import { Link } from 'react-router-dom';
import { ENTITLEMENT_REASON_MESSAGES } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { useApiResource } from '../hooks/useApiResource.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { UsageMeter } from './BillingUi.tsx';

/**
 * Limite do plano, em texto curto, dentro de telas que ja existem (criar sorteio, equipe).
 *
 * E INFORMACAO, nao autorizacao: a tela nao impede nada por conta propria. Quem barra e a API
 * (`PLAN_LIMIT_REACHED`, `SUBSCRIPTION_REQUIRED`), e o erro dela e mostrado quando acontece.
 * Sem permissao de ler a assinatura, ou se a leitura falhar, o componente some — um limite
 * que nao carregou nao pode atrapalhar a tarefa principal da tela.
 */
export function EntitlementSummary({ kind }: { kind: 'draws' | 'team' }) {
  const { can } = useSession();
  const pode = can('billing:read');
  const dados = useApiResource(
    (signal) => (pode ? api.call('tenantEntitlements', undefined, { signal }) : Promise.resolve(null)),
    [pode],
  );

  if (!pode || dados.status !== 'ready' || !dados.data) return null;
  const e = dados.data;
  const uso = kind === 'draws' ? e.activeDraws : e.teamMembers;

  return (
    <div className="card" aria-label="Limite do plano">
      <div className="card__body stack stack--sm">
        <UsageMeter label={kind === 'draws' ? 'Sorteios ativos' : 'Equipe'} used={uso.used} max={uso.max} />
        {kind === 'team' && <p className="muted">A equipe não conta o proprietário da comunidade.</p>}
        {!e.enforcementEnabled ? (
          <p className="muted">Por enquanto, os limites do plano são apenas informativos.</p>
        ) : kind === 'draws' && !e.canSubmitDraws ? (
          <p>
            {ENTITLEMENT_REASON_MESSAGES[e.reason]}{' '}
            <Link to="/assinatura">Ver minha assinatura</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
