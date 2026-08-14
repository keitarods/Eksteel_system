"use client";

import { useEffect, useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  calcularCustoCadCae,
  calcularCustoHoraNivel,
  calcularHoraTecnicaBase,
  type NivelResponsabilidadeCad,
} from "@/lib/calculo-custo/cad-cae";
import type { Parametro } from "@/lib/calculo-custo/parametros";
import { Botao, Campo, CampoTextarea, Cartao, FeedbackBloco, SelectCampo, Th, Td } from "@/components/orcamentos/ui";
import AdicionarAoOrcamentoBotao from "./adicionar-ao-orcamento-botao";

type ItemLote = {
  id: string;
  nome: string;
  nivelId: string;
  nivelNome: string;
  horasEstimadas: string;
  horasRevisaoExtra: string;
  revisoesInclusas: string;
  incluirArt: boolean;
  descricaoEscopo: string;
  quantidade: string;
  custoHoraNivel: number;
  custoHoras: number;
  custoRevisoes: number;
  custoArt: number;
  custoUnitario: number;
  custoTotal: number;
};

export default function CadCaeCalculadora({
  usuarioId,
  parametros,
  niveis,
}: {
  usuarioId: string;
  parametros: Record<string, Parametro>;
  niveis: NivelResponsabilidadeCad[];
}) {
  const niveisAtivos = niveis.filter((n) => n.ativo);

  const [nome, setNome] = useState("");
  const [nivelId, setNivelId] = useState(niveisAtivos[0]?.id ?? "");
  const [horasEstimadas, setHorasEstimadas] = useState("8");
  const [horasRevisaoExtra, setHorasRevisaoExtra] = useState("0");
  const [revisoesInclusas, setRevisoesInclusas] = useState("2");
  const [incluirArt, setIncluirArt] = useState(niveisAtivos[0]?.exigeArt ?? false);
  const [descricaoEscopo, setDescricaoEscopo] = useState("");
  const [quantidade, setQuantidade] = useState("1");

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [lote, setLote] = useState<ItemLote[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  function parseNumero(valor: string) {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  const nivelSelecionado = niveisAtivos.find((n) => n.id === nivelId) ?? null;

  // Ao trocar de nível, o toggle de ART segue a sugestão do nível — mas
  // continua editável manualmente depois (às vezes o cliente já tem outro
  // profissional assinando).
  useEffect(() => {
    setIncluirArt(nivelSelecionado?.exigeArt ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nivelId]);

  const horaTecnicaBase = calcularHoraTecnicaBase(
    parametros["salario_referencia_cad"]?.valor ?? 0,
    parametros["fator_k"]?.valor ?? 0,
    parametros["horas_produtivas_mes"]?.valor ?? 0
  );
  const custoHoraNivel = nivelSelecionado ? calcularCustoHoraNivel(horaTecnicaBase, nivelSelecionado.multiplicadorHora) : 0;

  function calcularPeca() {
    const qtd = parseNumero(quantidade) || 1;
    const { custoHoras, custoRevisoes, custoArt, total } = calcularCustoCadCae({
      horasEstimadas: parseNumero(horasEstimadas),
      horasRevisaoExtra: parseNumero(horasRevisaoExtra),
      custoHoraNivel,
      incluirArt,
      valorArtReferencia: parametros["valor_art_referencia"]?.valor ?? 0,
    });
    return { custoHoraNivel, custoHoras, custoRevisoes, custoArt, custoUnitario: total, custoTotal: total * qtd };
  }

  const previa = calcularPeca();

  function adicionarAoLote() {
    if (!nome.trim()) { setErro("Dê um nome pra esse serviço (pra identificar no lote/histórico)."); return; }
    if (!nivelSelecionado) { setErro("Selecione um nível de responsabilidade."); return; }
    setErro("");
    setLote((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nome,
        nivelId,
        nivelNome: nivelSelecionado.nome,
        horasEstimadas,
        horasRevisaoExtra,
        revisoesInclusas,
        incluirArt,
        descricaoEscopo,
        quantidade,
        ...previa,
      },
    ]);
    setNome("");
    setDescricaoEscopo("");
  }

  function removerDoLote(id: string) {
    setLote((prev) => prev.filter((p) => p.id !== id));
  }

  async function salvarNoHistorico(peca: ItemLote) {
    setSalvandoId(peca.id);
    const supabase = createClient();
    await supabase.from("calculos_pecas").insert({
      criado_por: usuarioId,
      nome: peca.nome,
      tipo_calculo: "cad_cae",
      custo_total: peca.custoUnitario,
      quantidade: parseNumero(peca.quantidade) || 1,
      parametros_especificos: {
        nivelResponsabilidadeId: peca.nivelId,
        nivelNome: peca.nivelNome,
        horasEstimadas: parseNumero(peca.horasEstimadas),
        horasRevisaoExtra: parseNumero(peca.horasRevisaoExtra),
        revisoesInclusas: parseNumero(peca.revisoesInclusas),
        custoHoraAplicado: peca.custoHoraNivel,
        incluirArt: peca.incluirArt,
        custoArt: peca.custoArt,
        custoRevisoes: peca.custoRevisoes,
        descricaoEscopo: peca.descricaoEscopo,
        modoCalculo: "hora_tecnica",
      },
    });
    setSalvandoId(null);
    setMensagem("Cálculo salvo no histórico.");
  }

  const totalLote = lote.reduce((s, p) => s + p.custoTotal, 0);

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      {niveisAtivos.length === 0 && (
        <Cartao>
          <p className="text-sm text-[#78909C]">
            Nenhum nível de responsabilidade ativo cadastrado ainda — cadastre pelo menos um na aba
            <span className="font-semibold text-[#90A4AE]"> Parâmetros</span> antes de calcular.
          </p>
        </Cartao>
      )}

      {niveisAtivos.length > 0 && (
        <Cartao>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Nome do serviço" value={nome} onChange={setNome} placeholder="Ex: Detalhamento de estrutura metálica" />
            <SelectCampo
              label="Nível de responsabilidade"
              value={nivelId}
              onChange={setNivelId}
              options={niveisAtivos.map((n) => ({ valor: n.id, label: n.nome }))}
            />
            <Campo label="Horas estimadas" value={horasEstimadas} onChange={setHorasEstimadas} />
            <Campo label="Revisões inclusas no preço" value={revisoesInclusas} onChange={setRevisoesInclusas} />
            <Campo label="Horas de revisão extra (além das inclusas)" value={horasRevisaoExtra} onChange={setHorasRevisaoExtra} />
            <Campo label="Quantidade" value={quantidade} onChange={setQuantidade} />
          </div>

          {nivelSelecionado && (
            <div className="mt-3 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-xs text-[#78909C]">
              {nivelSelecionado.descricao || "Sem descrição cadastrada pra esse nível."}
            </div>
          )}

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={incluirArt} onChange={(e) => setIncluirArt(e.target.checked)} className="h-4 w-4 accent-[#546E7A]" />
            Incluir ART/RRT no orçamento ({(parametros["valor_art_referencia"]?.valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
          </label>

          <div className="mt-4">
            <CampoTextarea
              label="Escopo do serviço (aparece no orçamento)"
              value={descricaoEscopo}
              onChange={setDescricaoEscopo}
              placeholder="Ex: Modelagem 3D e detalhamento de fabricação da estrutura de suporte, inclui 2 revisões."
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-[#78909C]">Hora técnica ({nivelSelecionado?.nome ?? "—"})</p><p className="font-semibold">{custoHoraNivel.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/h</p></div>
            <div><p className="text-xs text-[#78909C]">Horas</p><p className="font-semibold">{previa.custoHoras.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
            <div><p className="text-xs text-[#78909C]">Revisões extras</p><p className="font-semibold">{previa.custoRevisoes.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
            <div><p className="text-xs text-[#78909C]">ART</p><p className="font-semibold">{previa.custoArt.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
          </div>

          <p className="mt-3 text-sm">
            Custo por serviço: <span className="font-semibold text-[#90A4AE]">{previa.custoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
            {" · "}Total do lote deste item: <span className="font-semibold text-[#90A4AE]">{previa.custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
          </p>

          <div className="mt-4">
            <Botao onClick={adicionarAoLote}>Adicionar ao lote</Botao>
          </div>
        </Cartao>
      )}

      {lote.length > 0 && (
        <Cartao>
          <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Lote ({lote.length} item{lote.length === 1 ? "" : "s"})</p>
          <div className="overflow-x-auto rounded-2xl border border-[#2a2a2a]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#181818] text-[#90A4AE]">
                <tr>
                  <Th>Serviço</Th>
                  <Th>Nível</Th>
                  <Th>Qtd.</Th>
                  <Th>Custo un.</Th>
                  <Th>Total</Th>
                  <Th>{" "}</Th>
                </tr>
              </thead>
              <tbody>
                {lote.map((p) => (
                  <tr key={p.id} className="border-t border-[#2a2a2a] align-top">
                    <Td className="font-semibold">{p.nome}</Td>
                    <Td className="text-xs text-[#78909C]">{p.nivelNome}</Td>
                    <Td>{p.quantidade}</Td>
                    <Td>{p.custoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Td>
                    <Td className="font-semibold text-[#90A4AE]">{p.custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Td>
                    <Td>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => salvarNoHistorico(p)}
                          disabled={salvandoId === p.id}
                          className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-2 text-xs font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]"
                        >
                          <Save className="h-3.5 w-3.5" /> Salvar
                        </button>
                        <AdicionarAoOrcamentoBotao
                          usuarioId={usuarioId}
                          tipoItem="servico"
                          descricao={`${p.nome} (${p.nivelNome})`}
                          detalhamentoTecnico={`${p.descricaoEscopo ? `${p.descricaoEscopo} ` : ""}Nível: ${p.nivelNome}. ${p.horasEstimadas}h estimadas${parseNumero(p.horasRevisaoExtra) > 0 ? ` + ${p.horasRevisaoExtra}h de revisão extra` : ""}, ${p.revisoesInclusas} revisão(ões) inclusa(s).${p.incluirArt ? " Inclui ART/RRT." : ""}`}
                          quantidade={parseNumero(p.quantidade) || 1}
                          valorUnitario={p.custoUnitario}
                        />
                        <button
                          type="button"
                          onClick={() => removerDoLote(p.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-900/50 bg-red-900/10 px-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/30"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-right text-base font-bold">
            Total do lote: <span className="text-[#90A4AE]">{totalLote.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
          </p>
        </Cartao>
      )}
    </div>
  );
}
