import { describe, expect, it } from 'vitest';
import type { OrganizerDraw } from '@clubedarifa/shared';
import {
  buildCreateRequest,
  buildUpdateRequest,
  centsToMoneyText,
  emptyForm,
  emptyPrize,
  formFromDraw,
  isoToLocalInput,
  localInputToIso,
  parseMoneyToCents,
  parseThresholds,
  stepProblems,
  submissionProblems,
  type DrawForm,
} from '../src/lib/drawForm.ts';

const REGULAMENTO = 'Regulamento do sorteio de teste: participam todos os números pagos e o resultado segue a Loteria Federal.';

function completo(extra: Partial<DrawForm> = {}): DrawForm {
  return {
    ...emptyForm(),
    title: 'Rifa do Natal',
    prizes: [{ ...emptyPrize(), name: 'Moto 0 km' }],
    price: '15,00',
    drawDate: '2030-01-10T20:00',
    regulation: REGULAMENTO,
    ...extra,
  };
}

describe('dinheiro e datas', () => {
  it('"15,00", "15.00", "1.500,50" e "15" viram centavos; lixo e zero nao', () => {
    expect(parseMoneyToCents('15,00')).toBe(1500);
    expect(parseMoneyToCents('15.00')).toBe(1500);
    expect(parseMoneyToCents('1.500,50')).toBe(150050);
    expect(parseMoneyToCents('15')).toBe(1500);
    expect(parseMoneyToCents('19,99')).toBe(1999); // 19.99 * 100 = 1998.999... em ponto flutuante
    for (const ruim of ['', '0', '0,00', '-5', 'abc', '1,2,3', '12,345', 'R$ 10']) {
      expect(parseMoneyToCents(ruim), ruim).toBeNull();
    }
  });

  it('centavos voltam a texto brasileiro', () => {
    expect(centsToMoneyText(250000)).toBe('2.500,00');
    expect(centsToMoneyText(null)).toBe('');
  });

  it('datetime-local <-> ISO e simetrico; vazio e invalido viram undefined', () => {
    const iso = localInputToIso('2030-03-01T15:30')!;
    expect(isoToLocalInput(iso)).toBe('2030-03-01T15:30');
    expect(localInputToIso('')).toBeUndefined();
    expect(localInputToIso('nao-e-data')).toBeUndefined();
    expect(isoToLocalInput(null)).toBe('');
  });

  it('limiares: de 1 a 5 valores entre 1 e 99, estritamente decrescentes', () => {
    expect(parseThresholds('25, 10')).toEqual([25, 10]);
    expect(parseThresholds('50 25;10')).toEqual([50, 25, 10]);
    for (const ruim of ['', '10, 25', '25, 25', '0', '100', '25, x', '5, 4, 3, 2, 1, 0']) {
      expect(parseThresholds(ruim), ruim).toBeNull();
    }
  });
});

describe('o minimo para existir no servidor', () => {
  it('sem titulo, premio com nome ou preco: nao cria (null)', () => {
    expect(buildCreateRequest(emptyForm())).toBeNull();
    expect(buildCreateRequest(completo({ title: 'Ab' }))).toBeNull();
    expect(buildCreateRequest(completo({ price: '' }))).toBeNull();
    expect(buildCreateRequest(completo({ prizes: [emptyPrize()] }))).toBeNull();
    expect(buildCreateRequest(completo({ prizes: [{ ...emptyPrize(), name: 'M' }] }))).toBeNull();
  });

  it('com o minimo cria; campos vazios nem viajam', () => {
    const r = buildCreateRequest(completo({ drawDate: '', regulation: '' }))!;
    expect(r).toMatchObject({ title: 'Rifa do Natal', ticketPriceCents: 1500, totalNumbers: 100, prizes: [{ name: 'Moto 0 km' }] });
    expect(r).not.toHaveProperty('subtitle');
    expect(r).not.toHaveProperty('regulation');
    expect(r).not.toHaveProperty('customization');
    expect(r).not.toHaveProperty('promotionalPriceCents');
  });

  it('leva subtitulo, categoria, valor estimado, personalizacao e promocao quando preenchidos', () => {
    const r = buildCreateRequest(
      completo({
        subtitle: ' Sub ',
        category: 'Veículos',
        prizes: [{ ...emptyPrize(), name: 'Moto', value: '2.500,00', imageUrl: 'https://x.test/a.jpg', description: 'Zero' }],
        progressMode: 'PERCENTUAL',
        headline: 'Corra!',
        promoPrice: '12,00',
        promoUntil: '2030-01-05T10:00',
        thresholds: '30, 15',
      }),
    )!;
    expect(r.subtitle).toBe('Sub');
    expect(r.category).toBe('Veículos');
    expect(r.prizes[0]).toEqual({ name: 'Moto', description: 'Zero', imageUrl: 'https://x.test/a.jpg', estimatedValueCents: 250000 });
    expect(r.customization).toEqual({ progressMode: 'PERCENTUAL', headline: 'Corra!' });
    expect(r.promotionalPriceCents).toBe(1200);
    expect(r.thresholds).toEqual([30, 15]);
  });

  it('combinacao invalida entre campos (promocao >= preco) nao cria', () => {
    expect(buildCreateRequest(completo({ promoPrice: '20,00', promoUntil: '2030-01-05T10:00' }))).toBeNull();
  });

  it('linha de premio em branco nao conta; a ordem da lista e a posicao', () => {
    const r = buildCreateRequest(
      completo({ prizes: [{ ...emptyPrize(), name: 'Carro' }, emptyPrize(), { ...emptyPrize(), name: 'Moto' }] }),
    )!;
    expect(r.prizes.map((p) => p.name)).toEqual(['Carro', 'Moto']);
  });
});

describe('PATCH do rascunho: limpa o esvaziado, nao envia o invalido', () => {
  it('campo esvaziado vai como null (limpa no servidor)', () => {
    const { payload, skipped } = buildUpdateRequest(completo({ subtitle: '', category: '', description: '', regulation: '' }));
    expect(payload).toMatchObject({ subtitle: null, category: null, description: null, regulation: null, customization: null });
    expect(skipped).toEqual([]);
  });

  it('titulo curto demais NAO e enviado (o servidor mantem o anterior) e fica anotado', () => {
    const { payload, skipped } = buildUpdateRequest(completo({ title: 'Ab' }));
    expect(payload).not.toHaveProperty('title');
    expect(skipped).toContain('title');
    expect(payload).toMatchObject({ ticketPriceCents: 1500 });
  });

  it('preco ilegivel, limiares ruins e premio incompleto sao pulados, o resto segue', () => {
    const { payload, skipped } = buildUpdateRequest(
      completo({ price: 'abc', thresholds: '1, 2', prizes: [{ ...emptyPrize(), name: 'X' }] }),
    );
    expect(skipped).toEqual(expect.arrayContaining(['ticketPriceCents', 'thresholds', 'prizes']));
    expect(payload).not.toHaveProperty('ticketPriceCents');
    expect(payload).not.toHaveProperty('thresholds');
    expect(payload).not.toHaveProperty('prizes');
    expect(payload).toMatchObject({ totalNumbers: 100, closeMode: 'AO_ESGOTAR' });
  });

  it('promocao pela metade nao e enviada; vazia limpa as duas', () => {
    expect(buildUpdateRequest(completo({ promoPrice: '10,00' })).skipped).toContain('promotionalPriceCents');
    const { payload } = buildUpdateRequest(completo());
    expect(payload).toMatchObject({ promotionalPriceCents: null, promoUntil: null });
  });

  it('o mesmo formulario gera sempre o mesmo corpo (base do "nao reenviar o que nao mudou")', () => {
    const f = completo({ subtitle: 'x', headline: 'y' });
    expect(JSON.stringify(buildUpdateRequest(f).payload)).toBe(JSON.stringify(buildUpdateRequest({ ...f }).payload));
  });
});

const sorteio = (extra: Partial<OrganizerDraw> = {}): OrganizerDraw =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'rifa-1',
    title: 'Rifa do Natal',
    subtitle: 'Sub',
    description: 'Desc',
    prizeName: 'Moto',
    prizeImageUrl: null,
    unitPriceCents: 1500,
    ticketPriceCents: 1500,
    promotionalPriceCents: null,
    promoUntil: null,
    promoActive: false,
    totalNumbers: 500,
    labelDigits: 3,
    status: 'RASCUNHO',
    drawDate: '2030-01-10T20:00:00.000Z',
    paidCount: 0,
    prizeDescription: null,
    category: 'Veículos',
    regulation: REGULAMENTO,
    customization: { progressMode: 'OCULTAR', headline: 'Chamada', ctaLabel: null },
    prizes: [
      { position: 1, name: 'Moto', description: null, imageUrl: null, estimatedValueCents: 250000 },
      { position: 2, name: 'Capacete', description: 'Integral', imageUrl: 'https://x.test/c.jpg', estimatedValueCents: null },
    ],
    closeMode: 'POR_DATA',
    closeAt: '2030-01-09T20:00:00.000Z',
    salesStartAt: '2030-01-01T10:00:00.000Z',
    resultSource: 'LOTERIA_FEDERAL',
    noWinnerPolicy: 'SEM_CONTEMPLADO',
    takenCount: 0,
    reservedCount: 0,
    pendingCount: 0,
    revenueCents: 0,
    createdAt: '2029-12-01T00:00:00.000Z',
    thresholds: [30, 15],
    configuredPromotionalPriceCents: 1200,
    configuredPromoUntil: '2030-01-05T10:00:00.000Z',
    reviewNote: null,
    snapshot: null,
    ...extra,
  }) as OrganizerDraw;

describe('formFromDraw (continuar rascunho e duplicar)', () => {
  it('continuar: traz tudo do servidor', () => {
    const f = formFromDraw(sorteio());
    expect(f).toMatchObject({
      title: 'Rifa do Natal',
      subtitle: 'Sub',
      category: 'Veículos',
      totalNumbers: 500,
      price: '15,00',
      promoPrice: '12,00',
      closeMode: 'POR_DATA',
      noWinnerPolicy: 'SEM_CONTEMPLADO',
      thresholds: '30, 15',
      progressMode: 'OCULTAR',
      headline: 'Chamada',
      regulation: REGULAMENTO,
    });
    expect(f.prizes.map((p) => [p.name, p.value])).toEqual([['Moto', '2.500,00'], ['Capacete', '']]);
    expect(f.drawDate).not.toBe('');
  });

  it('duplicar: copia o conteudo, mas NAO as datas nem a promocao (DOC-01 §4)', () => {
    const f = formFromDraw(sorteio(), { duplicate: true });
    expect(f.title).toBe('Rifa do Natal (cópia)');
    expect(f.prizes).toHaveLength(2);
    expect(f.regulation).toBe(REGULAMENTO);
    for (const vazio of [f.drawDate, f.salesStartAt, f.closeAt, f.promoUntil, f.promoPrice]) expect(vazio).toBe('');
  });

  it('ida e volta: o formulario de um sorteio gera um PATCH sem nada a ignorar', () => {
    const { skipped } = buildUpdateRequest(formFromDraw(sorteio()));
    expect(skipped).toEqual([]);
  });
});

describe('validacao por passo e checklist de envio', () => {
  it('cada passo aponta o campo e a mensagem', () => {
    expect(stepProblems(0, emptyForm()).map((p) => p.field)).toEqual(['title']);
    expect(stepProblems(1, emptyForm()).map((p) => p.field)).toEqual(['prize-0-name']);
    expect(stepProblems(3, emptyForm()).map((p) => p.field)).toEqual(['price']);
    expect(stepProblems(4, emptyForm()).map((p) => p.field)).toEqual(['drawDate']);
    expect(stepProblems(6, emptyForm()).map((p) => p.field)).toEqual(['regulation']);
    expect(stepProblems(7, completo({ thresholds: '1, 2' })).map((p) => p.field)).toEqual(['thresholds']);
    expect(stepProblems(2, emptyForm())).toEqual([]);
    expect(stepProblems(5, emptyForm())).toEqual([]);
  });

  it('foto sem https e valor ilegivel do premio sao apontados no premio certo', () => {
    const f = completo({
      prizes: [
        { ...emptyPrize(), name: 'Moto' },
        { ...emptyPrize(), name: 'Carro', imageUrl: 'http://inseguro.test/a.jpg', value: 'caro' },
      ],
    });
    expect(stepProblems(1, f).map((p) => p.field)).toEqual(['prize-1-image', 'prize-1-value']);
  });

  it('fechamento por data exige a data; preco promocional precisa vir com prazo e ser menor', () => {
    expect(stepProblems(4, completo({ closeMode: 'POR_DATA' })).map((p) => p.field)).toContain('closeAt');
    expect(stepProblems(3, completo({ promoPrice: '10,00' })).map((p) => p.field)).toEqual(['promoPrice']);
    expect(stepProblems(3, completo({ promoPrice: '99,00', promoUntil: '2030-01-05T10:00' })).map((p) => p.field)).toEqual(['promoPrice']);
  });

  it('formulario completo: nada falta; sem regulamento ou sem data, o envio tem pendencias', () => {
    expect(submissionProblems(completo())).toEqual([]);
    expect(submissionProblems(completo({ regulation: '' })).join(' ')).toMatch(/regulamento/i);
    expect(submissionProblems(completo({ drawDate: '' })).join(' ')).toMatch(/data do sorteio/i);
    expect(submissionProblems(emptyForm()).length).toBeGreaterThan(3);
  });
});
