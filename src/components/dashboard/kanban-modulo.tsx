"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buscarTodasLinhas } from "@/lib/relatorios/dados";

const colunas = [{ id: "pendente", nome: "A fazer" }, { id: "andamento", nome: "Em andamento" }, { id: "concluida", nome: "Concluído" }] as const;
type Status = typeof colunas[number]["id"];
type Atividade = { id: string; titulo: string; descricao: string; status: Status; prazo: string | null; responsavel: string; criado_em: string };
const vazio = { titulo: "", descricao: "", prazo: "", responsavel: "" };
const campo = "w-full rounded-lg border border-line bg-background p-3 text-sm";

export default function KanbanModulo() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [form, setForm] = useState(vazio);
  const [editando, setEditando] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const rows = await buscarTodasLinhas(createClient(), "atividades_kanban");
      setAtividades((rows as unknown as Atividade[]).sort((a, b) => a.criado_em.localeCompare(b.criado_em)));
      setErro("");
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao carregar atividades."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || ocupado) return;
    setOcupado(true); setErro("");
    try {
      const db = createClient();
      const payload = { ...form, titulo: form.titulo.trim(), prazo: form.prazo || null };
      const { data, error } = await (editando ? db.from("atividades_kanban").update(payload).eq("id", editando) : db.from("atividades_kanban").insert(payload)).select().single();
      if (error) throw error;
      setAtividades(prev => editando ? prev.map(a => a.id === editando ? data : a) : [...prev, data]);
      setForm(vazio); setEditando(null);
    } catch (e) { setErro(e instanceof Error ? e.message : String((e as { message?: string }).message ?? "Falha ao salvar.")); }
    finally { setOcupado(false); }
  }

  async function mover(a: Atividade, status: Status) {
    setOcupado(true); setErro("");
    try {
      const { data, error } = await createClient().from("atividades_kanban").update({ status }).eq("id", a.id).select().single();
      if (error) throw error;
      setAtividades(prev => prev.map(item => item.id === a.id ? data : item));
    } catch (e) { setErro(String((e as { message?: string }).message ?? "Falha ao mover atividade.")); }
    finally { setOcupado(false); }
  }

  async function excluir(a: Atividade) {
    if (!confirm(`Excluir a atividade “${a.titulo}”?`)) return;
    setOcupado(true); setErro("");
    try {
      const { data, error } = await createClient().from("atividades_kanban").delete().eq("id", a.id).select("id").single();
      if (error || !data) throw error ?? new Error("Atividade não encontrada.");
      setAtividades(prev => prev.filter(item => item.id !== a.id));
      if (editando === a.id) { setEditando(null); setForm(vazio); }
    } catch (e) { setErro(String((e as { message?: string }).message ?? "Falha ao excluir atividade.")); }
    finally { setOcupado(false); }
  }

  return <section className="space-y-5">
    <div className="flex items-center justify-between"><div><h2 className="text-2xl font-bold">Atividades</h2><p className="text-sm text-muted">Organize as tarefas da equipe e acompanhe cada etapa.</p></div><button disabled={ocupado || carregando} onClick={carregar} className="rounded-lg border border-line p-3">Atualizar</button></div>
    {erro && <p role="alert" className="text-red-400">{erro}</p>}
    <form onSubmit={salvar} className="grid gap-3 rounded-xl border border-line bg-panel p-4 sm:grid-cols-2">
      <label className="text-sm">Título<input required maxLength={200} className={campo} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} /></label>
      <label className="text-sm">Responsável<input maxLength={150} className={campo} value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} /></label>
      <label className="text-sm">Descrição<textarea maxLength={4000} className={campo} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></label>
      <label className="text-sm">Prazo<input type="date" className={campo} value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} /></label>
      <div className="flex gap-3"><button disabled={ocupado || carregando} className="rounded-lg bg-accent px-4 py-2 font-semibold text-background disabled:opacity-50">{ocupado ? "Salvando…" : editando ? "Salvar alterações" : "Criar atividade"}</button>{editando && <button type="button" onClick={() => { setEditando(null); setForm(vazio); }}>Cancelar</button>}</div>
    </form>
    {carregando ? <p role="status">Carregando atividades…</p> : <div className="grid gap-4 lg:grid-cols-3">{colunas.map(c => <section key={c.id} className="min-h-48 rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-4 font-bold">{c.nome} <span className="text-muted">({atividades.filter(a => a.status === c.id).length})</span></h3>
      <div className="space-y-3">{atividades.filter(a => a.status === c.id).map(a => <article key={a.id} className="space-y-3 rounded-lg border border-line bg-panel p-4">
        <h4 className="break-words font-semibold">{a.titulo}</h4><p className="whitespace-pre-wrap break-words text-sm text-muted">{a.descricao}</p>
        <p className="text-xs text-muted">{a.responsavel || "Sem responsável"}{a.prazo ? ` • Prazo: ${a.prazo.split("-").reverse().join("/")}` : ""}</p>
        <label className="block text-xs">Etapa<select aria-label={`Etapa de ${a.titulo}`} disabled={ocupado} className={campo} value={a.status} onChange={e => mover(a, e.target.value as Status)}>{colunas.map(op => <option key={op.id} value={op.id}>{op.nome}</option>)}</select></label>
        <div className="flex gap-4 text-sm"><button disabled={ocupado} onClick={() => { setEditando(a.id); setForm({ titulo: a.titulo, descricao: a.descricao, prazo: a.prazo ?? "", responsavel: a.responsavel }); }}>Editar</button><button disabled={ocupado} className="text-red-400" onClick={() => excluir(a)}>Excluir</button></div>
      </article>)}{!atividades.some(a => a.status === c.id) && <p className="text-sm text-muted">Nenhuma atividade nesta etapa.</p>}</div>
    </section>)}</div>}
  </section>;
}
