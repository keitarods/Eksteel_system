"use client";

import { useState } from "react";
import { Save, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calcularGeometriaDxf, contornosParaSvg } from "@/lib/calculo-custo/geometria";
import { calcularCustoMaterial, calcularPesoPeca } from "@/lib/calculo-custo/material";
import { calcularCustoCorte, calcularTempoCorteMin, estimarVelocidadeCorte } from "@/lib/calculo-custo/laser";
import { AMPERAGENS_PLASMA_A, chavesParametroMaterial } from "@/lib/calculo-custo/types";
import type { Parametro, ProcessoCorte, VelocidadeCorte } from "@/lib/calculo-custo/parametros";
import { Botao, Campo, Cartao, FeedbackBloco, SelectCampo, Th, Td } from "@/components/orcamentos/ui";
import AdicionarAoOrcamentoBotao from "./adicionar-ao-orcamento-botao";

type Entrada = "dxf" | "manual";
type ProcessoOxiPlasma = Extract<ProcessoCorte, "oxicorte" | "plasma">;

const PROCESSOS: { valor: ProcessoOxiPlasma; label: string }[] = [
  { valor: "oxicorte", label: "Oxicorte" },
  { valor: "plasma", label: "Plasma" },
];

type Geometria = { areaMm2: number; perimetroMm: number };

type ItemLote = {
  id: string;
  nome: string;
  processo: ProcessoOxiPlasma;
  amperagem: number;
  espessuraMm: string;
  quantidade: string;
  geometria: Geometria;
  svg: string | null;
  pesoKg: number;
  custoMaterial: number;
  tempoCorteMin: number;
  custoCorte: number;
  custoUnitario: number;
  custoTotal: number;
};

export default function OxicorteCalculadora({
  usuarioId,
  parametros,
  velocidades,
}: {
  usuarioId: string;
  parametros: Record<string, Parametro>;
  velocidades: VelocidadeCorte[];
}) {
  const [processo, setProcesso] = useState<ProcessoOxiPlasma>("oxicorte");
  const [amperagem, setAmperagem] = useState<number>(65);
  const [entrada, setEntrada] = useState<Entrada>("dxf");

  const [arquivoNome, setArquivoNome] = useState("");
  const [svg, setSvg] = useState<string | null>(null);
  const [geometriaDxf, setGeometriaDxf] = useState<Geometria | null>(null);
  const [areaCm2Manual, setAreaCm2Manual] = useState("");
  const [perimetroMmManual, setPerimetroMmManual] = useState("");

  const [espessuraMm, setEspessuraMm] = useState("12");
  const [quantidade, setQuantidade] = useState("1");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [lote, setLote] = useState<ItemLote[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  function parseNumero(valor: string) {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    setErro("");
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    try {
      const conteudo = await arquivo.text();
      const resultado = calcularGeometriaDxf(conteudo);
      if (resultado.contornos.length === 0) {
        setErro("Não encontrei nenhum contorno fechado nesse DXF.");
        return;
      }
      setArquivoNome(arquivo.name);
      setSvg(contornosParaSvg(resultado.contornos, { larguraPx: 360 }));
      setGeometriaDxf({ areaMm2: resultado.areaMm2, perimetroMm: resultado.perimetroMm });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao ler o arquivo DXF.");
    }
  }

  const geometriaAtual: Geometria | null =
    entrada === "dxf"
      ? geometriaDxf
      : areaCm2Manual && perimetroMmManual
      ? { areaMm2: parseNumero(areaCm2Manual) * 100, perimetroMm: parseNumero(perimetroMmManual) }
      : null;

  function calcularPeca(): Omit<ItemLote, "id" | "nome" | "geometria" | "svg"> | null {
    if (!geometriaAtual) return null;
    const { preco, densidade } = chavesParametroMaterial("chapa", "aco_carbono");
    const precoKg = parametros[preco]?.valor ?? 0;
    const densidadeKgM3 = parametros[densidade]?.valor ?? 0;
    const aproveitamento = (parametros["aproveitamento_nesting_oxicorte"]?.valor ?? 100) / 100;
    const horaMaquina = parametros[processo === "oxicorte" ? "hora_maquina_oxicorte" : "hora_maquina_plasma"]?.valor ?? 0;
    const custoGasHora = parametros[processo === "oxicorte" ? "custo_gas_oxicorte_hora" : "custo_gas_plasma_hora"]?.valor ?? 0;

    const areaM2 = geometriaAtual.areaMm2 / 1e6;
    const perimetroM = geometriaAtual.perimetroMm / 1000;
    const espessura = parseNumero(espessuraMm);
    const qtd = parseNumero(quantidade) || 1;

    const pesoKg = calcularPesoPeca(areaM2, espessura, densidadeKgM3);
    const custoMaterialBruto = calcularCustoMaterial(pesoKg, precoKg);
    const custoMaterial = aproveitamento > 0 ? custoMaterialBruto / aproveitamento : custoMaterialBruto;

    const potenciaBusca = processo === "plasma" ? amperagem : 1;
    const velocidade = estimarVelocidadeCorte(velocidades, processo, "aco_carbono", espessura, potenciaBusca);
    const tempoCorteMin = calcularTempoCorteMin(perimetroM, velocidade);
    const custoCorte = calcularCustoCorte(tempoCorteMin, horaMaquina, custoGasHora);

    const custoUnitario = custoMaterial + custoCorte;
    return {
      processo,
      amperagem: processo === "plasma" ? amperagem : 0,
      espessuraMm,
      quantidade,
      pesoKg,
      custoMaterial,
      tempoCorteMin,
      custoCorte,
      custoUnitario,
      custoTotal: custoUnitario * qtd,
    };
  }

  const previaPeca = geometriaAtual ? calcularPeca() : null;

  function adicionarAoLote() {
    if (!geometriaAtual || !previaPeca) return;
    setLote((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nome: entrada === "dxf" ? arquivoNome : `Peça manual ${prev.length + 1}`,
        geometria: geometriaAtual,
        svg: entrada === "dxf" ? svg : null,
        ...previaPeca,
      },
    ]);
    setQuantidade("1");
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
      tipo_calculo: peca.processo === "oxicorte" ? "chapa_oxicorte" : "chapa_plasma",
      material: "aco_carbono",
      espessura_mm: parseNumero(peca.espessuraMm),
      area_m2: peca.geometria.areaMm2 / 1e6,
      perimetro_m: peca.geometria.perimetroMm / 1000,
      peso_kg: peca.pesoKg,
      tempo_corte_min: peca.tempoCorteMin,
      custo_material: peca.custoMaterial,
      custo_corte: peca.custoCorte,
      custo_total: peca.custoUnitario,
      quantidade: parseNumero(peca.quantidade) || 1,
      svg_preview: peca.svg,
      parametros_especificos: peca.processo === "plasma" ? { amperagem: peca.amperagem } : {},
    });
    setSalvandoId(null);
    setMensagem("Cálculo salvo no histórico.");
  }

  const totalLote = lote.reduce((s, p) => s + p.custoTotal, 0);

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      <Cartao>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="flex gap-2 rounded-2xl border border-[#333333] bg-[#181818] p-1.5">
            {PROCESSOS.map((p) => (
              <button
                key={p.valor}
                type="button"
                onClick={() => setProcesso(p.valor)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  processo === p.valor ? "bg-[#546E7A] text-white" : "text-[#90A4AE] hover:bg-[#2a2a2a]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 rounded-2xl border border-[#333333] bg-[#181818] p-1.5">
            {(["dxf", "manual"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEntrada(e)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  entrada === e ? "bg-[#546E7A] text-white" : "text-[#90A4AE] hover:bg-[#2a2a2a]"
                }`}
              >
                {e === "dxf" ? "Usar DXF" : "Informar manualmente"}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-3 text-xs text-[#78909C]">
          Material: <span className="font-semibold text-[#90A4AE]">Aço carbono</span> — é o único material com
          velocidade de corte calibrada pra oxicorte/plasma nesse momento.
        </p>

        {entrada === "dxf" ? (
          <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#333333] bg-[#141414] text-sm text-[#78909C] transition hover:border-[#546E7A]">
            <Upload className="h-5 w-5" />
            {arquivoNome || "Clique pra subir um arquivo .DXF"}
            <input type="file" accept=".dxf" className="hidden" onChange={handleArquivo} />
          </label>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Área da peça (cm²)" value={areaCm2Manual} onChange={setAreaCm2Manual} placeholder="Ex: 1200" />
            <Campo label="Perímetro de corte (mm)" value={perimetroMmManual} onChange={setPerimetroMmManual} placeholder="Ex: 1800" />
          </div>
        )}

        {geometriaAtual && previaPeca && (
          <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,220px)_1fr]">
            {svg && entrada === "dxf" ? (
              <div className="flex items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3" dangerouslySetInnerHTML={{ __html: svg }} />
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-xs text-[#78909C]">
                Sem preview (entrada manual)
              </div>
            )}
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Espessura (mm)" value={espessuraMm} onChange={setEspessuraMm} />
                {processo === "plasma" && (
                  <SelectCampo
                    label="Amperagem"
                    value={String(amperagem)}
                    onChange={(v) => setAmperagem(Number(v))}
                    options={AMPERAGENS_PLASMA_A.map((a) => ({ valor: String(a), label: `${a}A` }))}
                  />
                )}
                <Campo label="Quantidade" value={quantidade} onChange={setQuantidade} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-[#78909C]">Área</p><p className="font-semibold">{(geometriaAtual.areaMm2 / 100).toFixed(1)}cm²</p></div>
                <div><p className="text-xs text-[#78909C]">Perímetro</p><p className="font-semibold">{(geometriaAtual.perimetroMm / 10).toFixed(1)}cm</p></div>
                <div><p className="text-xs text-[#78909C]">Peso (un.)</p><p className="font-semibold">{previaPeca.pesoKg.toFixed(2)}kg</p></div>
                <div><p className="text-xs text-[#78909C]">Tempo corte</p><p className="font-semibold">{previaPeca.tempoCorteMin.toFixed(1)}min</p></div>
              </div>

              <p className="mt-3 text-sm">
                Custo por peça: <span className="font-semibold text-[#90A4AE]">{previaPeca.custoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                {" · "}Total do lote desta peça: <span className="font-semibold text-[#90A4AE]">{previaPeca.custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </p>

              <div className="mt-4">
                <Botao onClick={adicionarAoLote}>Adicionar ao lote</Botao>
              </div>
            </div>
          </div>
        )}
      </Cartao>

      {lote.length > 0 && (
        <Cartao>
          <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Lote ({lote.length} peça{lote.length === 1 ? "" : "s"})</p>
          <div className="overflow-x-auto rounded-2xl border border-[#2a2a2a]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#181818] text-[#90A4AE]">
                <tr>
                  <Th>Peça</Th>
                  <Th>Processo</Th>
                  <Th>Esp.</Th>
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
                    <Td className="text-xs text-[#78909C]">{p.processo === "oxicorte" ? "Oxicorte" : `Plasma ${p.amperagem}A`}</Td>
                    <Td>{p.espessuraMm}mm</Td>
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
                          tipoItem="produto"
                          descricao={`Chapa ${p.processo === "oxicorte" ? "oxicortada" : "cortada a plasma"} — ${p.nome}`}
                          detalhamentoTecnico={`Aço carbono, espessura ${p.espessuraMm}mm. Peso ${p.pesoKg.toFixed(2)}kg/un. Tempo de corte estimado ${p.tempoCorteMin.toFixed(1)}min.${p.processo === "plasma" ? ` Plasma ${p.amperagem}A.` : ""}`}
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
