"use client";

import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { MAX_CHECKLISTS, MAX_ITENS, progressoChecklists, type Checklist } from "@/lib/kanban/checklists";

export default function ChecklistsEditor({ value, onChange }: { value: Checklist[]; onChange: (listas: Checklist[]) => void }) {
  const atualizar = (id: string, update: Partial<Checklist>) => onChange(value.map(c => c.id === id ? { ...c, ...update } : c));
  return <section className="space-y-4 sm:col-span-2" aria-label="Checklists da atividade">
    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-sm font-semibold"><CheckSquare size={18} /> Checklists</h4><button type="button" disabled={value.length >= MAX_CHECKLISTS} onClick={() => onChange([...value, { id: crypto.randomUUID(), titulo: "Checklist", itens: [] }])} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-xs hover:bg-panel-hover disabled:opacity-50"><Plus size={15} /> Adicionar checklist</button></div>
    {!value.length && <p className="text-xs text-muted">Divida a atividade em etapas menores e acompanhe o que já foi feito.</p>}
    {value.map((lista, indice) => {
      const progresso = progressoChecklists([lista]);
      return <section key={lista.id} aria-label={`Checklist ${indice + 1}`} className="space-y-3 rounded-xl border border-line bg-background p-3">
        <div className="flex items-center gap-2"><input aria-label={`Título do checklist ${indice + 1}`} required maxLength={100} value={lista.titulo} onChange={e => atualizar(lista.id, { titulo: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-line bg-panel p-2 text-sm font-semibold" /><button type="button" aria-label={`Excluir checklist ${indice + 1}`} onClick={() => { if (!lista.itens.length || confirm(`Excluir o checklist “${lista.titulo}” e seus itens?`)) onChange(value.filter(c => c.id !== lista.id)); }} className="rounded-lg p-2 text-muted hover:text-red-300"><Trash2 size={16} /></button></div>
        <div className="flex items-center gap-3"><span className="shrink-0 text-xs text-muted">{progresso.concluidos}/{progresso.total} · {progresso.percentual}%</span><div role="progressbar" aria-label={`Progresso de ${lista.titulo}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso.percentual} className="h-2 flex-1 overflow-hidden rounded-full bg-line"><div className="h-full bg-emerald-400 transition-all" style={{ width: `${progresso.percentual}%` }} /></div></div>
        <div className="space-y-2">{lista.itens.map((item, i) => <div key={item.id} className="flex items-center gap-2">
          <input type="checkbox" aria-label={`Concluir ${item.texto || `item ${i + 1}`} em ${lista.titulo}`} checked={item.concluido} onChange={e => atualizar(lista.id, { itens: lista.itens.map(v => v.id === item.id ? { ...v, concluido: e.target.checked } : v) })} className="h-4 w-4 shrink-0 accent-emerald-500" />
          <input aria-label={`Item ${i + 1} do checklist ${indice + 1}`} required maxLength={500} placeholder="Descreva a etapa…" value={item.texto} onChange={e => atualizar(lista.id, { itens: lista.itens.map(v => v.id === item.id ? { ...v, texto: e.target.value } : v) })} className={`min-w-0 flex-1 rounded-lg border border-line bg-panel p-2 text-sm ${item.concluido ? "text-muted line-through" : ""}`} />
          <button type="button" aria-label={`Remover item ${i + 1} do checklist ${indice + 1}`} onClick={() => atualizar(lista.id, { itens: lista.itens.filter(v => v.id !== item.id) })} className="rounded-lg p-2 text-muted hover:text-red-300"><Trash2 size={14} /></button>
        </div>)}</div>
        <button type="button" disabled={lista.itens.length >= MAX_ITENS} onClick={() => atualizar(lista.id, { itens: [...lista.itens, { id: crypto.randomUUID(), texto: "", concluido: false }] })} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-muted hover:bg-panel-hover disabled:opacity-50"><Plus size={14} /> Adicionar item</button>
      </section>;
    })}
    {value.length > 0 && <p className="text-xs text-muted">Salve a atividade para guardar os checklists e os itens concluídos.</p>}
  </section>;
}
