import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dices, Eraser, Search, X } from 'lucide-react';
import { formatInteger, formatNumberLabel } from '@campaigns/shared';
import { NumberCell, type CellState } from './NumberCell.tsx';
import { NumberLegend } from './NumberLegend.tsx';

/**
 * Grade de numeros.
 *
 * DESEMPENHO — por que nao ha biblioteca de virtualizacao aqui
 * ------------------------------------------------------------
 * Mil botoes sao muito para desenhar de uma vez, mas virtualizacao por
 * janela quebra tres coisas que importam nesta tela: o Ctrl+F do navegador,
 * a navegacao por Tab e o scroll ate um numero especifico.
 *
 * A saida e `content-visibility: auto` por centena (ver styles.css). O
 * navegador pula layout e pintura dos blocos fora da tela, mas os elementos
 * continuam no DOM — buscaveis, focaveis, roláveis. `contain-intrinsic-size`
 * reserva a altura para que a barra de rolagem nao pule quando um bloco
 * entra em cena. Custo: zero dependencia.
 *
 * As centenas tambem resolvem um problema humano: uma parede de 1000 numeros
 * sem marcos e impossivel de percorrer. Com os cortes, achar o 734 vira
 * "bloco 700".
 */

const TAMANHO_BLOCO = 100;

export interface NumberGridProps {
  readonly totalNumbers: number;
  readonly labelDigits: 2 | 3;
  /** Numero -> estado ocupado. Ausente do mapa significa LIVRE. */
  readonly taken: ReadonlyMap<number, Exclude<CellState, 'LIVRE' | 'SELECIONADO'>>;
  readonly selected: ReadonlySet<number>;
  readonly onToggle: (value: number) => void;
  readonly onSelectMany: (values: number[]) => void;
  readonly onClear: () => void;
  readonly maxSelection: number;
  readonly disabled?: boolean;
}

export function NumberGrid({
  totalNumbers,
  labelDigits,
  taken,
  selected,
  onToggle,
  onSelectMany,
  onClear,
  maxSelection,
  disabled = false,
}: NumberGridProps) {
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState<number | null>(null);
  const [aviso, setAviso] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Pool do sorteio aleatorio: livre E ainda nao escolhido por mim. Exclui a
   * selecao local de proposito — "Surpreenda-me" nao pode devolver um numero
   * que ja esta na minha lista.
   */
  const livres = useMemo(() => {
    const resultado: number[] = [];
    for (let n = 0; n < totalNumbers; n += 1) {
      if (!taken.has(n) && !selected.has(n)) resultado.push(n);
    }
    return resultado;
  }, [totalNumbers, taken, selected]);

  /**
   * Disponibilidade REAL, para o rotulo. Conta apenas o que o servidor marcou
   * como ocupado.
   *
   * O pool acima nao serve aqui: ele desconta a minha selecao, e usa-lo fazia
   * o contador cair de "488 disponiveis" para "485" assim que eu marcava tres
   * numeros — como se escolher ja tivesse tirado algo de circulacao. Nao tirou:
   * ate a reserva ser aceita pelo servidor, aqueles numeros continuam
   * disponiveis para todo mundo, inclusive para mim.
   */
  const disponiveis = useMemo(() => {
    let total = 0;
    for (let n = 0; n < totalNumbers; n += 1) if (!taken.has(n)) total += 1;
    return total;
  }, [totalNumbers, taken]);

  const blocos = useMemo(() => {
    const grupos: { inicio: number; fim: number }[] = [];
    for (let inicio = 0; inicio < totalNumbers; inicio += TAMANHO_BLOCO) {
      grupos.push({ inicio, fim: Math.min(inicio + TAMANHO_BLOCO, totalNumbers) });
    }
    return grupos;
  }, [totalNumbers]);

  /** Sorteia `quantidade` numeros livres sem repetir. */
  const adicionarAleatorios = useCallback(
    (quantidade: number) => {
      const espaco = maxSelection - selected.size;
      if (espaco <= 0) {
        setAviso(`Você já escolheu o máximo de ${maxSelection} números por compra.`);
        return;
      }
      if (livres.length === 0) {
        setAviso('Não há mais números disponíveis neste sorteio.');
        return;
      }

      const quantos = Math.min(quantidade, espaco, livres.length);
      // Embaralhamento parcial de Fisher-Yates: sorteia `quantos` posicoes
      // sem percorrer nem copiar o array inteiro a cada escolha.
      const pool = livres.slice();
      const escolhidos: number[] = [];
      for (let i = 0; i < quantos; i += 1) {
        const j = i + Math.floor(Math.random() * (pool.length - i));
        [pool[i], pool[j]] = [pool[j]!, pool[i]!];
        escolhidos.push(pool[i]!);
      }
      escolhidos.sort((a, b) => a - b);
      onSelectMany(escolhidos);

      const faltou = quantidade - quantos;
      setAviso(
        faltou > 0
          ? `Adicionamos ${quantos} ${quantos === 1 ? 'número' : 'números'}. Não havia espaço para mais.`
          : `${quantos} ${quantos === 1 ? 'número adicionado' : 'números adicionados'}.`,
      );
    },
    [livres, maxSelection, onSelectMany, selected.size],
  );

  /** Leva a grade ate o numero pedido e o destaca por alguns segundos. */
  const irParaNumero = useCallback(
    (texto: string) => {
      const limpo = texto.trim();
      if (limpo === '') return;
      const alvo = Number.parseInt(limpo, 10);
      if (!Number.isInteger(alvo) || alvo < 0 || alvo >= totalNumbers) {
        setAviso(
          `Digite um número entre ${formatNumberLabel(0, labelDigits)} e ${formatNumberLabel(totalNumbers - 1, labelDigits)}.`,
        );
        setDestaque(null);
        return;
      }

      const celula = containerRef.current?.querySelector<HTMLElement>(`[data-number="${alvo}"]`);
      celula?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setDestaque(alvo);

      const ocupado = taken.get(alvo);
      setAviso(
        ocupado
          ? `Número ${formatNumberLabel(alvo, labelDigits)} não está disponível.`
          : `Número ${formatNumberLabel(alvo, labelDigits)} está disponível.`,
      );
    },
    [labelDigits, taken, totalNumbers],
  );

  // O destaque se apaga sozinho: um realce permanente vira ruido assim que a
  // pessoa passa a olhar outra parte da grade.
  useEffect(() => {
    if (destaque === null) return;
    const id = window.setTimeout(() => setDestaque(null), 2600);
    return () => window.clearTimeout(id);
  }, [destaque]);

  const cheio = selected.size >= maxSelection;

  return (
    <section className="grid-panel" aria-labelledby="grade-titulo">
      <div className="grid-panel__head">
        <div>
          <h2 id="grade-titulo" className="grid-panel__title">
            Escolha seus números
          </h2>
          <p className="grid-panel__hint">
            {formatInteger(disponiveis)} de {formatInteger(totalNumbers)} disponíveis ·
            até {maxSelection} por compra
          </p>
        </div>
        <NumberLegend />
      </div>

      <div className="grid-tools">
        <form
          className="grid-tools__search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            irParaNumero(busca);
          }}
        >
          <label className="sr-only" htmlFor="busca-numero">
            Procurar um número
          </label>
          <Search className="grid-tools__search-icon" size={16} aria-hidden="true" />
          <input
            id="busca-numero"
            className="grid-tools__input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={`Ir para o número (${formatNumberLabel(0, labelDigits)}–${formatNumberLabel(totalNumbers - 1, labelDigits)})`}
            value={busca}
            onChange={(event) => setBusca(event.target.value.replace(/\D/g, ''))}
          />
          {busca !== '' && (
            <button
              type="button"
              className="grid-tools__clear"
              aria-label="Limpar busca"
              onClick={() => {
                setBusca('');
                setDestaque(null);
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </form>

        <div className="grid-tools__actions">
          {[1, 5, 10].map((quantidade) => (
            <button
              key={quantidade}
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={disabled || cheio || livres.length === 0}
              onClick={() => adicionarAleatorios(quantidade)}
            >
              +{quantidade}
            </button>
          ))}
          <button
            type="button"
            className="btn btn--soft btn--sm"
            disabled={disabled || cheio || livres.length === 0}
            onClick={() => adicionarAleatorios(Math.max(1, Math.min(5, maxSelection - selected.size)))}
          >
            <Dices size={15} aria-hidden="true" />
            Surpreenda-me
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={disabled || selected.size === 0}
            onClick={() => {
              onClear();
              setAviso('Seleção limpa.');
            }}
          >
            <Eraser size={15} aria-hidden="true" />
            Limpar
          </button>
        </div>
      </div>

      {/*
        Regiao viva: e por aqui que quem usa leitor de tela fica sabendo do
        resultado de "+10" ou de uma busca. Sem isso, a acao acontece em
        silencio e a pessoa nao tem como saber o que mudou.
      */}
      <p className="grid-tools__status" role="status" aria-live="polite">
        {aviso}
      </p>

      <div className="grid-blocks" ref={containerRef}>
        {blocos.map(({ inicio, fim }) => (
          <div key={inicio} className="grid-block">
            {blocos.length > 1 && (
              <h3 className="grid-block__title">
                {formatNumberLabel(inicio, labelDigits)} – {formatNumberLabel(fim - 1, labelDigits)}
              </h3>
            )}
            <div className="number-grid" role="group" aria-label={`Números de ${formatNumberLabel(inicio, labelDigits)} a ${formatNumberLabel(fim - 1, labelDigits)}`}>
              {Array.from({ length: fim - inicio }, (_, offset) => {
                const valor = inicio + offset;
                const ocupado = taken.get(valor);
                const estado: CellState = ocupado ?? (selected.has(valor) ? 'SELECIONADO' : 'LIVRE');
                return (
                  <span
                    key={valor}
                    data-number={valor}
                    className={destaque === valor ? 'number-slot is-highlighted' : 'number-slot'}
                  >
                    <NumberCell
                      value={valor}
                      labelDigits={labelDigits}
                      state={estado}
                      onToggle={disabled ? undefined : onToggle}
                    />
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
