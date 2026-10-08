import { Link, useParams } from 'react-router-dom';
import { useAppPaths } from '../state/MarketplaceScope.tsx';
import { ArrowLeft, Award, FileCheck2, PackageCheck, Trophy } from 'lucide-react';
import {
  ApiClientError,
  formatDateTime,
  type DeliveryMethod,
  formatNumberLabel,
  type DrawResultVersion,
} from '@clubedarifa/shared';
import { CopyButton } from '../components/CopyButton.tsx';
import { ErrorState, Loading, NotFoundState } from '../components/States.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { useDocumentMeta } from '../hooks/useDocumentMeta.ts';
import { api } from '../api.ts';

/**
 * Resultado publico do sorteio: `/sorteio/:slug/resultado`. M06 · RN09 · RN20.
 *
 * MOSTRA: o numero contemplado, o nome MASCARADO, a fonte (Loteria Federal), a data e
 * o hash da prova — e a conta inteira, tentativa por tentativa. NAO mostra: nome
 * completo, telefone, e-mail. Quem quiser conferir refaz o calculo com o mesmo retrato
 * (snapshot) e chega ao mesmo numero.
 *
 * Um resultado CORRIGIDO nao apaga o anterior: a versao antiga continua aqui, marcada
 * como retificada, para quem viu o primeiro numero entender o que mudou.
 */
const ROTULO_ENTREGA: Record<DeliveryMethod, string> = {
  RETIRADA: 'retirada pelo ganhador',
  ENVIO: 'enviado ao ganhador',
  TRANSFERENCIA: 'transferência ao ganhador',
};

export function ResultPage() {
  const paths = useAppPaths();
  const { slug = '' } = useParams<{ slug: string }>();

  const resultado = useApiResource(
    (signal) => api.call('publicDrawResult', undefined, { params: { slug }, signal }),
    [slug],
  );

  const dados = resultado.data;
  useDocumentMeta({
    title: dados ? `Resultado · ${dados.drawTitle}` : 'Resultado do sorteio',
    description: dados
      ? dados.current.winningLabel
        ? `Número contemplado: ${dados.current.winningLabel}.`
        : 'Resultado publicado.'
      : null,
  });

  if (resultado.status === 'loading') {
    return (
      <div className="container page">
        <Loading label="Carregando o resultado…" />
      </div>
    );
  }

  if (resultado.status === 'error' || !dados) {
    const semResultado =
      resultado.error instanceof ApiClientError && resultado.error.code === 'NOT_FOUND';
    return (
      <div className="container page">
        {semResultado ? (
          <NotFoundState
            title="O resultado ainda não foi publicado"
            message="Quando a organização publicar, ele aparece aqui, com a prova de como foi apurado."
            action={
              <Link className="btn btn--primary" to={paths.draw(slug)}>
                Voltar ao sorteio
              </Link>
            }
          />
        ) : (
          <ErrorState error={resultado.error} onRetry={resultado.reload} />
        )}
      </div>
    );
  }

  const atual = dados.current;

  return (
    <div className="container page result-page">
      <Link className="back-link" to={paths.draw(slug)}>
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar ao sorteio
      </Link>

      <header className="result__head">
        <p className="eyebrow">Resultado</p>
        <h1 className="page__title">{dados.drawTitle}</h1>
        {atual.version > 1 && (
          <p className="alert alert--warning" role="status">
            <span className="alert__body">
              Este resultado foi <strong>corrigido</strong> (versão {atual.version}). A versão
              anterior continua visível mais abaixo, marcada como retificada.
            </span>
          </p>
        )}
      </header>

      <section className="result__winner" aria-labelledby="ganhador">
        <Trophy size={28} aria-hidden="true" />
        <h2 id="ganhador" className="result__label">
          {atual.winningLabel ? 'Número contemplado' : 'Sem contemplado'}
        </h2>
        {atual.winningLabel ? (
          <>
            <p className="result__number" aria-label={`Número ${atual.winningLabel}`}>
              {atual.winningLabel}
            </p>
            <p className="result__buyer">
              <Award size={16} aria-hidden="true" /> Participante: <strong>{atual.winnerMasked}</strong>
            </p>
          </>
        ) : (
          <p className="result__none">
            O número apurado não foi vendido e a regra do sorteio não prevê outro contemplado.
          </p>
        )}
      </section>

      {/* DOC-01 §15: status publico da entrega. So o fato, a data e a forma — sem rastreio nem foto. */}
      <section className="result__delivery" aria-labelledby="entrega">
        <h2 id="entrega" className="prose__title">
          <PackageCheck size={18} aria-hidden="true" />
          Entrega do prêmio
        </h2>
        {dados.delivery ? (
          <p className="alert alert--success" role="status">
            <span className="alert__body">
              <strong>Prêmio entregue em {new Date(dados.delivery.deliveredAt).toLocaleDateString('pt-BR')}</strong>
              {' · '}
              {ROTULO_ENTREGA[dados.delivery.method]}
            </span>
          </p>
        ) : (
          <p className="muted">A entrega do prêmio ainda não foi registrada pela organização.</p>
        )}
      </section>

      <dl className="result__facts">
        <div>
          <dt>Fonte</dt>
          <dd>Loteria Federal{atual.federalContest ? ` · concurso ${atual.federalContest}` : ''}</dd>
        </div>
        <div>
          <dt>Número sorteado</dt>
          <dd>{atual.federalNumber}</dd>
        </div>
        <div>
          <dt>Publicado em</dt>
          <dd>{formatDateTime(atual.publishedAt)}</dd>
        </div>
        {atual.evidenceUrl && (
          <div>
            <dt>Evidência</dt>
            <dd>
              <a href={atual.evidenceUrl} target="_blank" rel="noreferrer noopener">
                Abrir a fonte
              </a>
            </dd>
          </div>
        )}
        {atual.evidenceText && (
          <div>
            <dt>Registro</dt>
            <dd>{atual.evidenceText}</dd>
          </div>
        )}
      </dl>

      <section className="result__proof" aria-labelledby="prova">
        <h2 id="prova" className="prose__title">
          <FileCheck2 size={18} aria-hidden="true" />
          Como conferir
        </h2>
        <p>
          O resultado sai dos <strong>{dados.labelDigits} últimos dígitos</strong> do número da
          Loteria Federal ({atual.federalNumber} → <strong>{formatNumberLabel(atual.candidateNumber, dados.labelDigits)}</strong>).
          Se esse número não foi vendido, vale o próximo vendido acima, voltando ao início da
          grade. Toda a conta parte do retrato das vendas congelado quando elas encerraram.
        </p>

        <details className="result__attempts">
          <summary>Ver cada número conferido ({atual.attempts.length})</summary>
          <ol>
            {atual.attempts.map((a, i) => (
              <li key={`${a.number}-${i}`}>
                {formatNumberLabel(a.number, dados.labelDigits)} —{' '}
                {!a.inGrid ? 'fora da grade' : a.sold ? 'vendido (contemplado)' : 'não vendido'}
              </li>
            ))}
          </ol>
        </details>

        <HashLine label="Hash do retrato das vendas" value={atual.snapshotSha256} />
        <HashLine label="Hash da prova" value={atual.proofSha256} />
      </section>

      {dados.previous.length > 0 && (
        <section aria-labelledby="anteriores" className="result__previous">
          <h2 id="anteriores" className="prose__title">
            Versões retificadas
          </h2>
          <ul>
            {dados.previous.map((v: DrawResultVersion) => (
              <li key={v.version}>
                <strong>Versão {v.version} (retificada)</strong> ·{' '}
                {v.winningLabel ? `número ${v.winningLabel}` : 'sem contemplado'} · publicada em{' '}
                {formatDateTime(v.publishedAt)}
              </li>
            ))}
          </ul>
          {atual.correctionReason && (
            <p className="muted">Motivo da correção: {atual.correctionReason}</p>
          )}
        </section>
      )}
    </div>
  );
}

function HashLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="hash-line">
      <span className="hash-line__label">{label}</span>
      <code className="hash-line__value">{value}</code>
      <CopyButton text={value} label="Copiar" copiedLabel="Copiado" className="btn btn--ghost btn--sm" />
    </div>
  );
}
