import { useCallback, useState, type FormEvent } from 'react';
import { Archive, PackageCheck } from 'lucide-react';
import {
  ApiClientError,
  DELIVERY_METHODS,
  formatDateTime,
  type DeliveryMethod,
  type DrawDelivery,
  type DrawStatus,
} from '@clubedarifa/shared';
import { isoToLocalInput, localInputToIso } from '../lib/drawForm.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { api } from '../api.ts';

/**
 * Entrega do premio e arquivamento (DOC-01 §15 · RN30).
 *
 * Registra data, forma, rastreio e se ha AUTORIZACAO DE IMAGEM do ganhador. Nao ha envio de
 * foto nesta versao (depende de armazenamento): por isso nenhuma imagem do ganhador e
 * publicada — a pagina publica mostra apenas "Premio entregue em DD/MM".
 *
 * Arquivar so e oferecido com a entrega registrada, e e IRREVERSIVEL: depois disso o sorteio
 * e somente leitura. A API e o banco recusam o arquivamento sem entrega; esconder o botao e
 * orientacao, nao regra.
 */
const ROTULO_FORMA: Record<DeliveryMethod, string> = {
  RETIRADA: 'Retirada pelo ganhador',
  ENVIO: 'Envio (correios/transportadora)',
  TRANSFERENCIA: 'Transferência (valor ou bem)',
};

export function DeliveryPanel({
  drawId,
  status,
  delivery,
  onChanged,
}: {
  drawId: string;
  status: DrawStatus;
  delivery: DrawDelivery | null;
  onChanged: () => void;
}) {
  const { can } = useSession();
  const podeEscrever = can('draw:lifecycle:write');
  const arquivada = status === 'ARQUIVADA';

  const [editando, setEditando] = useState(false);
  const [forma, setForma] = useState<DeliveryMethod>(delivery?.method ?? 'RETIRADA');
  const [quando, setQuando] = useState(isoToLocalInput(delivery?.deliveredAt ?? new Date().toISOString()));
  const [rastreio, setRastreio] = useState(delivery?.trackingCode ?? '');
  const [obs, setObs] = useState(delivery?.notes ?? '');
  const [autorizou, setAutorizou] = useState(delivery?.winnerImageAuthorized ?? false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoArquivo, setConfirmandoArquivo] = useState(false);

  const salvar = useCallback(
    async (evento: FormEvent) => {
      evento.preventDefault();
      const iso = localInputToIso(quando);
      if (!iso) {
        setErro('Informe a data da entrega.');
        return;
      }
      setEnviando(true);
      setErro(null);
      try {
        await api.call(
          'recordDrawDelivery',
          {
            method: forma,
            deliveredAt: iso,
            winnerImageAuthorized: autorizou,
            ...(rastreio.trim() ? { trackingCode: rastreio.trim() } : {}),
            ...(obs.trim() ? { notes: obs.trim() } : {}),
          },
          { params: { id: drawId } },
        );
        setEditando(false);
        onChanged();
      } catch (falha) {
        setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível registrar a entrega.');
      } finally {
        setEnviando(false);
      }
    },
    [autorizou, drawId, forma, obs, onChanged, quando, rastreio],
  );

  const arquivar = useCallback(async () => {
    setEnviando(true);
    setErro(null);
    try {
      await api.call('updateDrawStatus', { status: 'ARQUIVADA' }, { params: { id: drawId } });
      setConfirmandoArquivo(false);
      onChanged();
    } catch (falha) {
      setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível arquivar o sorteio.');
    } finally {
      setEnviando(false);
    }
  }, [drawId, onChanged]);

  const mostrarForm = podeEscrever && !arquivada && (editando || !delivery);

  return (
    <div className="delivery" aria-labelledby="entrega-titulo">
      <h3 className="delivery__title" id="entrega-titulo">
        <PackageCheck size={18} aria-hidden="true" /> Entrega do prêmio
      </h3>

      {delivery && !editando && (
        <dl className="delivery__summary">
          <div>
            <dt>Forma</dt>
            <dd>{ROTULO_FORMA[delivery.method]}</dd>
          </div>
          <div>
            <dt>Entregue em</dt>
            <dd>{formatDateTime(delivery.deliveredAt)}</dd>
          </div>
          {delivery.trackingCode && (
            <div>
              <dt>Rastreio</dt>
              <dd>{delivery.trackingCode}</dd>
            </div>
          )}
          {delivery.notes && (
            <div>
              <dt>Observações</dt>
              <dd>{delivery.notes}</dd>
            </div>
          )}
          <div>
            <dt>Autorização de imagem do ganhador</dt>
            <dd>{delivery.winnerImageAuthorized ? 'Sim' : 'Não'}</dd>
          </div>
        </dl>
      )}

      {!delivery && !podeEscrever && <p className="muted">A entrega ainda não foi registrada.</p>}
      {!delivery && podeEscrever && !arquivada && (
        <p className="muted">
          Depois que o prêmio chegar ao ganhador, registre a entrega. A página pública passa a mostrar “Prêmio
          entregue em …”, e então o sorteio pode ser arquivado.
        </p>
      )}

      {mostrarForm && (
        <form className="form-grid" onSubmit={(e) => void salvar(e)}>
          <div className="field">
            <label className="field__label" htmlFor="ent-forma">
              Forma de entrega
            </label>
            <select id="ent-forma" className="field__input" value={forma} onChange={(e) => setForma(e.target.value as DeliveryMethod)}>
              {DELIVERY_METHODS.map((m) => (
                <option key={m} value={m}>
                  {ROTULO_FORMA[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="ent-quando">
              Data da entrega
            </label>
            <input id="ent-quando" className="field__input" type="datetime-local" required value={quando} onChange={(e) => setQuando(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="ent-rastreio">
              Código de rastreio <span className="muted">(opcional)</span>
            </label>
            <input id="ent-rastreio" className="field__input" maxLength={100} value={rastreio} onChange={(e) => setRastreio(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="ent-obs">
              Observações <span className="muted">(opcional — não aparecem para o público)</span>
            </label>
            <textarea id="ent-obs" className="field__input" rows={3} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
          <label className="check">
            <input type="checkbox" checked={autorizou} onChange={(e) => setAutorizou(e.target.checked)} />
            <span>O ganhador autorizou o uso da sua imagem (autorização anexada ao processo)</span>
          </label>
          <p className="field__hint">
            Nesta versão nenhuma foto do ganhador é publicada, com ou sem autorização.
          </p>
          {erro && (
            <p className="alert alert--danger" role="alert">
              <span className="alert__body">{erro}</span>
            </p>
          )}
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando ? 'Salvando…' : delivery ? 'Salvar correção' : 'Registrar entrega'}
            </button>
            {delivery && (
              <button type="button" className="btn btn--ghost" onClick={() => setEditando(false)}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}

      {delivery && podeEscrever && !arquivada && !editando && (
        <div className="row">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditando(true)}>
            Corrigir entrega
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setConfirmandoArquivo(true)}>
            <Archive size={15} aria-hidden="true" />
            Arquivar sorteio
          </button>
        </div>
      )}

      {confirmandoArquivo && (
        <div className="alert alert--warning" role="alertdialog" aria-labelledby="arquivo-titulo">
          <div className="alert__body stack stack--sm">
            <p className="alert__title" id="arquivo-titulo">
              Arquivar este sorteio?
            </p>
            <p>
              Tudo fica somente leitura e o sorteio passa para o histórico público da comunidade. Esta ação não
              pode ser desfeita.
            </p>
            <div className="row">
              <button type="button" className="btn btn--primary btn--sm" disabled={enviando} onClick={() => void arquivar()}>
                {enviando ? <span className="btn__spinner" aria-hidden="true" /> : null}
                Arquivar
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmandoArquivo(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {erro && !mostrarForm && (
        <p className="alert alert--danger" role="alert">
          <span className="alert__body">{erro}</span>
        </p>
      )}

      {arquivada && <p className="muted">Sorteio arquivado: somente leitura.</p>}
    </div>
  );
}
