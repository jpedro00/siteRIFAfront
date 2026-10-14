import { Link, Route, Routes } from 'react-router-dom';
import { Activity, Banknote, BarChart3, Building2, ClipboardCheck, CreditCard, Layers, Store, Users } from 'lucide-react';
import { SessionProvider, useSession } from './state/SessionProvider.tsx';
import { AuthGate } from './pages/AuthGate.tsx';
import { AdminShell, type AdminNavItem } from './components/AdminShell.tsx';
import { ScrollToTop } from './components/ScrollToTop.tsx';
import { AccessDenied, NotFoundState } from './components/States.tsx';
import { TenantsPage } from './pages/TenantsPage.tsx';
import { HealthPage } from './pages/HealthPage.tsx';
import { ReviewQueuePage } from './pages/ReviewQueuePage.tsx';
import { PlansPage } from './pages/PlansPage.tsx';
import { SubscriptionsPage } from './pages/SubscriptionsPage.tsx';
import { UsersPage } from './pages/UsersPage.tsx';
import { CreatorsPage } from './pages/CreatorsPage.tsx';
import { MetricsPage } from './pages/MetricsPage.tsx';
import { FinancePage } from './pages/FinancePage.tsx';

/**
 * Console Super Admin.
 *
 * A navegacao e montada a partir das PERMISSOES DE PLATAFORMA devolvidas pela
 * API. Um sub-perfil so ve as areas que o DOC-01 secao 17 lhe atribui —
 * nenhum sub-perfil recebe tudo.
 *
 * As areas ainda inexistentes (risco, cobrancas, saude) sairam do
 * menu. Elas nao tem rota no backend, e um item desabilitado com o nome de
 * uma fase futura nao ajuda quem opera: informa apenas que o console nao esta
 * pronto. Voltam ao menu quando tiverem o que mostrar.
 */
const NAV: AdminNavItem[] = [
  {
    to: '/',
    label: 'Comunidades',
    icon: <Building2 size={17} aria-hidden="true" />,
    permission: 'platform:tenant:read',
  },
  {
    to: '/criadores',
    label: 'Criadores',
    icon: <Store size={17} aria-hidden="true" />,
    permission: 'platform:tenant:read',
  },
  {
    to: '/usuarios',
    label: 'Usuários',
    icon: <Users size={17} aria-hidden="true" />,
    permission: 'platform:user:read',
  },
  {
    to: '/metricas',
    label: 'Métricas',
    icon: <BarChart3 size={17} aria-hidden="true" />,
    permission: 'platform:metrics:read',
  },
  {
    to: '/revisao',
    label: 'Fila de revisão',
    icon: <ClipboardCheck size={17} aria-hidden="true" />,
    permission: 'platform:review:read',
  },
  {
    to: '/planos',
    label: 'Planos',
    icon: <Layers size={17} aria-hidden="true" />,
    permission: 'platform:billing:read',
  },
  {
    to: '/assinaturas',
    label: 'Assinaturas',
    icon: <CreditCard size={17} aria-hidden="true" />,
    permission: 'platform:billing:read',
  },
  {
    to: '/financeiro',
    label: 'Financeiro',
    icon: <Banknote size={17} aria-hidden="true" />,
    permission: 'platform:billing:read',
  },
  {
    to: '/saude',
    label: 'Saúde',
    icon: <Activity size={17} aria-hidden="true" />,
    permission: 'platform:health:read',
  },
];

function Shell() {
  const { session, can } = useSession();
  if (!session) return null;

  return (
    <AdminShell items={NAV}>
      <ScrollToTop />

      <Routes>
        <Route
          path="/"
          element={
            can('platform:tenant:read') ? (
              <TenantsPage />
            ) : (
              <AccessDenied message="Seu perfil de Super Admin não inclui a leitura de comunidades." />
            )
          }
        />
        <Route
          path="/criadores"
          element={
            can('platform:tenant:read') ? (
              <CreatorsPage />
            ) : (
              <AccessDenied message="Seu perfil de Super Admin não inclui a leitura de criadores." />
            )
          }
        />
        <Route
          path="/usuarios"
          element={
            can('platform:user:read') ? (
              <UsersPage />
            ) : (
              <AccessDenied message="Seu perfil de Super Admin não inclui a leitura de usuários." />
            )
          }
        />
        <Route
          path="/metricas"
          element={
            can('platform:metrics:read') ? (
              <MetricsPage />
            ) : (
              <AccessDenied message="Seu perfil de Super Admin não inclui as métricas da plataforma." />
            )
          }
        />
        <Route
          path="/revisao"
          element={
            can('platform:review:read') ? (
              <ReviewQueuePage />
            ) : (
              <AccessDenied message="Seu perfil de Super Admin não inclui a revisão de sorteios." />
            )
          }
        />
        <Route
          path="/planos"
          element={
            can('platform:billing:read') ? (
              <PlansPage />
            ) : (
              <AccessDenied message="Seu perfil de Super Admin não inclui o catálogo de planos." />
            )
          }
        />
        <Route
          path="/assinaturas"
          element={
            can('platform:billing:read') ? (
              <SubscriptionsPage />
            ) : (
              <AccessDenied message="Seu perfil de Super Admin não inclui a consulta de assinaturas." />
            )
          }
        />
        <Route
          path="/financeiro"
          element={
            can('platform:billing:read') ? (
              <FinancePage />
            ) : (
              <AccessDenied message="Seu perfil de Super Admin não inclui o financeiro da plataforma." />
            )
          }
        />
        <Route
          path="/saude"
          element={
            can('platform:health:read') ? (
              <HealthPage />
            ) : (
              <AccessDenied message="Seu perfil de Super Admin não inclui a leitura da saúde da plataforma." />
            )
          }
        />
        <Route
          path="*"
          element={
            <NotFoundState
              message="A página que você tentou abrir não existe no console da plataforma."
              action={
                <Link className="btn btn--primary" to="/">
                  Voltar às comunidades
                </Link>
              }
            />
          }
        />
      </Routes>
    </AdminShell>
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
