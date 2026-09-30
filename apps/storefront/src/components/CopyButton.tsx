import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

/**
 * Botao "copiar". O resultado e ANUNCIADO (regiao viva) e mostrado no proprio botao:
 * copiar para a area de transferencia nao tem efeito visivel, e sem retorno a pessoa
 * nao sabe se funcionou.
 *
 * `navigator.clipboard` so existe em contexto seguro (https/localhost) e pode ser
 * negado. A queda: seleciona o texto de um campo, que o usuario copia com Ctrl+C.
 */
export function CopyButton({
  text,
  label,
  copiedLabel = 'Copiado!',
  className = 'btn btn--primary',
  onFallback,
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  className?: string;
  /** Chamado quando o navegador recusou: o pai destaca o texto para copia manual. */
  onFallback?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setFalhou(false);
      setCopiado(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setFalhou(true);
      onFallback?.();
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => void copiar()}>
        {copiado ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copiado ? copiedLabel : label}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copiado ? copiedLabel : falhou ? 'Não foi possível copiar automaticamente. Selecione o código e copie.' : ''}
      </span>
    </>
  );
}
