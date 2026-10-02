import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import {
  ALLOWED_GRID_SIZES,
  DRAW_CLOSE_MODES,
  NO_WINNER_POLICIES,
  PROGRESS_MODES,
  formatCents,
  formatNumberLabel,
  gridLabelRange,
  labelDigitsForGridSize,
  type DrawCloseMode,
  type NoWinnerPolicy,
  type OrganizerDraw,
  type ProgressMode,
} from '@clubedarifa/shared';
import {
  MIN_REGULATION,
  MODELO_REGULAMENTO,
  emptyPrize,
  parseMoneyToCents,
} from '../../lib/drawForm.ts';
import { ImageUploader } from '../ImageUploader.tsx';
import { CheckField, ColorField, ComingSoon, SelectField, TextAreaField, TextField, erroDe, type StepProps } from './fields.tsx';

/** Os oito passos de preenchimento do assistente (o nono, a revisao, fica em `WizardReview`). */

const CATEGORIAS = ['Veículos', 'Eletrônicos', 'Casa e decoração', 'Dinheiro', 'Viagens', 'Beneficente', 'Outros'];

// ---------------------------------------------------------------------------
// 1 · Informacoes basicas
// ---------------------------------------------------------------------------

export function DuplicatePicker({
  options,
  onPick,
}: {
  options: readonly OrganizerDraw[];
  onPick: (draw: OrganizerDraw) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="field">
      <label className="field__label" htmlFor="duplicar-de">
        Começar a partir de um sorteio anterior <span className="muted">(opcional)</span>
      </label>
      <select
        id="duplicar-de"
        className="field__input"
        defaultValue=""
        onChange={(e) => {
          const escolhido = options.find((d) => d.id === e.target.value);
          if (escolhido) onPick(escolhido);
        }}
      >
        <option value="">— Criar do zero —</option>
        {options.map((d) => (
          <option key={d.id} value={d.id}>
            {d.title}
          </option>
        ))}
      </select>
      <p className="field__hint">
        Copia título, prêmios, grade, preço e textos. Não copia números vendidos, datas nem resultado.
      </p>
    </div>
  );
}

export function StepBasic({ form, set, ...rest }: StepProps) {
  return (
    <div className="stack stack--lg">
      <TextField
        id="title"
        label="Título do sorteio"
        required
        value={form.title}
        maxLength={160}
        onChange={(v) => set('title', v)}
        error={erroDe(rest, 'title')}
        hint="É o nome que aparece na vitrine, como “Rifa do Natal 2026”."
      />
      <TextField
        id="subtitle"
        label="Subtítulo"
        optional
        value={form.subtitle}
        maxLength={160}
        onChange={(v) => set('subtitle', v)}
        error={erroDe(rest, 'subtitle')}
        hint="Uma frase de apoio, abaixo do título."
      />
      <TextField
        id="category"
        label="Categoria"
        optional
        value={form.category}
        maxLength={40}
        list="categorias"
        onChange={(v) => set('category', v)}
        error={erroDe(rest, 'category')}
      />
      <datalist id="categorias">
        {CATEGORIAS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <TextAreaField
        id="description"
        label="Descrição"
        optional
        value={form.description}
        maxLength={4000}
        rows={5}
        onChange={(v) => set('description', v)}
        hint="Explique a finalidade do sorteio. O regulamento completo é o passo 7."
      />
      <p className="field__hint">
        O endereço da página (<code>/sorteio/…</code>) é gerado a partir do título quando o rascunho é salvo.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2 · Premios
// ---------------------------------------------------------------------------

export function StepPrizes({ form, set, ...rest }: StepProps) {
  const lista = form.prizes;
  const atualiza = (i: number, parcial: Partial<(typeof lista)[number]>) =>
    set('prizes', lista.map((p, j) => (j === i ? { ...p, ...parcial } : p)));
  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    const nova = [...lista];
    [nova[i], nova[j]] = [nova[j]!, nova[i]!];
    set('prizes', nova);
  };

  return (
    <div className="stack stack--lg">
      <p className="muted">
        Um ou mais prêmios, em ordem (1º, 2º, 3º…). O primeiro é o prêmio principal: a foto dele é a capa na
        vitrine e no compartilhamento.
      </p>

      <ol className="prize-list">
        {lista.map((p, i) => {
          return (
            <li key={p.key} className="prize-card card">
              <div className="card__body stack">
                <div className="prize-card__head">
                  <h3 className="prize-card__title">
                    {i + 1}º prêmio {i === 0 && <span className="badge badge--neutral">Principal · capa</span>}
                  </h3>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`Mover o ${i + 1}º prêmio para cima`}
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => move(i, 1)}
                      disabled={i === lista.length - 1}
                      aria-label={`Mover o ${i + 1}º prêmio para baixo`}
                    >
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger-ghost btn--sm"
                      onClick={() => set('prizes', lista.length === 1 ? [emptyPrize()] : lista.filter((_, j) => j !== i))}
                      aria-label={`Remover o ${i + 1}º prêmio`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <TextField
                  id={`prize-${i}-name`}
                  label="Nome do prêmio"
                  required
                  value={p.name}
                  maxLength={160}
                  onChange={(v) => atualiza(i, { name: v })}
                  error={erroDe(rest, `prize-${i}-name`)}
                />
                <TextAreaField
                  id={`prize-${i}-description`}
                  label="Descrição"
                  optional
                  rows={3}
                  value={p.description}
                  maxLength={4000}
                  onChange={(v) => atualiza(i, { description: v })}
                />
                <TextField
                  id={`prize-${i}-value`}
                  label="Valor estimado"
                  optional
                  prefix="R$"
                  inputMode="decimal"
                  placeholder="2.500,00"
                  value={p.value}
                  onChange={(v) => atualiza(i, { value: v })}
                  error={erroDe(rest, `prize-${i}-value`)}
                />
                <ImageUploader
                  label={i === 0 ? 'Foto do prêmio (capa)' : 'Foto do prêmio'}
                  value={p.imageUrl}
                  onChange={(v) => atualiza(i, { imageUrl: v })}
                  error={erroDe(rest, `prize-${i}-image`)}
                />

              </div>
            </li>
          );
        })}
      </ol>

      <div>
        <button
          type="button"
          className="btn btn--secondary"
          disabled={lista.length >= 20}
          onClick={() => set('prizes', [...lista, emptyPrize()])}
        >
          <Plus size={16} aria-hidden="true" />
          Adicionar prêmio
        </button>
        {lista.length >= 20 && <p className="field__hint">O limite é de 20 prêmios por sorteio.</p>}
      </div>

      <ComingSoon
        title="Em uma próxima versão"
        items={['Várias fotos por prêmio, recorte e ponto focal.', 'Vídeo do prêmio.']}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3 · Grade
// ---------------------------------------------------------------------------

export function StepGrid({ form, set }: StepProps) {
  const digitos = labelDigitsForGridSize(form.totalNumbers);
  const amostra = Array.from({ length: 30 }, (_, n) => formatNumberLabel(n, digitos));
  return (
    <div className="stack stack--lg">
      <div className="field">
        <span className="field__label" id="rotulo-grade">
          Tamanho da grade <span className="field__required" aria-hidden="true">*</span>
        </span>
        <div className="grid-choice" role="radiogroup" aria-labelledby="rotulo-grade">
          {ALLOWED_GRID_SIZES.map((tamanho) => {
            const faixa = gridLabelRange(tamanho);
            const escolhido = form.totalNumbers === tamanho;
            return (
              <label key={tamanho} className={`grid-choice__option${escolhido ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name="grade"
                  className="sr-only"
                  value={tamanho}
                  checked={escolhido}
                  onChange={() => set('totalNumbers', tamanho)}
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
          O tamanho da grade e o preço base ficam travados depois da primeira reserva (RN14); como o sorteio ainda
          é rascunho, você pode mudar à vontade.
        </p>
      </div>

      <div>
        <p className="field__label">Prévia dos rótulos</p>
        <ul className="grid-preview" aria-label={`Primeiros números da grade de ${form.totalNumbers}`}>
          {amostra.map((rotulo) => (
            <li key={rotulo} className="grid-preview__cell">
              {rotulo}
            </li>
          ))}
          <li className="grid-preview__more" aria-hidden="true">
            …
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4 · Preco
// ---------------------------------------------------------------------------

export function StepPrice({ form, set, ...rest }: StepProps) {
  const cheio = parseMoneyToCents(form.price);
  return (
    <div className="stack stack--lg">
      <TextField
        id="price"
        label="Valor por número"
        required
        prefix="R$"
        inputMode="decimal"
        placeholder="15,00"
        value={form.price}
        onChange={(v) => set('price', v)}
        error={erroDe(rest, 'price')}
        hint={
          cheio === null
            ? 'Use vírgula para os centavos, como 15,00.'
            : `Cada número será vendido por ${formatCents(cheio)}. Grade cheia: ${formatCents(cheio * form.totalNumbers)}.`
        }
      />
      <TextField
        id="promoPrice"
        label="Preço promocional"
        optional
        prefix="R$"
        inputMode="decimal"
        placeholder="12,00"
        value={form.promoPrice}
        onChange={(v) => set('promoPrice', v)}
        error={erroDe(rest, 'promoPrice')}
        hint="Precisa ser menor que o preço cheio e vale até a data abaixo."
      />
      <TextField
        id="promoUntil"
        label="A promoção vale até"
        optional
        type="datetime-local"
        value={form.promoUntil}
        onChange={(v) => set('promoUntil', v)}
      />
      <TextField
        id="minPerOrder"
        label="Mínimo de números por pedido"
        optional
        inputMode="numeric"
        placeholder="1"
        value={form.minPerOrder}
        maxLength={3}
        onChange={(v) => set('minPerOrder', v.replace(/[^0-9]/g, ''))}
        error={erroDe(rest, 'minPerOrder')}
        hint="Em branco: sem mínimo."
      />
      <TextField
        id="maxPerOrder"
        label="Máximo de números por pedido"
        optional
        inputMode="numeric"
        placeholder="10"
        value={form.maxPerOrder}
        maxLength={3}
        onChange={(v) => set('maxPerOrder', v.replace(/[^0-9]/g, ''))}
        error={erroDe(rest, 'maxPerOrder')}
        hint="Em branco: sem máximo. O limite é aplicado também pelo servidor."
      />
      <ComingSoon
        title="Em uma próxima versão"
        items={['Pacotes de números (ex.: 5 por R$ X).', 'Cupons e afiliados.']}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5 · Cronograma
// ---------------------------------------------------------------------------

const ROTULO_FECHAMENTO: Record<DrawCloseMode, string> = {
  AO_ESGOTAR: 'Ao esgotar os números',
  POR_DATA: 'Em uma data',
  O_QUE_VIER_PRIMEIRO: 'O que vier primeiro (data ou esgotar)',
};
const ROTULO_SEM_VENCEDOR: Record<NoWinnerPolicy, string> = {
  PROXIMO_VENDIDO_ACIMA: 'Vale o próximo número vendido acima',
  SEM_CONTEMPLADO: 'Sem contemplado (o resultado fica sem vencedor)',
};

export function StepSchedule({ form, set, ...rest }: StepProps) {
  return (
    <div className="stack stack--lg">
      <TextField
        id="salesStartAt"
        label="Início das vendas"
        optional
        type="datetime-local"
        value={form.salesStartAt}
        onChange={(v) => set('salesStartAt', v)}
        hint="Em branco: as vendas começam assim que a plataforma aprovar."
      />
      <SelectField
        id="closeMode"
        label="Quando as vendas encerram"
        value={form.closeMode}
        onChange={(v) => set('closeMode', v)}
        options={DRAW_CLOSE_MODES.map((m) => ({ value: m, label: ROTULO_FECHAMENTO[m] }))}
      />
      {form.closeMode !== 'AO_ESGOTAR' && (
        <TextField
          id="closeAt"
          label="Data de fechamento"
          required
          type="datetime-local"
          value={form.closeAt}
          onChange={(v) => set('closeAt', v)}
          error={erroDe(rest, 'closeAt')}
        />
      )}
      <TextField
        id="drawDate"
        label="Data do sorteio"
        required
        type="datetime-local"
        value={form.drawDate}
        onChange={(v) => set('drawDate', v)}
        error={erroDe(rest, 'drawDate')}
        hint="O fechamento precisa ser anterior a esta data."
      />
      <div className="field">
        <span className="field__label">Fonte do resultado</span>
        <p className="field__static">Loteria Federal — extração do dia indicado (única fonte disponível).</p>
      </div>
      <SelectField
        id="noWinnerPolicy"
        label="Se o número apurado não foi vendido"
        value={form.noWinnerPolicy}
        onChange={(v) => set('noWinnerPolicy', v)}
        options={NO_WINNER_POLICIES.map((m) => ({ value: m, label: ROTULO_SEM_VENCEDOR[m] }))}
        hint="Fica registrado no regulamento e é aplicado na apuração, com cada tentativa na prova."
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 6 · Personalizacao
// ---------------------------------------------------------------------------

const ROTULO_PROGRESSO: Record<ProgressMode, { titulo: string; exemplo: string }> = {
  FALTAM: { titulo: 'Mostrar “faltam X”', exemplo: 'Faltam 62 números' },
  PERCENTUAL: { titulo: 'Mostrar % vendido', exemplo: '38% vendido' },
  OCULTAR: { titulo: 'Ocultar o progresso', exemplo: 'Sem barra de progresso' },
};

export function StepCustomization({ form, set }: StepProps) {
  return (
    <div className="stack stack--lg">
      <p className="muted">
        O sorteio herda a aparência padrão da plataforma. Aqui você ajusta só o que a vitrine já aplica. O
        regulamento, o preço total e o prazo de 30 minutos da reserva aparecem sempre.
      </p>
      <fieldset className="field">
        <legend className="field__label">Barra de progresso</legend>
        <div className="choice-list">
          {PROGRESS_MODES.map((modo) => (
            <label key={modo} className={`choice${form.progressMode === modo ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="progresso"
                className="sr-only"
                checked={form.progressMode === modo}
                onChange={() => set('progressMode', modo)}
              />
              <span className="choice__title">{ROTULO_PROGRESSO[modo].titulo}</span>
              <span className="choice__hint">{ROTULO_PROGRESSO[modo].exemplo}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <TextField
        id="headline"
        label="Chamada principal"
        optional
        value={form.headline}
        maxLength={120}
        onChange={(v) => set('headline', v)}
        hint="Frase de destaque na página do sorteio. Em branco: sem chamada."
      />
      <TextField
        id="ctaLabel"
        label="Texto do botão de compra"
        optional
        value={form.ctaLabel}
        maxLength={30}
        onChange={(v) => set('ctaLabel', v)}
        hint="Em branco: “Reservar números”."
      />
      <ImageUploader
        label="Banner da página do sorteio"
        shape="wide"
        value={form.bannerUrl}
        onChange={(v) => set('bannerUrl', v)}
        hint="Aparece no topo da página do sorteio. Em branco: a foto do prêmio principal."
      />
      <ColorField
        id="accentColor"
        label="Cor de destaque"
        value={form.accentColor}
        onChange={(v) => set('accentColor', v)}
        hint="Usada no botão de compra e nos destaques desta página."
      />
      <CheckField
        id="showCountdown"
        label="Mostrar contador regressivo até o fechamento das vendas"
        checked={form.showCountdown}
        onChange={(v) => set('showCountdown', v)}
      />
      <CheckField
        id="showBuyers"
        label="Mostrar quem já comprou (nome abreviado)"
        hint="Ex.: “Maria L. · 3 números”. Nunca mostra telefone nem e-mail."
        checked={form.showBuyers}
        onChange={(v) => set('showBuyers', v)}
      />
      <ComingSoon title="Em uma próxima versão" items={['Modelos de página e botões de compra rápida configuráveis.']} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7 · Regulamento
// ---------------------------------------------------------------------------

export function StepRegulation({ form, set, ...rest }: StepProps) {
  const [confirmando, setConfirmando] = useState(false);
  const tamanho = form.regulation.trim().length;
  return (
    <div className="stack stack--lg">
      <TextAreaField
        id="regulation"
        label="Regulamento do sorteio"
        required
        rows={14}
        value={form.regulation}
        maxLength={20000}
        onChange={(v) => set('regulation', v)}
        error={erroDe(rest, 'regulation')}
        hint={`${tamanho} caracteres — mínimo de ${MIN_REGULATION}. É exibido na página do sorteio e revisado pela plataforma antes da aprovação.`}
      />
      <div className="row">
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => {
            if (form.regulation.trim() === '') set('regulation', MODELO_REGULAMENTO);
            else setConfirmando(true);
          }}
        >
          Usar o modelo de regulamento
        </button>
      </div>
      {confirmando && (
        <div className="alert alert--warning" role="alertdialog" aria-labelledby="modelo-titulo">
          <div className="alert__body stack stack--sm">
            <p className="alert__title" id="modelo-titulo">
              Substituir o texto atual pelo modelo?
            </p>
            <div className="row">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => {
                  set('regulation', MODELO_REGULAMENTO);
                  setConfirmando(false);
                }}
              >
                Substituir
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmando(false)}>
                Manter meu texto
              </button>
            </div>
          </div>
        </div>
      )}
      <p className="field__hint">
        O modelo é um ponto de partida, não aconselhamento jurídico: ajuste à modalidade do seu sorteio.
      </p>
      <ComingSoon
        title="Ainda não disponível neste passo"
        items={[
          'Modalidade e documentos de autorização, e responsável legal: dependem do armazenamento de documentos e do cadastro KYB.',
        ]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8 · Automacoes
// ---------------------------------------------------------------------------

export function StepAutomations({ form, set, ...rest }: StepProps) {
  return (
    <div className="stack stack--lg">
      <TextField
        id="thresholds"
        label="Avisos de “faltam X números”"
        value={form.thresholds}
        onChange={(v) => set('thresholds', v)}
        error={erroDe(rest, 'thresholds')}
        hint="De 1 a 5 valores entre 1 e 99, em ordem decrescente (padrão: 25, 10). “Faltam” conta só números PAGOS; cada aviso sai uma única vez."
      />
      <div>
        <p className="field__label">O que a plataforma registra hoje, sozinha</p>
        <ul className="plain-list">
          <li>Aviso de “faltam X” (nos valores acima) e de esgotamento.</li>
          <li>Ativação do sorteio e publicação do resultado.</li>
          <li>Fechamento automático e abertura da apuração.</li>
        </ul>
        <p className="field__hint">
          Cada aviso fica registrado uma única vez (sem duplicar). O envio por WhatsApp ou e-mail ainda não está
          conectado a um provedor.
        </p>
      </div>
      <ComingSoon
        title="Ainda não disponível neste passo"
        items={[
          'Clientes cativos e pré-autorização: dependem da integração de cobrança recorrente (Vindi).',
          'Lembretes de reserva expirando e de PIX pendente.',
          'Modelos de mensagem e relatório D+1.',
        ]}
      />
    </div>
  );
}
