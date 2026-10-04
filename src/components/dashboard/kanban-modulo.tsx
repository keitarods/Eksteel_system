"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, CheckCircle2, CheckSquare, GripVertical, LayoutDashboard, Plus, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { paginar } from "@/lib/relatorios/paginacao";
import { buscarTodasLinhas } from "@/lib/relatorios/dados";

import ChecklistsEditor from "./checklists-editor";
import { progressoChecklists, validarChecklists, type Checklist } from "@/lib/kanban/checklists";
import { detectarChecklists, gravarAtividade } from "@/lib/kanban/persistencia";

const colunas = [{ id: "pendente", nome: "A fazer" }, { id: "andamento", nome: "Em andamento" }, { id: "concluida", nome: "Concluído" }] as const;
type Status = typeof colunas[number]["id"];
type Atividade = { id: string; titulo: string; descricao: string; status: Status; prazo: string | null; responsavel: string; participantes?: string[] | null; checklists?: Checklist[]; criado_em: string };
type Usuario = { id: string; nome: string; email: string };
const vazio = { titulo: "", descricao: "", prazo: "", participantes: [] as string[], checklists: [] as Checklist[] };
const campo = "w-full rounded-lg border border-line bg-background p-3 text-sm";

export default function KanbanModulo() {
  const [modalAberto, setModalAberto] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [buscaParticipante, setBuscaParticipante] = useState("");
  const [busca, setBusca] = useState("");
  const [statusNovo, setStatusNovo] = useState<Status>("pendente");
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [destino, setDestino] = useState<Status | null>(null);
  const [aviso, setAviso] = useState("");
  const checklistsOriginais = useRef<Checklist[]>([]);
  const trava = useRef(false);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState(false);
  const [checklistsDisponiveis, setChecklistsDisponiveis] = useState(false);
  const [form, setForm] = useState(vazio);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    setUsuariosDisponiveis(false);
    try {
      const db = createClient();
      const [rows, cadastrados, temChecklists] = await Promise.all([
        buscarTodasLinhas(db, "atividades_kanban"),
        paginar(async (inicio, fim) => {
          const { data, error } = await db.from("usuarios_empresa").select("usuario_id, nome, email").order("usuario_id").range(inicio, fim);
          if (error) throw new Error("Não foi possível carregar os usuários cadastrados. Atualize o quadro para tentar novamente.");
          return (data ?? []).map(u => ({ id: String(u.usuario_id), nome: String(u.nome ?? "").trim(), email: String(u.email ?? "").trim() }));
        }),
        detectarChecklists(db),
      ]);
      setChecklistsDisponiveis(temChecklists);
      setUsuarios(cadastrados.sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR")));
      setUsuariosDisponiveis(true);
      setAtividades((rows as unknown as Atividade[]).sort((a, b) => a.criado_em.localeCompare(b.criado_em)));
      setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao carregar atividades."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || trava.current || carregando) return;
    if (!usuariosDisponiveis) { setErro("Atualize o quadro para carregar os usuários antes de salvar."); return; }
    if (form.participantes.some(id => !usuarios.some(u => u.id === id))) {
      setErro("Remova os participantes indisponíveis e selecione somente usuários cadastrados."); return;
    }
    const erroChecklist = validarChecklists(form.checklists);
    if (erroChecklist) { setErro(erroChecklist); return; }
    trava.current = true;
    setOcupado(true); setErro("");
    try {
      const db = createClient();
      const payload = { ...form, responsavel: form.participantes[0] ?? "", titulo: form.titulo.trim(), prazo: form.prazo || null, checklists: form.checklists.map(c => ({ ...c, titulo: c.titulo.trim(), itens: c.itens.map(i => ({ ...i, texto: i.texto.trim() })) })) };
      const { data, error } = await gravarAtividade(db, payload, editando, statusNovo, checklistsDisponiveis, checklistsOriginais.current);
      if (error) {
        if (error.code === "PGRST204" || error.code === "42703") throw new Error("Os recursos desta atividade ainda não foram habilitados no sistema. Solicite a atualização ao administrador.");
        if (error.code === "PGRST116") throw new Error("Esta atividade foi alterada por outra pessoa. Reabra o cartão antes de salvar para preservar as alterações.");
        throw error;
      }
      setAtividades(prev => editando ? prev.map(a => a.id === editando ? data : a) : [...prev, data]);
      setForm(vazio); setEditando(null); dialog.current?.close(); setAviso("Atividade salva.");
    } catch (e) { setErro(e instanceof Error ? e.message : String((e as { message?: string }).message ?? "Falha ao salvar.")); }
    finally { trava.current = false; setOcupado(false); }
  }

  async function mover(a: Atividade, status: Status) {
    if (trava.current || a.status === status) return;
    trava.current = true;
    setOcupado(true); setErro("");
    try {
      const { data, error } = await createClient().from("atividades_kanban").update({ status }).eq("id", a.id).select().single();
      if (error) throw error;
      setAtividades(prev => prev.map(item => item.id === a.id ? data : item));
      setAviso(`Atividade movida para ${colunas.find(c => c.id === status)?.nome}.`);
    } catch (e) { setErro(String((e as { message?: string }).message ?? "Falha ao mover atividade.")); }
    finally { trava.current = false; setOcupado(false); }
  }

  async function excluir(a: Atividade) {
    if (trava.current) return;
    if (!confirm(`Excluir a atividade “${a.titulo}”?`)) return;
    trava.current = true;
    setOcupado(true); setErro("");
    try {
      const { data, error } = await createClient().from("atividades_kanban").delete().eq("id", a.id).select("id").single();
      if (error || !data) throw error ?? new Error("Atividade não encontrada.");
      setAtividades(prev => prev.filter(item => item.id !== a.id));
      if (editando === a.id) { setEditando(null); setForm(vazio); }
    } catch (e) { setErro(String((e as { message?: string }).message ?? "Falha ao excluir atividade.")); }
    finally { trava.current = false; setOcupado(false); }
  }

  function nomeResponsavel(valor: string) {
    const usuario = usuarios.find(u => u.id === valor);
    return usuario ? usuario.nome || usuario.email || "Usuário cadastrado" : valor;
  }

  function participantesDaAtividade(atividade: Atividade): string[] {
    if (atividade.participantes != null) return atividade.participantes;
    const anterior = atividade.responsavel;
    if (!anterior) return [];
    const encontrados = usuarios.filter(u => u.id === anterior || u.nome === anterior || u.email === anterior);
    return encontrados.length === 1 ? [encontrados[0].id] : [anterior];
  }

  function alternarParticipante(id: string) {
    setForm(f => ({ ...f, participantes: f.participantes.includes(id) ? f.participantes.filter(p => p !== id) : [...f.participantes, id] }));
  }

  function abrir(status: Status, atividade?: Atividade) {
    setErro(""); setStatusNovo(status); setEditando(atividade?.id ?? null);
    setBuscaParticipante("");
    checklistsOriginais.current = atividade?.checklists ?? [];
    setForm(atividade ? { titulo: atividade.titulo, descricao: atividade.descricao, prazo: atividade.prazo ?? "", participantes: participantesDaAtividade(atividade), checklists: atividade.checklists ?? [] } : vazio);
    setModalAberto(true);
    dialog.current?.showModal();
  }
  const visiveis = atividades.filter(a => `${a.titulo} ${a.descricao} ${participantesDaAtividade(a).map(nomeResponsavel).join(" ")}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR")));
  const hoje = new Date().toLocaleDateString("sv-SE");
  const concluidas = atividades.filter(a => a.status === "concluida").length;
  const cores: Record<Status, string> = { pendente: "bg-slate-400", andamento: "bg-sky-400", concluida: "bg-emerald-400" };

  return <section className="w-full min-w-0 space-y-5 overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><span className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-300"><LayoutDashboard size={22} /></span><div><p className="text-xs font-semibold uppercase tracking-widest text-muted">Espaço de trabalho</p><h2 className="text-2xl font-bold">Quadro de atividades</h2></div></div>
      <div className="flex gap-2"><button disabled={ocupado || carregando} onClick={carregar} aria-label="Atualizar quadro" className="rounded-lg border border-line p-3 hover:bg-panel disabled:opacity-50"><RefreshCw size={18} className={carregando ? "animate-spin" : ""} /></button><button disabled={ocupado || carregando} onClick={() => abrir("pendente")} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"><Plus size={18} /> Nova atividade</button></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex w-full items-center gap-2 rounded-lg border border-line bg-panel px-3 sm:max-w-sm"><Search size={17} className="text-muted" /><input aria-label="Buscar atividades" placeholder="Buscar título, descrição ou participante" value={busca} onChange={e => setBusca(e.target.value)} className="w-full bg-transparent py-3 text-sm outline-none" /></label>
      <div className="flex items-center gap-3 text-sm text-muted"><CheckCircle2 size={16} className="text-emerald-400" /><span>{concluidas} de {atividades.length} concluídas</span><div role="progressbar" aria-label="Atividades concluídas" aria-valuenow={concluidas} aria-valuemin={0} aria-valuemax={atividades.length || 1} className="h-1.5 w-20 overflow-hidden rounded-full bg-line"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${atividades.length ? concluidas / atividades.length * 100 : 0}%` }} /></div></div>
    </div>
    {erro && !modalAberto && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{erro}</p>}
    <p role="status" className="sr-only">{aviso}</p>
    <div className="rounded-2xl border border-sky-900/30 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-3 sm:p-5">
      <p className="mb-4 text-xs text-slate-400">Arraste os cartões entre as colunas ou use o seletor de etapa.</p>
      {carregando ? <p role="status" className="p-6 text-sm text-slate-300">Carregando atividades…</p> : <div className="flex w-full min-w-0 items-start gap-4 overflow-x-auto pb-3">{colunas.map(c => {
        const lista = visiveis.filter(a => a.status === c.id);
        return <section key={c.id} aria-label={c.nome} onDragOver={e => { if (arrastando && !ocupado) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDestino(c.id); } }} onDrop={e => { e.preventDefault(); const a = atividades.find(item => item.id === arrastando); setDestino(null); setArrastando(null); if (a) void mover(a, c.id); }} className={`w-[290px] min-w-[290px] flex-1 rounded-xl border p-3 transition-colors sm:min-w-[310px] ${destino === c.id ? "border-sky-400 bg-slate-700" : "border-slate-700/60 bg-slate-800/90"}`}>
          <div className="mb-4 flex items-center gap-2 px-1"><span className={`h-2 w-2 rounded-full ${cores[c.id]}`} /><h3 className="text-sm font-semibold text-slate-100">{c.nome}</h3><span className="rounded-md bg-slate-700 px-2 py-0.5 text-xs text-slate-300">{lista.length}</span><button disabled={ocupado} aria-label={`Adicionar atividade em ${c.nome}`} onClick={() => abrir(c.id)} className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><Plus size={18} /></button></div>
          <div className="min-h-32 space-y-3">{lista.map(a => {
            const progresso = progressoChecklists(a.checklists ?? []);
            const participantes = participantesDaAtividade(a);
            const atrasada = Boolean(a.prazo && a.prazo < hoje && a.status !== "concluida");
            return <article key={a.id} draggable={!ocupado} onDragStart={e => { setArrastando(a.id); e.dataTransfer.setData("text/plain", a.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setArrastando(null); setDestino(null); }} className={`group rounded-lg border border-slate-600/70 bg-slate-700/70 p-3.5 shadow-sm transition hover:border-slate-500 hover:shadow-md ${arrastando === a.id ? "opacity-40" : ""}`}>
              <div className={`mb-3 h-1 w-9 rounded-full ${cores[a.status]}`} />
              <div className="flex items-start gap-2"><button disabled={ocupado} onClick={() => abrir(a.status, a)} className="flex-1 text-left text-sm font-semibold leading-6 text-slate-100 hover:underline">{a.titulo}</button><GripVertical size={16} aria-hidden="true" className="mt-1 shrink-0 cursor-grab text-slate-400" /></div>
              {a.descricao && <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-5 text-slate-300">{a.descricao}</p>}
              {progresso.total > 0 && <button type="button" disabled={ocupado} onClick={() => abrir(a.status, a)} aria-label={`Checklist de ${a.titulo}: ${progresso.concluidos} de ${progresso.total} itens concluídos`} className={`mt-3 inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs ${progresso.percentual === 100 ? "bg-emerald-400/15 text-emerald-200" : "bg-slate-900/50 text-slate-300"}`}><CheckSquare size={14} /> {progresso.concluidos}/{progresso.total}</button>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                {a.prazo && <span className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${atrasada ? "bg-red-400/15 text-red-200" : a.status === "concluida" ? "bg-emerald-400/15 text-emerald-200" : "bg-slate-900/50 text-slate-300"}`}><CalendarDays size={12} />{a.prazo.split("-").reverse().join("/")}{atrasada ? " · Atrasada" : ""}</span>}
                <button type="button" disabled={ocupado} onClick={() => abrir(a.status, a)} aria-label={`Participantes de ${a.titulo}: ${participantes.map(nomeResponsavel).join(", ") || "nenhum"}`} title={participantes.map(nomeResponsavel).join(", ") || "Adicionar participantes"} className="ml-auto flex items-center gap-2 rounded-full p-1 text-xs text-slate-300 hover:bg-slate-600">
                  {participantes.length ? <><span>{participantes.length} {participantes.length === 1 ? "participante" : "participantes"}</span><span className="flex -space-x-2">{participantes.slice(0, 3).map(id => <span key={id} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-700 bg-sky-900 text-[10px] font-bold text-sky-100">{nomeResponsavel(id).trim().split(/\s+/).filter(Boolean).slice(0,2).map(n => n[0]).join("").toUpperCase()}</span>)}{participantes.length > 3 && <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-600 text-[10px]">+{participantes.length - 3}</span>}</span></> : <><Users size={15} /> Adicionar participantes</>}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t border-slate-600/60 pt-3"><select aria-label={`Etapa de ${a.titulo}`} disabled={ocupado} className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-800 px-2 py-2 text-xs text-slate-200" value={a.status} onChange={e => void mover(a, e.target.value as Status)}>{colunas.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}</select><button disabled={ocupado} aria-label={`Excluir ${a.titulo}`} onClick={() => void excluir(a)} className="rounded-md p-2 text-slate-400 hover:bg-red-400/10 hover:text-red-300"><Trash2 size={15} /></button></div>
            </article>;
          })}{!lista.length && <p className="rounded-lg border border-dashed border-slate-600 p-5 text-center text-xs leading-5 text-slate-400">{busca ? "Nenhuma atividade encontrada." : "Tudo pronto para começar. Adicione uma atividade ou arraste um cartão para cá."}</p>}</div>
          <button disabled={ocupado} onClick={() => abrir(c.id)} className="mt-3 flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm text-slate-300 hover:bg-slate-700"><Plus size={16} /> Adicionar atividade</button>
        </section>;
      })}</div>}
    </div>
    <dialog ref={dialog} onClose={() => setModalAberto(false)} aria-labelledby="atividade-titulo" onCancel={e => { if (ocupado) e.preventDefault(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-line bg-panel p-5 text-foreground shadow-2xl backdrop:bg-black/70 sm:p-6">
      <div className="mb-5 flex items-center justify-between"><div><p className="text-xs text-muted">{colunas.find(c => c.id === statusNovo)?.nome}</p><h3 id="atividade-titulo" className="text-xl font-bold">{editando ? "Editar atividade" : "Nova atividade"}</h3></div><button disabled={ocupado} type="button" aria-label="Fechar" onClick={() => dialog.current?.close()} className="rounded-lg p-2 hover:bg-panel-hover"><X size={20} /></button></div>
      {erro && <p role="alert" className="mb-4 text-sm text-red-300">{erro}</p>}
      <form onSubmit={salvar}><fieldset disabled={ocupado} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm sm:col-span-2">Título<input autoFocus required maxLength={200} className={campo} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} /></label>
        <label className="space-y-1 text-sm sm:col-span-2">Descrição<textarea rows={4} maxLength={4000} className={campo} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></label>
        {checklistsDisponiveis ? <ChecklistsEditor value={form.checklists} onChange={checklists => setForm(f => ({ ...f, checklists }))} /> : <p className="text-xs text-muted sm:col-span-2">Checklists temporariamente indisponíveis. Você pode salvar os demais dados da atividade.</p>}
        <fieldset disabled={!usuariosDisponiveis || carregando} className="space-y-3 sm:col-span-2">
          <legend className="mb-2 text-sm font-medium">Participantes ({form.participantes.length})</legend>
          <div className="flex flex-wrap gap-2">{form.participantes.map(id => <button key={id} type="button" onClick={() => alternarParticipante(id)} aria-label={`Remover ${nomeResponsavel(id)}`} className="inline-flex max-w-full items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-xs text-sky-200"><span className="truncate">{nomeResponsavel(id)}{!usuarios.some(u => u.id === id) ? " (indisponível)" : ""}</span><X size={13} className="shrink-0" /></button>)}{!form.participantes.length && <p className="text-xs text-muted">Nenhum participante selecionado.</p>}</div>
          <input aria-label="Buscar participantes" placeholder="Buscar usuário por nome ou e-mail" className={campo} value={buscaParticipante} onChange={e => setBuscaParticipante(e.target.value)} />
          <div className="max-h-44 overflow-y-auto rounded-lg border border-line bg-background p-2">{usuarios.filter(u => `${u.nome} ${u.email}`.toLocaleLowerCase("pt-BR").includes(buscaParticipante.toLocaleLowerCase("pt-BR"))).map(u => <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-panel-hover"><input type="checkbox" checked={form.participantes.includes(u.id)} onChange={() => alternarParticipante(u.id)} className="h-4 w-4 shrink-0 accent-sky-500" /><span className="min-w-0 text-sm"><span className="block truncate">{u.nome || u.email || "Usuário cadastrado"}</span>{u.nome && u.email && <span className="block truncate text-xs text-muted">{u.email}</span>}</span></label>)}{!usuarios.some(u => `${u.nome} ${u.email}`.toLocaleLowerCase("pt-BR").includes(buscaParticipante.toLocaleLowerCase("pt-BR"))) && <p className="p-2 text-xs text-muted">Nenhum usuário encontrado.</p>}</div>
          <p className="text-xs text-muted">Marque os usuários que participam desta atividade. As alterações serão aplicadas ao salvar.</p>
        </fieldset>
        <label className="space-y-1 text-sm">Prazo<input type="date" className={campo} value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} /></label>
        <div className="mt-2 flex justify-end gap-3 sm:col-span-2"><button type="button" onClick={() => dialog.current?.close()} className="rounded-lg border border-line px-4 py-2 text-sm">Cancelar</button><button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{ocupado ? "Salvando…" : editando ? "Salvar alterações" : "Criar atividade"}</button></div>
      </fieldset></form>
    </dialog>
  </section>;
}
