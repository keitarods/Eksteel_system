"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mapClienteOrcamento, type ClienteOrcamento } from "@/lib/orcamentos/types";
import { Campo, SelectCampo, Botao } from "./ui";

export default function ClientePicker({
  usuarioId,
  clientes,
  clienteId,
  onSelecionar,
  onClienteCriado,
  onClienteExcluido,
}: {
  usuarioId: string;
  clientes: ClienteOrcamento[];
  clienteId: string;
  onSelecionar: (id: string) => void;
  onClienteCriado: (cliente: ClienteOrcamento) => void;
  onClienteExcluido: (id: string) => void;
}) {
  const [criando, setCriando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    nome: "", cnpjCpf: "", telefone: "", email: "", endereco: "", cidade: "", uf: "",
  });

  async function handleCriar() {
    if (!form.nome.trim()) { setErro("Informe o nome do cliente."); return; }
    setSalvando(true);
    setErro("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("clientes_orcamento")
      .insert({
        criado_por: usuarioId,
        nome: form.nome.trim(),
        cnpj_cpf: form.cnpjCpf.trim(),
        telefone: form.telefone.trim(),
        email: form.email.trim(),
        endereco: form.endereco.trim(),
        cidade: form.cidade.trim(),
        uf: form.uf.trim(),
      })
      .select()
      .single();
    setSalvando(false);
    if (error) { setErro(error.message); return; }

    const cliente = mapClienteOrcamento(data);
    onClienteCriado(cliente);
    onSelecionar(cliente.id);
    setCriando(false);
    setForm({ nome: "", cnpjCpf: "", telefone: "", email: "", endereco: "", cidade: "", uf: "" });
  }

  async function handleExcluir() {
    if (!clienteId) return;
    const cliente = clientes.find((c) => c.id === clienteId);
    if (!cliente) return;
    if (!confirm(`Excluir o cliente "${cliente.nome}"? Isso não pode ser desfeito.`)) return;

    setExcluindo(true);
    setErro("");
    const supabase = createClient();
    const { error } = await supabase.from("clientes_orcamento").delete().eq("id", clienteId);
    setExcluindo(false);
    if (error) {
      setErro(
        error.code === "23503"
          ? "Não dá pra excluir: esse cliente já está vinculado a um ou mais orçamentos."
          : error.message
      );
      return;
    }
    onClienteExcluido(clienteId);
  }

  if (criando) {
    return (
      // Div, não <form> — o ClientePicker já fica dentro do <form> do orçamento,
      // e HTML não permite formulário aninhado (o navegador ignora o form interno
      // e o clique acaba submetendo o formulário de fora).
      <div className="rounded-2xl border border-[#333333] bg-[#141414] p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#90A4AE]">Novo cliente</p>
          <button type="button" onClick={() => setCriando(false)} className="text-[#90A4AE] hover:text-[#ECEFF1]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Campo label="Nome / Razão social" value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} required />
          <Campo label="CNPJ/CPF" value={form.cnpjCpf} onChange={(v) => setForm((f) => ({ ...f, cnpjCpf: v }))} />
          <Campo label="Telefone" value={form.telefone} onChange={(v) => setForm((f) => ({ ...f, telefone: v }))} />
          <Campo label="E-mail" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          <div className="sm:col-span-2">
            <Campo label="Endereço" value={form.endereco} onChange={(v) => setForm((f) => ({ ...f, endereco: v }))} />
          </div>
          <Campo label="Cidade" value={form.cidade} onChange={(v) => setForm((f) => ({ ...f, cidade: v }))} />
          <Campo label="UF" value={form.uf} onChange={(v) => setForm((f) => ({ ...f, uf: v.toUpperCase().slice(0, 2) }))} />
        </div>
        {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}
        <div className="mt-4">
          <Botao type="button" onClick={handleCriar} disabled={salvando}>
            {salvando ? "Salvando..." : "Cadastrar e selecionar"}
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <SelectCampo
            label="Cliente"
            value={clienteId}
            onChange={onSelecionar}
            options={clientes.map((c) => ({ valor: c.id, label: c.nome }))}
            placeholder="Selecione um cliente..."
          />
        </div>
        {clienteId && (
          <button
            type="button"
            onClick={handleExcluir}
            disabled={excluindo}
            title="Excluir cliente selecionado"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-900/50 bg-red-900/10 text-red-400 transition hover:bg-red-900/30 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <Botao variante="secundario" onClick={() => setCriando(true)}>
          <Plus className="h-4 w-4" /> Novo
        </Botao>
      </div>
      {erro && <p className="mt-2 text-sm text-red-400">{erro}</p>}
    </div>
  );
}
