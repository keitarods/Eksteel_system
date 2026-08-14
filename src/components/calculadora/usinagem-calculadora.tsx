"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  calcularCustoMaterialUsinagem,
  calcularCustoUsinagem,
  calcularTempoUsinagemMin,
  chaveHoraMaquinaUsinagem,
  COMPLEXIDADES,
  EQUIPAMENTOS_USINAGEM,
  type Complexidade,
  type EquipamentoUsinagem,
} from "@/lib/calculo-custo/usinagem";
import { MATERIAIS, chavesParametroMaterial, type Material } from "@/lib/calculo-custo/types";
import type { Parametro } from "@/lib/calculo-custo/parametros";
import { Botao, Campo, Cartao, FeedbackBloco, SelectCampo, Th, Td } from "@/components/orcamentos/ui";
import AdicionarAoOrcamentoBotao from "./adicionar-ao-orcamento-botao";

type ModoTempo = "manual" | "estimado";

type ItemLote = {
  id: string;
  nome: string;
  equipamento: EquipamentoUsinagem;
  material: Material;
  pesoBrutoKg: string;
  tempoUsinagemMin: number;
  tempoSetupMin: string;
  quantidade: string;
  custoMaterial: number;
  custoOperacao: number;
  custoSetupRateado: number;
  custoFerramental: number;
  custoUnitario: number;
  custoTotal: number;
};

export default function UsinagemCalculadora({
  usuarioId,
  parametros,
}: {
  usuarioId: string;
  parametros: Record<string, Parametro>;
}) {
  const [nome, setNome] = useState("");
  const [equipamento, setEquipamento] = useState<EquipamentoUsinagem>("torno_cnc");
  const [material, setMaterial] = useState<Material>("aco_carbono");
  const [pesoBrutoKg, setPesoBrutoKg] = useState("1");
  const [fatorPerda, setFatorPerda] = useState(String(parametros["fator_perda_usinagem"]?.valor ?? 18));

  const [modoTempo, setModoTempo] = useState<ModoTempo>("manual");
  const [tempoManualMin, setTempoManualMin] = useState("30");
  const [complexidade, setComplexidade] = useState<Complexidade>("media");

  const [tempoSetupMin, setTempoSetupMin] = useState("15");
  const [quantidade, setQuantidade] = useState("1");

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [lote, setLote] = useState<ItemLote[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  function parseNumero(valor: string) {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  const tempoBaseMin = parametros["tempo_base_usinagem_min"]?.valor ?? 20;
  const tempoUsinagemMin = calcularTempoUsinagemMin(modoTempo, parseNumero(tempoManualMin), tempoBaseMin, complexidade);

  function calcularPeca() {
    const { preco } = chavesParametroMaterial("usinagem", material);
    const precoKg = parametros[preco]?.valor ?? 0;
    const horaMaquina = parametros[chaveHoraMaquinaUsinagem(equipamento)]?.valor ?? 0;
    const ferramentalHora = parametros["ferramental_usinagem_hora"]?.valor ?? 0;
    const qtd = parseNumero(quantidade) || 1;

    const custoMaterial = calcularCustoMaterialUsinagem(parseNumero(pesoBrutoKg), precoKg, parseNumero(fatorPerda));
    const { custoOperacao, custoSetupRateado, custoFerramental } = calcularCustoUsinagem({
      tempoUsinagemMin,
      tempoSetupMin: parseNumero(tempoSetupMin),
      quantidadeLote: qtd,
      horaMaquina,
      ferramentalHora,
    });

    const custoUnitario = custoMaterial + custoOperacao + custoSetupRateado + custoFerramental;
    return { custoMaterial, custoOperacao, custoSetupRateado, custoFerramental, custoUnitario, custoTotal: custoUnitario * qtd };
  }

  const previa = calcularPeca();

  function adicionarAoLote() {
    if (!nome.trim()) { setErro("Dê um nome pra essa peça (pra identificar no lote/histórico)."); return; }
    setErro("");
    setLote((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nome,
        equipamento,
        material,
        pesoBrutoKg,
        tempoUsinagemMin,
        tempoSetupMin,
        quantidade,
        ...previa,
      },
    ]);
    setNome("");
  }

  function removerDoLote(id: string) {
    setLote((prev) => prev.filter((p) => p.id !== id));
  }

  async function salvarNoHistorico(peca: ItemLote) {
    setSalvandoId(peca.id);
    const supabase = createClient();
    const tipoCalculo = peca.equipamento.startsWith("torno") ? "torneamento" : "fresamento";
    await supabase.from("calculos_pecas").insert({
      criado_por: usuarioId,
      nome: peca.nome,
      tipo_calculo: tipoCalculo,
      material: peca.material,
      peso_kg: parseNumero(peca.pesoBrutoKg),
      custo_material: peca.custoMaterial,
      custo_total: peca.custoUnitario,
      quantidade: parseNumero(peca.quantidade) || 1,
      parametros_especificos: {
        equipamento: peca.equipamento,
        tempoUsinagemMin: peca.tempoUsinagemMin,
        tempoSetupMin: parseNumero(peca.tempoSetupMin),
        custoOperacao: peca.custoOperacao,
        custoSetupRateado: peca.custoSetupRateado,
        custoFerramental: peca.custoFerramental,
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
          <Campo label="Nome da peça" value={nome} onChange={setNome} placeholder="Ex: Eixo escalonado" />
          <SelectCampo
            label="Equipamento"
            value={equipamento}
            onChange={(v) => setEquipamento(v as EquipamentoUsinagem)}
            options={EQUIPAMENTOS_USINAGEM.map((e) => ({ valor: e.valor, label: e.label }))}
          />
          <SelectCampo
            label="Material"
            value={material}
            onChange={(v) => setMaterial(v as Material)}
            options={MATERIAIS.map((m) => ({ valor: m.valor, label: m.label }))}
          />
          <Campo label="Peso do material bruto (kg)" value={pesoBrutoKg} onChange={setPesoBrutoKg} />
          <Campo label="Perda em cavaco (%)" value={fatorPerda} onChange={setFatorPerda} />
          <Campo label="Setup (min, rateado pelo lote)" value={tempoSetupMin} onChange={setTempoSetupMin} />
          <Campo label="Quantidade do lote" value={quantidade} onChange={setQuantidade} />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">Tempo de usinagem</p>
          <div className="mb-3 flex gap-2 rounded-2xl border border-[#333333] bg-[#181818] p-1.5 self-start">
            {(["manual", "estimado"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModoTempo(m)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  modoTempo === m ? "bg-[#546E7A] text-white" : "text-[#90A4AE] hover:bg-[#2a2a2a]"
                }`}
              >
                {m === "manual" ? "Informar tempo" : "Estimar por complexidade"}
              </button>
            ))}
          </div>
          {modoTempo === "manual" ? (
            <div className="max-w-xs">
              <Campo label="Tempo de usinagem (min)" value={tempoManualMin} onChange={setTempoManualMin} />
            </div>
          ) : (
            <div className="max-w-xs">
              <SelectCampo
                label="Complexidade"
                value={complexidade}
                onChange={(v) => setComplexidade(v as Complexidade)}
                options={COMPLEXIDADES.map((c) => ({ valor: c.valor, label: c.label }))}
              />
              <p className="mt-1 text-xs text-[#78909C]">Tempo estimado: {tempoUsinagemMin.toFixed(1)}min (baseado em {tempoBaseMin}min × multiplicador de complexidade)</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-[#78909C]">Material</p><p className="font-semibold">{previa.custoMaterial.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
          <div><p className="text-xs text-[#78909C]">Operação</p><p className="font-semibold">{previa.custoOperacao.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
          <div><p className="text-xs text-[#78909C]">Setup rateado</p><p className="font-semibold">{previa.custoSetupRateado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
          <div><p className="text-xs text-[#78909C]">Ferramental</p><p className="font-semibold">{previa.custoFerramental.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
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
                  <Th>Equipamento</Th>
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
                    <Td className="text-xs text-[#78909C]">{EQUIPAMENTOS_USINAGEM.find((e) => e.valor === p.equipamento)?.label}</Td>
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
                          descricao={`Usinagem (${EQUIPAMENTOS_USINAGEM.find((e) => e.valor === p.equipamento)?.label}) — ${p.nome}`}
                          detalhamentoTecnico={`Material: ${MATERIAIS.find((m) => m.valor === p.material)?.label}. Peso bruto ${p.pesoBrutoKg}kg. Tempo de usinagem ${p.tempoUsinagemMin.toFixed(1)}min + setup ${p.tempoSetupMin}min.`}
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
