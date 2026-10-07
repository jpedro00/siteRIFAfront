import { Building2, Plus } from 'lucide-react';
import { MEMBERSHIP_ROLE_LABELS } from '@clubedarifa/shared';
import { useSession } from '../state/SessionProvider.tsx';

/**
 * Painel central: uma conta pode operar varias comunidades. Esta tela aparece quando ha mais de
 * um vinculo e nenhuma escolha valida, e quando a conta ainda nao tem comunidade nenhuma.
 *
 * A lista vem da SESSAO (vinculos verificados no servidor). O slug escolhido e so uma
 * preferencia: a cada requisicao o servidor confere o vinculo, e sem vinculo responde 404.
 */
function createUrl(): string | null {
  const raw = import.meta.env['VITE_STOREFRONT_BASE_URL'] as string | undefined;
  return raw && /^https?:\/\//.test(raw) ? `${raw.replace(/\/+$/, '')}/quero-criar-rifas` : null;
}

export function CommunityPickerPage() {
  const { communities, selectCommunity, logout } = useSession();
  const criar = createUrl();

  return (
    <main className="dash__content">
      <div className="card" style={{ maxWidth: '40rem', margin: '4rem auto' }}>
        <div className="card__body stack">
          <h1>Escolha a comunidade</h1>
          <p className="muted">Sua conta administra mais de uma comunidade. Escolha com qual você quer trabalhar agora; dá para trocar depois.</p>
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {communities.map((m) => (
              <li key={m.tenantId}>
                <button type="button" className="btn btn--secondary btn--block" onClick={() => selectCommunity(m.tenantSlug)}>
                  <Building2 size={16} aria-hidden="true" />
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    {m.tenantName} <span className="muted">· {m.roles.map((r) => MEMBERSHIP_ROLE_LABELS[r]).join(', ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {criar && (
            <a className="btn btn--ghost" href={criar}>
              <Plus size={16} aria-hidden="true" /> Criar outra comunidade
            </a>
          )}
          <button type="button" className="btn btn--ghost" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </div>
    </main>
  );
}

export function NoCommunityPage() {
  const { session, logout } = useSession();
  const criar = createUrl();
  return (
    <main className="dash__content">
      <div className="card" style={{ maxWidth: '40rem', margin: '4rem auto' }}>
        <div className="card__body stack">
          <h1>Você ainda não tem uma comunidade</h1>
          <p className="muted">
            {session ? `Você entrou como ${session.user.email}. ` : ''}Para criar rifas, crie a sua comunidade (é a mesma conta que
            você usa para comprar) ou peça um convite a quem administra uma.
          </p>
          {criar && (
            <a className="btn btn--primary" href={criar}>
              Criar minha comunidade
            </a>
          )}
          <button type="button" className="btn btn--ghost" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </div>
    </main>
  );
}
