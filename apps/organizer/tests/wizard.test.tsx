import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, type OrganizerDraw } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({
  call: vi.fn(),
  permissions: new Set<string>(),
}));

vi.mock('../src/api.ts', () => ({ api: { call: h.call }, apiBaseUrl: 'https://api.test' }));
vi.mock('../src/state/SessionProvider.tsx', () => ({
  useSession: () => ({
    can: (p: string) => h.permissions.has(p),
    tenant: { tenantId: 'tenant-1', name: 'Clube', roles: ['OWNER'] },
  }),
}));
vi.mock('../src/components/EntitlementSummary.tsx', () => ({ EntitlementSummary: () => null }));

import { DEBOUNCE_MS } from '../src/hooks/useDrawAutosave.ts';
import { DrawWizardPage } from '../src/pages/DrawWizardPage.tsx';

/**
 * Assistente de 9 passos + salvamento automatico (DOC-01 §4).
 *
 * O tempo e controlado (timers falsos): "digitar" e "esperar o debounce" sao passos explicitos,
 * e o que se prova e QUANTAS requisicoes saem e com que corpo.
 */

const ID = '11111111-1111-4111-8111-111111111111';
const REGULAMENTO = 'Regulamento do sorteio de teste: participam todos os números pagos e o resultado segue a Loteria Federal.';
const CHAVE_LOCAL = 'clubedarifa:wizard:v1:tenant-1:novo';

const sorteio = (extra: Partial<OrganizerDraw> = {}): OrganizerDraw =>
  ({
    id: ID,
    slug: 'rifa-1',
    title: 'Rifa do Natal',
    subtitle: null,
    description: null,
    prizeName: 'Moto',
    prizeImageUrl: null,
    unitPriceCents: 1500,
    ticketPriceCents: 1500,
    promotionalPriceCents: null,
    promoUntil: null,
    promoActive: false,
    totalNumbers: 100,
    labelDigits: 2,
    status: 'RASCUNHO',
    drawDate: '2030-01-10T20:00:00.000Z',
    paidCount: 0,
    prizeDescription: null,
    category: null,
    regulation: REGULAMENTO,
    customization: { progressMode: 'FALTAM', headline: null, ctaLabel: null },
    prizes: [{ position: 1, name: 'Moto', description: null, imageUrl: null, estimatedValueCents: null }],
    closeMode: 'AO_ESGOTAR',
    closeAt: null,
    salesStartAt: null,
    resultSource: 'LOTERIA_FEDERAL',
    noWinnerPolicy: 'PROXIMO_VENDIDO_ACIMA',
    takenCount: 0,
    reservedCount: 0,
    pendingCount: 0,
    revenueCents: 0,
    createdAt: '2029-12-01T00:00:00.000Z',
    thresholds: [25, 10],
    configuredPromotionalPriceCents: null,
    configuredPromoUntil: null,
    reviewNote: null,
    snapshot: null,
    ...extra,
  }) as OrganizerDraw;

/** Respostas da API falsa: cada nome devolve o que o teste configurou. */
const respostas: Record<string, (body?: unknown, opts?: { params?: Record<string, string> }) => unknown> = {};

function Local() {
  const l = useLocation();
  return <output data-testid="local">{`${l.pathname}${l.search}`}</output>;
}

function abrir(url = '/sorteios/novo') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/sorteios/novo" element={<DrawWizardPage />} />
        <Route path="/sorteios/:id/editar" element={<DrawWizardPage />} />
        <Route path="/sorteios/:id" element={<p>Detalhe do sorteio</p>} />
        <Route path="/sorteios" element={<p>Lista</p>} />
      </Routes>
      <Local />
    </MemoryRouter>,
  );
}

const chamadas = (nome: string) => h.call.mock.calls.filter((c) => c[0] === nome);

/** Digita num campo (pelo rotulo) e deixa o React assentar. */
async function digitar(rotulo: RegExp | string, valor: string) {
  const campo = screen.getByLabelText(rotulo);
  fireEvent.change(campo, { target: { value: valor } });
}

/** Espera o debounce passar e as promessas assentarem. */
async function passarDebounce(extra = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50 + extra);
  });
}

const proximo = () => fireEvent.click(screen.getByRole('button', { name: /Próximo/ }));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: false });
  window.localStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.history.replaceState(null, '', '/');
  h.permissions = new Set(['draw:write', 'draw:lifecycle:write', 'payment_account:read']);
  h.call.mockReset();
  for (const k of Object.keys(respostas)) delete respostas[k];
  respostas['createDraw'] = () => sorteio();
  respostas['updateDraw'] = () => sorteio();
  respostas['organizerDraw'] = () => sorteio();
  respostas['organizerDraws'] = () => ({ draws: [], nextCursor: null });
  respostas['updateDrawStatus'] = () => sorteio({ status: 'REVISÃO COMPLIANCE' });
  respostas['tenantPaymentAccounts'] = () => ({ enabled: true, accounts: [], checkoutAvailable: true });
  h.call.mockImplementation(async (nome: string, body?: unknown, opts?: { params?: Record<string, string> }) => {
    const r = respostas[nome];
    if (!r) throw new Error(`chamada inesperada: ${nome}`);
    return r(body, opts);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
describe('salvamento automatico', () => {
  it('antes do minimo NADA vai ao servidor: o rascunho fica no aparelho, e a tela diz isso', async () => {
    abrir();
    await digitar(/Título do sorteio/, 'Rifa do Natal');
    await passarDebounce();

    expect(chamadas('createDraw')).toHaveLength(0);
    expect(screen.getByText(/Guardado neste aparelho/)).toBeInTheDocument();
    const guardado = JSON.parse(window.localStorage.getItem(CHAVE_LOCAL)!);
    expect(guardado.form.title).toBe('Rifa do Natal');
    expect(guardado.dirty).toBe(true);
  });

  it('formulario intocado: nenhuma mensagem de "guardado" e nenhuma requisicao', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Prêmios/ }));
    await passarDebounce(2000);
    expect(screen.queryByText(/Guardado neste aparelho/)).toBeNull();
    expect(h.call).not.toHaveBeenCalledWith('createDraw', expect.anything());
    expect(screen.getByText('As alterações são salvas automaticamente.')).toBeInTheDocument();
  });

  it('digitar rapido gera UMA requisicao so (debounce), nao uma por tecla', async () => {
    abrir();
    await digitar(/Título do sorteio/, 'Rifa do Natal');
    proximo(); // passo 2: premios
    await digitar(/Nome do prêmio/, 'Moto');
    // vai ao passo 4 (preco) pelo indicador de passos
    fireEvent.click(screen.getByRole('button', { name: /Preço/ }));
    for (const v of ['1', '15', '15,', '15,0', '15,00']) await digitar(/Valor por número/, v);
    await passarDebounce();

    expect(chamadas('createDraw')).toHaveLength(1);
    expect(chamadas('createDraw')[0]![1]).toMatchObject({
      title: 'Rifa do Natal',
      ticketPriceCents: 1500,
      totalNumbers: 100,
      prizes: [{ name: 'Moto' }],
    });
    expect(screen.getByText(/Salvo às/)).toBeInTheDocument();
  });

  it('depois de criado: so PATCH (nunca uma segunda criacao), e a URL passa a apontar para o rascunho', async () => {
    abrir();
    await digitar(/Título do sorteio/, 'Rifa do Natal');
    fireEvent.click(screen.getByRole('button', { name: /Prêmios/ }));
    await digitar(/Nome do prêmio/, 'Moto');
    fireEvent.click(screen.getByRole('button', { name: /Preço/ }));
    await digitar(/Valor por número/, '15,00');
    await passarDebounce();
    expect(chamadas('createDraw')).toHaveLength(1);
    expect(window.location.pathname).toBe(`/sorteios/${ID}/editar`);

    await digitar(/Preço promocional/, '10,00');
    await digitar(/A promoção vale até/, '2030-01-05T10:00');
    await passarDebounce();

    expect(chamadas('createDraw')).toHaveLength(1);
    expect(chamadas('updateDraw')).toHaveLength(1);
    expect(chamadas('updateDraw')[0]![2]).toMatchObject({ params: { id: ID } });
    expect(chamadas('updateDraw')[0]![1]).toMatchObject({ promotionalPriceCents: 1000, ticketPriceCents: 1500 });
  });

  it('o que ainda esta invalido NAO e enviado e a tela avisa; o resto salva', async () => {
    abrir();
    await digitar(/Título do sorteio/, 'Rifa do Natal');
    fireEvent.click(screen.getByRole('button', { name: /Prêmios/ }));
    await digitar(/Nome do prêmio/, 'Moto');
    fireEvent.click(screen.getByRole('button', { name: /Preço/ }));
    await digitar(/Valor por número/, '15,00');
    await passarDebounce();

    fireEvent.click(screen.getByRole('button', { name: /Informações básicas/ }));
    await digitar(/Título do sorteio/, 'Ab'); // invalido no meio da digitacao
    await passarDebounce();

    const ultimo = chamadas('updateDraw').at(-1)?.[1] as Record<string, unknown> | undefined;
    // Nada mudou no corpo (o titulo curto saiu e o resto e igual): nao ha motivo para enviar.
    expect(ultimo === undefined || !('title' in ultimo)).toBe(true);
    expect(screen.getByText(/Alguns campos ainda estão incompletos/)).toBeInTheDocument();
  });

  it('falha do servidor: mostra o erro, mantem a copia local e tenta de novo na proxima alteracao', async () => {
    respostas['createDraw'] = () => {
      throw new ApiClientError({ code: 'INTERNAL', message: 'Erro interno. Tente novamente em instantes.', status: 500 });
    };
    abrir();
    await digitar(/Título do sorteio/, 'Rifa do Natal');
    fireEvent.click(screen.getByRole('button', { name: /Prêmios/ }));
    await digitar(/Nome do prêmio/, 'Moto');
    fireEvent.click(screen.getByRole('button', { name: /Preço/ }));
    await digitar(/Valor por número/, '15,00');
    await passarDebounce();

    expect(screen.getByText('Erro interno. Tente novamente em instantes.')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(CHAVE_LOCAL)!).form.title).toBe('Rifa do Natal');

    respostas['createDraw'] = () => sorteio();
    await digitar(/Valor por número/, '16,00');
    await passarDebounce();
    // A nova tentativa leva o valor MAIS RECENTE (a anterior falhou e nao foi dada como salva).
    expect((chamadas('createDraw').at(-1)![1] as { ticketPriceCents: number }).ticketPriceCents).toBe(1600);
    expect(screen.getByText(/Salvo às/)).toBeInTheDocument();
  });

  it('sair e voltar: o que estava no aparelho volta, com aviso', async () => {
    window.localStorage.setItem(
      CHAVE_LOCAL,
      JSON.stringify({ dirty: true, at: new Date().toISOString(), form: { ...formVazio(), title: 'Rifa guardada' } }),
    );
    abrir();
    expect(screen.getByLabelText(/Título do sorteio/)).toHaveValue('Rifa guardada');
    expect(screen.getByText(/Recuperamos o que você estava preenchendo/)).toBeInTheDocument();
  });
});

function formVazio() {
  return {
    title: '',
    subtitle: '',
    category: '',
    description: '',
    prizes: [{ key: 'k1', name: '', description: '', imageUrl: '', value: '' }],
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
    progressMode: 'FALTAM',
    headline: '',
    ctaLabel: '',
    regulation: '',
  };
}

// ---------------------------------------------------------------------------
describe('continuar e duplicar', () => {
  it('continuar um rascunho: carrega do servidor e NAO reenvia o que nao mudou', async () => {
    abrir(`/sorteios/${ID}/editar`);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByLabelText(/Título do sorteio/)).toHaveValue('Rifa do Natal');
    await passarDebounce(2000);
    expect(chamadas('updateDraw')).toHaveLength(0);
    expect(chamadas('createDraw')).toHaveLength(0);

    await digitar(/Subtítulo/, 'Uma moto zero');
    await passarDebounce();
    expect(chamadas('updateDraw')).toHaveLength(1);
    expect(chamadas('updateDraw')[0]![1]).toMatchObject({ subtitle: 'Uma moto zero' });
  });

  it('so rascunho se edita: outro estado mostra a orientacao e o caminho para o sorteio', async () => {
    respostas['organizerDraw'] = () => sorteio({ status: 'ATIVA' });
    abrir(`/sorteios/${ID}/editar`);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Este sorteio não está mais em rascunho')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Título do sorteio/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Abrir o sorteio' })).toHaveAttribute('href', `/sorteios/${ID}`);
  });

  it('duplicar: copia o conteudo (titulo "(cópia)") sem datas, e cria um sorteio NOVO', async () => {
    respostas['organizerDraw'] = () =>
      sorteio({ title: 'Rifa antiga', status: 'ATIVA', drawDate: '2030-01-10T20:00:00.000Z', closeAt: '2030-01-09T20:00:00.000Z', closeMode: 'POR_DATA' });
    abrir(`/sorteios/novo?duplicar=${ID}`);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByLabelText(/Título do sorteio/)).toHaveValue('Rifa antiga (cópia)');
    expect(screen.getByText(/Cópia de um sorteio anterior/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cronograma/ }));
    expect(screen.getByLabelText(/Data do sorteio/)).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: /Informações básicas/ }));
    await digitar(/Subtítulo/, 'Edicao 2');
    await passarDebounce();
    expect(chamadas('createDraw')).toHaveLength(1);
    expect(chamadas('createDraw')[0]![1]).toMatchObject({ title: 'Rifa antiga (cópia)', subtitle: 'Edicao 2' });
    expect(chamadas('createDraw')[0]![1]).not.toHaveProperty('drawDate');
  });

  it('"começar de um sorteio anterior" aparece no passo 1 e preenche o formulario', async () => {
    respostas['organizerDraws'] = () => ({ draws: [sorteio({ title: 'Rifa de ontem' })], nextCursor: null });
    abrir();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.change(screen.getByLabelText(/Começar a partir de um sorteio anterior/), { target: { value: ID } });
    expect(screen.getByLabelText(/Título do sorteio/)).toHaveValue('Rifa de ontem (cópia)');
  });
});

// ---------------------------------------------------------------------------
describe('passos', () => {
  it('premios: varios, em ordem; adicionar, mover e remover', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Prêmios/ }));
    await digitar(/Nome do prêmio/, 'Carro');
    fireEvent.click(screen.getByRole('button', { name: /Adicionar prêmio/ }));
    const nomes = screen.getAllByLabelText(/Nome do prêmio/);
    expect(nomes).toHaveLength(2);
    fireEvent.change(nomes[1]!, { target: { value: 'Moto' } });

    // mover o 2º para cima: Moto passa a ser o 1º
    fireEvent.click(screen.getByRole('button', { name: 'Mover o 2º prêmio para cima' }));
    expect(screen.getAllByLabelText(/Nome do prêmio/).map((i) => (i as HTMLInputElement).value)).toEqual(['Moto', 'Carro']);
    expect(screen.getByText(/Principal · capa/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remover o 2º prêmio' }));
    expect(screen.getAllByLabelText(/Nome do prêmio/)).toHaveLength(1);
    // remover o ultimo premio deixa uma linha em branco (nunca zero)
    fireEvent.click(screen.getByRole('button', { name: 'Remover o 1º prêmio' }));
    expect(screen.getAllByLabelText(/Nome do prêmio/)).toHaveLength(1);
    expect(screen.getByLabelText(/Nome do prêmio/)).toHaveValue('');
  });

  it('ordem dos premios chega ao servidor, com valor estimado', async () => {
    abrir();
    await digitar(/Título do sorteio/, 'Rifa do Natal');
    fireEvent.click(screen.getByRole('button', { name: /Prêmios/ }));
    await digitar(/Nome do prêmio/, 'Carro');
    fireEvent.click(screen.getByRole('button', { name: /Adicionar prêmio/ }));
    const nomes = screen.getAllByLabelText(/Nome do prêmio/);
    fireEvent.change(nomes[1]!, { target: { value: 'Moto' } });
    fireEvent.change(screen.getAllByLabelText(/Valor estimado/)[1]!, { target: { value: '2.500,00' } });
    fireEvent.click(screen.getByRole('button', { name: /Preço/ }));
    await digitar(/Valor por número/, '15,00');
    await passarDebounce();
    expect(chamadas('createDraw')[0]![1]).toMatchObject({
      prizes: [{ name: 'Carro' }, { name: 'Moto', estimatedValueCents: 250000 }],
    });
  });

  it('grade: 100, 500 e 1000 com a faixa real dos rotulos', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Grade de números/ }));
    const grupo = screen.getByRole('radiogroup');
    expect(within(grupo).getByText('00 – 99')).toBeInTheDocument();
    expect(within(grupo).getByText('000 – 499')).toBeInTheDocument();
    expect(within(grupo).getByText('000 – 999')).toBeInTheDocument();
    fireEvent.click(within(grupo).getAllByRole('radio')[2]!);
    expect(screen.getByLabelText(/Primeiros números da grade de 1000/)).toHaveTextContent('000');
  });

  it('foto do premio e enviada (sem campo de link tecnico); o que ainda nao existe aparece como futuro, sem campos falsos', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Prêmios/ }));
    expect(screen.getByRole('button', { name: 'Escolher imagem' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Endereço da foto/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Preço/ }));
    expect(screen.getByLabelText(/Mínimo de números por pedido/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Máximo de números por pedido/)).toBeInTheDocument();
    expect(screen.getByText(/Pacotes de números/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Automações/ }));
    expect(screen.getByText(/Clientes cativos e pré-autorização/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/cativ/i)).toBeNull();
  });

  it('personalizacao: progresso, chamada, botao, banner, cor, contador e compradores', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Personalização/ }));
    expect(screen.getByRole('radio', { name: /Mostrar “faltam X”/ })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: /Ocultar o progresso/ }));
    await digitar(/Chamada principal/, 'Corra!');
    await digitar(/Texto do botão de compra/, 'Quero!');
    expect(screen.getByRole('radio', { name: /Ocultar o progresso/ })).toBeChecked();
    expect(screen.getByLabelText(/Cor de destaque/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escolher imagem' })).toBeInTheDocument();
    expect(screen.getByLabelText(/contador regressivo/i)).not.toBeChecked();
    expect(screen.getByLabelText(/Mostrar quem já comprou/)).not.toBeChecked();
    fireEvent.click(screen.getByLabelText(/Mostrar quem já comprou/));
    expect(screen.getByLabelText(/Mostrar quem já comprou/)).toBeChecked();
  });

  it('regulamento: o modelo preenche o vazio e pede confirmacao antes de substituir um texto', async () => {
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Regulamento/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Usar o modelo de regulamento' }));
    const campo = screen.getByLabelText(/Regulamento do sorteio/) as HTMLTextAreaElement;
    expect(campo.value).toMatch(/^REGULAMENTO DO SORTEIO/);

    await digitar(/Regulamento do sorteio/, 'Meu texto próprio');
    fireEvent.click(screen.getByRole('button', { name: 'Usar o modelo de regulamento' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manter meu texto' }));
    expect((screen.getByLabelText(/Regulamento do sorteio/) as HTMLTextAreaElement).value).toBe('Meu texto próprio');
  });

  it('erros de um passo so aparecem depois de sair dele, e o indicador marca a pendencia', async () => {
    abrir();
    expect(screen.queryByText(/pelo menos 3 caracteres/)).toBeNull();
    proximo();
    fireEvent.click(screen.getByRole('button', { name: /Informações básicas/ }));
    expect(screen.getByText('O título precisa ter pelo menos 3 caracteres.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Informações básicas.*há pendências/s })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe('revisao e envio', () => {
  const formCompleto = () => ({
    ...formVazio(),
    title: 'Rifa do Natal',
    prizes: [{ key: 'k1', name: 'Moto', description: '', imageUrl: '', value: '' }],
    price: '15,00',
    drawDate: '2030-01-10T20:00',
    regulation: REGULAMENTO,
    headline: 'Corra, restam poucos!',
    ctaLabel: 'Quero meus números',
  });

  function abrirNaRevisao(form = formCompleto()) {
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ dirty: true, at: new Date().toISOString(), form }));
    abrir();
    fireEvent.click(screen.getByRole('button', { name: /Revisão/ }));
  }

  it('checklist limpo, previa no celular e no desktop, e envio: salva o rascunho e manda para revisao', async () => {
    abrirNaRevisao();
    expect(screen.getByText(/Tudo certo: o sorteio pode ser enviado/)).toBeInTheDocument();

    const previa = screen.getByLabelText('Pré-visualização no celular');
    expect(within(previa).getByRole('heading', { name: 'Rifa do Natal' })).toBeInTheDocument();
    expect(within(previa).getByText('Corra, restam poucos!')).toBeInTheDocument();
    expect(within(previa).getByText('Faltam 100 números')).toBeInTheDocument();
    expect(within(previa).getByText('Quero meus números')).toBeInTheDocument();
    expect(within(previa).getByText(/Sua reserva vale por 30 minutos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Desktop/ }));
    expect(screen.getByLabelText('Pré-visualização no desktop')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enviar para revisão/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(chamadas('createDraw')).toHaveLength(1);
    expect(chamadas('updateDrawStatus')).toHaveLength(1);
    expect(chamadas('updateDrawStatus')[0]![1]).toEqual({ status: 'REVISÃO COMPLIANCE' });
    expect(screen.getByText('Detalhe do sorteio')).toBeInTheDocument();
    expect(window.localStorage.getItem(CHAVE_LOCAL)).toBeNull();
  });

  it('o progresso "ocultar" some da previa', async () => {
    abrirNaRevisao({ ...formCompleto(), progressMode: 'OCULTAR' });
    const previa = screen.getByLabelText('Pré-visualização no celular');
    expect(within(previa).queryByText(/Faltam/)).toBeNull();
    expect(within(previa).queryByText(/% vendido/)).toBeNull();
  });

  it('pendencias listadas e envio travado (sem regulamento, sem data)', async () => {
    abrirNaRevisao({ ...formCompleto(), regulation: '', drawDate: '' });
    expect(screen.getByRole('button', { name: /Enviar para revisão/ })).toBeDisabled();
    expect(screen.getByText(/regulamento/i, { selector: 'li' })).toBeInTheDocument();
    expect(screen.getByText(/Defina a data do sorteio/, { selector: 'li' })).toBeInTheDocument();
  });

  it('sem conta de recebimento: avisa, mas nao impede o envio', async () => {
    respostas['tenantPaymentAccounts'] = () => ({ enabled: true, accounts: [], checkoutAvailable: false });
    abrirNaRevisao();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText(/ainda não tem uma conta de recebimento conectada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar para revisão/ })).toBeEnabled();
  });

  it('a API recusa o envio (ex.: limite do plano): a mensagem aparece e nada navega', async () => {
    respostas['updateDrawStatus'] = () => {
      throw new ApiClientError({ code: 'CONFLICT', message: 'O sorteio mudou de estado.', status: 409 });
    };
    abrirNaRevisao();
    fireEvent.click(screen.getByRole('button', { name: /Enviar para revisão/ }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(screen.getByText('O sorteio mudou de estado.')).toBeInTheDocument();
    expect(screen.queryByText('Detalhe do sorteio')).toBeNull();
    expect(screen.getByRole('button', { name: /Enviar para revisão/ })).toBeEnabled();
  });

  it('sem permissao de ciclo de vida, o botao de envio e explicado e desabilitado', async () => {
    h.permissions = new Set(['draw:write']);
    abrirNaRevisao();
    expect(screen.getByRole('button', { name: /Enviar para revisão/ })).toBeDisabled();
    expect(screen.getByText(/Seu perfil não pode enviar sorteios para revisão/)).toBeInTheDocument();
  });
});
