import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { buildCreateRequest, buildUpdateRequest, type DrawForm } from '../lib/drawForm.ts';

/**
 * Salvamento automatico do assistente (DOC-01 §4: "o rascunho e salvo a cada passo").
 *
 * COMO FUNCIONA
 * -------------
 *   * DEBOUNCE: nada de requisicao a cada tecla. Depois de `DEBOUNCE_MS` sem digitar, um
 *     unico salvamento sai; trocar de passo ou sair da tela forca o salvamento na hora.
 *   * CRIACAO TARDIA: a API so cria sorteio com o minimo (titulo, um premio, preco, grade).
 *     Antes disso o rascunho vive NO NAVEGADOR (localStorage) e o estado e "local".
 *   * DEPOIS DE CRIADO: so PATCH — e a API so aceita PATCH em RASCUNHO. O envio deixa de fora
 *     o que ainda e invalido (a pessoa esta no meio de uma digitacao) sem apagar o que ja foi
 *     salvo.
 *   * SEM DUPLICIDADE: os salvamentos entram numa fila (um de cada vez) e o conteudo igual ao
 *     ultimo enviado nao e reenviado.
 *   * COPIA LOCAL: sempre. Se a rede cair ou a API recusar, nada do que foi digitado se perde.
 */
export const DEBOUNCE_MS = 1200;

export type SaveState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly at: Date; readonly skipped: readonly string[] }
  /** Ainda nao ha o minimo para criar no servidor; o que foi digitado esta guardado no navegador. */
  | { readonly kind: 'local' }
  | { readonly kind: 'error'; readonly message: string };

interface LocalRecord {
  readonly form: DrawForm;
  readonly dirty: boolean;
  readonly at: string;
}

const chaveLocal = (scope: string, id: string | null) => `clubedarifa:wizard:v1:${scope}:${id ?? 'novo'}`;

export function readLocal(scope: string, id: string | null): LocalRecord | null {
  try {
    const bruto = window.localStorage.getItem(chaveLocal(scope, id));
    return bruto ? (JSON.parse(bruto) as LocalRecord) : null;
  } catch {
    return null;
  }
}

function writeLocal(scope: string, id: string | null, record: LocalRecord): void {
  try {
    window.localStorage.setItem(chaveLocal(scope, id), JSON.stringify(record));
  } catch {
    /* armazenamento indisponivel: o salvamento no servidor continua valendo */
  }
}

export function clearLocal(scope: string, id: string | null): void {
  try {
    window.localStorage.removeItem(chaveLocal(scope, id));
  } catch {
    /* idem */
  }
}

function describe(falha: unknown): string {
  if (falha instanceof ApiClientError) {
    if (falha.status === 409) return falha.message;
    return falha.message;
  }
  return 'Sem conexão com o servidor. O que você digitou está guardado neste aparelho; tentaremos de novo.';
}

export interface AutosaveOptions {
  readonly form: DrawForm;
  /** Id do rascunho no servidor; nulo enquanto so existe no navegador. */
  readonly initialDraftId: string | null;
  /** Comunidade: separa as copias locais de uma comunidade para outra. */
  readonly scope: string;
  /** Desliga tudo (ex.: carregando, ou o sorteio nao esta mais em RASCUNHO). */
  readonly enabled: boolean;
  /** Chamado quando o servidor passa a ter o rascunho (a tela troca a URL, sem recarregar). */
  readonly onCreated: (id: string) => void;
}

export interface Autosave {
  readonly state: SaveState;
  readonly draftId: string | null;
  /** Salva AGORA e devolve o id do rascunho (nulo se ainda nao ha o minimo). */
  flush(): Promise<string | null>;
  /** Ha algo digitado esperando o debounce ou o envio. */
  readonly pending: boolean;
  /** Ha alteracoes que NAO estao no servidor (pendentes, ou a ultima tentativa falhou). */
  readonly unsaved: boolean;
}

export function useDrawAutosave(options: AutosaveOptions): Autosave {
  const { form, scope, enabled, onCreated } = options;
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const [draftId, setDraftId] = useState<string | null>(options.initialDraftId);
  const [pending, setPending] = useState(false);

  const formRef = useRef(form);
  // O formulario como chegou: enquanto nao muda, nao ha nada a "guardar" nem a dizer.
  const formInicial = useRef(JSON.stringify(form));
  const draftIdRef = useRef<string | null>(options.initialDraftId);
  // Rascunho que ja existe: o que foi carregado JA esta no servidor, entao nao e reenviado.
  const ultimoEnviado = useRef<string | null>(
    options.initialDraftId ? JSON.stringify(buildUpdateRequest(form).payload) : null,
  );
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;
  const primeira = useRef(true);

  formRef.current = form;

  const salvarUmaVez = useCallback(async (): Promise<string | null> => {
    const atual = formRef.current;
    const id = draftIdRef.current;

    try {
      if (!id) {
        const pedido = buildCreateRequest(atual);
        if (!pedido) {
          // Ainda sem o minimo: o que foi digitado esta no aparelho (copia local), nao ha o que "esperar".
          // Formulario intocado: nada foi digitado, entao nada a dizer.
          if (JSON.stringify(atual) !== formInicial.current) setState({ kind: 'local' });
          setPending(false);
          return null;
        }
        setState({ kind: 'saving' });
        const criado = await api.call('createDraw', pedido);
        draftIdRef.current = criado.id;
        setDraftId(criado.id);
        // O que acabou de ser criado e o que o PATCH enviaria: nao repete.
        ultimoEnviado.current = JSON.stringify(buildUpdateRequest(atual).payload);
        writeLocal(scope, criado.id, { form: atual, dirty: false, at: new Date().toISOString() });
        clearLocal(scope, null);
        onCreatedRef.current(criado.id);
        setState({ kind: 'saved', at: new Date(), skipped: [] });
        setPending(false);
        return criado.id;
      }

      const { payload, skipped } = buildUpdateRequest(atual);
      const hash = JSON.stringify(payload);
      if (hash === ultimoEnviado.current) {
        setState((s) => (s.kind === 'saved' ? { ...s, skipped } : { kind: 'saved', at: new Date(), skipped }));
        setPending(false);
        return id;
      }
      setState({ kind: 'saving' });
      await api.call('updateDraw', payload, { params: { id } });
      ultimoEnviado.current = hash;
      writeLocal(scope, id, { form: atual, dirty: false, at: new Date().toISOString() });
      setState({ kind: 'saved', at: new Date(), skipped });
      setPending(false);
      return id;
    } catch (falha) {
      setState({ kind: 'error', message: describe(falha) });
      // A tentativa terminou (com erro): a tela mostra o erro, nao "pendente". A copia local segue
      // marcada como nao salva, e o aviso de saida continua valendo (`unsaved`).
      setPending(false);
      return id;
    }
  }, [scope]);

  const flush = useCallback((): Promise<string | null> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const proxima = fila.current.then(salvarUmaVez, salvarUmaVez);
    fila.current = proxima;
    return proxima;
  }, [salvarUmaVez]);

  // Cada mudanca: copia local imediata + salvamento com debounce.
  useEffect(() => {
    if (!enabled) return;
    if (primeira.current) {
      // A primeira passagem e o estado carregado, nao uma edicao.
      primeira.current = false;
      return;
    }
    writeLocal(scope, draftIdRef.current, { form, dirty: true, at: new Date().toISOString() });
    setPending(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void flush();
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [form, enabled, scope, flush]);

  // Sair da tela: salva o que ficou pendente.
  useEffect(
    () => () => {
      if (formRef.current && enabled) void flush();
    },
    [enabled, flush],
  );

  const unsaved = pending || state.kind === 'error';

  // Fechar a aba com algo que nao esta no servidor: avisa.
  useEffect(() => {
    if (!unsaved) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, [unsaved]);

  return { state, draftId, flush, pending, unsaved };
}
