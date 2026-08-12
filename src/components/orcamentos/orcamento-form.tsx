"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  TIPOS_ORCAMENTO,
  type ClienteOrcamento,
  type Orcamento,
  type OrcamentoItem,
  type TipoOrcamento,
} from "@/lib/orcamentos/types";
import { calcularSubtotal, calcularTotal, parseNumero } from "@/lib/orcamentos/calculos";
import { Campo, CampoTextarea, SelectCampo, Botao, FeedbackBloco } from "./ui";
import ClientePicker from "./cliente-picker";
import OrcamentoItensEditor, { criarItemVazio, type ItemRascunho } from "./orcamento-itens-editor";

function itemExistenteParaRascunho(item: OrcamentoItem): ItemRascunho {
  return {
    tempId: item.id,
    tipoItem: item.tipoItem,
    descricao: item.descricao,
    detalhamentoTecnico: item.detalhamentoTecnico,
    unidade: item.unidade,
    quantidade: String(item.quantidade),
    valorUnitario: String(item.valorUnitario).replace(".", ","),
  };
}

export default function OrcamentoForm({
  usuarioId,
  dataHoje,
  clientesIniciais,
  orcamentoExistente,
  itensExistentes,
  onCancelar,
  onSalvo,
}: {
  usuarioId: string;
  dataHoje: string;
  clientesIniciais: ClienteOrcamento[];
  orcamentoExistente?: Orcamento;
  itensExistentes?: OrcamentoItem[];
  onCancelar?: () => void;
  onSalvo?: (orcamento: Orcamento) => void;
}) {
  const router = useRouter();
  const editando = !!orcamentoExistente;

  const [clientes, setClientes] = useState<ClienteOrcamento[]>(clientesIniciais);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [clienteId, setClienteId] = useState(orcamentoExistente?.clienteId ?? "");
  const [tipo, setTipo] = useState<TipoOrcamento | "">(orcamentoExistente?.tipo ?? "");
  const [dataEmissao, setDataEmissao] = useState(orcamentoExistente?.dataEmissao ?? dataHoje);
  const [validadeDias, setValidadeDias] = useState(String(orcamentoExistente?.validadeDias ?? 15));
  const [condicoesPagamento, setCondicoesPagamento] = useState(orcamentoExistente?.condicoesPagamento ?? "");
  const [prazoEntrega, setPrazoEntrega] = useState(orcamentoExistente?.prazoEntrega ?? "");
  const [responsavelTecnico, setResponsavelTecnico] = useState(orcamentoExistente?.responsavelTecnico ?? "");
  const [observacoes, setObservacoes] = useState(orcamentoExistente?.observacoes ?? "");
  const [desconto, setDesconto] = useState(
    orcamentoExistente ? String(orcamentoExistente.desconto).replace(".", ",") : "0"
  );
  const [itens, setItens] = useState<ItemRascunho[]>(
    itensExistentes && itensExistentes.length > 0
      ? itensExistentes.map(itemExistenteParaRascunho)
      : [criarItemVazio(crypto.randomUUID())]
  );

  const itensValidos = itens.filter((it) => it.descricao.trim());
  const subtotal = calcularSubtotal(
    itensValidos.map((it) => ({ valorTotal: parseNumero(it.quantidade) * parseNumero(it.valorUnitario) }))
  );
  const total = calcularTotal(subtotal, parseNumero(desconto));

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    setErro("");

    if (!clienteId || !tipo || !dataEmissao) {
      setErro("Preencha cliente, tipo e data de emissão.");
      return;
    }
    if (itensValidos.length === 0) {
      setErro("Adicione pelo menos um item com descrição.");
      return;
    }

    setSalvando(true);
    const supabase = createClient();

    const payload = {
      cliente_id: clienteId,
      tipo,
      data_emissao: dataEmissao,
      validade_dias: parseNumero(validadeDias) || 15,
      condicoes_pagamento: condicoesPagamento.trim(),
      prazo_entrega: prazoEntrega.trim(),
      observacoes: observacoes.trim(),
      responsavel_tecnico: responsavelTecnico.trim(),
      subtotal,
      desconto: parseNumero(desconto),
      total,
    };

    const itensPayload = itensValidos.map((it, idx) => ({
      tipo_item: it.tipoItem,
      descricao: it.descricao.trim(),
      detalhamento_tecnico: it.detalhamentoTecnico.trim(),
      unidade: it.unidade.trim(),
      quantidade: parseNumero(it.quantidade) || 1,
      valor_unitario: parseNumero(it.valorUnitario),
      valor_total: (parseNumero(it.quantidade) || 1) * parseNumero(it.valorUnitario),
      ordem: idx,
    }));

    if (editando && orcamentoExistente) {
      const { error: errOrc } = await supabase
        .from("orcamentos")
        .update({
          ...payload,
          atualizado_por: usuarioId,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", orcamentoExistente.id);
      if (errOrc) { setSalvando(false); setErro(errOrc.message); return; }

      const { error: errDel } = await supabase.from("orcamento_itens").delete().eq("orcamento_id", orcamentoExistente.id);
      if (errDel) { setSalvando(false); setErro(errDel.message); return; }

      const { error: errItens } = await supabase.from("orcamento_itens").insert(
        itensPayload.map((it) => ({ ...it, orcamento_id: orcamentoExistente.id }))
      );
      setSalvando(false);
      if (errItens) { setErro(errItens.message); return; }

      setMensagem("Orçamento atualizado.");
      const clienteNome = clientes.find((c) => c.id === clienteId)?.nome ?? orcamentoExistente.clienteNome;
      const atualizado: Orcamento = { ...orcamentoExistente, ...payload, tipo: tipo as TipoOrcamento, clienteNome };
      if (onSalvo) onSalvo(atualizado);
      router.refresh();
      return;
    }

    const { data: novoOrcamento, error: errOrc } = await supabase
      .from("orcamentos")
      .insert({ ...payload, criado_por: usuarioId })
      .select()
      .single();
    if (errOrc || !novoOrcamento) { setSalvando(false); setErro(errOrc?.message ?? "Erro ao criar orçamento."); return; }

    const { error: errItens } = await supabase.from("orcamento_itens").insert(
      itensPayload.map((it) => ({ ...it, orcamento_id: novoOrcamento.id }))
    );
    setSalvando(false);
    if (errItens) { setErro(errItens.message); return; }

    router.push(`/orcamentos/${novoOrcamento.id}`);
  }

  return (
    <form onSubmit={handleSalvar} className="flex flex-col gap-5">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ClientePicker
            usuarioId={usuarioId}
            clientes={clientes}
            clienteId={clienteId}
            onSelecionar={setClienteId}
            onClienteCriado={(c) => setClientes((prev) => [c, ...prev])}
          />
        </div>
        <SelectCampo label="Tipo de orçamento" value={tipo} onChange={(v) => setTipo(v as TipoOrcamento)} options={TIPOS_ORCAMENTO.map((t) => ({ valor: t.valor, label: t.label }))} />
        <Campo label="Data de emissão" type="date" value={dataEmissao} onChange={setDataEmissao} required />
        <Campo label="Validade (dias)" value={validadeDias} onChange={setValidadeDias} placeholder="15" />
        <Campo label="Responsável técnico" value={responsavelTecnico} onChange={setResponsavelTecnico} placeholder="Ex: Eng. Matheus Keitaro" />
        <Campo label="Condições de pagamento" value={condicoesPagamento} onChange={setCondicoesPagamento} placeholder="Ex: 50% na aprovação, 50% na entrega" />
        <Campo label="Prazo de entrega/execução" value={prazoEntrega} onChange={setPrazoEntrega} placeholder="Ex: 15 dias úteis" />
        <div className="sm:col-span-2">
          <CampoTextarea label="Observações" value={observacoes} onChange={setObservacoes} placeholder="Garantia, observações gerais..." />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-[#90A4AE]">Itens do orçamento</p>
        <OrcamentoItensEditor itens={itens} onChange={setItens} />
      </div>

      <div className="ml-auto w-full max-w-xs space-y-2 rounded-2xl border border-[#333333] bg-[#141414] p-4">
        <div className="flex items-center justify-between text-sm text-[#90A4AE]">
          <span>Subtotal</span>
          <span className="font-semibold text-[#ECEFF1]">
            {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-[#90A4AE]">
          <span>Desconto (R$)</span>
          <input
            type="text"
            value={desconto}
            onChange={(e) => setDesconto(e.target.value)}
            placeholder="0,00"
            className="h-9 w-28 rounded-xl border border-[#333333] bg-[#212121] px-2 text-right text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
          />
        </div>
        <div className="flex items-center justify-between border-t border-[#2a2a2a] pt-2 text-base font-bold">
          <span>Total</span>
          <span className="text-[#90A4AE]">
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Botao type="submit" disabled={salvando}>
          <Save className="h-4 w-4" />
          {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Criar orçamento"}
        </Botao>
        {onCancelar && (
          <Botao variante="secundario" onClick={onCancelar}>Cancelar</Botao>
        )}
      </div>
    </form>
  );
}
