import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check } from 'lucide-react';
import {
  ALLOWED_GRID_SIZES,
  ApiClientError,
  formatCents,
  gridLabelRange,
  type CreateDrawRequest,
  type GridSize,
} from '@campaigns/shared';
import { PageHeader } from '../components/Ui.tsx';
import { api } from '../api.ts';

/**
 * Criacao de sorteio: `/sorteios/novo`.
 *
 * FORMULARIO EM SECOES
 * --------------------
 * Identificacao, premio, venda, data. Nao e organizacao por organizacao: sao
 * quatro decisoes diferentes, e agrupa-las deixa claro o que ainda falta
 * decidir. Um formulario de nove campos corridos parece o dobro do tamanho.
 *
 * PRECO
 * -----
 * O contrato trafega CENTAVOS (inteiro), mas ninguem digita centavos. O campo
 * aceita "15,00" e converte na hora do envio. Guardar dinheiro em ponto
 * flutuante e a origem classica do pedido que fecha em R$ 14,99.
 *
 * GRADE
 * -----
 * 100, 500 ou 1000 — RN13, e a lista vem da constante PROTEGIDA do pacote
 * compartilhado, nao de um array escrito aqui. Cada opcao mostra a faixa de
 * rotulos real (00–99, 000–499, 000–999) para que a escolha seja concreta.
 */

interface Erros {
  title?: string;
  prizeName?: string;
  unitPrice?: string;
  drawDate?: string;
}

/** "15,00" ou "15.00" ou "15" -> 1500. Devolve null se nao for um valor util. */
function parsePriceToCents(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  if (limpo === '') return null;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  // `Math.round` fecha o buraco do ponto flutuante: 19.99 * 100 da
  // 1998.9999999999998 em IEEE-754, e truncar viraria R$ 19,98.
  return Math.round(valor * 100);
}

export function NewDrawPage() {
  const navigate = useNavigate();

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [premio, setPremio] = useState('');
  const [descricaoPremio, setDescricaoPremio] = useState('');
  const [imagem, setImagem] = useState('');
  const [preco, setPreco] = useState('');
  const [grade, setGrade] = useState<GridSize>(100);
  const [data, setData] = useState('');

  const [erros, setErros] = useState<Erros>({});
  const [jaEnviou, setJaEnviou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const centavos = parsePriceToCents(preco);

  const validar = useCallback((): Erros => {
    const encontrados: Erros = {};

    if (titulo.trim().length < 3) {
      encontrados.title = 'O título precisa ter pelo menos 3 caracteres.';
    }
    if (premio.trim().length < 2) {
      encontrados.prizeName = 'Informe o nome do prêmio.';
    }
    if (parsePriceToCents(preco) === null) {
      encontrados.unitPrice = 'Informe um valor maior que zero, como 15,00.';
    }
    if (data !== '' && Number.isNaN(new Date(data).getTime())) {
      encontrados.drawDate = 'Confira a data informada.';
    }

    return encontrados;
  }, [data, preco, premio, titulo]);

  const enviar = useCallback(async () => {
    setJaEnviou(true);
    const encontrados = validar();
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      const primeiro = Object.keys(encontrados)[0];
      document.getElementById(`campo-${primeiro}`)?.focus();
      return;
    }

    setEnviando(true);
    setErroEnvio(null);

    try {
      const corpo: CreateDrawRequest = {
        title: titulo.trim(),
        prizeName: premio.trim(),
        unitPriceCents: parsePriceToCents(preco)!,
        totalNumbers: grade,
        ...(descricao.trim() === '' ? {} : { description: descricao.trim() }),
        ...(descricaoPremio.trim() === '' ? {} : { prizeDescription: descricaoPremio.trim() }),
        ...(imagem.trim() === '' ? {} : { prizeImageUrl: imagem.trim() }),
        // O input `datetime-local` nao traz fuso; `toISOString` resolve no
        // fuso do navegador, que e o de quem esta cadastrando.
        ...(data === '' ? {} : { drawDate: new Date(data).toISOString() }),
      };

      const criado = await api.call('createDraw', corpo);
      navigate(`/sorteios/${criado.id}`, { replace: true });
    } catch (falha) {
      if (falha instanceof ApiClientError && falha.code === 'CONFLICT') {
        setErroEnvio(
          'Já existe um sorteio com um título muito parecido nesta comunidade. Use um título diferente.',
        );
      } else if (falha instanceof ApiClientError) {
        setErroEnvio(falha.message);
      } else {
        setErroEnvio('Não foi possível criar o sorteio. Tente novamente em instantes.');
      }
    } finally {
      setEnviando(false);
    }
  }, [
    data,
    descricao,
    descricaoPremio,
    grade,
    imagem,
    navigate,
    preco,
    premio,
    titulo,
    validar,
  ]);

  const revalidar = () => {
    if (jaEnviou) setErros(validar());
  };

  return (
    <div className="dash__content--narrow">
      <Link className="back-link" to="/sorteios">
        <ArrowLeft size={16} aria-hidden="true" />
        Sorteios
      </Link>

      <PageHeader
        title="Novo sorteio"
        description="O sorteio é criado como rascunho. Ele só aparece na vitrine depois que você abrir as vendas."
      />

      <form
        className="stack stack--xl"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void enviar();
        }}
      >
        <fieldset className="fieldset card" disabled={enviando}>
          <div className="card__body stack stack--lg">
            <legend className="fieldset__legend">Identificação</legend>

            <div className={`field${erros.title ? ' field--invalid' : ''}`}>
              <label className="field__label" htmlFor="campo-title">
                Título do sorteio <span className="field__required" aria-hidden="true">*</span>
              </label>
              <input
                id="campo-title"
                className="field__input"
                type="text"
                required
                maxLength={160}
                value={titulo}
                aria-invalid={erros.title ? true : undefined}
                aria-describedby={erros.title ? 'erro-title' : 'dica-title'}
                onChange={(event) => setTitulo(event.target.value)}
                onBlur={revalidar}
              />
              {erros.title ? (
                <p className="field__error" id="erro-title">
                  <AlertCircle size={14} aria-hidden="true" />
                  {erros.title}
                </p>
              ) : (
                <p className="field__hint" id="dica-title">
                  É o nome que aparece na vitrine, como “Rifa do Natal 2026”.
                </p>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="campo-description">
                Descrição <span className="muted">(opcional)</span>
              </label>
              <textarea
                id="campo-description"
                className="field__textarea"
                maxLength={4000}
                value={descricao}
                onChange={(event) => setDescricao(event.target.value)}
              />
              <p className="field__hint">
                Explique a finalidade do sorteio e as regras que o participante deve conhecer.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="fieldset card" disabled={enviando}>
          <div className="card__body stack stack--lg">
            <legend className="fieldset__legend">Prêmio</legend>

            <div className={`field${erros.prizeName ? ' field--invalid' : ''}`}>
              <label className="field__label" htmlFor="campo-prizeName">
                Nome do prêmio <span className="field__required" aria-hidden="true">*</span>
              </label>
              <input
                id="campo-prizeName"
                className="field__input"
                type="text"
                required
                maxLength={160}
                value={premio}
                aria-invalid={erros.prizeName ? true : undefined}
                aria-describedby={erros.prizeName ? 'erro-prizeName' : undefined}
                onChange={(event) => setPremio(event.target.value)}
                onBlur={revalidar}
              />
              {erros.prizeName && (
                <p className="field__error" id="erro-prizeName">
                  <AlertCircle size={14} aria-hidden="true" />
                  {erros.prizeName}
                </p>
              )}
            </div>

            <div className="field">
              <label className="field__label" htmlFor="campo-prizeDescription">
                Descrição do prêmio <span className="muted">(opcional)</span>
              </label>
              <textarea
                id="campo-prizeDescription"
                className="field__textarea"
                maxLength={4000}
                value={descricaoPremio}
                onChange={(event) => setDescricaoPremio(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="campo-prizeImageUrl">
                Endereço da foto <span className="muted">(opcional)</span>
              </label>
              <input
                id="campo-prizeImageUrl"
                className="field__input"
                type="url"
                inputMode="url"
                placeholder="https://…"
                maxLength={2000}
                value={imagem}
                onChange={(event) => setImagem(event.target.value)}
              />
              <p className="field__hint">
                Sem foto, a vitrine mostra um espaço reservado — nenhuma imagem genérica é
                usada no lugar do prêmio.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="fieldset card" disabled={enviando}>
          <div className="card__body stack stack--lg">
            <legend className="fieldset__legend">Venda</legend>

            <div className={`field${erros.unitPrice ? ' field--invalid' : ''}`}>
              <label className="field__label" htmlFor="campo-unitPrice">
                Valor por número <span className="field__required" aria-hidden="true">*</span>
              </label>
              <div className="field__group">
                <span className="field__prefix" aria-hidden="true">
                  R$
                </span>
                <input
                  id="campo-unitPrice"
                  className="field__input"
                  type="text"
                  inputMode="decimal"
                  required
                  placeholder="15,00"
                  value={preco}
                  aria-invalid={erros.unitPrice ? true : undefined}
                  aria-describedby={erros.unitPrice ? 'erro-unitPrice' : 'dica-unitPrice'}
                  onChange={(event) => setPreco(event.target.value)}
                  onBlur={revalidar}
                />
              </div>
              {erros.unitPrice ? (
                <p className="field__error" id="erro-unitPrice">
                  <AlertCircle size={14} aria-hidden="true" />
                  {erros.unitPrice}
                </p>
              ) : (
                <p className="field__hint" id="dica-unitPrice">
                  {centavos === null
                    ? 'Use vírgula para os centavos, como 15,00.'
                    : `Cada número será vendido por ${formatCents(centavos)}. Grade cheia: ${formatCents(centavos * grade)}.`}
                </p>
              )}
            </div>

            <div className="field">
              <span className="field__label" id="rotulo-grade">
                Tamanho da grade <span className="field__required" aria-hidden="true">*</span>
              </span>
              <div className="grid-choice" role="radiogroup" aria-labelledby="rotulo-grade">
                {ALLOWED_GRID_SIZES.map((tamanho) => {
                  const faixa = gridLabelRange(tamanho);
                  const escolhido = grade === tamanho;
                  return (
                    <label
                      key={tamanho}
                      className={`grid-choice__option${escolhido ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="grade"
                        className="sr-only"
                        value={tamanho}
                        checked={escolhido}
                        onChange={() => setGrade(tamanho)}
                      />
                      <span className="grid-choice__check" aria-hidden="true">
                        {escolhido ? <Check size={13} strokeWidth={3} /> : null}
                      </span>
                      <span className="grid-choice__value">{tamanho}</span>
                      <span className="grid-choice__range">
                        {faixa.first} – {faixa.last}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="field__hint">
                O tamanho da grade não pode ser alterado depois que o sorteio for criado.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="fieldset card" disabled={enviando}>
          <div className="card__body stack stack--lg">
            <legend className="fieldset__legend">Data</legend>

            <div className={`field${erros.drawDate ? ' field--invalid' : ''}`}>
              <label className="field__label" htmlFor="campo-drawDate">
                Data prevista do sorteio <span className="muted">(opcional)</span>
              </label>
              <input
                id="campo-drawDate"
                className="field__input"
                type="datetime-local"
                value={data}
                aria-invalid={erros.drawDate ? true : undefined}
                aria-describedby={erros.drawDate ? 'erro-drawDate' : 'dica-drawDate'}
                onChange={(event) => setData(event.target.value)}
                onBlur={revalidar}
              />
              {erros.drawDate ? (
                <p className="field__error" id="erro-drawDate">
                  <AlertCircle size={14} aria-hidden="true" />
                  {erros.drawDate}
                </p>
              ) : (
                <p className="field__hint" id="dica-drawDate">
                  Fica visível na vitrine. Deixe em branco se ainda não houver data definida.
                </p>
              )}
            </div>
          </div>
        </fieldset>

        {erroEnvio && (
          <div className="alert alert--danger" role="alert">
            <AlertCircle className="alert__icon" size={18} aria-hidden="true" />
            <div className="alert__body">{erroEnvio}</div>
          </div>
        )}

        <div className="form-actions">
          <Link className="btn btn--ghost" to="/sorteios">
            Cancelar
          </Link>
          <button type="submit" className="btn btn--primary" disabled={enviando}>
            {enviando ? <span className="btn__spinner" aria-hidden="true" /> : null}
            {enviando ? 'Criando…' : 'Criar sorteio'}
          </button>
        </div>
      </form>
    </div>
  );
}
