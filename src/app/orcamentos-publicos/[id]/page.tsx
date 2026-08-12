import Image from "next/image";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { buscarOrcamentoCompleto } from "@/lib/orcamentos/queries";
import { mapClienteOrcamento } from "@/lib/orcamentos/types";
import { calcularDataValidade, formatarData, formatarMoeda } from "@/lib/orcamentos/calculos";
import { EMPRESA_ORCAMENTO } from "@/lib/orcamentos/empresa";
import { Th, Td } from "@/components/orcamentos/ui";
import StatusBadge from "@/components/orcamentos/status-badge";

export default async function OrcamentoPublicoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Rota sem login: usa a service role key só no servidor pra buscar o orçamento,
  // sem depender de RLS aberta pra "anon".
  const supabase = createServiceClient();
  const resultado = await buscarOrcamentoCompleto(supabase, id);
  if (!resultado) notFound();

  const { orcamento, itens } = resultado;

  const { data: clienteRaw } = await supabase
    .from("clientes_orcamento")
    .select("*")
    .eq("id", orcamento.clienteId)
    .maybeSingle();
  const cliente = clienteRaw ? mapClienteOrcamento(clienteRaw) : null;
  const dataValidade = calcularDataValidade(orcamento.dataEmissao, orcamento.validadeDias);

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-8 text-[#ECEFF1] sm:px-6">
      <section className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#333333] pb-6">
          <Image src="/images/Eksteel-logo.png" alt="Eksteel" width={150} height={46} unoptimized className="h-11 w-auto object-contain" />
          <div className="text-right text-xs text-[#78909C]">
            <p className="font-semibold text-[#90A4AE]">{EMPRESA_ORCAMENTO.razaoSocial}</p>
            <p>{EMPRESA_ORCAMENTO.telefone} · {EMPRESA_ORCAMENTO.email}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#90A4AE]">Orçamento</p>
            <h1 className="mt-0.5 text-3xl font-bold">{orcamento.numero}</h1>
            <div className="mt-2"><StatusBadge status={orcamento.status} /></div>
          </div>
          <div className="text-right text-sm text-[#78909C]">
            <p>Emissão: {formatarData(orcamento.dataEmissao)}</p>
            <p>Validade: {formatarData(dataValidade)}</p>
          </div>
        </div>

        <a
          href={`/api/orcamentos/${orcamento.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-5 text-sm font-semibold text-white transition hover:bg-[#455A64]"
        >
          <FileDown className="h-4 w-4" /> Baixar PDF
        </a>

        <div className="mt-6 rounded-3xl border border-[#333333] bg-[#212121] p-5 sm:p-6">
          <p className="mb-2 text-sm font-semibold text-[#90A4AE]">Cliente</p>
          <p className="text-lg font-bold">{cliente?.nome || "-"}</p>
          <p className="mt-1 text-sm text-[#78909C]">
            {[cliente?.cnpjCpf, cliente?.telefone, cliente?.email].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-[#333333]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] bg-[#212121] text-left text-sm">
              <thead className="bg-[#181818] text-[#90A4AE]">
                <tr>
                  <Th>Descrição</Th>
                  <Th>Unid.</Th>
                  <Th>Qtd.</Th>
                  <Th>Valor unit.</Th>
                  <Th>Valor total</Th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => (
                  <tr key={it.id} className="border-t border-[#2a2a2a]">
                    <Td className="font-semibold">
                      {it.descricao}
                      {it.tipoItem === "servico" && it.detalhamentoTecnico && (
                        <p className="mt-1 text-xs font-normal text-[#78909C]">{it.detalhamentoTecnico}</p>
                      )}
                    </Td>
                    <Td>{it.unidade || "-"}</Td>
                    <Td>{it.quantidade}</Td>
                    <Td>{formatarMoeda(it.valorUnitario)}</Td>
                    <Td className="font-semibold text-[#90A4AE]">{formatarMoeda(it.valorTotal)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5">
          <div className="flex items-center justify-between text-sm text-[#90A4AE]">
            <span>Subtotal</span><span className="font-semibold text-[#ECEFF1]">{formatarMoeda(orcamento.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-[#90A4AE]">
            <span>Desconto</span><span className="font-semibold text-[#ECEFF1]">- {formatarMoeda(orcamento.desconto)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-[#2a2a2a] pt-2 text-base font-bold">
            <span>Total</span><span className="text-[#90A4AE]">{formatarMoeda(orcamento.total)}</span>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-[#333333] bg-[#212121] p-5 text-sm text-[#78909C] sm:p-6">
          <p><span className="font-semibold text-[#90A4AE]">Pagamento:</span> {orcamento.condicoesPagamento || "A combinar"}</p>
          <p className="mt-1"><span className="font-semibold text-[#90A4AE]">Prazo de entrega:</span> {orcamento.prazoEntrega || "A combinar"}</p>
          {orcamento.observacoes && (
            <p className="mt-1"><span className="font-semibold text-[#90A4AE]">Observações:</span> {orcamento.observacoes}</p>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-[#455A64]">
          {EMPRESA_ORCAMENTO.razaoSocial} · {EMPRESA_ORCAMENTO.site}
        </p>
      </section>
    </main>
  );
}
