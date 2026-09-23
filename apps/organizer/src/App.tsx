import { Link, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, ScrollText, Ticket, Users } from 'lucide-react';
import { SessionProvider, useSession } from './state/SessionProvider.tsx';
import { AuthGate } from './pages/AuthGate.tsx';
import { DashboardShell, type NavItem } from './components/DashboardShell.tsx';
import { ScrollToTop } from './components/ScrollToTop.tsx';
import { AccessDenied, ErrorState, Loading, NotFoundState } from './components/States.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { DrawsListPage } from './pages/DrawsListPage.tsx';
import { NewDrawPage } from './pages/NewDrawPage.tsx';
import { DrawDetailPage } from './pages/DrawDetailPage.tsx';
import { TeamPage } from './pages/TeamPage.tsx';
import { AuditPage } from './pages/AuditPage.tsx';

/**
 * Painel do Organizador.
 *
 * A navegacao lista o que EXISTE. As areas das fases seguintes sairam do
 * menu: um painel com metade dos itens acinzentados anuncia um produto
 * inacabado a quem paga para usa-lo — o roadmap vive no documento de
 * planejamento, nao na barra lateral de quem esta trabalhando.
 *
 * Cada item declara a permissao que a area exige. O filtro evita caminho sem
 * saida; a tranca de verdade esta no servidor, em toda requisicao.
 */
const NAV: NavItem[] = [
  {
    to: '/',
    label: 'Visão geral',
    icon: <LayoutDashboard size={17} aria-hidden="true" />,
    permission: 'tenant:read',
    exact: true,
  },
  {
    to: '/sorteios',
    label: 'Sorteios',
    icon: <Ticket size={17} aria-hidden="true" />,
    permission: 'tenant:read',
  },
  {
    to: '/equipe',
    label: 'Equipe',
    icon: <Users size={17} aria-hidden="true" />,
    permission: 'tenant:read',
    section: 'Comunidade',
  },
  {
    to: '/auditoria',
    label: 'Auditoria',
    icon: <ScrollText size={17} aria-hidden="true" />,
    permission: 'team:manage',
  },
];

function Shell() {
  const { tenant, tenantError, tenantLoading, can } = useSession();

  if (tenantLoading) return <Loading label="Carregando a comunidade…" />;

  if (tenantError) {
    // Sem vinculo com a comunidade pedida: o backend responde 404 de proposito
    // (DOC-01 secao 21) — nao confirmar a existencia da comunidade alheia.
    return (
      <main className="dash__content">
        <ErrorState error={tenantError} />
      </main>
    );
  }

  if (!tenant) {
    return (
      <main className="dash__content">
        <AccessDenied
          title="Comunidade não identificada"
          message="Não foi possível identificar a comunidade a partir do endereço. Acesse pelo domínio da sua comunidade."
        />
      </main>
    );
  }

  return (
    <DashboardShell items={NAV}>
      <ScrollToTop />

      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/sorteios" element={<DrawsListPage />} />
        <Route
          path="/sorteios/novo"
          element={
            can('draw:write') ? (
              <NewDrawPage />
            ) : (
              <AccessDenied message="Seu perfil não tem permissão para criar sorteios nesta comunidade." />
            )
          }
        />
        <Route path="/sorteios/:id" element={<DrawDetailPage />} />
        <Route path="/equipe" element={<TeamPage />} />
        <Route
          path="/auditoria"
          element={
            can('team:manage') ? (
              <AuditPage />
            ) : (
              <AccessDenied message="Somente o dono da comunidade acessa a trilha de auditoria." />
            )
          }
        />
        <Route
          path="*"
          element={
            <NotFoundState
              message="A página que você tentou abrir não existe neste painel."
              action={
                <Link className="btn btn--primary" to="/">
                  Voltar à visão geral
                </Link>
              }
            />
          }
        />
      </Routes>
    </DashboardShell>
  );
}

export function App() {
  return (
    <SessionProvider>
      <AuthGate>
        <Shell />
      </AuthGate>
    </SessionProvider>
  );
}
