import { Link, Route, Routes } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { SessionProvider, useSession } from './state/SessionProvider.tsx';
import { AuthGate } from './pages/AuthGate.tsx';
import { AdminShell, type AdminNavItem } from './components/AdminShell.tsx';
import { ScrollToTop } from './components/ScrollToTop.tsx';
import { AccessDenied, NotFoundState } from './components/States.tsx';
import { TenantsPage } from './pages/TenantsPage.tsx';

/**
 * Console Super Admin.
 *
 * A navegacao e montada a partir das PERMISSOES DE PLATAFORMA devolvidas pela
 * API. Um sub-perfil so ve as areas que o DOC-01 secao 17 lhe atribui —
 * nenhum sub-perfil recebe tudo.
 *
 * As areas ainda inexistentes (revisao, risco, cobrancas, saude) sairam do
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
