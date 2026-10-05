import { useEffect, useRef, useState } from 'react';
import { AlertCircle, RefreshCw, WifiOff } from 'lucide-react';
import type { OrderResponse } from '@clubedarifa/shared';
import { CopyButton } from './CopyButton.tsx';
import { ReservationTimer } from './ReservationTimer.tsx';

/**
 * Pagamento por PIX.
 *
 * QUATRO ESTADOS, todos com texto (nunca so cor ou icone):
 *   - com cobranca         QR + "copia e cola" + prazo + status ao vivo
 *   - sem cobranca         o PIX nao foi gerado (provedor fora): botao para tentar de novo,
 *                          e a garantia de que os numeros continuam reservados
 *   - sem conexao          a tela esta desatualizada; o pagamento pode ter acontecido
 *   - estorno manual       pagou tarde e o numero ja tinha outro dono
 *
 * O QR vem do provedor (imagem em base64) quando ha; senao e desenhado no navegador a
 * partir do "copia e cola". A biblioteca de QR e carregada SO nesse caso (import
 * dinamico), para nao pesar no bundle de quem nunca precisa dela.
 */
export interface PixPaymentProps {
  readonly order: OrderResponse;
  /** A ultima consulta de status falhou: a tela pode estar desatualizada. */
  readonly stale: boolean;
  readonly generating: boolean;
  readonly generateError: string | null;
  readonly onGenerate: () => void;
}

function useQrImage(copyPaste: string | null, base64: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (base64 ? `data:image/png;base64,${base64}` : null));

  useEffect(() => {
    if (base64) {
      setUrl(`data:image/png;base64,${base64}`);
      return;
    }
    if (!copyPaste) {
      setUrl(null);
      return;
    }
    let cancelado = false;
    void import('qrcode')
      .then((mod) => mod.toDataURL(copyPaste, { margin: 1, width: 260, errorCorrectionLevel: 'M' }))
      .then((dataUrl) => {
        if (!cancelado) setUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelado) setUrl(null);
      });
    return () => {
      cancelado = true;
    };
  }, [copyPaste, base64]);

  return url;
}

export function PixPayment({ order, stale, generating, generateError, onGenerate }: PixPaymentProps) {
  const pagamento = order.payment;
  const codigoRef = useRef<HTMLTextAreaElement>(null);
  const qr = useQrImage(pagamento?.copyPaste ?? null, pagamento?.qrCodeBase64 ?? null);

  if (order.status !== 'PENDENTE') return null;

  // ---- sem cobranca: o PIX ainda nao foi gerado --------------------------------
  if (!pagamento) {
    return (
      <section className="pix pix--missing" aria-labelledby="pix-titulo">
        <h2 id="pix-titulo" className="pix__title">
          Pagamento por PIX
        </h2>
        <div className="alert alert--warning" role="status">
          <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
          <div className="alert__body">
            <p className="alert__title">O PIX ainda não foi gerado</p>
            <p>
              Não conseguimos falar com o provedor de pagamento agora. Seus números continuam
              reservados até o fim do prazo — tente gerar o PIX de novo.
            </p>
          </div>
        </div>
        {generateError && (
          <p className="field__error" role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            {generateError}
          </p>
        )}
        <button type="button" className="btn btn--primary btn--lg" disabled={generating} onClick={onGenerate}>
          {generating ? <span className="btn__spinner" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
          {generating ? 'Gerando o PIX…' : 'Gerar o PIX'}
        </button>
      </section>
    );
  }

  // ---- pagou depois de o numero ter outro dono ---------------------------------
  if (pagamento.needsManualRefund) {
    return (
      <section className="pix" aria-labelledby="pix-titulo">
        <h2 id="pix-titulo" className="pix__title">
          Pagamento recebido — precisa de atenção
        </h2>
        <div className="alert alert--danger" role="alert">
          <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
          <div className="alert__body">
            <p className="alert__title">Não conseguimos concluir sua compra</p>
            <p>
              Seu pagamento chegou depois de o prazo terminar, e um ou mais números já tinham
              outro dono. O valor será devolvido pela organização. Guarde o endereço desta página.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ---- cobranca gerada ----------------------------------------------------------
  return (
    <section className="pix" aria-labelledby="pix-titulo">
      <h2 id="pix-titulo" className="pix__title">
        Pague com PIX
      </h2>

      <div className="pix__deadline">
        <ReservationTimer expiresAt={pagamento.expiresAt} />
      </div>

      {stale && (
        <p className="alert alert--warning" role="status">
          <WifiOff className="alert__icon" size={16} aria-hidden="true" />
          <span className="alert__body">
            Sem conexão. Estamos tentando de novo — se você já pagou, a confirmação aparece assim
            que a conexão voltar.
          </span>
        </p>
      )}

      <div className="pix__body">
        <div className="pix__qr">
          {qr ? (
            <img src={qr} width={220} height={220} alt="QR Code do PIX. Aponte a câmera do app do seu banco." />
          ) : (
            <div className="pix__qr-empty" role="img" aria-label="QR Code indisponível">
              QR Code indisponível. Use o código ao lado.
            </div>
          )}
        </div>

        <div className="pix__code">
          <p className="pix__step">
            <strong>1.</strong> Abra o app do seu banco e escolha pagar com PIX.
          </p>
          <p className="pix__step">
            <strong>2.</strong> Leia o QR Code ou cole o código abaixo (“PIX copia e cola”).
          </p>

          <label className="field__label" htmlFor="pix-codigo">
            PIX copia e cola
          </label>
          <textarea
            id="pix-codigo"
            ref={codigoRef}
            className="field__input pix__textarea"
            readOnly
            rows={3}
            value={pagamento.copyPaste ?? ''}
            onFocus={(event) => event.currentTarget.select()}
          />

          {pagamento.copyPaste && (
            <CopyButton
              text={pagamento.copyPaste}
              label="Copiar código"
              copiedLabel="Código copiado!"
              onFallback={() => codigoRef.current?.select()}
            />
          )}
        </div>
      </div>

      {/* Status ao vivo: o pai consulta a cada poucos segundos; a regiao anuncia a mudanca. */}
      <p className="pix__status" role="status" aria-live="polite">
        Aguardando o pagamento… Esta página confirma sozinha assim que o PIX for pago.
      </p>
    </section>
  );
}
