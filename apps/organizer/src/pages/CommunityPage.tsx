import { useCallback, useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import {
  ApiClientError,
  COMMUNITY_PAGE_KEYS,
  COMMUNITY_PAGE_LABELS,
  type CommunityContent,
  type CommunityPageKey,
  type UpdateCommunityRequest,
} from '@clubedarifa/shared';
import { api } from '../api.ts';
import { useSession } from '../state/SessionProvider.tsx';
import { ImageUploader } from '../components/ImageUploader.tsx';
import { ErrorPanel, PageHeader } from '../components/Ui.tsx';
import { Loading } from '../components/States.tsx';
import { ColorField, TextAreaField, TextField } from '../components/wizard/fields.tsx';

/**
 * Comunidade: nome publico, logo, banner, cor, contatos e paginas institucionais. O que
 * for salvo aqui e o que a vitrine mostra (cabecalho, rodape, contato e as paginas
 * Sobre, Como funciona, Termos, Privacidade e Contato).
 */
interface Formulario {
  publicName: string;
  description: string;
  footerText: string;
  logoUrl: string;
  bannerUrl: string;
  primaryColor: string;
  whatsapp: string;
  phone: string;
  email: string;
  instagram: string;
  facebook: string;
  pages: Record<CommunityPageKey, string>;
}

function doConteudo(c: CommunityContent): Formulario {
  return {
    publicName: c.publicName ?? '',
    description: c.description ?? '',
    footerText: c.footerText ?? '',
    logoUrl: c.logoUrl ?? '',
    bannerUrl: c.bannerUrl ?? '',
    primaryColor: c.primaryColor ?? '',
    whatsapp: c.contact['whatsapp'] ?? '',
    phone: c.contact['phone'] ?? '',
    email: c.contact['email'] ?? '',
    instagram: c.contact['instagram'] ?? '',
    facebook: c.contact['facebook'] ?? '',
    pages: Object.fromEntries(COMMUNITY_PAGE_KEYS.map((k) => [k, c.pages[k] ?? ''])) as Record<CommunityPageKey, string>,
  };
}

function paraRequisicao(f: Formulario): UpdateCommunityRequest {
  return {
    publicName: f.publicName,
    description: f.description,
    footerText: f.footerText,
    logoUrl: f.logoUrl,
    bannerUrl: f.bannerUrl,
    primaryColor: f.primaryColor,
    contact: { whatsapp: f.whatsapp, phone: f.phone, email: f.email, instagram: f.instagram, facebook: f.facebook },
    pages: f.pages,
  };
}

export function CommunityPage() {
  const { can } = useSession();
  const podeEditar = can('branding:write');
  const [form, setForm] = useState<Formulario | null>(null);
  const [erroCarga, setErroCarga] = useState<unknown>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    setErroCarga(null);
    try {
      setForm(doConteudo(await api.call('tenantCommunity')));
    } catch (e) {
      setErroCarga(e);
    }
  }, []);
  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (erroCarga) return <ErrorPanel error={erroCarga} onRetry={() => void carregar()} />;
  if (!form) return <Loading label="Carregando a comunidade…" />;

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => {
    setAviso(null);
    setForm((f) => (f ? { ...f, [k]: v } : f));
  };

  async function salvar() {
    if (!form) return;
    setSalvando(true);
    setAviso(null);
    try {
      const salvo = await api.call('updateTenantCommunity', paraRequisicao(form));
      setForm(doConteudo(salvo));
      setAviso({ tipo: 'ok', texto: 'Alterações salvas. A vitrine já mostra a nova versão.' });
    } catch (e) {
      setAviso({
        tipo: 'erro',
        texto: e instanceof ApiClientError ? e.message : 'Não foi possível salvar. Tente novamente.',
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Comunidade"
        description="A marca, os contatos e as páginas que seus participantes veem na vitrine."
        actions={
          podeEditar && (
            <button type="button" className="btn btn--primary" disabled={salvando} onClick={() => void salvar()}>
              <Save size={16} aria-hidden="true" />
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          )
        }
      />
      {!podeEditar && <p className="alert alert--info">Seu perfil só pode visualizar estes dados.</p>}
      {aviso && (
        <p className={`alert alert--${aviso.tipo === 'ok' ? 'success' : 'danger'}`} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
          <span className="alert__body">
            {aviso.tipo === 'ok' && <Check size={15} aria-hidden="true" />} {aviso.texto}
          </span>
        </p>
      )}

      <fieldset disabled={!podeEditar || salvando} className="stack stack--lg" style={{ border: 0, padding: 0, margin: 0 }}>
        <section className="card">
          <div className="card__body stack">
            <h2>Identidade</h2>
            <TextField id="publicName" label="Nome exibido na vitrine" value={form.publicName} maxLength={120} onChange={(v) => set('publicName', v)} hint="Em branco: usa o nome cadastrado da comunidade." />
            <TextAreaField id="description" label="Descrição curta" optional rows={3} value={form.description} maxLength={600} onChange={(v) => set('description', v)} hint="Aparece na página inicial da vitrine." />
            <ImageUploader label="Logo" value={form.logoUrl} onChange={(v) => set('logoUrl', v)} hint="Fundo transparente fica melhor. Aparece no cabeçalho da vitrine." />
            <ImageUploader label="Banner da página inicial" shape="wide" value={form.bannerUrl} onChange={(v) => set('bannerUrl', v)} />
            <ColorField id="primaryColor" label="Cor principal" value={form.primaryColor} onChange={(v) => set('primaryColor', v)} hint="Botões e destaques da vitrine." />
            <TextField id="footerText" label="Texto do rodapé" optional value={form.footerText} maxLength={300} onChange={(v) => set('footerText', v)} />
          </div>
        </section>

        <section className="card">
          <div className="card__body stack">
            <h2>Contatos</h2>
            <TextField id="whatsapp" label="WhatsApp" optional value={form.whatsapp} maxLength={30} onChange={(v) => set('whatsapp', v)} placeholder="+55 11 99999-0000" />
            <TextField id="phone" label="Telefone" optional value={form.phone} maxLength={30} onChange={(v) => set('phone', v)} />
            <TextField id="email" label="E-mail de contato" optional value={form.email} maxLength={320} onChange={(v) => set('email', v)} />
            <TextField id="instagram" label="Instagram" optional value={form.instagram} maxLength={120} onChange={(v) => set('instagram', v)} placeholder="@suacomunidade" />
            <TextField id="facebook" label="Facebook" optional value={form.facebook} maxLength={200} onChange={(v) => set('facebook', v)} />
          </div>
        </section>

        <section className="card">
          <div className="card__body stack">
            <h2>Páginas</h2>
            <p className="muted">Texto simples; linhas em branco separam parágrafos. Página vazia não aparece na vitrine.</p>
            {COMMUNITY_PAGE_KEYS.map((k) => (
              <TextAreaField
                key={k}
                id={`page-${k}`}
                label={COMMUNITY_PAGE_LABELS[k]}
                optional
                rows={k === 'terms' || k === 'privacy' ? 10 : 6}
                value={form.pages[k]}
                maxLength={k === 'terms' || k === 'privacy' ? 20000 : k === 'contact' ? 5000 : 10000}
                onChange={(v) => set('pages', { ...form.pages, [k]: v })}
              />
            ))}
          </div>
        </section>
      </fieldset>
    </>
  );
}
