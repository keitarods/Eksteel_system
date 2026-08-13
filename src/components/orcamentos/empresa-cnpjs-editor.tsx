"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  atualizarEmpresaCnpj,
  criarEmpresaCnpj,
  excluirEmpresaCnpj,
  type EmpresaCnpj,
} from "@/lib/orcamentos/empresa";
import { Botao, Cartao } from "./ui";

type LinhaCnpj = EmpresaCnpj & { salvando?: boolean; excluindo?: boolean };

export default function EmpresaCnpjsEditor({
  usuarioId,
  cnpjsIniciais,
}: {
  usuarioId: string;
  cnpjsIniciais: EmpresaCnpj[];
}) {
  const [linhas, setLinhas] = useState<LinhaCnpj[]>(cnpjsIniciais);
  const [erro, setErro] = useState("");

  function atualizarCampo(id: string, campo: "label" | "cnpj", valor: string) {
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, { id: `novo-${crypto.randomUUID()}`, label: "", cnpj: "" }]);
  }

  async function salvarLinha(linha: LinhaCnpj) {
    if (!linha.label.trim()) { setErro("Informe um nome pro CNPJ (ex: Matheus MEI)."); return; }
    setErro("");
    setLinhas((prev) => prev.map((l) => (l.id === linha.id ? { ...l, salvando: true } : l)));
    const supabase = createClient();

    if (linha.id.startsWith("novo-")) {
      const { cnpj, error } = await criarEmpresaCnpj(supabase, usuarioId, linha.label, linha.cnpj);
      if (error || !cnpj) { setErro(error ?? "Erro ao salvar."); setLinhas((prev) => prev.map((l) => (l.id === linha.id ? { ...l, salvando: false } : l))); return; }
      setLinhas((prev) => prev.map((l) => (l.id === linha.id ? { ...cnpj, salvando: false } : l)));
      return;
    }

    const { error } = await atualizarEmpresaCnpj(supabase, linha.id, linha.label, linha.cnpj);
    setLinhas((prev) => prev.map((l) => (l.id === linha.id ? { ...l, salvando: false } : l)));
    if (error) setErro(error);
  }

  async function excluirLinha(linha: LinhaCnpj) {
    if (linha.id.startsWith("novo-")) {
      setLinhas((prev) => prev.filter((l) => l.id !== linha.id));
      return;
    }
    if (!confirm(`Excluir "${linha.label}"?`)) return;
    setErro("");
    setLinhas((prev) => prev.map((l) => (l.id === linha.id ? { ...l, excluindo: true } : l)));
    const supabase = createClient();
    const { error } = await excluirEmpresaCnpj(supabase, linha.id);
    if (error) {
      setErro(error);
      setLinhas((prev) => prev.map((l) => (l.id === linha.id ? { ...l, excluindo: false } : l)));
      return;
    }
    setLinhas((prev) => prev.filter((l) => l.id !== linha.id));
  }

  return (
    <Cartao>
      <p className="text-sm font-semibold text-[#90A4AE]">CNPJs da empresa</p>
      <p className="mt-1 text-xs text-[#78909C]">
        Cada orçamento novo escolhe um desses CNPJs (ex: MEI do Matheus, MEI do Enyo) pra aparecer no PDF.
      </p>

      {erro && <p className="mt-3 text-sm text-red-400">{erro}</p>}

      <div className="mt-4 flex flex-col gap-2">
        {linhas.map((linha) => (
          <div key={linha.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3">
            <input
              type="text"
              value={linha.label}
              onChange={(e) => atualizarCampo(linha.id, "label", e.target.value)}
              placeholder="Nome (ex: Matheus MEI)"
              className="h-9 w-44 rounded-xl border border-[#333333] bg-[#212121] px-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
            />
            <input
              type="text"
              value={linha.cnpj}
              onChange={(e) => atualizarCampo(linha.id, "cnpj", e.target.value)}
              placeholder="00.000.000/0001-00"
              className="h-9 flex-1 min-w-40 rounded-xl border border-[#333333] bg-[#212121] px-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
            />
            <button
              type="button"
              onClick={() => salvarLinha(linha)}
              disabled={linha.salvando}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-3 text-xs font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a] disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> {linha.salvando ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => excluirLinha(linha)}
              disabled={linha.excluindo}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-900/50 bg-red-900/10 text-red-400 transition hover:bg-red-900/30 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {linhas.length === 0 && <p className="text-sm text-[#78909C]">Nenhum CNPJ cadastrado ainda.</p>}
      </div>

      <div className="mt-3">
        <Botao variante="secundario" onClick={adicionarLinha}>
          <Plus className="h-4 w-4" /> Adicionar CNPJ
        </Botao>
      </div>
    </Cartao>
  );
}
