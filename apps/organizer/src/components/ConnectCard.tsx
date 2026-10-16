import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ApiClientError, type PaymentAccount } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { redirectTo } from '../lib/navigate.ts';
import { Notice, ToneBadge } from './BillingUi.tsx';

/**
 * Cartao "Conta Rifas (Stripe)": o cadastro de recebimento via Stripe Connect.
 *
 * O cadastro e a verificacao acontecem na pagina da Stripe; aqui so mostramos o estado e
 * levamos a pessoa para la. Nenhum dado bancario ou documento passa por esta tela. O dinheiro
 * cai na conta do criador e a plataforma retem a taxa do plano.
 *
 * Volta da Stripe: `?connect=return` (terminou ou saiu) e `?connect=refresh` (o link expirou).
 * Nos dois casos relemos o estado UMA vez, limpamos a URL e recarregamos a lista; no
 * `refresh` o botao "Continuar cadastro" gera um link novo.
 */

const PENDENCIAS: Record<string, string> = {
  'external_account': 'Conta bancária ou chave PIX para receber',
  'business_profile.url': 'Site ou página do negócio',
  'business_profile.mcc': 'Ramo de atividade',
  'business_profile.product_description': 'Descrição do que você vende',
  'tos_acceptance.date': 'Aceite dos termos da Stripe',
  'tos_acceptance.ip': 'Aceite dos termos da Stripe',
};

/** Texto simples para um codigo de pendencia da Stripe; o que nao conhecemos vira lista generica. */
export function humanizeRequirement(code: string): string {
  const conhecido = PENDENCIAS[code];
  if (conhecido) return conhecido;
  const partes = code
    .split('.')
    .filter((p) => !/^(individual|company|representative|person_\w+|verification)$/.test(p))
    .join(' ')
    .replace(/_/g, ' ')
    .trim();
  return partes ? `Informação pendente: ${partes}` : 'Informação pendente';
}

export function ConnectCard({
  accounts,
  enabled,
  canManage,
  onChanged,
}: {
  accounts: readonly PaymentAccount[];
  enabled: boolean;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const lido = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linkExpirou, setLinkExpirou] = useState(false);

  useEffect(() => {
    if (lido.current) return;
    const retorno = params.get('connect');
    if (retorno !== 'return' && retorno !== 'refresh') return;
    lido.current = true;
    if (retorno === 'refresh') setLinkExpirou(true);
    const proximo = new URLSearchParams(params);
    proximo.delete('connect');
    setParams(proximo, { replace: true });
    if (!canManage) {
      onChanged();
      return;
    }
    void (async () => {
      try {
        await api.call('refreshStripeAccount');
      } catch (falha) {
        setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível atualizar o seu cadastro agora. Tente novamente.');
      }
      onChanged();
    })();
    // Roda so na chegada; a trava e o `lido`.
  }, []);

  if (!enabled) return null;

  const stripe = accounts
    .filter((c) => c.provider === 'STRIPE')
    .sort((a, b) => b.connectedAt.localeCompare(a.connectedAt));
  const conta = stripe.find((c) => c.canReceivePayments) ?? stripe[0] ?? null;
  const ativa = conta?.canReceivePayments === true;
  const pendencias = conta?.requirementsDue ?? [];

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
                  {pendencias.map((codigo) => (
                    <li key={codigo}>{humanizeRequirement(codigo)}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p>
            Cadastre onde você quer receber. O cadastro é feito na página segura da Stripe; não pedimos senha nem dados bancários aqui. O dinheiro das
            rifas cai na conta do criador e a plataforma retém a taxa do plano.
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
