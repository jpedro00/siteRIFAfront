import { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { mediaSrc } from '@clubedarifa/shared';
import { api, apiBaseUrl } from '../api.ts';
import { ImageError, prepareImage } from '../lib/imageUpload.ts';

/**
 * Envio de imagem com pre-visualizacao. Guarda no campo o endereco devolvido pela API
 * (`/api/public/media/<id>`); o organizador nunca ve um link tecnico.
 */
interface Props {
  readonly label: string;
  readonly value: string;
  readonly onChange: (valor: string) => void;
  readonly hint?: string;
  readonly error?: string | undefined;
  readonly disabled?: boolean;
  /** Proporcao da moldura da previa, so visual. */
  readonly shape?: 'wide' | 'square';
}

export function ImageUploader({ label, value, onChange, hint, error, disabled, shape = 'square' }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const src = mediaSrc(value, apiBaseUrl);

  async function escolher(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setFalha(null);
    try {
      const pronta = await prepareImage(file);
      const resposta = await api.call('uploadMedia', pronta);
      onChange(resposta.url);
    } catch (e) {
      setFalha(e instanceof ImageError ? e.message : 'Não foi possível enviar a imagem. Tente novamente.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const mensagem = error ?? falha;
  return (
    <div className={`field${mensagem ? ' field--invalid' : ''}`}>
      <span className="field__label" id={`${id}-rotulo`}>
        {label}
      </span>
      <div className={`uploader uploader--${shape}`}>
        <div className="uploader__preview" aria-hidden={src ? undefined : true}>
          {src ? <img src={src} alt={`Pré-visualização: ${label}`} /> : <ImagePlus size={28} aria-hidden="true" />}
        </div>
        <div className="uploader__actions">
          <input
            ref={input}
            id={id}
            className="uploader__input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || busy}
            aria-labelledby={`${id}-rotulo`}
            onChange={(e) => void escolher(e.target.files?.[0])}
          />
          <button type="button" className="btn btn--secondary" disabled={disabled || busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <ImagePlus size={16} aria-hidden="true" />}
            {busy ? 'Enviando…' : value ? 'Trocar imagem' : 'Escolher imagem'}
          </button>
          {value && !busy && (
            <button type="button" className="btn btn--ghost" disabled={disabled} onClick={() => onChange('')}>
              <Trash2 size={16} aria-hidden="true" /> Remover
            </button>
          )}
        </div>
      </div>
      {mensagem ? (
        <p className="field__error" role="alert">
          {mensagem}
        </p>
      ) : (
        <p className="field__hint">{hint ?? 'JPG, PNG ou WebP. A imagem é reduzida automaticamente.'}</p>
      )}
    </div>
  );
}
