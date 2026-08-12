"use client";

import { useState } from "react";
import { CheckCircle2, FilePlus2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listarOrcamentos, criarOrcamentoRascunho, adicionarItemAoOrcamento } from "@/lib/orcamentos/queries";
import type { Orcamento } from "@/lib/orcamentos/types";
import { Botao } from "@/components/orcamentos/ui";

export default function AdicionarAoOrcamentoBotao({
  usuarioId,
  tipoItem,
  descricao,
  detalhamentoTecnico,
  unidade = "un",
  quantidade,
  valorUnitario,
}: {
  usuarioId: string;
  tipoItem: "produto" | "servico";
  descricao: string;
  detalhamentoTecnico?: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [orcamentoId, setOrcamentoId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  async function abrir() {
    setAberto(true);
    setSucesso(null);
    setErro("");
    if (orcamentos.length === 0) {
      setCarregando(true);
      const supabase = createClient();
      const lista = await listarOrcamentos(supabase);
      setOrcamentos(lista.filter((o) => o.status === "rascunho"));
      setCarregando(false);
    }
  }

  async function confirmar() {
    if (!descricao.trim() || quantidade <= 0 || valorUnitario <= 0) {
      setErro("Preencha a descrição, quantidade e valor antes de adicionar.");
      return;
    }
    setEnviando(true);
    setErro("");
    const supabase = createClient();

    let idAlvo = orcamentoId;
    if (!idAlvo) {
      const { id, error } = await criarOrcamentoRascunho(supabase, usuarioId);
      if (error || !id) { setEnviando(false); setErro(error ?? "Erro ao criar orçamento."); return; }
      idAlvo = id;
    }

    const { error } = await adicionarItemAoOrcamento(supabase, {
      orcamentoId: idAlvo,
      tipoItem,
      descricao,
      detalhamentoTecnico,
      unidade,
      quantidade,
      valorUnitario,
    });
    setEnviando(false);
    if (error) { setErro(error); return; }
    setSucesso(idAlvo);
  }

  if (!aberto) {
    return (
      <Botao variante="secundario" onClick={abrir}>
        <FilePlus2 className="h-4 w-4" /> Adicionar ao orçamento
      </Botao>
    );
  }

  if (sucesso) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-900/50 bg-emerald-900/10 px-4 py-3 text-sm text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Item adicionado.{" "}
        <a href={`/orcamentos/${sucesso}`} target="_blank" rel="noopener noreferrer" className="underline">
          Abrir orçamento
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#333333] bg-[#141414] p-4">
      <p className="text-sm font-semibold text-[#90A4AE]">Adicionar a qual orçamento?</p>
      {carregando ? (
        <p className="mt-2 text-xs text-[#78909C]">Carregando orçamentos...</p>
      ) : (
        <select
          value={orcamentoId}
          onChange={(e) => setOrcamentoId(e.target.value)}
          className="mt-2 h-10 w-full rounded-xl border border-[#333333] bg-[#212121] px-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
        >
          <option value="">Criar novo rascunho</option>
          {orcamentos.map((o) => (
            <option key={o.id} value={o.id}>{o.numero} — {o.clienteNome || "sem cliente"}</option>
          ))}
        </select>
      )}
      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
      <div className="mt-3 flex gap-2">
        <Botao onClick={confirmar} disabled={enviando}>{enviando ? "Adicionando..." : "Confirmar"}</Botao>
        <Botao variante="secundario" onClick={() => setAberto(false)}>Cancelar</Botao>
      </div>
    </div>
  );
}
