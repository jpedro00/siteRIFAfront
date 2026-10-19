import { useState } from 'react';
import { ApiClientError, type PaymentAccount } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { redirectTo } from '../lib/navigate.ts';
import { Notice, ToneBadge } from './BillingUi.tsx';

/**
 * Cartao "Conta Rifas (Stripe)": o cadastro de recebimento via Stripe Connect.
 *
 * O cadastro e a verificacao acontecem na pagina da Stripe; aqui so mostramos o estado e
 * levamos a pessoa para la. Nenhum dado bancario ou documento passa por esta tela. O dinheiro
 * cai direto na conta do criador e a plataforma retem a taxa do plano.
 *
 * Volta da Stripe: `?connect=return` (terminou ou saiu) e `?connect=refresh` (o link expirou).
 * A pagina (ReceiptsPage) trata a volta: rele o estado UMA vez, limpa a URL e recarrega; no
 * `refresh` o botao "Continuar cadastro" gera um link novo.
 */

/** Pendencias da Stripe em portugues, por prefixo. A ordem desta lista e a ordem de exibicao. */
const REGRAS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^individual\.(first_name|last_name)/, 'Nome completo'],
  [/^individual\.dob/, 'Data de nascimento'],
  [/^individual\.id_number/, 'CPF'],
  [/^individual\.verification\.(document|additional_document)/, 'Documento de identidade'],
  [/^individual\.address/, 'Endereço'],
  [/^individual\.phone/, 'Telefone'],
  [/^individual\.email/, 'E-mail'],
  [/^individual\.political_exposure/, 'Declaração de exposição política'],
  [/^business_profile/, 'Dados do negócio'],
  [/^company\./, 'Dados da empresa'],
  [/^representative\./, 'Dados do responsável'],
  [/^external_account/, 'Conta bancária para receber os repasses'],
  [/^tos_acceptance/, 'Aceite dos termos da Stripe'],
];
export const OUTRAS_PENDENCIAS = 'Outras informações pedidas pela Stripe';

/** Lista sem repeticao, em portugues, em ordem estavel. Nunca mostra um codigo cru da Stripe. */
export function humanizeRequirements(codes: readonly string[]): string[] {
  const achados = new Set<string>();
  let outras = false;
  for (const codigo of codes) {
    const regra = REGRAS.find(([re]) => re.test(codigo));
    if (regra) achados.add(regra[1]);
    else outras = true;
  }
  const ordenados = REGRAS.map(([, texto]) => texto).filter((t, i, todos) => achados.has(t) && todos.indexOf(t) === i);
  return outras ? [...ordenados, OUTRAS_PENDENCIAS] : ordenados;
}

export function ConnectCard({
  accounts,
  canManage,
  linkExpirou = false,
  erro: erroExterno = null,
}: {
  accounts: readonly PaymentAccount[];
  canManage: boolean;
  /** O link de cadastro expirou (volta com `?connect=refresh`). Vem da pagina para sobreviver ao recarregamento. */
  linkExpirou?: boolean;
  /** Falha ao reler o cadastro na volta da Stripe. */
  erro?: string | null;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [erroLocal, setErro] = useState<string | null>(null);
  const erro = erroLocal ?? erroExterno;

  // Conta encerrada (desconectada/revogada) nao conta como cadastro em andamento.
  const stripe = accounts
    .filter((c) => c.provider === 'STRIPE' && c.status !== 'DISCONNECTED' && c.status !== 'REVOKED')
    .sort((a, b) => Number(b.status === 'CONNECTED') - Number(a.status === 'CONNECTED') || b.connectedAt.localeCompare(a.connectedAt));
  const conta = stripe.find((c) => c.canReceivePayments) ?? stripe[0] ?? null;
  const ativa = conta?.canReceivePayments === true;
  const pendencias = humanizeRequirements(conta?.requirementsDue ?? []);

  const iniciar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      const { url } = await api.call('connectStripeAccount');
      redirectTo(url);
    } catch (falha) {
      setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível iniciar o cadastro. Tente novamente.');
      setOcupado(false);
    }
  };

  return (
    <article className="card" aria-label="Conta Rifas (Stripe)">
      <div className="card__body stack stack--sm">
        <div className="row row--between row--wrap">
          <h2 className="section__title">Conta Rifas (Stripe)</h2>
          {ativa ? (
            <ToneBadge tone="success">Recebimento ativo</ToneBadge>
          ) : conta ? (
            <ToneBadge tone="warning">Cadastro em andamento</ToneBadge>
          ) : (
            <ToneBadge tone="neutral">Não cadastrado</ToneBadge>
          )}
        </div>

        <div aria-live="polite" className="stack stack--sm">
          {linkExpirou && !ativa && (
            <Notice tone="info" title="O link de cadastro expirou">
              <p>Sem problema: use “Continuar cadastro” para gerar um link novo.</p>
            </Notice>
          )}
          {erro && (
            <Notice tone="danger" title="Não foi possível concluir" live="assertive">
              <p>{erro}</p>
            </Notice>
          )}
        </div>

        {ativa ? (
          <p>Tudo certo: os pagamentos dos participantes caem direto na sua conta, e a plataforma retém a taxa do seu plano em cada venda.</p>
        ) : conta ? (
          <>
            <p>Falta pouco para você começar a receber. Termine o cadastro na página da Stripe.</p>
            {pendencias.length > 0 && (
              <div>
                <p className="muted">O que ainda falta:</p>
                <ul className="plain-list">
                  {pendencias.map((texto) => (
                    <li key={texto}>{texto}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p>
            Cadastre onde você quer receber. O cadastro é feito na página segura da Stripe; não pedimos senha nem dados bancários aqui. O dinheiro das
            rifas cai direto na sua conta e a plataforma retém a taxa do plano.
          </p>
        )}

        {!ativa &&
          (canManage ? (
            <div className="row row--wrap">
              <button type="button" className="btn btn--primary" disabled={ocupado} onClick={() => void iniciar()}>
                {ocupado ? <span className="btn__spinner" aria-hidden="true" /> : null}
                {conta ? 'Continuar cadastro' : 'Cadastrar recebimento'}
              </button>
            </div>
          ) : (
            <p className="muted">Somente o proprietário faz o cadastro de recebimento.</p>
          ))}
      </div>
    </article>
  );
}
