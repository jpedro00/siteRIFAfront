import type { ReservationResponse } from '@campaigns/shared';

/**
 * Guarda a reserva em curso entre a grade e o checkout.
 *
 * POR QUE ISSO EXISTE
 * -------------------
 * A reserva e criada na tela da grade e usada na tela seguinte. Passar por
 * `state` do roteador funciona ate a pessoa atualizar a pagina — e ai o
 * `state` some, enquanto a reserva continua VALENDO no servidor por mais 29
 * minutos. Sem esta memoria, a pessoa veria "reserva nao encontrada" com os
 * numeros dela bloqueados para todo mundo, inclusive para ela.
 *
 * `sessionStorage`, nao `localStorage`: a reserva vale por 30 minutos e
 * morre com a aba. Sobreviver ao fechamento do navegador so produziria
 * resgates de reservas ha muito vencidas.
 *
 * Tudo aqui tolera falha silenciosa. Navegacao privada ou armazenamento
 * bloqueado nao pode derrubar a compra — o fluxo normal (sem recarregar)
 * continua funcionando pelo `state` do roteador.
 */

const CHAVE = 'rifas:reserva';

export interface ReservaGuardada {
  readonly reservation: ReservationResponse;
  readonly drawSlug: string;
  readonly drawTitle: string;
  readonly labelDigits: 2 | 3;
}

export function saveReservation(dados: ReservaGuardada): void {
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    /* sem armazenamento; o fluxo sem recarregar continua valendo */
  }
}

export function loadReservation(reservationId?: string): ReservaGuardada | null {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE);
    if (!bruto) return null;

    const dados = JSON.parse(bruto) as ReservaGuardada;
    if (!dados?.reservation?.reservationId) return null;

    // Guardado para OUTRA reserva: ignorar em vez de mostrar numeros de um
    // pedido que nao e o que a pessoa esta abrindo.
    if (reservationId && dados.reservation.reservationId !== reservationId) return null;

    // Ja vencida: o servidor vai recusar de qualquer forma, e mostrar um
    // resumo de reserva morta so adia a ma noticia.
    if (new Date(dados.reservation.expiresAt).getTime() <= Date.now()) {
      clearReservation();
      return null;
    }

    return dados;
  } catch {
    return null;
  }
}

export function clearReservation(): void {
  try {
    window.sessionStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}
