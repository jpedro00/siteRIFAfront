import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ApiClientError,
  MEMBERSHIP_ROLE_LABELS,
  formatDateTime,
  type AcceptInvitationResponse,
} from '@clubedarifa/shared';
import { AuthGate } from './AuthGate.tsx';
import { Loading } from '../components/States.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { api } from '../api.ts';

/**
 * Aceite de convite: `/convite/:token`. A previa e publica (o e-mail vem mascarado);
 * aceitar exige sessao — e a API confere que o e-mail da sessao e o do convite.
 * Quem ainda nao tem conta cria uma na vitrine com o MESMO e-mail e volta ao link.
 */
export function InvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const previa = useApiResource(
    (signal) => api.call('invitationPreview', undefined, { params: { token }, signal }),
    [token],
  );

  if (previa.status === 'loading') return <Loading label="Abrindo o convite…" />;

  if (previa.status === 'error' || !previa.data) {
    return (
      <div className="auth">
        <div className="auth__box" role="alert">
          <h1>Convite não encontrado</h1>
          <p className="muted">O link está incorreto ou já não vale. Peça um novo convite a quem convidou você.</p>
        </div>
      </div>
    );
  }

  const c = previa.data;
  const situacao: Record<typeof c.state, string | null> = {
    OPEN: null,
    ACCEPTED: 'Este convite já foi aceito.',
    REVOKED: 'Este convite foi revogado.',
    EXPIRED: 'Este convite expirou. Peça um novo.',
  };
  const bloqueio = situacao[c.state];

  return (
    <div className="auth">
      <div className="auth__box">
        <h1>Convite para {c.tenantName}</h1>
        <p>
          Você foi convidado como <strong>{MEMBERSHIP_ROLE_LABELS[c.role]}</strong> ({c.emailMasked}). Vale até{' '}
          {formatDateTime(c.expiresAt)}.
        </p>
        {bloqueio ? (
          <p className="alert alert--warning" role="status">
            <span className="alert__body">{bloqueio}</span>
          </p>
        ) : (
          <AuthGate>
            <Aceitar token={token} />
          </AuthGate>
        )}
      </div>
    </div>
  );
}

function Aceitar({ token }: { token: string }) {
  const [feito, setFeito] = useState<AcceptInvitationResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (feito) {
    return (
      <p className="alert alert--success" role="status">
        <span className="alert__body">
          Pronto! Você agora faz parte de <strong>{feito.tenantName}</strong>. Abra o painel da comunidade
          para começar.
        </span>
      </p>
    );
  }

  return (
    <>
      {erro && (
        <p className="alert alert--danger" role="alert">
          <span className="alert__body">{erro}</span>
        </p>
      )}
      <button
        type="button"
        className="btn btn--primary"
        disabled={enviando}
        onClick={() => {
          setEnviando(true);
          setErro(null);
          api
            .call('acceptInvitation', undefined, { params: { token } })
            .then(setFeito)
            .catch((f: unknown) =>
              setErro(f instanceof ApiClientError ? f.message : 'Não foi possível aceitar o convite.'),
            )
            .finally(() => setEnviando(false));
        }}
      >
        {enviando ? 'Aceitando…' : 'Aceitar convite'}
      </button>
    </>
  );
}
