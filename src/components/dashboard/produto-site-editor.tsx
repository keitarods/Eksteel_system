"use client";
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { LIMITE_IMAGEM, LIMITE_MODELO, validarGlb } from '@/lib/portfolio/validacao';

type Dados = { descricao: string | null; ordem: number; link_mercado_livre: string | null; link_mercado_livre_2: string | null; nome: string; categoria: string; ativo: boolean };
type Foto = { nome: string; url: string };
const campo = 'mt-1 w-full rounded-lg border border-line bg-background px-3 py-2 text-sm';
const botao = 'min-h-11 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold disabled:opacity-50';
export default function ProdutoSiteEditor({ produtoId }: { produtoId: string }) {
  const url = `/api/produtos/${produtoId}/site`;
  const [dados, setDados] = useState<Dados | null>(null);
  const [modelo, setModelo] = useState<Foto | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const carregar = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(url, { signal, cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Não foi possível carregar o produto.');
    return body as { produto: Dados; imagens: Foto[]; modelo: Foto | null };
  }, [url]);
  useEffect(() => {
    const controller = new AbortController();
    carregar(controller.signal).then(body => { if (!controller.signal.aborted) { setDados(body.produto); setFotos(body.imagens); setModelo(body.modelo); } }).catch(e => { if (!controller.signal.aborted) setErro(e.message); }).finally(() => { if (!controller.signal.aborted) setCarregando(false); });
    return () => controller.abort();
  }, [carregar]);
  async function requisitar(method: string, body: BodyInit, json = true) {
    const response = await fetch(url, { method, body, headers: json ? { 'Content-Type': 'application/json' } : undefined });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault(); if (!dados) return;
    setOcupado(true); setErro(''); setMensagem('');
    try {
      await requisitar('PATCH', JSON.stringify({ descricao: dados.descricao ?? '', ordem: dados.ordem, link_mercado_livre: dados.link_mercado_livre ?? '', link_mercado_livre_2: dados.link_mercado_livre_2 ?? '' }));
      setMensagem('Dados do site salvos.');
    } catch(e) { setErro((e as Error).message); } finally { setOcupado(false); }
  }
  async function enviar(file: File) {
    setErro(''); setMensagem('');
    if (file.size > LIMITE_IMAGEM) { setErro('Cada imagem pode ter até 3 MB.'); return; }
    setOcupado(true);
    try { const form = new FormData(); form.set('imagem', file); await requisitar('POST', form, false); setMensagem('Imagem enviada.'); const body = await carregar(); setFotos(body.imagens); setModelo(body.modelo); }
    catch(e) { setErro((e as Error).message); } finally { setOcupado(false); }
  }
  async function enviarModelo(file: File) {
    setErro(''); setMensagem('');
    if (!/\.glb$/i.test(file.name) || !file.size || file.size > LIMITE_MODELO) { setErro('Selecione um arquivo .glb de até 3 MB.'); return; }
    if (modelo && !confirm('Substituir o modelo 3D atual deste produto?')) return;
    setOcupado(true);
    try {
      validarGlb(new Uint8Array(await file.arrayBuffer()));
      const form = new FormData(); form.set('modelo', file);
      await requisitar('POST', form, false);
      const body = await carregar(); setModelo(body.modelo);
      setMensagem('Modelo 3D enviado. A atualização no site pode levar alguns instantes.');
    } catch(e) { setErro((e as Error).message); } finally { setOcupado(false); }
  }
  async function remover(foto: Foto) {
    if (!confirm('Remover esta imagem do site?')) return;
    setOcupado(true); setErro(''); setMensagem('');
    try { await requisitar('DELETE', JSON.stringify({ nome: foto.nome })); setFotos(prev => prev.filter(f => f.nome !== foto.nome)); setMensagem('Imagem removida.'); }
    catch(e) { setErro((e as Error).message); } finally { setOcupado(false); }
  }
  return <div className="space-y-5">
    {erro && <p role="alert" className="rounded-lg bg-red-900/20 p-3 text-sm text-red-300">{erro}</p>}
    {mensagem && <p role="status" className="text-sm text-emerald-300">{mensagem}</p>}
    {carregando ? <p role="status">Carregando dados do site…</p> : !dados ? <button className={botao} onClick={async () => { setErro(''); setCarregando(true); try { const body = await carregar(); setDados(body.produto); setFotos(body.imagens); setModelo(body.modelo); } catch(e) { setErro((e as Error).message); } finally { setCarregando(false); } }}>Tentar novamente</button> : <>
      <p className="text-sm leading-6 text-muted">{dados.nome} · {dados.categoria} · {dados.ativo ? 'Visível no site' : 'Oculto no site'}. Nome, categoria e visibilidade são alterados no cadastro principal.</p>
      <form onSubmit={salvar} className="space-y-4"><fieldset disabled={ocupado} className="space-y-4">
        <label className="block text-sm">Descrição para o site<textarea className={campo} rows={5} maxLength={10000} value={dados.descricao ?? ''} onChange={e => setDados({ ...dados, descricao: e.target.value })} /></label>
        <label className="block text-sm">Link do Mercado Livre — loja 1<input className={campo} type="url" placeholder="https://..." maxLength={2048} value={dados.link_mercado_livre ?? ''} onChange={e => setDados({ ...dados, link_mercado_livre: e.target.value })} /></label>
        <label className="block text-sm">Link do Mercado Livre — loja 2<input className={campo} type="url" placeholder="https://..." maxLength={2048} value={dados.link_mercado_livre_2 ?? ''} onChange={e => setDados({ ...dados, link_mercado_livre_2: e.target.value })} /></label>
        <label className="block text-sm">Ordem no catálogo<input className={campo} type="number" min={0} max={1000000} step={1} required value={dados.ordem} onChange={e => setDados({ ...dados, ordem: Number(e.target.value) })} /><span className="mt-1 block text-xs text-muted">Menores números aparecem primeiro. Deixe os links vazios para ocultar os botões de compra.</span></label>
        <button type="submit" className={`${botao} bg-accent text-background`}>{ocupado ? 'Aguarde…' : 'Salvar dados do site'}</button>
      </fieldset></form>
      <section className="space-y-3 border-t border-line pt-4">
        <h3 className="font-semibold">Modelo 3D do produto</h3>
        <p className="text-xs leading-5 text-muted">Arquivo .glb, até 3 MB. O modelo é vinculado automaticamente ao produto no site. Um novo envio substitui o modelo atual.</p>
        {modelo ? <a className="block break-all text-sm text-accent underline" href={modelo.url} target="_blank" rel="noopener noreferrer">Baixar modelo atual: {modelo.nome}</a> : <p className="text-sm text-muted">Nenhum modelo 3D cadastrado.</p>}
        <label className="block text-sm">{modelo ? 'Substituir modelo 3D' : 'Adicionar modelo 3D'}<input type="file" accept=".glb,model/gltf-binary" disabled={ocupado} className="mt-2 block w-full min-w-0 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-surface file:p-3 file:text-foreground" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void enviarModelo(file); }} /></label>
      </section>
      <section className="space-y-3 border-t border-line pt-4"><h3 className="font-semibold">Imagens do produto</h3><p className="text-xs leading-5 text-muted">JPEG, PNG ou WebP, até 3 MB por imagem. Envio e remoção são salvos imediatamente. A primeira imagem é a capa; novas fotos entram no final.</p>
        <label className="block text-sm">Adicionar imagem<input type="file" accept="image/jpeg,image/png,image/webp" disabled={ocupado} className="mt-2 block w-full min-w-0 text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-surface file:p-3 file:text-foreground" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void enviar(file); }} /></label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fotos.map((foto,i) => <div key={foto.nome} className="min-w-0 rounded-lg border border-line p-2"><Image src={foto.url} alt={`${dados.nome} — foto ${i+1}`} width={240} height={180} unoptimized className="h-32 w-full rounded object-contain" /><p className="my-2 text-xs text-muted">{i === 0 ? 'Capa' : `Foto ${i+1}`}</p><button disabled={ocupado} className={`${botao} w-full text-red-300`} onClick={() => remover(foto)}>Remover</button></div>)}</div>
        {!fotos.length && <p className="text-sm text-muted">Nenhuma imagem cadastrada.</p>}
      </section>
    </>}
  </div>;
}
