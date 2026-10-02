import { Users } from 'lucide-react';
import { formatDateTime } from '@clubedarifa/shared';
import { api } from '../api.ts';
import { useApiResource } from '../hooks/useApiResource.ts';

/**
 * Quem ja comprou, com nome abreviado ("Maria L."), somente se o organizador ligou a opcao.
 * Nunca mostra telefone nem e-mail; a lista vem pronta do servidor.
 */
export function RecentBuyers({ slug }: { slug: string }) {
  const compradores = useApiResource(
    (signal) => api.call('publicDrawBuyers', undefined, { params: { slug }, signal }),
    [slug],
  );
  const lista = compradores.data?.buyers ?? [];
  if (compradores.status !== 'ready' || lista.length === 0) return null;

  return (
    <section className="prose" aria-labelledby="compradores-titulo">
      <h2 id="compradores-titulo" className="prose__title">
        <Users size={18} aria-hidden="true" />
        Quem já comprou
      </h2>
      <ul className="buyers-list">
        {lista.map((b, i) => (
          <li key={`${b.paidAt}-${i}`}>
            <strong>{b.name}</strong> · {b.quantity} {b.quantity === 1 ? 'número' : 'números'}
            <span className="muted"> · {formatDateTime(b.paidAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
