/**
 * Telefone com DDI.
 *
 * O campo do checkout aceita numero do Brasil ("(11) 98888-7777") e de outros
 * paises ("+351 912 345 678"). Formatar NAO e validar: a mascara ajuda quem
 * digita; quem decide se o numero serve e o servidor.
 *
 * REGRA
 *  - comeca com "+"  -> internacional: `+<DDI> <resto>`, sem mascara fixa (cada pais
 *                       agrupa de um jeito); o DDI e o que vier ate o primeiro espaco
 *                       ou, digitando so digitos, os 1 a 3 primeiros;
 *  - sem "+"          -> Brasil, mascara "(DD) NNNNN-NNNN".
 * Para o servidor, o numero vai em formato E.164 ("+5511988887777"): o mesmo numero
 * nunca chega escrito de dois jeitos, e o DDI nao e adivinhado depois.
 */

const DDI_BRASIL = '55';

/** Mascara enquanto a pessoa digita. */
export function formatPhoneInput(raw: string): string {
  const internacional = raw.trimStart().startsWith('+');
  const digitos = raw.replace(/\D/g, '');

  if (!internacional) return formatBrasil(digitos.slice(0, 11));

  if (digitos === '') return '+';
  // Brasil digitado com o DDI: "+55 (11) 98888-7777".
  if (digitos.startsWith(DDI_BRASIL)) {
    const local = digitos.slice(2, 13);
    return local === '' ? '+55' : `+55 ${formatBrasil(local)}`;
  }

  // Outros paises: DDI de 1 a 3 digitos. Sem uma tabela de paises, agrupa o que vier
  // depois em blocos de 3, que e legivel para qualquer plano de numeracao.
  const ddi = digitos.slice(0, digitos.startsWith('1') || digitos.startsWith('7') ? 1 : 3);
  const resto = digitos.slice(ddi.length, ddi.length + 12);
  const grupos = resto.match(/.{1,3}/g) ?? [];
  return `+${ddi}${grupos.length > 0 ? ` ${grupos.join(' ')}` : ''}`;
}

function formatBrasil(d: string): string {
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export interface PhoneCheck {
  readonly valid: boolean;
  /** E.164 ("+5511988887777"), so quando valido. */
  readonly e164: string | null;
  readonly message: string | null;
}

/**
 * Confere e normaliza. Brasil: 10 ou 11 digitos com DDD (o 9 inicial e do celular).
 * Internacional: 8 a 15 digitos no total (limite do E.164).
 */
export function checkPhone(raw: string): PhoneCheck {
  const digitos = raw.replace(/\D/g, '');
  const internacional = raw.trimStart().startsWith('+');

  if (!internacional) {
    // Aceita tambem "55" + numero sem o "+", desde que sobre um numero completo.
    const local = digitos.length > 11 && digitos.startsWith(DDI_BRASIL) ? digitos.slice(2) : digitos;
    if (local.length < 10 || local.length > 11) {
      return { valid: false, e164: null, message: 'Informe o telefone com DDD, como (11) 98888-7777.' };
    }
    const dd = Number(local.slice(0, 2));
    if (dd < 11 || dd > 99) {
      return { valid: false, e164: null, message: 'Confira o DDD do telefone.' };
    }
    if (local.length === 11 && local[2] !== '9') {
      return { valid: false, e164: null, message: 'Celular com 11 dígitos começa com 9 depois do DDD.' };
    }
    return { valid: true, e164: `+${DDI_BRASIL}${local}`, message: null };
  }

  if (digitos.length < 8 || digitos.length > 15) {
    return { valid: false, e164: null, message: 'Informe o número com o código do país, como +351 912 345 678.' };
  }
  if (digitos.startsWith(DDI_BRASIL)) {
    // "+55..." precisa seguir a regra brasileira do que vem depois do DDI.
    return checkPhone(digitos.slice(2));
  }
  return { valid: true, e164: `+${digitos}`, message: null };
}
