"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Download, Eye, FileText, FolderOpen, RefreshCw, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { agruparPastas, baixarDesenho, correspondeBusca, listarDesenhos, type Desenho } from "@/lib/desenhos/biblioteca";

const botao = "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-panel-hover disabled:opacity-50";
const tamanho = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KiB` : `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MiB`;

export default function BibliotecaDesenhos({ usuarioId }: { usuarioId: string }) {
  const [arquivos, setArquivos] = useState<Desenho[]>([]);
  const [pastaAtiva, setPastaAtiva] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ desenho: Desenho; url: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const requisicao = useRef(0);
  const trava = useRef(false);
  const montado = useRef(true);

  const carregar = useCallback(async () => {
    const atual = ++requisicao.current;
    try {
      const dados = await listarDesenhos(createClient());
      if (atual !== requisicao.current || !montado.current) return;
      setArquivos(dados);
      setAviso(`${dados.length} PDFs carregados.`);
    } catch (e) {
      if (atual === requisicao.current && montado.current) { setArquivos([]); setErro(e instanceof Error ? e.message : "Falha ao carregar desenhos."); }
    } finally { if (atual === requisicao.current && montado.current) setCarregando(false); }
  }, []);

  useEffect(() => {
    montado.current = true;
    // A carga inicial só atualiza estado após a resposta assíncrona do Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    return () => { montado.current = false; };
  }, [carregar]);
  useEffect(() => {
    if (!preview) return;
    dialog.current?.showModal();
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  function salvarArquivo(url: string, nome: string) {
    const link = document.createElement("a");
    link.href = url; link.download = nome; document.body.appendChild(link); link.click(); link.remove();
  }
  async function abrir(desenho: Desenho, baixar = false) {
    if (trava.current) return;
    trava.current = true; setOcupado(desenho.id); setErro("");
    try {
      const blob = await baixarDesenho(createClient(), desenho);
      if (!montado.current) return;
      const url = URL.createObjectURL(blob);
      if (baixar) {
        salvarArquivo(url, desenho.filename);
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setAviso(`Download de ${desenho.filename} iniciado.`);
      } else setPreview({ desenho, url });
    } catch (e) { if (montado.current) setErro(e instanceof Error ? e.message : "Falha ao abrir PDF."); }
    finally { trava.current = false; if (montado.current) setOcupado(null); }
  }
  function navegar(chave: string | null) { setPastaAtiva(chave); setBusca(""); }
  function atualizar() { setCarregando(true); setErro(""); void carregar(); }
  const pastas = agruparPastas(arquivos);
  const pasta = pastas.find(p => p.chave === pastaAtiva);
  const filtrados = (pasta ? pasta.arquivos : arquivos).filter(a => correspondeBusca(a, busca));
  const pastasVisiveis = pastas.filter(p => p.arquivos.some(a => correspondeBusca(a, busca)));

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex items-center gap-2 rounded-lg border border-line bg-background px-3 sm:w-96"><Search size={18} className="text-muted" /><input aria-label="Buscar desenhos" placeholder="Buscar PDF, pasta, origem ou observação" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" value={busca} onChange={e => setBusca(e.target.value)} /></label>
      <button className={botao} disabled={carregando || !!ocupado} onClick={atualizar}><RefreshCw size={16} className={carregando ? "animate-spin" : ""} /> Atualizar biblioteca</button>
    </div>
    <nav aria-label="Caminho da pasta" className="flex flex-wrap items-center gap-2 text-sm"><button onClick={() => navegar(null)} className="inline-flex items-center gap-2 font-semibold text-steel hover:underline"><FolderOpen size={17} /> Todas as pastas</button>{pasta && <><ChevronRight size={15} className="text-muted" /><span aria-current="page" className="break-all">{pasta.nome}</span><span className="text-xs text-muted">{pasta.autor === usuarioId ? "Sua pasta" : `Compartilhada · ${pasta.autor.slice(0, 8)}`}</span></>}</nav>
    <p role="status" className="sr-only">{aviso}</p>
    {erro && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{erro}</div>}
    {carregando ? <p role="status" className="rounded-xl border border-line bg-panel p-12 text-center text-muted">Carregando biblioteca de desenhos…</p> : !erro && arquivos.length === 0 ? <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-12 text-center"><FolderOpen size={40} className="mx-auto text-steel" /><h2 className="mt-4 text-lg font-semibold">Seus desenhos aparecerão aqui</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">No Model System, abra Projetos na nuvem, escolha uma pasta e use Gerar e enviar PDF ou Enviar arquivo. As pastas com PDFs publicados e liberados para sua conta serão exibidas nesta biblioteca.</p><p className="mt-3 text-xs text-muted">Se o PDF foi publicado por outra pessoa, solicite acesso à pasta ao administrador.</p></div> : <>
      {!pasta && <section aria-label="Pastas de desenhos" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{pastasVisiveis.map(p => <button key={p.chave} onClick={() => navegar(p.chave)} className="group rounded-xl border border-line bg-panel p-5 text-left transition hover:border-steel hover:bg-panel-hover"><FolderOpen size={32} className="mb-4 text-sky-300" /><h2 className="break-words font-semibold">{p.nome}</h2><p className="mt-2 text-xs text-muted">{p.arquivos.length} {p.arquivos.length === 1 ? "PDF" : "PDFs"} · {p.autor === usuarioId ? "Sua pasta" : `Compartilhada · ${p.autor.slice(0, 8)}`}</p></button>)}</section>}
      {(pasta || busca.trim()) && <section aria-label="Arquivos PDF" className="overflow-hidden rounded-xl border border-line bg-panel">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">{filtrados.length} {filtrados.length === 1 ? "PDF encontrado" : "PDFs encontrados"}</div>
        <ul className="divide-y divide-line">{filtrados.map(a => <li key={a.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
          <span className="hidden rounded-lg bg-red-400/10 p-3 text-red-300 sm:block"><FileText size={24} /></span>
          <div className="min-w-0 flex-1"><button onClick={() => void abrir(a)} disabled={!!ocupado} className="break-all text-left font-semibold hover:text-steel hover:underline disabled:opacity-50">{a.filename}</button><p className="mt-1 break-words text-sm text-muted">{a.source_name}{!pasta && ` · ${a.folder_name}`}</p>{a.purpose && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{a.purpose}</p>}<p className="mt-2 text-xs text-muted">{tamanho(a.byte_size)} · {new Date(a.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></div>
          <div className="flex shrink-0 flex-wrap gap-2"><button className={botao} disabled={!!ocupado} onClick={() => void abrir(a)} aria-label={`Visualizar ${a.filename}`}><Eye size={16} />{ocupado === a.id ? "Carregando…" : "Visualizar"}</button><button className={botao} disabled={!!ocupado} onClick={() => void abrir(a, true)} aria-label={`Baixar ${a.filename}`}><Download size={16} /> Baixar</button></div>
        </li>)}</ul>
      </section>}
      {!!arquivos.length && !filtrados.length && <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-muted">Nenhum PDF encontrado para esta busca.</p>}
    </>}
    <details className="rounded-xl border border-line bg-panel p-4 text-sm text-muted"><summary className="cursor-pointer font-medium text-foreground">Como adicionar desenhos nesta biblioteca</summary><p className="mt-3 leading-6">No Model System Eksteel, conecte Projetos na nuvem ao mesmo repositório usado aqui. Escolha ou crie uma pasta, informe a origem do desenho e use Gerar e enviar PDF. Você também pode enviar um PDF já salvo usando Enviar arquivo. Depois, clique em Atualizar biblioteca nesta página.</p><p className="mt-2 leading-6">São exibidos seus PDFs e os de pastas compartilhadas com sua conta. Cada envio mantém uma cópia independente, com sua data, origem e observação.</p></details>
    <dialog ref={dialog} onClose={() => setPreview(null)} aria-labelledby="titulo-pdf" className="fixed inset-0 m-auto h-[92dvh] w-[calc(100%-1rem)] max-w-7xl overflow-hidden rounded-xl border border-line bg-panel p-0 text-foreground shadow-2xl backdrop:bg-black/75">
      {preview && <div className="flex h-full flex-col"><div className="flex flex-wrap items-center gap-3 border-b border-line p-3"><h2 id="titulo-pdf" className="min-w-0 flex-1 truncate font-semibold">{preview.desenho.filename}</h2><button className={botao} onClick={() => salvarArquivo(preview.url, preview.desenho.filename)}><Download size={16} /> Baixar PDF</button><button autoFocus className={botao} aria-label="Fechar visualização" onClick={() => dialog.current?.close()}><X size={20} /></button></div><p className="px-3 py-2 text-xs text-muted">Se o navegador não exibir o PDF, use Baixar PDF para abri-lo no seu dispositivo.</p><iframe title={`PDF: ${preview.desenho.filename}`} src={preview.url} className="min-h-0 w-full flex-1 border-0 bg-white" /></div>}
    </dialog>
  </div>;
}
