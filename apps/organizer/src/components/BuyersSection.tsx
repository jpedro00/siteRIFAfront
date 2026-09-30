import { useCallback, useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import {
  ApiClientError,
  formatCents,
  formatDateTime,
  formatNumberLabel,
  type DrawOrder,
} from '@clubedarifa/shared';
import { useSession } from '../state/SessionProvider.tsx';
import { api } from '../api.ts';

const POR_PAGINA = 25;

/**
 * Compradores do sorteio, paginados por cursor ("carregar mais"): a pagina 2 nao
 * repete nem pula linha se entrar pedido novo enquanto se le a 1.
 *
 * O contato vem do SERVIDOR conforme a permissao (`contactVisible`); esconder a
 * coluna aqui seria so cosmetico. O CSV exige `buyer:read:full`.
 */
export function BuyersSection({
  drawId,
  labelDigits,
}: {
  drawId: string;
  labelDigits: 2 | 3;
}) {
  const { can } = useSession();
  const [pedidos, setPedidos] = useState<DrawOrder[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [contato, setContato] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState(false);
  const geracao = useRef(0);

  const carregar = useCallback(
    async (cursor: string | null) => {
      const minha = ++geracao.current;
      setCarregando(true);
      setErro(null);
      try {
        const r = await api.call('organizerDrawOrders', undefined, {
          params: { id: drawId },
          query: { limit: POR_PAGINA, cursor: cursor ?? undefined },
        });
        if (minha !== geracao.current) return;
        setPedidos((antes) => (cursor === null ? r.orders : [...antes, ...r.orders]));
        setProximo(r.nextCursor);
        setContato(r.contactVisible);
      } catch (falha) {
        if (minha !== geracao.current) return;
        setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível carregar os pedidos.');
      } finally {
        if (minha === geracao.current) setCarregando(false);
      }
    },
    [drawId],
  );

  useEffect(() => {
    void carregar(null);
  }, [carregar]);

  const exportar = useCallback(async () => {
    setBaixando(true);
    setErro(null);
    try {
      const arquivo = await api.call('exportDrawOrders', undefined, { params: { id: drawId } });
      const blob = new Blob([arquivo.content], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = arquivo.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (falha) {
      setErro(falha instanceof ApiClientError ? falha.message : 'Não foi possível exportar o CSV.');
    } finally {
      setBaixando(false);
    }
  }, [drawId]);

  return (
    <section className="section" aria-labelledby="compradores">
      <div className="section__head">
        <h2 className="section__title" id="compradores">
          Compradores
        </h2>
        {can('buyer:read:full') && (
          <button type="button" className="btn btn--ghost btn--sm" disabled={baixando} onClick={() => void exportar()}>
            <Download size={14} aria-hidden="true" />
            {baixando ? 'Gerando…' : 'Exportar CSV'}
          </button>
        )}
      </div>

      {erro && (
        <p className="alert alert--danger" role="alert">
          <span className="alert__body">{erro}</span>
        </p>
      )}

      {pedidos.length === 0 && !carregando && !erro ? (
        <p className="muted">Ainda não há pedidos neste sorteio.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Comprador</th>
                {contato && <th scope="col">Contato</th>}
                <th scope="col">Números</th>
                <th scope="col">Pedido</th>
                <th scope="col" className="table__num">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.orderId}>
                  <td>
                    <span className="table__primary">{p.buyerName}</span>
                    <p className="table__secondary">{formatDateTime(p.createdAt)}</p>
                  </td>
                  {contato && (
                    <td>
                      {p.buyerPhone ?? '—'}
                      {p.buyerEmail && <p className="table__secondary">{p.buyerEmail}</p>}
                    </td>
                  )}
                  <td>{p.numbers.map((n) => formatNumberLabel(n, labelDigits)).join(', ')}</td>
                  <td>
                    {p.status}
                    {p.needsManualRefund && (
                      <p className="table__secondary">Devolução manual necessária</p>
                    )}
                  </td>
                  <td className="table__num">{formatCents(p.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {carregando && <p className="muted" role="status">Carregando…</p>}
      {proximo && !carregando && (
        <button type="button" className="btn btn--ghost" onClick={() => void carregar(proximo)}>
          Carregar mais
        </button>
      )}
    </section>
  );
}
