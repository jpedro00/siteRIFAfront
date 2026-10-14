import { RefreshCw } from 'lucide-react';
import { formatCentsCompact, formatInteger } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { ErrorState, Loading } from '../components/States.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';

/**
 * Metricas da plataforma. Todo numero vem de consulta real ao banco: usuarios, comunidades,
 * rifas, pedidos pagos e assinaturas. Nao ha visitas, conversao ou trafego porque nao existe
 * analytics que os produza. O valor bruto dos pedidos pagos so chega a quem tem permissao
 * financeira; para os demais o cartao simplesmente nao aparece.
 */
const RIFA: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  EM_REVISAO: 'Em revisão',
  AGENDADA: 'Agendada',
  ATIVA: 'Ativa',
  PAUSADA: 'Pausada',
  'VENDAS ENCERRADAS': 'Vendas encerradas',
  APURAÇÃO: 'Apuração',
  'RESULTADO PUBLICADO': 'Resultado publicado',
  ARQUIVADA: 'Arquivada',
  CANCELADA: 'Cancelada',
};
const ASSINATURA: Record<string, string> = {
  active: 'Ativas',
  trialing: 'Em teste',
  past_due: 'Em atraso',
  unpaid: 'Não pagas',
  paused: 'Pausadas',
  canceled: 'Canceladas',
  incomplete: 'Incompletas',
  incomplete_expired: 'Expiradas',
};

function Cartao({ titulo, valor, nota }: { titulo: string; valor: string; nota?: string }) {
  return (
    <div className="card">
      <div className="card__body">
        <p className="muted">{titulo}</p>
        <p style={{ fontSize: '1.75rem', fontWeight: 600, margin: '4px 0' }}>{valor}</p>
        {nota && <p className="muted">{nota}</p>}
      </div>
    </div>
  );
}

function Distribuicao({
  titulo,
  dados,
  rotulos,
}: {
  titulo: string;
  dados: Record<string, number>;
  rotulos: Record<string, string>;
}) {
  const linhas = Object.entries(dados).sort((a, b) => b[1] - a[1]);
  return (
    <section className="card">
      <div className="card__header">
        <h2 className="card__title">{titulo}</h2>
      </div>
      <div className="card__body">
        {linhas.length === 0 ? (
          <p className="muted">Sem registros ainda.</p>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {linhas.map(([chave, total]) => (
              <li key={chave} className="row row--between">
                <span>{rotulos[chave] ?? chave}</span>
                <strong>{formatInteger(total)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function MetricsPage() {
  const recurso = useApiResource(() => api.call('platformMetrics'), []);
  const m = recurso.data;

  return (
    <>
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-header__title">Métricas</h1>
          <p className="page-header__description">Números reais da plataforma, lidos do banco no momento da consulta.</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn--secondary" onClick={recurso.reload} disabled={recurso.status === 'loading'}>
            <RefreshCw size={16} aria-hidden="true" />
            Atualizar
          </button>
        </div>
      </header>

      {recurso.status === 'loading' && <Loading label="Carregando as métricas…" />}
      {recurso.status === 'error' && <ErrorState error={recurso.error} onRetry={recurso.reload} />}

      {recurso.status === 'ready' && m && (
        <div className="stack">
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}>
            <Cartao titulo="Usuários" valor={formatInteger(m.users.total)} nota={`${formatInteger(m.users.active)} ativos`} />
            <Cartao
              titulo="Comunidades"
              valor={formatInteger(m.communities.total)}
              nota={`${formatInteger(m.communities.active)} ativas`}
            />
            <Cartao titulo="Criadores com rifa publicada" valor={formatInteger(m.creatorsWithPublishedDraw)} />
            <Cartao titulo="Pedidos pagos" valor={formatInteger(m.orders.paid)} />
            {m.orders.grossPaidCents !== null && (
              <Cartao
                titulo="Valor bruto dos pedidos pagos"
                valor={formatCentsCompact(m.orders.grossPaidCents)}
                nota="Informativo; não é receita da plataforma."
              />
            )}
          </div>
          <Distribuicao titulo="Rifas por situação" dados={m.drawsByStatus} rotulos={RIFA} />
          <Distribuicao titulo="Assinaturas por situação" dados={m.subscriptionsByStatus} rotulos={ASSINATURA} />
          <p className="muted">Atualizado em {new Date(m.generatedAt).toLocaleString('pt-BR')}.</p>
        </div>
      )}
    </>
  );
}
