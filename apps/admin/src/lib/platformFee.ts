/**
 * Taxa da plataforma por plano. O servidor guarda em pontos-base (bps: 1% = 100); a tela
 * trabalha em porcentagem. `null` = sem override: vale a taxa padrao da plataforma.
 */

export const PLATFORM_FEE_HINT = 'Vazio usa a taxa padrão da plataforma.';
export const PLATFORM_FEE_DEFAULT_LABEL = 'Padrão da plataforma';
export const PLATFORM_FEE_ERROR = 'Informe uma porcentagem de 0 a 100, com até 2 casas decimais (ex.: 5 ou 7,5).';

export type ParsedFee = { ok: true; bps: number | null } | { ok: false; error: string };

/** "5" -> 500, "0,5" -> 50, "12.34" -> 1234, "" -> null (sem override). */
export function parsePercentToBps(texto: string): ParsedFee {
  const t = texto.trim();
  if (t === '') return { ok: true, bps: null };
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(t)) return { ok: false, error: PLATFORM_FEE_ERROR };
  const pct = Number(t.replace(',', '.'));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return { ok: false, error: PLATFORM_FEE_ERROR };
  return { ok: true, bps: Math.round(pct * 100) };
}

const PERCENT = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** 500 -> "5", 50 -> "0,5", 1234 -> "12,34". Sem override devolve "" (campo vazio). */
export function formatBpsAsPercent(bps: number | null | undefined): string {
  if (bps === null || bps === undefined) return '';
  return PERCENT.format(bps / 100);
}

/** Texto para lista e detalhe: "5%" ou "Padrão da plataforma". */
export function describePlatformFee(bps: number | null | undefined): string {
  return bps === null || bps === undefined ? PLATFORM_FEE_DEFAULT_LABEL : `${formatBpsAsPercent(bps)}%`;
}
