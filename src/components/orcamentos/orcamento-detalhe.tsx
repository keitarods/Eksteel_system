"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FileDown, Files, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  STATUS_ORCAMENTO,
  type ClienteOrcamento,
  type Orcamento,
  type OrcamentoItem,
  type StatusOrcamento,
} from "@/lib/orcamentos/types";
import { formatarData, formatarMoeda } from "@/lib/orcamentos/calculos";
import { Botao, Cartao, FeedbackBloco, Th, Td } from "./ui";
import StatusBadge from "./status-badge";
import OrcamentoForm from "./orcamento-form";

function LinhaDetalhe({ label, valor }: { label: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-[#2a2a2a] py-2.5 text-sm">
      <span className="text-[#90A4AE]">{label}</span>
      <span className="text-right font-semibold">{valor}</span>
    </div>
  );
}

export default function OrcamentoDetalhe({
  usuarioId,
  dataHoje,
  clientesIniciais,
  orcamentoInicial,
  itensIniciais,
  cliente,
}: {
  usuarioId: string;
  dataHoje: string;
  clientesIniciais: ClienteOrcamento[];
  orcamentoInicial: Orcamento;
  itensIniciais: OrcamentoItem[];
  cliente: ClienteOrcamento | null;
}) {
  const router = useRouter();
  const [orcamento, setOrcamento] = useState(orcamentoInicial);
  const [itens, setItens] = useState(itensIniciais);
  const [editando, setEditando] = useState(false);
  const [duplicando, setDuplicando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function handleMudarStatus(novoStatus: StatusOrcamento) {
    setMensagem("");
    setErro("");
    const supabase = createClient();
    const payload: Record<string, unknown> = {
      status: novoStatus,
      atualizado_por: usuarioId,
      atualizado_em: new Date().toISOString(),
    };
    if (novoStatus === "aprovado") payload.aprovado_em = new Date().toISOString();
    const { error } = await supabase.from("orcamentos").update(payload).eq("id", orcamento.id);
    if (error) { setErro(error.message); return; }
    setOrcamento((prev) => ({
      ...prev,
      status: novoStatus,
      aprovadoEm: novoStatus === "aprovado" ? String(payload.aprovado_em) : prev.aprovadoEm,
    }));
    setMensagem("Status atualizado.");
  }

  async function handleDuplicar() {
    setDuplicando(true);
    setErro("");
    const resp = await fetch(`/api/orcamentos/${orcamento.id}/duplicar`, { method: "POST" });
    const data = await resp.json();
    setDuplicando(false);
    if (!resp.ok) { setErro(data.error ?? "Erro ao duplicar orçamento."); return; }
    router.push(`/orcamentos/${data.id}`);
  }

  async function handleCopiarLink() {
    const url = `${window.location.origin}/orcamentos-publicos/${orcamento.id}`;
    await navigator.clipboard.writeText(url);
    setMensagem("Link público copiado.");
  }

  if (editando) {
    return (
      <Cartao>
        <p className="text-sm font-semibold text-[#90A4AE]">Editando orçamento {orcamento.numero}</p>
        <div className="mt-4">
          <OrcamentoForm
            usuarioId={usuarioId}
            dataHoje={dataHoje}
            clientesIniciais={clientesIniciais}
            orcamentoExistente={orcamento}
            itensExistentes={itens}
            onCancelar={() => setEditando(false)}
            onSalvo={(atualizado) => {
              setOrcamento(atualizado);
              setEditando(false);
            }}
          />
        </div>
      </Cartao>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Cartao>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#90A4AE]">Orçamento</p>
            <h2 className="mt-0.5 text-2xl font-bold">{orcamento.numero}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={orcamento.status} />
            <select
              value={orcamento.status}
              onChange={(e) => handleMudarStatus(e.target.value as StatusOrcamento)}
              className="h-9 rounded-xl border border-[#333333] bg-[#141414] px-2 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
            >
              {STATUS_ORCAMENTO.map((s) => (
                <option key={s.valor} value={s.valor}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <FeedbackBloco mensagem={mensagem} erro={erro} />

        <div className="mt-5 flex flex-wrap gap-3">
          <Botao onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4" /> Editar
          </Botao>
          <a href={`/api/orcamentos/${orcamento.id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Botao variante="secundario">
              <FileDown className="h-4 w-4" /> Gerar PDF
            </Botao>
          </a>
          <Botao variante="secundario" onClick={handleDuplicar} disabled={duplicando}>
            <Files className="h-4 w-4" /> {duplicando ? "Duplicando..." : "Duplicar orçamento"}
          </Botao>
          <Botao variante="secundario" onClick={handleCopiarLink}>
            <Copy className="h-4 w-4" /> Copiar link público
          </Botao>
        </div>
      </Cartao>

      <div className="grid gap-5 lg:grid-cols-2">
        <Cartao>
          <p className="mb-2 text-sm font-semibold text-[#90A4AE]">Cliente</p>
          <LinhaDetalhe label="Nome" valor={cliente?.nome || "-"} />
          <LinhaDetalhe label="CNPJ/CPF" valor={cliente?.cnpjCpf || "-"} />
          <LinhaDetalhe label="Telefone" valor={cliente?.telefone || "-"} />
          <LinhaDetalhe label="E-mail" valor={cliente?.email || "-"} />
          <LinhaDetalhe label="Cidade/UF" valor={[cliente?.cidade, cliente?.uf].filter(Boolean).join("/") || "-"} />
        </Cartao>

        <Cartao>
          <p className="mb-2 text-sm font-semibold text-[#90A4AE]">Condições comerciais</p>
          <LinhaDetalhe label="Tipo" valor={<span className="capitalize">{orcamento.tipo.replace("_", " ")}</span>} />
          <LinhaDetalhe label="Emissão" valor={formatarData(orcamento.dataEmissao)} />
          <LinhaDetalhe label="Validade" valor={`${orcamento.validadeDias} dias`} />
          <LinhaDetalhe label="Pagamento" valor={orcamento.condicoesPagamento || "-"} />
          <LinhaDetalhe label="Prazo de entrega" valor={orcamento.prazoEntrega || "-"} />
          <LinhaDetalhe label="Responsável técnico" valor={orcamento.responsavelTecnico || "-"} />
        </Cartao>
      </div>

      <Cartao>
        <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Itens</p>
        <div className="overflow-x-auto rounded-2xl border border-[#2a2a2a]">
          <table className="w-full min-w-[600px] text-left text-sm">
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

        <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5">
          <LinhaDetalhe label="Subtotal" valor={formatarMoeda(orcamento.subtotal)} />
          <LinhaDetalhe label="Desconto" valor={`- ${formatarMoeda(orcamento.desconto)}`} />
          <div className="flex items-center justify-between pt-2 text-base font-bold">
            <span>Total</span>
            <span className="text-[#90A4AE]">{formatarMoeda(orcamento.total)}</span>
          </div>
        </div>

        {orcamento.observacoes && (
          <p className="mt-4 text-sm text-[#78909C]"><span className="font-semibold text-[#90A4AE]">Observações:</span> {orcamento.observacoes}</p>
        )}
      </Cartao>
    </div>
  );
}
