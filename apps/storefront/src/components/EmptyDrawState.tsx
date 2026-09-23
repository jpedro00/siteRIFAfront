import { Bell, Ticket } from 'lucide-react';

/**
 * A comunidade existe, mas nao ha sorteio aberto.
 *
 * Esta tela nao pede desculpa por um sistema incompleto e nao menciona fase,
 * roadmap ou construcao. Do ponto de vista de quem chegou, nada esta faltando
 * no PRODUTO: e a comunidade que ainda nao publicou sorteio, e essa e uma
 * situacao normal da vida de uma vitrine — entre um sorteio e o proximo, esta
 * e a tela correta.
 *
 * O tom e de convite para voltar, nao de erro.
 */
export function EmptyDrawState({ communityName }: { communityName: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon">
        <Ticket size={28} aria-hidden="true" />
      </span>
      <h2 className="empty-state__title">Nenhum sorteio aberto no momento</h2>
      <p className="empty-state__text">
        {communityName} ainda não tem sorteios com vendas abertas. Assim que houver um novo
        sorteio, ele aparece aqui.
      </p>
      <p className="empty-state__text muted">
        <Bell size={14} aria-hidden="true" style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
        Volte em breve para conferir.
      </p>
    </div>
  );
}
