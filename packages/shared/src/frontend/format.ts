/**
 * Formatacao de apresentacao.
 *
 * Mora no pacote compartilhado porque vitrine e painel precisam mostrar o
 * MESMO preco com o MESMO formato. Duas implementacoes de "centavos para
 * reais" acabam divergindo em arredondamento, e a divergencia aparece onde
 * mais custa: o participante ve R$ 15,00 e o organizador ve R$ 14,99.
 *
 * Dinheiro trafega em CENTAVOS (inteiro) de ponta a ponta. A conversao para
 * texto acontece uma vez, aqui, na hora de desenhar.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BRL_COMPACTO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const INTEIRO = new Intl.NumberFormat('pt-BR');

/** Centavos para "R$ 1.234,56". */
export function formatCents(cents: number): string {
  return BRL.format(cents / 100);
}

/** Centavos sem os decimais, para metrica de painel. */
export function formatCentsCompact(cents: number): string {
  return cents % 100 === 0 ? BRL_COMPACTO.format(cents / 100) : formatCents(cents);
}

/** Inteiro com separador de milhar: 1000 -> "1.000". */
export function formatInteger(value: number): string {
  return INTEIRO.format(value);
}

/**
 * Percentual inteiro, limitado a 0..100.
 *
 * Arredonda para BAIXO de proposito. Com 999 de 1000 vendidos, `Math.round`
 * mostraria "100%" com um numero ainda a venda — e quem chegasse a tela iria
 * embora achando que perdeu.
 */
export function percentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.floor((part / total) * 100)));
}

const DATA_CURTA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? null : data;
}

/** "14 de mar. de 2026", ou `null` quando nao ha data. */
export function formatDate(iso: string | null | undefined): string | null {
  const data = parse(iso);
  return data ? DATA_CURTA.format(data) : null;
}

/** "14/03/2026 19:30", ou `null` quando nao ha data. */
export function formatDateTime(iso: string | null | undefined): string | null {
  const data = parse(iso);
  return data ? DATA_HORA.format(data) : null;
}

/**
 * Milissegundos restantes para "mm:ss" (ou "h:mm:ss" acima de uma hora).
 *
 * Nunca devolve negativo: um cronometro que passa a contar para tras assusta
 * sem informar nada. Vencido e "00:00", e quem chama decide o que dizer.
 */
export function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.floor(msRemaining / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dd = (n: number) => String(n).padStart(2, '0');
  return horas > 0 ? `${horas}:${dd(minutos)}:${dd(segundos)}` : `${dd(minutos)}:${dd(segundos)}`;
}

/**
 * Iniciais para avatar. No maximo duas letras.
 *
 * Cai para "?" quando nao ha nome utilizavel, em vez de devolver vazio — um
 * circulo em branco no canto da tela parece falha de carregamento.
 */
export function initialsOf(name: string | null | undefined): string {
  const partes = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

/**
 * Telefone brasileiro enquanto se digita: "(11) 98888-7777".
 *
 * Mascara apenas o que couber; o resto e descartado. A VALIDACAO continua
 * sendo do servidor — formatar nao e validar, e o campo aceita colar um
 * numero ja formatado sem brigar com quem digitou.
 */
export function formatPhoneBR(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** So os digitos, para enviar ao servidor. */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, '');
}
