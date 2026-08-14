"use client";

import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  calcularCustoSolda,
  estimarTempoSoldaMin,
  POSICOES_SOLDA,
  PROCESSOS_SOLDA,
  TIPOS_JUNTA,
  type PosicaoSolda,
  type ProcessoSolda,
  type TipoJunta,
} from "@/lib/calculo-custo/soldagem";
import type { Parametro, TempoSoldaPadrao } from "@/lib/calculo-custo/parametros";
import { Botao, Campo, Cartao, FeedbackBloco, SelectCampo, Th, Td } from "@/components/orcamentos/ui";
import AdicionarAoOrcamentoBotao from "./adicionar-ao-orcamento-botao";

type LinhaLivre = { id: string; descricao: string; valor: string };

type ItemLote = {
  id: string;
  nome: string;
  tipoJunta: TipoJunta;
  espessuraMm: string;
  comprimentoM: string;
  processo: ProcessoSolda;
  posicao: PosicaoSolda;
  quantidade: string;
  tempoSoldaMin: number;
  custoMaoDeObra: number;
  custoMaquina: number;
  custoConsumiveis: number;
  custoPreparacao: number;
  custoUnitario: number;
  custoTotal: number;
};

export default function SoldagemCalculadora({
  usuarioId,
  parametros,
  temposSolda,
}: {
  usuarioId: string;
  parametros: Record<string, Parametro>;
  temposSolda: TempoSoldaPadrao[];
}) {
  const [nome, setNome] = useState("");
  const [tipoJunta, setTipoJunta] = useState<TipoJunta>("filete");
  const [espessuraMm, setEspessuraMm] = useState("6");
  const [comprimentoM, setComprimentoM] = useState("1");
  const [processo, setProcesso] = useState<ProcessoSolda>("mig");
  const [posicao, setPosicao] = useState<PosicaoSolda>("plana");
  const [quantidade, setQuantidade] = useState("1");
  const [preparacao, setPreparacao] = useState<LinhaLivre[]>([]);

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [lote, setLote] = useState<ItemLote[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  function parseNumero(valor: string) {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function calcularPeca() {
    const horaSoldador = parametros[processo === "mig" ? "hora_soldador_mig" : "hora_soldador_tig"]?.valor ?? 0;
    const horaMaquinaSolda = parametros["hora_maquina_solda"]?.valor ?? 0;
    const consumoArameKgH = parametros["consumo_arame_kg_h"]?.valor ?? 0;
    const precoKgArame = parametros["preco_kg_arame_mig"]?.valor ?? 0;
    const custoGasHora = parametros["custo_gas_solda_hora"]?.valor ?? 0;
    const qtd = parseNumero(quantidade) || 1;

    const tempoSoldaMin = estimarTempoSoldaMin(
      temposSolda,
      tipoJunta,
      parseNumero(espessuraMm),
      parseNumero(comprimentoM),
      processo,
      posicao
    );
    const { custoMaoDeObra, custoMaquina, custoConsumiveis } = calcularCustoSolda({
      tempoSoldaMin,
      horaSoldador,
      horaMaquinaSolda,
      consumoArameKgH,
      precoKgArame,
      custoGasHora,
    });
    const custoPreparacao = preparacao.filter((l) => l.descricao.trim()).reduce((s, l) => s + parseNumero(l.valor), 0);

    const custoUnitario = custoMaoDeObra + custoMaquina + custoConsumiveis + custoPreparacao;
    return { tempoSoldaMin, custoMaoDeObra, custoMaquina, custoConsumiveis, custoPreparacao, custoUnitario, custoTotal: custoUnitario * qtd };
  }

  const previa = calcularPeca();

  function adicionarAoLote() {
    if (!nome.trim()) { setErro("Dê um nome pra essa peça (pra identificar no lote/histórico)."); return; }
    setErro("");
    setLote((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nome, tipoJunta, espessuraMm, comprimentoM, processo, posicao, quantidade, ...previa },
    ]);
    setNome("");
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
      tipo_calculo: "soldagem",
      material: "aco_carbono",
      espessura_mm: parseNumero(peca.espessuraMm),
      custo_total: peca.custoUnitario,
      quantidade: parseNumero(peca.quantidade) || 1,
      parametros_especificos: {
        tipoJunta: peca.tipoJunta,
        comprimentoM: parseNumero(peca.comprimentoM),
        processo: peca.processo,
        posicao: peca.posicao,
        tempoSoldaMin: peca.tempoSoldaMin,
        custoMaoDeObra: peca.custoMaoDeObra,
        custoMaquina: peca.custoMaquina,
        custoConsumiveis: peca.custoConsumiveis,
        custoPreparacao: peca.custoPreparacao,
      },
    });
    setSalvandoId(null);
    setMensagem("Cálculo salvo no histórico.");
  }

  const totalLote = lote.reduce((s, p) => s + p.custoTotal, 0);

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      <Cartao>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome da peça" value={nome} onChange={setNome} placeholder="Ex: Estrutura de suporte" />
          <SelectCampo label="Tipo de junta" value={tipoJunta} onChange={(v) => setTipoJunta(v as TipoJunta)} options={TIPOS_JUNTA} />
          <Campo label="Espessura (mm)" value={espessuraMm} onChange={setEspessuraMm} />
          <Campo label="Comprimento do cordão (m)" value={comprimentoM} onChange={setComprimentoM} />
          <SelectCampo label="Processo" value={processo} onChange={(v) => setProcesso(v as ProcessoSolda)} options={PROCESSOS_SOLDA} />
          <SelectCampo label="Posição" value={posicao} onChange={(v) => setPosicao(v as PosicaoSolda)} options={POSICOES_SOLDA.map((p) => ({ valor: p.valor, label: p.label }))} />
          <Campo label="Quantidade" value={quantidade} onChange={setQuantidade} />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Preparação / acabamento (chanfro, esmerilhamento, inspeção...)</p>
            <button
              type="button"
              onClick={() => setPreparacao((prev) => [...prev, { id: crypto.randomUUID(), descricao: "", valor: "0" }])}
              className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-2 text-xs font-semibold text-[#546E7A] hover:bg-[#2a2a2a]"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar
            </button>
          </div>
          {preparacao.map((linha) => (
            <div key={linha.id} className="mt-2 flex gap-2">
              <input
                type="text"
                value={linha.descricao}
                onChange={(e) => setPreparacao((prev) => prev.map((l) => (l.id === linha.id ? { ...l, descricao: e.target.value } : l)))}
                placeholder="Descrição"
                className="h-9 flex-1 rounded-xl border border-[#333333] bg-[#141414] px-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
              />
              <input
                type="text"
                value={linha.valor}
                onChange={(e) => setPreparacao((prev) => prev.map((l) => (l.id === linha.id ? { ...l, valor: e.target.value } : l)))}
                placeholder="0,00"
                className="h-9 w-28 rounded-xl border border-[#333333] bg-[#141414] px-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
              />
              <button
                type="button"
                onClick={() => setPreparacao((prev) => prev.filter((l) => l.id !== linha.id))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-[#78909C]">Tempo estimado</p><p className="font-semibold">{previa.tempoSoldaMin.toFixed(1)}min</p></div>
          <div><p className="text-xs text-[#78909C]">Mão de obra</p><p className="font-semibold">{previa.custoMaoDeObra.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
          <div><p className="text-xs text-[#78909C]">Máquina + consumíveis</p><p className="font-semibold">{(previa.custoMaquina + previa.custoConsumiveis).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
          <div><p className="text-xs text-[#78909C]">Preparação</p><p className="font-semibold">{previa.custoPreparacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
        </div>

        <p className="mt-3 text-sm">
          Custo por peça: <span className="font-semibold text-[#90A4AE]">{previa.custoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
          {" · "}Total do lote desta peça: <span className="font-semibold text-[#90A4AE]">{previa.custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
        </p>

        <div className="mt-4">
          <Botao onClick={adicionarAoLote}>Adicionar ao lote</Botao>
        </div>
      </Cartao>

      {lote.length > 0 && (
        <Cartao>
          <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Lote ({lote.length} peça{lote.length === 1 ? "" : "s"})</p>
          <div className="overflow-x-auto rounded-2xl border border-[#2a2a2a]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#181818] text-[#90A4AE]">
                <tr>
                  <Th>Peça</Th>
                  <Th>Junta</Th>
                  <Th>Processo</Th>
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
                    <Td className="text-xs text-[#78909C]">{TIPOS_JUNTA.find((t) => t.valor === p.tipoJunta)?.label}, {p.espessuraMm}mm</Td>
                    <Td className="text-xs text-[#78909C]">{PROCESSOS_SOLDA.find((pr) => pr.valor === p.processo)?.label}</Td>
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
                          descricao={`Soldagem — ${p.nome}`}
                          detalhamentoTecnico={`Junta ${TIPOS_JUNTA.find((t) => t.valor === p.tipoJunta)?.label.toLowerCase()}, espessura ${p.espessuraMm}mm, cordão ${p.comprimentoM}m. Processo ${PROCESSOS_SOLDA.find((pr) => pr.valor === p.processo)?.label}, posição ${POSICOES_SOLDA.find((po) => po.valor === p.posicao)?.label.toLowerCase()}. Tempo estimado ${p.tempoSoldaMin.toFixed(1)}min.`}
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
