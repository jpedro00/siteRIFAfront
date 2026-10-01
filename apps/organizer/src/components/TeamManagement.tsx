import { useCallback, useState, type FormEvent } from 'react';
import {
  MEMBERSHIP_ROLES,
  MEMBERSHIP_ROLE_LABELS,
  formatDateTime,
  type InviteMemberResponse,
  type MembershipRole,
} from '@clubedarifa/shared';
import { useApiResource } from '../hooks/useApiResource.ts';
import { CopyLink } from './CopyLink.tsx';
import { EntitlementNotice } from './BillingUi.tsx';
import { EntitlementSummary } from './EntitlementSummary.tsx';
import { describeEntitlementError } from '../lib/billingCopy.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { api } from '../api.ts';

/**
 * Gestao da equipe (P9 · RN11). Exige `team:manage` e MFA — a API decide; a tela so
 * mostra o erro dela. O link do convite aparece UMA vez, ao criar: no banco fica so o
 * hash do token. Quem perder o link reenvia o convite (o anterior e revogado).
 */
export function TeamManagement() {
  const { can } = useSession();
  const equipe = useApiResource((signal) => api.call('tenantTeam', undefined, { signal }), []);
  const [ofereceAssinatura, setOfereceAssinatura] = useState(false);
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<MembershipRole>('SUPPORT');
  const [convite, setConvite] = useState<InviteMemberResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const executar = useCallback(
    async (acao: () => Promise<void>) => {
      setOcupado(true);
      setErro(null);
      setOfereceAssinatura(false);
      try {
        await acao();
        equipe.reload();
      } catch (falha) {
        // `PLAN_LIMIT_REACHED` / `SUBSCRIPTION_REQUIRED`: a API decidiu; a tela explica.
        const descricao = describeEntitlementError(falha, 'Não foi possível concluir a ação.');
        setErro(descricao.message);
        setOfereceAssinatura(descricao.offerSubscription);
      } finally {
        setOcupado(false);
      }
    },
    [equipe],
  );

  const convidar = (evento: FormEvent) => {
    evento.preventDefault();
    void executar(async () => {
      const r = await api.call('inviteTeamMember', { email: email.trim(), role: papel });
      setConvite(r);
      setEmail('');
    });
  };

  const link = convite ? `${window.location.origin}/convite/${convite.token}` : null;

  return (
    <section className="section" aria-labelledby="gestao-equipe">
      <div className="section__head">
        <h2 className="section__title" id="gestao-equipe">
          Membros e convites
        </h2>
      </div>

      <EntitlementSummary kind="team" />

      {erro && ofereceAssinatura && (
        <EntitlementNotice message={erro} offerSubscription canOpenSubscription={can('billing:read')} />
      )}
      {erro && !ofereceAssinatura && (
        <p className="alert alert--danger" role="alert">
          <span className="alert__body">{erro}</span>
        </p>
      )}

      <form className="form-inline" onSubmit={convidar}>
        <div className="field">
          <label className="field__label" htmlFor="convite-email">
            E-mail da pessoa
          </label>
          <input id="convite-email" className="field__input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="convite-papel">
            Papel
          </label>
          <select id="convite-papel" className="field__input" value={papel} onChange={(e) => setPapel(e.target.value as MembershipRole)}>
            {MEMBERSHIP_ROLES.map((r) => (
              <option key={r} value={r}>
                {MEMBERSHIP_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn--primary" disabled={ocupado}>
          Convidar
        </button>
      </form>

      {link && convite && (
        <div className="alert alert--success" role="status">
          <div className="alert__body">
            <p className="alert__title">Convite criado para {convite.email}</p>
            <p>
              Envie este link (vale até {formatDateTime(convite.expiresAt)}). Ele não será mostrado de novo.
            </p>
            <CopyLink value={link} />
          </div>
        </div>
      )}

      {equipe.status === 'ready' && equipe.data && (
        <>
          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Membros da equipe</caption>
              <thead>
                <tr>
                  <th scope="col">Pessoa</th>
                  <th scope="col">Papel</th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {equipe.data.members.map((m) => (
                  <tr key={m.membershipId}>
                    <td>
                      <span className="table__primary">{m.displayName}</span>
                      <p className="table__secondary">{m.email}</p>
                    </td>
                    <td>
                      <select
                        aria-label={`Papel de ${m.displayName}`}
                        className="field__input"
                        value={m.role}
                        disabled={m.isSelf || ocupado}
                        onChange={(e) =>
                          void executar(async () => {
                            await api.call('changeTeamMemberRole', { role: e.target.value as MembershipRole }, { params: { id: m.membershipId } });
                          })
                        }
                      >
                        {MEMBERSHIP_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {MEMBERSHIP_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {!m.isSelf && (
                        removendo === m.membershipId ? (
                          <>
                            <button
                              type="button"
                              className="btn btn--danger-ghost btn--sm"
                              disabled={ocupado}
                              onClick={() => {
                                setRemovendo(null);
                                void executar(async () => {
                                  await api.call('removeTeamMember', undefined, { params: { id: m.membershipId } });
                                });
                              }}
                            >
                              Confirmar remoção
                            </button>{' '}
                            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setRemovendo(null)}>
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <button type="button" className="btn btn--danger-ghost btn--sm" disabled={ocupado} onClick={() => setRemovendo(m.membershipId)}>
                            Remover
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {equipe.data.invitations.length > 0 && (
            <>
              <h3 className="section__subtitle">Convites em aberto</h3>
              <ul className="plain-list">
                {equipe.data.invitations.map((c) => (
                  <li key={c.id}>
                    {c.email} · {MEMBERSHIP_ROLE_LABELS[c.role]} ·{' '}
                    {c.expired ? 'expirado' : `vale até ${formatDateTime(c.expiresAt)}`}{' '}
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      disabled={ocupado}
                      onClick={() =>
                        void executar(async () => {
                          await api.call('revokeTeamInvitation', undefined, { params: { id: c.id } });
                        })
                      }
                    >
                      Revogar
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {equipe.status === 'error' && (
        <p className="alert alert--danger" role="alert">
          <span className="alert__body">Não foi possível carregar a equipe.</span>
        </p>
      )}
    </section>
  );
}
