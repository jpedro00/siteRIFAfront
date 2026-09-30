import { formatCents, formatInteger, type DashboardResponse } from '@clubedarifa/shared';

type Dia = DashboardResponse['salesByDay'][number];

/**
 * Numeros pagos por dia (30 dias), em SVG puro: sem biblioteca de grafico, sem
 * dependencia nova. Cada barra tem <title> e a tabela equivalente fica ao alcance
 * de leitor de tela — o grafico nao e o unico caminho para o dado (RN28).
 */
export function SalesChart({ days }: { days: readonly Dia[] }) {
  const largura = 600;
  const altura = 140;
  const max = Math.max(1, ...days.map((d) => d.paidNumbers));
  const passo = days.length > 0 ? largura / days.length : largura;
  const total = days.reduce((soma, d) => soma + d.paidNumbers, 0);

  return (
    <figure className="sales-chart">
      <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={`Números pagos por dia nos últimos ${days.length} dias: ${formatInteger(total)} no total.`} preserveAspectRatio="none">
        {days.map((d, i) => {
          const h = (d.paidNumbers / max) * (altura - 8);
          return (
            <rect key={d.date} className="sales-chart__bar" x={i * passo + 1} y={altura - h} width={Math.max(1, passo - 2)} height={h} rx={2}>
              <title>
                {d.date}: {formatInteger(d.paidNumbers)} pagos
                {d.revenueCents !== null ? ` · ${formatCents(d.revenueCents)}` : ''}
              </title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="muted">
        {total === 0 ? 'Nenhuma venda paga nos últimos 30 dias.' : `${formatInteger(total)} números pagos nos últimos ${days.length} dias.`}
      </figcaption>
      <details>
        <summary>Ver em tabela</summary>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col" className="table__num">Pagos</th>
            </tr>
          </thead>
          <tbody>
            {days.filter((d) => d.paidNumbers > 0).map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td className="table__num">{formatInteger(d.paidNumbers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
