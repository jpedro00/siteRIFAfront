import { useState } from 'react';

/** Campo somente leitura com o link e um botao de copiar (cai para selecionar, sem clipboard). */
export function CopyLink({ value }: { value: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="copy-link">
      <input
        className="field__input"
        readOnly
        value={value}
        aria-label="Link do convite"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => void copiar()}>
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}
