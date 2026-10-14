import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { TenantPermission } from '@clubedarifa/shared';
import { useSession } from '../state/SessionProvider.tsx';

interface Passo {
  readonly to: string;
  readonly titulo: string;
  readonly texto: string;
  readonly permission: TenantPermission;
}

/**
 * Passos para quem acabou de criar a comunidade e ainda nao tem rifa.
 *
 * Cada item leva a uma tela que JA existe. Nao ha progresso gravado: o checklist so aparece
 * enquanto a comunidade nao tem nenhum sorteio, e some sozinho depois da primeira rifa. Itens
 * que a pessoa nao tem permissao para abrir nao aparecem (esconder nao e controle de acesso;
 * o servidor continua decidindo).
 */
const PASSOS: readonly Passo[] = [
  { to: '/comunidade', titulo: 'Complete sua comunidade', texto: 'Nome público, logo, contato e descrição que aparecem na sua vitrine.', permission: 'tenant:read' },
  { to: '/recebimentos', titulo: 'Configure seus recebimentos', texto: 'Conecte a sua conta para receber o pagamento das rifas.', permission: 'payment_account:read' },
  { to: '/assinatura', titulo: 'Confira sua assinatura', texto: 'Veja o plano da sua comunidade e o que ele inclui.', permission: 'billing:read' },
];

export function FirstStepsChecklist() {
  const { can } = useSession();
  const passos = PASSOS.filter((passo) => can(passo.permission));
  const podeCriar = can('draw:write');

  return (
    <div className="stack" data-testid="primeiros-passos">
      <div>
        <h3>Primeiros passos</h3>
        <p className="muted">Faltam poucos passos para publicar a sua primeira rifa.</p>
      </div>
      <ol className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {passos.map((passo, indice) => (
          <li key={passo.to} className="row row--between">
            <span>
              <strong>
                {indice + 1}. {passo.titulo}
              </strong>
              <br />
              <span className="muted">{passo.texto}</span>
            </span>
            <Link className="btn btn--secondary btn--sm" to={passo.to}>
              Abrir
            </Link>
          </li>
        ))}
        {podeCriar && (
          <li className="row row--between">
            <span>
              <strong>
                {passos.length + 1}. Crie a sua primeira rifa
              </strong>
              <br />
              <span className="muted">O assistente leva você do prêmio à publicação.</span>
            </span>
            <Link className="btn btn--primary" to="/sorteios/novo">
              <Plus size={16} aria-hidden="true" />
              Criar minha primeira rifa
            </Link>
          </li>
        )}
      </ol>
    </div>
  );
}
