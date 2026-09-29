import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearReservation,
  loadReservation,
  saveReservation,
  type ReservaGuardada,
} from '../../../../apps/storefront/src/lib/reservationStore.js';

const NOVA = 'clubedarifa:reserva';
const ANTIGA = 'rifas:reserva';

/** sessionStorage minimo em memoria: o ambiente de teste e node, sem `window`. */
function memoria() {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (k: string) => dados.get(k) ?? null,
    removeItem: (k: string) => void dados.delete(k),
    setItem: (k: string, v: string) => void dados.set(k, String(v)),
  };
}
type Memoria = ReturnType<typeof memoria>;

function reserva(id = 'r-1', minutos = 20): ReservaGuardada {
  return {
    reservation: {
      reservationId: id,
      expiresAt: new Date(Date.now() + minutos * 60_000).toISOString(),
    },
    drawSlug: 'sorteio',
    drawTitle: 'Sorteio',
    labelDigits: 2,
  } as unknown as ReservaGuardada;
}

describe('reservationStore · migracao da chave rifas:reserva', () => {
  let storage: Memoria;

  beforeEach(() => {
    storage = memoria();
    (globalThis as { window?: unknown }).window = { sessionStorage: storage };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('grava so na chave nova', () => {
    saveReservation(reserva());
    expect(storage.getItem(NOVA)).not.toBeNull();
    expect(storage.getItem(ANTIGA)).toBeNull();
  });

  it('le a chave antiga como plano B e a migra para a nova', () => {
    storage.setItem(ANTIGA, JSON.stringify(reserva('antiga')));

    expect(loadReservation('antiga')?.reservation.reservationId).toBe('antiga');
    expect(storage.getItem(NOVA)).not.toBeNull();
    expect(storage.getItem(ANTIGA)).toBeNull();
  });

  it('a chave nova tem prioridade e a antiga e removida ao gravar', () => {
    storage.setItem(ANTIGA, JSON.stringify(reserva('antiga')));
    saveReservation(reserva('nova'));

    expect(loadReservation()?.reservation.reservationId).toBe('nova');
    expect(storage.getItem(ANTIGA)).toBeNull();
  });

  it('clearReservation limpa as duas chaves', () => {
    storage.setItem(ANTIGA, JSON.stringify(reserva()));
    storage.setItem(NOVA, JSON.stringify(reserva()));
    clearReservation();
    expect(storage.getItem(NOVA)).toBeNull();
    expect(storage.getItem(ANTIGA)).toBeNull();
  });

  it('reserva antiga ja vencida nao e devolvida', () => {
    storage.setItem(ANTIGA, JSON.stringify(reserva('velha', -5)));
    expect(loadReservation()).toBeNull();
  });
});
