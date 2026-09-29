import type { ReservationResponse } from '@clubedarifa/shared';

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

const CHAVE = 'clubedarifa:reserva';

/**
 * Chave anterior a marca "Clube da Rifa". Uma reserva guardada antes do deploy
 * ainda vale no servidor; ler a chave antiga como plano B evita "reserva nao
 * encontrada" para quem estava no meio do checkout. So se le dela: toda
 * gravacao vai para a chave nova, e a antiga some assim que for migrada.
 */
const CHAVE_ANTIGA = 'rifas:reserva';

export interface ReservaGuardada {
  readonly reservation: ReservationResponse;
  readonly drawSlug: string;
  readonly drawTitle: string;
  readonly labelDigits: 2 | 3;
}

export function saveReservation(dados: ReservaGuardada): void {
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify(dados));
    window.sessionStorage.removeItem(CHAVE_ANTIGA);
  } catch {
    /* sem armazenamento; o fluxo sem recarregar continua valendo */
  }
}

export function loadReservation(reservationId?: string): ReservaGuardada | null {
  try {
    const bruto = lerMigrando();
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

/** Le a chave nova; se vazia, migra a antiga (grava na nova e remove a antiga). */
function lerMigrando(): string | null {
  const atual = window.sessionStorage.getItem(CHAVE);
  if (atual) return atual;

  const antigo = window.sessionStorage.getItem(CHAVE_ANTIGA);
  if (!antigo) return null;

  window.sessionStorage.setItem(CHAVE, antigo);
  window.sessionStorage.removeItem(CHAVE_ANTIGA);
  return antigo;
}

export function clearReservation(): void {
  try {
    window.sessionStorage.removeItem(CHAVE);
    window.sessionStorage.removeItem(CHAVE_ANTIGA);
  } catch {
    /* nada a fazer */
  }
}
