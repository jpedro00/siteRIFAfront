import { formatInteger, percentOf } from '@campaigns/shared';

/**
 * Progresso de vendas.
 *
 * RN18 — o que conta como vendido e SOMENTE o que foi PAGO. Numero reservado
 * ou aguardando pagamento nao entra: incluir daria um progresso que anda para
 * tras quando uma reserva vence, e uma barra que recua destroi a confianca
 * exatamente na tela onde ela esta sendo construida.
 *
 * POR ISSO O RODAPE FALA DE VENDA, NUNCA DE DISPONIBILIDADE. `total - paid`
 * responde "quantos ainda nao foram vendidos", que NAO e "quantos voce pode
 * escolher agora": um numero reservado por outra pessoa nao foi vendido e
 * tambem nao esta livre. Rotular essa conta como "restantes" fazia o painel do
 * sorteio afirmar duas coisas diferentes lado a lado — "500 numeros restantes"
 * logo acima de "Disponiveis 488 de 500". Quem decide a compra lendo o numero
 * errado descobre a diferenca so ao clicar.
 *
 * A disponibilidade real depende de `takenCount`, que so existe no detalhe do
 * sorteio (`publicDrawDetail`); o resumo do catalogo nao a carrega. Quem tem o
 * dado mostra a linha "Disponiveis"; aqui ficam apenas venda e percentual, que
 * valem nos dois lugares.
 *
 * `aria-valuetext` traz a leitura em palavras. Sem ele o leitor de tela
 * anuncia so "42 por cento", sem dizer de que.
 */
export function ProgressBar({
  paid,
  total,
  size = 'md',
  showMeta = true,
}: {
  paid: number;
  total: number;
  size?: 'md' | 'lg';
  showMeta?: boolean;
}) {
  const percentual = percentOf(paid, total);
  const esgotado = paid >= total;

  return (
    <div className={`progress${size === 'lg' ? ' progress--lg' : ''}`}>
      <div
        className="progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={paid}
        aria-valuetext={`${formatInteger(paid)} de ${formatInteger(total)} números vendidos, ${percentual}%`}
      >
        <div
          className={`progress__fill${percentual >= 100 ? ' progress__fill--success' : ''}`}
          style={{ width: `${percentual}%` }}
        />
      </div>

      {showMeta && (
        <div className="progress__meta">
          <span>
            <span className="progress__value">{percentual}%</span> vendido
          </span>
          <span>
            {esgotado ? (
              'Todos os números foram vendidos'
            ) : (
              <>
                <span className="progress__value">{formatInteger(paid)}</span> de{' '}
                {formatInteger(total)} vendidos
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
