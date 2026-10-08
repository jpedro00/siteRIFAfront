import { Link, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { IS_CENTRAL, LEGACY_TENANT_SLUG } from './lib/mode.ts';
import { MarketplaceScope } from './state/MarketplaceScope.tsx';
import { CreatorPage, MarketplaceDrawsPage, MarketplaceHomePage } from './pages/MarketplacePages.tsx';
import { CreatorOnboardingPage } from './pages/CreatorOnboardingPage.tsx';
import { StorefrontProvider, useStorefront } from './state/SessionProvider.tsx';
import { PublicHeader } from './components/PublicHeader.tsx';
import { PublicFooter } from './components/PublicFooter.tsx';
import { ScrollToTop } from './components/ScrollToTop.tsx';
import { ErrorState, Loading, NotFoundState } from './components/States.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { DrawsPage } from './pages/DrawsPage.tsx';
import { DrawPage } from './pages/DrawPage.tsx';
import { CheckoutPage } from './pages/CheckoutPage.tsx';
import { OrderPage } from './pages/OrderPage.tsx';
import { ResultPage } from './pages/ResultPage.tsx';
import { AccountPage } from './pages/AccountPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { InstitutionalPage } from './pages/InstitutionalPage.tsx';
import { ForgotPasswordPage, ResetPasswordPage } from './pages/PasswordPages.tsx';
import { accentStyle } from './lib/brand.ts';

/**
 * Vitrine da comunidade.
 *
 * O QUE MUDOU E POR QUE
 * ---------------------
 * A barra lateral fixa saiu. Ela era herança de painel administrativo e
 * custava caro na tela que precisa vender: roubava largura no desktop,
 * empilhava navegacao acima do produto no celular e dava a uma pagina de
 * compra a aparencia de ferramenta interna.
 *
 * Saiu junto tudo que falava de fase, roadmap ou area "prevista". Quem chega
 * aqui quer comprar um numero; ler que parte do site pertence a uma fase
 * futura so informa que o lugar nao esta pronto.
 *
 * O que entrou: cabecalho publico, conteudo em largura total e rodape.
 */
/** `/sorteio/:slug...` (modo por comunidade) -> `/rifa/<comunidade herdeira>/:slug...`, so se configurada. */
function LegacyDrawRedirect({ to }: { to: string }) {
  const { slug = '' } = useParams<{ slug: string }>();
  if (!LEGACY_TENANT_SLUG) return <Navigate to="/sorteios" replace />;
  return <Navigate to={`/rifa/${LEGACY_TENANT_SLUG}/${slug}${to}`} replace />;
}

function Shell() {
  const { tenantStatus, tenant, tenantError, reloadTenant } = useStorefront();

  if (tenantStatus === 'loading') {
    return (
      <main className="container page">
        <Loading label="Carregando a comunidade…" />
      </main>
    );
  }

  // Comunidade inexistente NAO e falha do sistema — e endereco errado. A
  // mensagem fala do link, que e a unica coisa sob o controle de quem leu.
  if (tenantStatus === 'not_found') {
    return (
      <main className="container page">
        <NotFoundState
          title="Comunidade não encontrada"
          message="Este endereço não corresponde a nenhuma comunidade. Confira o link que você usou."
        />
      </main>
    );
  }

  if (tenantStatus === 'error' || (!tenant && !IS_CENTRAL)) {
    return (
      <main className="container page">
        <ErrorState
          error={tenantError}
          onRetry={reloadTenant}
          title="Não foi possível carregar esta comunidade"
        />
      </main>
    );
  }

  return (
    <div className="site" style={IS_CENTRAL ? undefined : accentStyle(tenant?.colors['primary'])}>
      <ScrollToTop />

      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>

      <PublicHeader />

      <main className="site__main" id="conteudo">
        <Routes>
          <Route path="/" element={IS_CENTRAL ? <MarketplaceHomePage /> : <HomePage />} />
          <Route path="/sorteios" element={IS_CENTRAL ? <MarketplaceDrawsPage /> : <DrawsPage />} />
          {IS_CENTRAL ? (
            <>
              <Route path="/criador/:tenantSlug" element={<CreatorPage />} />
              <Route path="/rifa/:tenantSlug" element={<MarketplaceScope />}>
                <Route path=":slug" element={<DrawPage />} />
                <Route path=":slug/checkout" element={<CheckoutPage />} />
                <Route path=":slug/resultado" element={<ResultPage />} />
                <Route path="pedido/:id" element={<OrderPage />} />
              </Route>
              {/* Links antigos (/sorteio/:slug) seguem funcionando se houver comunidade herdeira. */}
              <Route path="/sorteio/:slug" element={<LegacyDrawRedirect to="" />} />
              <Route path="/sorteio/:slug/checkout" element={<LegacyDrawRedirect to="/checkout" />} />
              <Route path="/sorteio/:slug/resultado" element={<LegacyDrawRedirect to="/resultado" />} />
            </>
          ) : (
            <>
              <Route path="/sorteio/:slug" element={<DrawPage />} />
              <Route path="/sorteio/:slug/checkout" element={<CheckoutPage />} />
              <Route path="/sorteio/:slug/resultado" element={<ResultPage />} />
              <Route path="/pedido/:id" element={<OrderPage />} />
            </>
          )}
          <Route path="/quero-criar-rifas" element={<CreatorOnboardingPage />} />
          <Route path="/conta" element={<AccountPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/p/:key" element={<InstitutionalPage />} />
          <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route
            path="*"
            element={
              <div className="container page">
                <NotFoundState
                  action={
                    <Link className="btn btn--primary" to="/">
                      Ir para o início
                    </Link>
                  }
                />
              </div>
            }
          />
        </Routes>
      </main>

      <PublicFooter />
    </div>
  );
}

export function App() {
  return (
    <StorefrontProvider>
      <Shell />
    </StorefrontProvider>
  );
}
