import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarOrcamentoCompleto } from "@/lib/orcamentos/queries";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const resultado = await buscarOrcamentoCompleto(supabase, id);
  if (!resultado) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  const { orcamento, itens } = resultado;

  const { data: novoOrcamento, error: errOrc } = await supabase
    .from("orcamentos")
    .insert({
      criado_por: user.id,
      cliente_id: orcamento.clienteId,
      tipo: orcamento.tipo,
      status: "rascunho",
      data_emissao: new Date().toISOString().slice(0, 10),
      validade_dias: orcamento.validadeDias,
      condicoes_pagamento: orcamento.condicoesPagamento,
      prazo_entrega: orcamento.prazoEntrega,
      observacoes: orcamento.observacoes,
      responsavel_tecnico: orcamento.responsavelTecnico,
      cnpj_emissor: orcamento.cnpjEmissor,
      cnpj_emissor_label: orcamento.cnpjEmissorLabel,
      subtotal: orcamento.subtotal,
      desconto: orcamento.desconto,
      total: orcamento.total,
    })
    .select("id")
    .single();

  if (errOrc || !novoOrcamento) {
    return NextResponse.json({ error: errOrc?.message ?? "Erro ao duplicar orçamento." }, { status: 500 });
  }

  if (itens.length > 0) {
    const { error: errItens } = await supabase.from("orcamento_itens").insert(
      itens.map((it) => ({
        orcamento_id: novoOrcamento.id,
        tipo_item: it.tipoItem,
        descricao: it.descricao,
        detalhamento_tecnico: it.detalhamentoTecnico,
        unidade: it.unidade,
        quantidade: it.quantidade,
        valor_unitario: it.valorUnitario,
        valor_total: it.valorTotal,
        ordem: it.ordem,
      }))
    );
    if (errItens) {
      return NextResponse.json({ error: errItens.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: novoOrcamento.id });
}
