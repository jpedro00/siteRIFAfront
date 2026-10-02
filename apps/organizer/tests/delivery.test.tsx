import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, type DrawDelivery } from '@clubedarifa/shared';

const h = vi.hoisted(() => ({ call: vi.fn(), permissions: new Set<string>() }));

vi.mock('../src/api.ts', () => ({ api: { call: h.call } }));
vi.mock('../src/state/SessionProvider.tsx', () => ({
  useSession: () => ({ can: (p: string) => h.permissions.has(p) }),
}));

import { DeliveryPanel } from '../src/components/DeliveryPanel.tsx';

/**
 * Entrega do premio e arquivamento (DOC-01 §15 · RN30). A tela so INFORMA e pede: quem recusa
 * (arquivar sem entrega, editar depois de arquivado) e a API e o banco.
 */

const entrega = (extra: Partial<DrawDelivery> = {}): DrawDelivery => ({
  method: 'ENVIO',
  deliveredAt: '2030-03-01T15:00:00.000Z',
  trackingCode: 'BR123456789XX',
  notes: 'Entregue na portaria.',
  winnerImageAuthorized: true,
  recordedAt: '2030-03-01T16:00:00.000Z',
  ...extra,
});

const onChanged = vi.fn();
const abrir = (props: { status?: 'RESULTADO PUBLICADO' | 'ARQUIVADA'; delivery?: DrawDelivery | null } = {}) =>
  render(
    <DeliveryPanel
      drawId="11111111-1111-4111-8111-111111111111"
      status={props.status ?? 'RESULTADO PUBLICADO'}
      delivery={props.delivery ?? null}
      onChanged={onChanged}
    />,
  );

beforeEach(() => {
  h.call.mockReset();
  onChanged.mockReset();
  h.permissions = new Set(['draw:lifecycle:write']);
});

describe('registrar a entrega', () => {
  it('sem entrega: orienta e mostra o formulario; envia forma, data, rastreio e a autorizacao de imagem', async () => {
    h.call.mockResolvedValue({});
    abrir();
    expect(screen.getByText(/registre a entrega/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Arquivar sorteio/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('Forma de entrega'), { target: { value: 'ENVIO' } });
    fireEvent.change(screen.getByLabelText('Data da entrega'), { target: { value: '2030-03-01T12:00' } });
    fireEvent.change(screen.getByLabelText(/Código de rastreio/), { target: { value: 'BR1' } });
    fireEvent.change(screen.getByLabelText(/Observações/), { target: { value: 'Na portaria' } });
    fireEvent.click(screen.getByLabelText(/autorizou o uso da sua imagem/));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }));

    await waitFor(() => expect(h.call).toHaveBeenCalledTimes(1));
    const [nome, corpo, opcoes] = h.call.mock.calls[0]!;
    expect(nome).toBe('recordDrawDelivery');
    expect(corpo).toMatchObject({ method: 'ENVIO', trackingCode: 'BR1', notes: 'Na portaria', winnerImageAuthorized: true });
    expect(corpo.deliveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(opcoes).toEqual({ params: { id: '11111111-1111-4111-8111-111111111111' } });
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('a autorizacao de imagem NAO e presumida: nasce desmarcada, e a tela diz que nao ha foto publicada', () => {
    abrir();
    expect(screen.getByLabelText(/autorizou o uso da sua imagem/)).not.toBeChecked();
    expect(screen.getByText(/nenhuma foto do ganhador é publicada/i)).toBeInTheDocument();
  });

  it('a API recusa (ex.: ja arquivado): a mensagem aparece e nada e dado como salvo', async () => {
    h.call.mockRejectedValue(new ApiClientError({ code: 'CONFLICT', message: 'O sorteio está arquivado.', status: 409 }));
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar entrega' }));
    expect(await screen.findByText('O sorteio está arquivado.')).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('data em branco e recusada na propria tela', async () => {
    abrir();
    fireEvent.change(screen.getByLabelText('Data da entrega'), { target: { value: '' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Registrar entrega' }).closest('form')!);
    expect(await screen.findByText('Informe a data da entrega.')).toBeInTheDocument();
    expect(h.call).not.toHaveBeenCalled();
  });
});

describe('entrega registrada e arquivamento', () => {
  it('mostra o resumo e oferece corrigir e arquivar', () => {
    abrir({ delivery: entrega() });
    expect(screen.getByText('Envio (correios/transportadora)')).toBeInTheDocument();
    expect(screen.getByText('BR123456789XX')).toBeInTheDocument();
    expect(screen.getByText('Entregue na portaria.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Corrigir entrega' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arquivar sorteio/ })).toBeInTheDocument();
  });

  it('arquivar pede confirmacao na propria tela (sem dialogo nativo) e e irreversivel', async () => {
    h.call.mockResolvedValue({});
    abrir({ delivery: entrega() });
    fireEvent.click(screen.getByRole('button', { name: /Arquivar sorteio/ }));
    const aviso = screen.getByRole('alertdialog');
    expect(aviso).toHaveTextContent(/não pode ser desfeita/);
    expect(h.call).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }));
    await waitFor(() => expect(h.call).toHaveBeenCalledWith('updateDrawStatus', { status: 'ARQUIVADA' }, { params: { id: '11111111-1111-4111-8111-111111111111' } }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('cancelar a confirmacao nao arquiva', () => {
    abrir({ delivery: entrega() });
    fireEvent.click(screen.getByRole('button', { name: /Arquivar sorteio/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.call).not.toHaveBeenCalled();
  });

  it('corrigir a entrega reabre o formulario com os dados atuais', () => {
    abrir({ delivery: entrega() });
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir entrega' }));
    expect(screen.getByLabelText(/Código de rastreio/)).toHaveValue('BR123456789XX');
    expect(screen.getByRole('button', { name: 'Salvar correção' })).toBeInTheDocument();
  });
});

describe('somente leitura', () => {
  it('ARQUIVADA: resumo, sem formulario nem botoes', () => {
    abrir({ status: 'ARQUIVADA', delivery: entrega() });
    expect(screen.getByText(/Sorteio arquivado: somente leitura/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByLabelText('Forma de entrega')).toBeNull();
  });

  it('sem permissao: ve o resumo, nao altera nada', () => {
    h.permissions = new Set();
    abrir({ delivery: entrega() });
    expect(screen.getByText('BR123456789XX')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('sem permissao e sem entrega: so informa que ainda nao foi registrada', () => {
    h.permissions = new Set();
    abrir();
    expect(screen.getByText('A entrega ainda não foi registrada.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Forma de entrega')).toBeNull();
  });
});
