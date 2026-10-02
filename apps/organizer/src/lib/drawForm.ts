import {
  DEFAULT_PROGRESS_MODE,
  createDrawRequestSchema,
  drawReadinessProblems,
  updateDrawRequestSchema,
  type CreateDrawRequest,
  type DrawCloseMode,
  type GridSize,
  type NoWinnerPolicy,
  type OrganizerDraw,
  type ProgressMode,
  type UpdateDrawRequest,
} from '@clubedarifa/shared';

/**
 * Estado do assistente de criacao (DOC-01 §4) e sua traducao para o contrato.
 *
 * Tudo aqui e PURO: sem React, sem rede. O formulario guarda TEXTO (o que a pessoa
 * digita); os payloads saem daqui ja no formato do contrato. Assim a regra de "o que
 * pode ser salvo agora" tem teste proprio e a tela so a usa.
 */

export interface PrizeForm {
  /** Chave estavel de lista (nao e a posicao: reordenar nao pode remontar o campo). */
  readonly key: string;
  name: string;
  description: string;
  imageUrl: string;
  /** Valor estimado em reais, como digitado ("2.500,00"). */
  value: string;
}

export interface DrawForm {
  title: string;
  subtitle: string;
  category: string;
  description: string;
  prizes: PrizeForm[];
  totalNumbers: GridSize;
  price: string;
  promoPrice: string;
  /** `datetime-local` ("2030-01-31T20:00"), no fuso de quem cadastra. */
  promoUntil: string;
  salesStartAt: string;
  closeMode: DrawCloseMode;
  closeAt: string;
  drawDate: string;
  noWinnerPolicy: NoWinnerPolicy;
  /** "25, 10" */
  thresholds: string;
  progressMode: ProgressMode;
  headline: string;
  ctaLabel: string;
  regulation: string;
}

let sequencia = 0;
export const novaChave = (): string => `p${Date.now().toString(36)}${(sequencia += 1)}`;

export const emptyPrize = (): PrizeForm => ({ key: novaChave(), name: '', description: '', imageUrl: '', value: '' });

export function emptyForm(): DrawForm {
  return {
    title: '',
    subtitle: '',
    category: '',
    description: '',
    prizes: [emptyPrize()],
    totalNumbers: 100,
    price: '',
    promoPrice: '',
    promoUntil: '',
    salesStartAt: '',
    closeMode: 'AO_ESGOTAR',
    closeAt: '',
    drawDate: '',
    noWinnerPolicy: 'PROXIMO_VENDIDO_ACIMA',
    thresholds: '25, 10',
    progressMode: DEFAULT_PROGRESS_MODE,
    headline: '',
    ctaLabel: '',
    regulation: '',
  };
}

// ---------------------------------------------------------------------------
// Conversoes de campo
// ---------------------------------------------------------------------------

/** "15,00" | "15.00" | "1.500,50" | "15" -> centavos. Null se nao for um valor util (> 0). */
export function parseMoneyToCents(texto: string): number | null {
  const bruto = texto.trim().replace(/\s/g, '');
  if (bruto === '') return null;
  // Com virgula, o ponto e separador de milhar; sem virgula, o ponto e decimal.
  const limpo = bruto.includes(',') ? bruto.replace(/\./g, '').replace(',', '.') : bruto;
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  // `Math.round`: 19.99 * 100 = 1998.9999999999998 em ponto flutuante.
  return Math.round(valor * 100);
}

export function centsToMoneyText(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** ISO (UTC) -> valor de `datetime-local` no fuso do navegador. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** `datetime-local` -> ISO (UTC). Undefined se vazio ou invalido. */
export function localInputToIso(valor: string): string | undefined {
  if (valor.trim() === '') return undefined;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** "25, 10" -> [25, 10]. Null se nao for uma lista valida (1 a 5, 1..99, decrescente). */
export function parseThresholds(texto: string): number[] | null {
  const partes = texto
    .split(/[,;\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length < 1 || partes.length > 5) return null;
  const numeros = partes.map(Number);
  if (numeros.some((n) => !Number.isInteger(n) || n < 1 || n > 99)) return null;
  if (numeros.some((n, i) => i > 0 && n >= numeros[i - 1]!)) return null;
  return numeros;
}

// ---------------------------------------------------------------------------
// Do servidor para o formulario (continuar rascunho / duplicar)
// ---------------------------------------------------------------------------

export function formFromDraw(draw: OrganizerDraw, options: { duplicate?: boolean } = {}): DrawForm {
  const duplicando = options.duplicate === true;
  return {
    title: duplicando ? `${draw.title} (cópia)` : draw.title,
    subtitle: draw.subtitle ?? '',
    category: draw.category ?? '',
    description: draw.description ?? '',
    prizes:
      draw.prizes.length > 0
        ? draw.prizes.map((p) => ({
            key: novaChave(),
            name: p.name,
            description: p.description ?? '',
            imageUrl: p.imageUrl ?? '',
            value: centsToMoneyText(p.estimatedValueCents),
          }))
        : [emptyPrize()],
    totalNumbers: draw.totalNumbers as GridSize,
    price: centsToMoneyText(draw.ticketPriceCents),
    // Duplicar copia "tudo menos numeros vendidos, datas e resultado" (DOC-01 §4): promocao
    // vence e datas ficam vazias.
    promoPrice: duplicando ? '' : centsToMoneyText(draw.configuredPromotionalPriceCents),
    promoUntil: duplicando ? '' : isoToLocalInput(draw.configuredPromoUntil),
    salesStartAt: duplicando ? '' : isoToLocalInput(draw.salesStartAt),
    closeMode: draw.closeMode,
    closeAt: duplicando ? '' : isoToLocalInput(draw.closeAt),
    drawDate: duplicando ? '' : isoToLocalInput(draw.drawDate),
    noWinnerPolicy: draw.noWinnerPolicy,
    thresholds: draw.thresholds.join(', '),
    progressMode: draw.customization.progressMode,
    headline: draw.customization.headline ?? '',
    ctaLabel: draw.customization.ctaLabel ?? '',
    regulation: draw.regulation ?? '',
  };
}

// ---------------------------------------------------------------------------
// Do formulario para o contrato
// ---------------------------------------------------------------------------

const texto = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());

/** Premios com conteudo; a linha em branco que a pessoa acabou de adicionar nao conta. */
export function filledPrizes(form: DrawForm): PrizeForm[] {
  return form.prizes.filter((p) => [p.name, p.description, p.imageUrl, p.value].some((v) => v.trim() !== ''));
}

function prizePayload(form: DrawForm): CreateDrawRequest['prizes'] | null {
  const preenchidos = filledPrizes(form);
  if (preenchidos.length === 0) return null;
  const saida: CreateDrawRequest['prizes'] = [];
  for (const p of preenchidos) {
    if (p.name.trim().length < 2) return null;
    const valor = p.value.trim() === '' ? undefined : parseMoneyToCents(p.value);
    if (p.value.trim() !== '' && valor === null) return null;
    saida.push({
      name: p.name.trim(),
      ...(texto(p.description) ? { description: texto(p.description)! } : {}),
      ...(texto(p.imageUrl) ? { imageUrl: texto(p.imageUrl)! } : {}),
      ...(valor ? { estimatedValueCents: valor } : {}),
    });
  }
  return saida;
}

function customizationPayload(form: DrawForm) {
  const c = {
    ...(form.progressMode !== DEFAULT_PROGRESS_MODE ? { progressMode: form.progressMode } : {}),
    ...(texto(form.headline) ? { headline: texto(form.headline)! } : {}),
    ...(texto(form.ctaLabel) ? { ctaLabel: texto(form.ctaLabel)! } : {}),
  };
  return c;
}

/**
 * O MINIMO para existir no servidor: titulo, um premio com nome, preco e grade. Sem isso
 * o rascunho vive so no navegador (a API nao cria sorteio pela metade).
 */
export function buildCreateRequest(form: DrawForm): CreateDrawRequest | null {
  const prizes = prizePayload(form);
  const preco = parseMoneyToCents(form.price);
  if (form.title.trim().length < 3 || !prizes || preco === null) return null;

  const promo = parseMoneyToCents(form.promoPrice);
  const promoAte = localInputToIso(form.promoUntil);
  const thresholds = parseThresholds(form.thresholds);
  const customization = customizationPayload(form);

  const candidato = {
    title: form.title.trim(),
    prizes,
    ticketPriceCents: preco,
    totalNumbers: form.totalNumbers,
    closeMode: form.closeMode,
    noWinnerPolicy: form.noWinnerPolicy,
    ...(texto(form.subtitle) ? { subtitle: texto(form.subtitle)! } : {}),
    ...(texto(form.category) ? { category: texto(form.category)! } : {}),
    ...(texto(form.description) ? { description: texto(form.description)! } : {}),
    ...(texto(form.regulation) ? { regulation: form.regulation.trim() } : {}),
    ...(Object.keys(customization).length > 0 ? { customization } : {}),
    ...(promo !== null && promoAte ? { promotionalPriceCents: promo, promoUntil: promoAte } : {}),
    ...(localInputToIso(form.salesStartAt) ? { salesStartAt: localInputToIso(form.salesStartAt)! } : {}),
    ...(localInputToIso(form.closeAt) ? { closeAt: localInputToIso(form.closeAt)! } : {}),
    ...(localInputToIso(form.drawDate) ? { drawDate: localInputToIso(form.drawDate)! } : {}),
    ...(thresholds ? { thresholds } : {}),
  };

  // Combinacao invalida entre campos (ex.: fechamento depois do sorteio): nao cria ainda.
  // O erro aparece na tela do passo; o rascunho local continua guardado.
  const r = createDrawRequestSchema.safeParse(candidato);
  return r.success ? r.data : null;
}

export interface UpdatePayload {
  readonly payload: UpdateDrawRequest;
  /** Campos que ainda nao sao validos e, por isso, NAO foram enviados. */
  readonly skipped: readonly string[];
}

/**
 * O que enviar no PATCH do rascunho. Limpa com `null` o que a pessoa esvaziou, e deixa
 * de fora (sem apagar o valor ja salvo) o que ainda e invalido — enquanto alguem digita
 * "Ma" num titulo de 3 letras, o servidor continua com o titulo anterior.
 */
export function buildUpdateRequest(form: DrawForm): UpdatePayload {
  const skipped: string[] = [];
  const payload: Record<string, unknown> = {};

  const campo = (chave: string, valor: unknown) => {
    payload[chave] = valor;
  };

  campo('title', form.title.trim());
  campo('subtitle', texto(form.subtitle) ?? null);
  campo('category', texto(form.category) ?? null);
  campo('description', texto(form.description) ?? null);
  campo('regulation', texto(form.regulation) ? form.regulation.trim() : null);
  campo('totalNumbers', form.totalNumbers);
  campo('closeMode', form.closeMode);
  campo('noWinnerPolicy', form.noWinnerPolicy);

  const preco = parseMoneyToCents(form.price);
  if (preco !== null) campo('ticketPriceCents', preco);
  else skipped.push('ticketPriceCents');

  const promo = parseMoneyToCents(form.promoPrice);
  const promoAte = localInputToIso(form.promoUntil);
  if (promo !== null && promoAte) {
    campo('promotionalPriceCents', promo);
    campo('promoUntil', promoAte);
  } else if (form.promoPrice.trim() === '' && form.promoUntil.trim() === '') {
    campo('promotionalPriceCents', null);
    campo('promoUntil', null);
  } else {
    skipped.push('promotionalPriceCents');
  }

  campo('salesStartAt', localInputToIso(form.salesStartAt) ?? null);
  campo('closeAt', localInputToIso(form.closeAt) ?? null);
  campo('drawDate', localInputToIso(form.drawDate) ?? null);

  const thresholds = parseThresholds(form.thresholds);
  if (thresholds) campo('thresholds', thresholds);
  else skipped.push('thresholds');

  const prizes = prizePayload(form);
  if (prizes) campo('prizes', prizes);
  else skipped.push('prizes');

  const customization = customizationPayload(form);
  campo('customization', Object.keys(customization).length > 0 ? customization : null);

  // Rede de seguranca: o que o esquema do contrato recusar sai do envio e fica anotado.
  let candidato = payload;
  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    const r = updateDrawRequestSchema.safeParse(candidato);
    if (r.success) return { payload: r.data, skipped };
    const chaves = new Set(r.error.issues.map((i) => String(i.path[0] ?? '')));
    candidato = Object.fromEntries(Object.entries(candidato).filter(([k]) => !chaves.has(k)));
    for (const k of chaves) if (k && !skipped.includes(k)) skipped.push(k);
  }
  return { payload: {}, skipped };
}

// ---------------------------------------------------------------------------
// Validacao por passo e checklist de envio
// ---------------------------------------------------------------------------

export const STEP_TITLES = [
  'Informações básicas',
  'Prêmios',
  'Grade de números',
  'Preço',
  'Cronograma',
  'Personalização',
  'Regulamento',
  'Automações',
  'Revisão',
] as const;
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const MIN_REGULATION = 50;

export interface StepProblem {
  readonly field: string;
  readonly message: string;
}

/** Problemas BLOQUEANTES de cada passo (o que impediria o envio a revisao). */
export function stepProblems(step: StepIndex, form: DrawForm): StepProblem[] {
  const p: StepProblem[] = [];
  switch (step) {
    case 0:
      if (form.title.trim().length < 3) p.push({ field: 'title', message: 'O título precisa ter pelo menos 3 caracteres.' });
      if (form.subtitle.trim().length > 160) p.push({ field: 'subtitle', message: 'O subtítulo tem no máximo 160 caracteres.' });
      if (form.category.trim().length > 40) p.push({ field: 'category', message: 'A categoria tem no máximo 40 caracteres.' });
      break;
    case 1: {
      const preenchidos = filledPrizes(form);
      if (preenchidos.length === 0) p.push({ field: 'prize-0-name', message: 'Cadastre ao menos um prêmio.' });
      form.prizes.forEach((pr, i) => {
        if (!filledPrizes(form).includes(pr)) return;
        if (pr.name.trim().length < 2) p.push({ field: `prize-${i}-name`, message: 'Informe o nome do prêmio.' });
        if (pr.imageUrl.trim() !== '' && !pr.imageUrl.trim().toLowerCase().startsWith('https://')) {
          p.push({ field: `prize-${i}-image`, message: 'O endereço da foto precisa começar com https://.' });
        }
        if (pr.value.trim() !== '' && parseMoneyToCents(pr.value) === null) {
          p.push({ field: `prize-${i}-value`, message: 'Use um valor como 2.500,00.' });
        }
      });
      break;
    }
    case 3: {
      if (parseMoneyToCents(form.price) === null) p.push({ field: 'price', message: 'Informe um valor maior que zero, como 15,00.' });
      const cheio = parseMoneyToCents(form.price);
      const promo = parseMoneyToCents(form.promoPrice);
      if ((form.promoPrice.trim() !== '') !== (form.promoUntil.trim() !== '')) {
        p.push({ field: 'promoPrice', message: 'O preço promocional e o prazo da promoção são informados juntos.' });
      } else if (form.promoPrice.trim() !== '' && promo === null) {
        p.push({ field: 'promoPrice', message: 'Informe um valor promocional válido.' });
      } else if (promo !== null && cheio !== null && promo >= cheio) {
        p.push({ field: 'promoPrice', message: 'O preço promocional precisa ser menor que o preço cheio.' });
      }
      break;
    }
    case 4:
      if (form.closeMode !== 'AO_ESGOTAR' && !localInputToIso(form.closeAt)) {
        p.push({ field: 'closeAt', message: 'Este modo de fechamento exige a data de fechamento das vendas.' });
      }
      if (!localInputToIso(form.drawDate)) p.push({ field: 'drawDate', message: 'Defina a data do sorteio.' });
      break;
    case 6:
      if (form.regulation.trim().length < MIN_REGULATION) {
        p.push({ field: 'regulation', message: `O regulamento precisa ter pelo menos ${MIN_REGULATION} caracteres.` });
      }
      break;
    case 7:
      if (parseThresholds(form.thresholds) === null) {
        p.push({ field: 'thresholds', message: 'Use de 1 a 5 valores entre 1 e 99, em ordem decrescente, como 25, 10.' });
      }
      break;
    default:
      break;
  }
  return p;
}

/** Erros de FORMATO que o contrato compartilhado nao cobre (a API os recusa na gravacao). */
const SO_DE_FORMATO = /^(prize-\d+-(image|value)|thresholds|subtitle|category)$/;

/**
 * O checklist do passo 9: os MESMOS criterios que a API aplica no envio (funcao compartilhada)
 * mais os erros de formato que impedem a gravacao. Cada problema aparece uma unica vez, com a
 * redacao do contrato.
 */
export function submissionProblems(form: DrawForm): string[] {
  const doContrato = drawReadinessProblems({
    title: form.title,
    regulation: form.regulation,
    prizes: filledPrizes(form).map((p) => ({ name: p.name })),
    ticketPriceCents: parseMoneyToCents(form.price),
    promotionalPriceCents: parseMoneyToCents(form.promoPrice),
    promoUntil: localInputToIso(form.promoUntil),
    salesStartAt: localInputToIso(form.salesStartAt),
    closeAt: localInputToIso(form.closeAt),
    drawDate: localInputToIso(form.drawDate),
    closeMode: form.closeMode,
  });
  const deFormato = ([0, 1, 3, 4, 6, 7] as const).flatMap((s) =>
    stepProblems(s, form)
      .filter((p) => SO_DE_FORMATO.test(p.field))
      .map((p) => p.message),
  );
  return [...new Set([...doContrato, ...deFormato])];
}

/** Modelo de regulamento (editavel). Nao e texto juridico: o organizador revisa e a plataforma aprova. */
export const MODELO_REGULAMENTO = `REGULAMENTO DO SORTEIO

1. Participação. Participa quem adquirir um ou mais números, com pagamento confirmado, durante o período de vendas.

2. Números. Cada número pago é único e vinculado ao comprador. Reservas valem por 30 minutos e expiram sozinhas se o pagamento não for confirmado.

3. Apuração. O resultado segue a extração da Loteria Federal do dia indicado no sorteio. O número contemplado é calculado conforme a grade escolhida; se o número calculado não tiver sido vendido, aplica-se a regra indicada neste sorteio.

4. Prova. O resultado é publicado com o número da fonte oficial, a evidência e um código de verificação (hash) que qualquer pessoa pode conferir.

5. Entrega. O prêmio é entregue ao contemplado após a confirmação da identidade, e a entrega é registrada nesta página.

6. Cancelamento. Em caso de cancelamento do sorteio, todos os valores pagos são devolvidos.`;
