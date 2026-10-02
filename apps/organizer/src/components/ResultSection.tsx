import { useCallback, useState, type FormEvent } from 'react';
import { Trophy } from 'lucide-react';
import {
  ApiClientError,
  formatDateTime,
  formatNumberLabel,
  type DrawStatus,
} from '@clubedarifa/shared';
import { DeliveryPanel } from './DeliveryPanel.tsx';
import { useApiResource } from '../hooks/useApiResource.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { api } from '../api.ts';

/**
 * Apuracao e resultado (M06 · RN09 · RN20).
 *
 * O ganhador NAO e digitado: o organizador informa o numero da Loteria Federal e a
 * evidencia; a API calcula o vencedor sobre o retrato congelado das vendas e devolve
 * cada tentativa. Corrigir cria uma versao nova (com motivo) — a anterior fica
 * retificada, nunca apagada. Publicar exige MFA, entao a API pode recusar com 403.
 */
const STATUS_COM_APURACAO: readonly DrawStatus[] = [
  'VENDAS ENCERRADAS',
  'APURAÇÃO',
  'RESULTADO PUBLICADO',
  'ARQUIVADA',
];

export function ResultSection({
  drawId,
  status,
  onChanged,
}: {
  drawId: string;
  status: DrawStatus;
  onChanged: () => void;
}) {
  const { can } = useSession();
  const visivel = STATUS_COM_APURACAO.includes(status);

  const resultado = useApiResource(
    (signal) =>
      visivel
        ? api.call('organizerDrawResult', undefined, { params: { id: drawId }, signal }).catch((f) => {
            // Ainda sem resultado: 404 e o estado normal de "em apuracao".
            if (f instanceof ApiClientError && f.status === 404) return null;
            throw f;
          })
        : Promise.resolve(null),
    [drawId, status, visivel],
  );

  const [federal, setFederal] = useState('');
  const [concurso, setConcurso] = useState('');
  const [texto, setTexto] = useState('');
  const [url, setUrl] = useState('');
  const [motivo, setMotivo] = useState('');
  const [corrigindo, setCorrigindo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const atual = resultado.data;
  const podeEscrever = can('draw:lifecycle:write');

  const enviar = useCallback(
    async (evento: FormEvent) => {
      evento.preventDefault();
      setEnviando(true);
      setErro(null);
      const corpo = {
        federalNumber: federal.trim(),
        ...(concurso.trim() ? { federalContest: concurso.trim() } : {}),
        ...(texto.trim() ? { evidenceText: texto.trim() } : {}),
        ...(url.trim() ? { evidenceUrl: url.trim() } : {}),
      };
      try {
        if (corrigindo) {
          await api.call('correctDrawResult', { ...corpo, reason: motivo.trim() }, { params: { id: drawId } });
        } else {
          await api.call('publishDrawResult', corpo, { params: { id: drawId } });
        }
        setCorrigindo(false);
        setFederal('');
        setTexto('');
        setUrl('');
        setMotivo('');
        resultado.reload();
        onChanged();
      } catch (falha) {
        setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível publicar o resultado.');
      } finally {
        setEnviando(false);
      }
    },
    [concurso, corrigindo, drawId, federal, motivo, onChanged, resultado, texto, url],
  );

  if (!visivel) return null;

  const mostrarForm = podeEscrever && ((!atual && resultado.status === 'ready') || corrigindo);

  return (
    <section className="section" aria-labelledby="resultado">
      <div className="section__head">
        <h2 className="section__title" id="resultado">
          Apuração e resultado
        </h2>
      </div>

      {resultado.status === 'error' && (
        <p className="alert alert--danger" role="alert">
          <span className="alert__body">Não foi possível carregar o resultado.</span>
        </p>
      )}

      {atual && (
        <div className="result-card">
          <Trophy size={20} aria-hidden="true" />
          <p>
            {atual.current.winningLabel ? (
              <>
                Número contemplado <strong>{atual.current.winningLabel}</strong> — {atual.current.winnerMasked}
              </>
            ) : (
              <strong>Sem contemplado</strong>
            )}
          </p>
          <p className="muted">
            Federal {atual.current.federalNumber} → {formatNumberLabel(atual.current.candidateNumber, atual.labelDigits)} ·
            versão {atual.current.version} · {formatDateTime(atual.current.publishedAt)}
          </p>
          {podeEscrever && !corrigindo && status !== 'ARQUIVADA' && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setCorrigindo(true)}>
              Corrigir resultado
            </button>
          )}
        </div>
      )}

      {atual && (status === 'RESULTADO PUBLICADO' || status === 'ARQUIVADA') && (
        <DeliveryPanel drawId={drawId} status={status} delivery={atual.delivery} onChanged={() => { resultado.reload(); onChanged(); }} />
      )}

      {!atual && resultado.status === 'ready' && !podeEscrever && (
        <p className="muted">Aguardando a publicação do resultado pela organização.</p>
      )}

      {mostrarForm && (
        <form className="form-grid" onSubmit={(e) => void enviar(e)}>
          <div className="field">
            <label className="field__label" htmlFor="res-federal">
              Número da Loteria Federal
            </label>
            <input id="res-federal" className="field__input" inputMode="numeric" required value={federal} onChange={(e) => setFederal(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="res-concurso">
              Concurso <span className="muted">(opcional)</span>
            </label>
            <input id="res-concurso" className="field__input" value={concurso} onChange={(e) => setConcurso(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="res-texto">
              Evidência (texto)
            </label>
            <textarea id="res-texto" className="field__input" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="res-url">
              Evidência (link https)
            </label>
            <input id="res-url" className="field__input" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          {corrigindo && (
            <div className="field">
              <label className="field__label" htmlFor="res-motivo">
                Motivo da correção
              </label>
              <input id="res-motivo" className="field__input" required minLength={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
          )}
          {erro && (
            <p className="alert alert--danger" role="alert">
              <span className="alert__body">{erro}</span>
            </p>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando ? 'Enviando…' : corrigindo ? 'Publicar correção' : 'Publicar resultado'}
            </button>
            {corrigindo && (
              <button type="button" className="btn btn--ghost" onClick={() => setCorrigindo(false)}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
