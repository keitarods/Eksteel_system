"use client";

import { useState } from "react";
import { Save, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { calcularGeometriaDxf, contornosParaSvg } from "@/lib/calculo-custo/geometria";
import { calcularCustoMaterial, calcularPesoPeca } from "@/lib/calculo-custo/material";
import { calcularCustoCorte, calcularTempoCorteMin, estimarVelocidadeCorte } from "@/lib/calculo-custo/laser";
import {
  MATERIAIS,
  POTENCIAS_LASER_KW,
  chavesParametroMaterial,
  materialParaVelocidadeCorte,
  type Material,
} from "@/lib/calculo-custo/types";
import type { Parametro, VelocidadeCorte } from "@/lib/calculo-custo/parametros";
import type { ResultadoGeometria } from "@/lib/calculo-custo/types";
import { Botao, Campo, Cartao, FeedbackBloco, SelectCampo, Th, Td } from "@/components/orcamentos/ui";
import AdicionarAoOrcamentoBotao from "./adicionar-ao-orcamento-botao";

type PecaLote = {
  id: string;
  nomeArquivo: string;
  resultado: ResultadoGeometria;
  svg: string;
  material: Material;
  espessuraMm: string;
  potenciaKw: number;
  quantidade: string;
  pesoKg: number;
  custoMaterial: number;
  tempoCorteMin: number;
  custoCorte: number;
  custoUnitario: number;
  custoTotal: number;
};

export default function ChapaCalculadora({
  usuarioId,
  parametros,
  velocidades,
}: {
  usuarioId: string;
  parametros: Record<string, Parametro>;
  velocidades: VelocidadeCorte[];
}) {
  const [arquivoAtual, setArquivoAtual] = useState<{ nome: string; resultado: ResultadoGeometria; svg: string } | null>(null);
  const [material, setMaterial] = useState<Material>("aco_carbono");
  const [espessuraMm, setEspessuraMm] = useState("3");
  const [potenciaKw, setPotenciaKw] = useState<number>(3);
  const [quantidade, setQuantidade] = useState("1");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [lote, setLote] = useState<PecaLote[]>([]);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  function parseNumero(valor: string) {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    setErro("");
    setMensagem("");
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    try {
      const conteudo = await arquivo.text();
      const resultado = calcularGeometriaDxf(conteudo);
      if (resultado.contornos.length === 0) {
        setErro("Não encontrei nenhum contorno fechado nesse DXF. Confira se o desenho está em 2D e fechado.");
        return;
      }
      const svg = contornosParaSvg(resultado.contornos, { larguraPx: 360 });
      setArquivoAtual({ nome: arquivo.name, resultado, svg });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao ler o arquivo DXF.");
    }
  }

  function calcularPeca(): Omit<PecaLote, "id" | "nomeArquivo" | "resultado" | "svg"> | null {
    if (!arquivoAtual) return null;
    const { preco, densidade } = chavesParametroMaterial(material);
    const precoKg = parametros[preco]?.valor ?? 0;
    const densidadeKgM3 = parametros[densidade]?.valor ?? 0;
    const horaLaser = parametros["hora_maquina_laser"]?.valor ?? 0;
    const gasHora = parametros["custo_gas_corte_hora"]?.valor ?? 0;

    const areaM2 = arquivoAtual.resultado.areaMm2 / 1e6;
    const perimetroM = arquivoAtual.resultado.perimetroMm / 1000;
    const espessura = parseNumero(espessuraMm);
    const qtd = parseNumero(quantidade) || 1;

    const pesoKg = calcularPesoPeca(areaM2, espessura, densidadeKgM3);
    const custoMaterial = calcularCustoMaterial(pesoKg, precoKg);

    const velocidade = estimarVelocidadeCorte(velocidades, materialParaVelocidadeCorte(material), espessura, potenciaKw);
    const tempoCorteMin = calcularTempoCorteMin(perimetroM, velocidade);
    const custoCorte = calcularCustoCorte(tempoCorteMin, horaLaser, gasHora);

    const custoUnitario = custoMaterial + custoCorte;
    return {
      material,
      espessuraMm,
      potenciaKw,
      quantidade,
      pesoKg,
      custoMaterial,
      tempoCorteMin,
      custoCorte,
      custoUnitario,
      custoTotal: custoUnitario * qtd,
    };
  }

  const previaPeca = arquivoAtual ? calcularPeca() : null;

  function adicionarAoLote() {
    if (!arquivoAtual || !previaPeca) return;
    setLote((prev) => [
      ...prev,
      { id: crypto.randomUUID(), nomeArquivo: arquivoAtual.nome, resultado: arquivoAtual.resultado, svg: arquivoAtual.svg, ...previaPeca },
    ]);
    setArquivoAtual(null);
    setQuantidade("1");
  }

  function removerDoLote(id: string) {
    setLote((prev) => prev.filter((p) => p.id !== id));
  }

  async function salvarNoHistorico(peca: PecaLote) {
    setSalvandoId(peca.id);
    const supabase = createClient();
    await supabase.from("calculos_pecas").insert({
      criado_por: usuarioId,
      nome: peca.nomeArquivo,
      material: peca.material,
      espessura_mm: parseNumero(peca.espessuraMm),
      area_m2: peca.resultado.areaMm2 / 1e6,
      perimetro_m: peca.resultado.perimetroMm / 1000,
      bbox_largura_mm: peca.resultado.bbox.larguraMm,
      bbox_altura_mm: peca.resultado.bbox.alturaMm,
      peso_kg: peca.pesoKg,
      tempo_corte_min: peca.tempoCorteMin,
      custo_material: peca.custoMaterial,
      custo_corte: peca.custoCorte,
      custo_total: peca.custoUnitario,
      quantidade: parseNumero(peca.quantidade) || 1,
      svg_preview: peca.svg,
    });
    setSalvandoId(null);
    setMensagem("Cálculo salvo no histórico.");
  }

  const totalLote = lote.reduce((s, p) => s + p.custoTotal, 0);

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      <Cartao>
        <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Nova peça</p>
        <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#333333] bg-[#141414] text-sm text-[#78909C] transition hover:border-[#546E7A]">
          <Upload className="h-5 w-5" />
          {arquivoAtual ? arquivoAtual.nome : "Clique pra subir um arquivo .DXF"}
          <input type="file" accept=".dxf" className="hidden" onChange={handleArquivo} />
        </label>

        {arquivoAtual && previaPeca && (
          <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,220px)_1fr]">
            <div
              className="flex items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3"
              dangerouslySetInnerHTML={{ __html: arquivoAtual.svg }}
            />
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectCampo
                  label="Material"
                  value={material}
                  onChange={(v) => setMaterial(v as Material)}
                  options={MATERIAIS.map((m) => ({ valor: m.valor, label: m.label }))}
                />
                <Campo label="Espessura (mm)" value={espessuraMm} onChange={setEspessuraMm} />
                <SelectCampo
                  label="Potência do laser"
                  value={String(potenciaKw)}
                  onChange={(v) => setPotenciaKw(Number(v))}
                  options={POTENCIAS_LASER_KW.map((p) => ({ valor: String(p), label: `${p}kW` }))}
                />
                <Campo label="Quantidade" value={quantidade} onChange={setQuantidade} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-sm sm:grid-cols-4">
                <div><p className="text-xs text-[#78909C]">Área</p><p className="font-semibold">{(arquivoAtual.resultado.areaMm2 / 100).toFixed(1)}cm²</p></div>
                <div><p className="text-xs text-[#78909C]">Perímetro</p><p className="font-semibold">{(arquivoAtual.resultado.perimetroMm / 10).toFixed(1)}cm</p></div>
                <div><p className="text-xs text-[#78909C]">Peso (un.)</p><p className="font-semibold">{previaPeca.pesoKg.toFixed(3)}kg</p></div>
                <div><p className="text-xs text-[#78909C]">Tempo corte</p><p className="font-semibold">{previaPeca.tempoCorteMin.toFixed(1)}min</p></div>
              </div>

              <p className="mt-3 text-sm">
                Custo por peça: <span className="font-semibold text-[#90A4AE]">
                  {previaPeca.custoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
                {" · "}Total do lote desta peça: <span className="font-semibold text-[#90A4AE]">
                  {previaPeca.custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
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
                  <Th>Arquivo</Th>
                  <Th>Material</Th>
                  <Th>Esp.</Th>
                  <Th>Qtd.</Th>
                  <Th>Peso un.</Th>
                  <Th>Custo un.</Th>
                  <Th>Total</Th>
                  <Th>{" "}</Th>
                </tr>
              </thead>
              <tbody>
                {lote.map((p) => (
                  <tr key={p.id} className="border-t border-[#2a2a2a] align-top">
                    <Td className="font-semibold">{p.nomeArquivo}</Td>
                    <Td>{MATERIAIS.find((m) => m.valor === p.material)?.label}</Td>
                    <Td>{p.espessuraMm}mm</Td>
                    <Td>{p.quantidade}</Td>
                    <Td>{p.pesoKg.toFixed(3)}kg</Td>
                    <Td>{p.custoUnitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Td>
                    <Td className="font-semibold text-[#90A4AE]">
                      {p.custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </Td>
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
                          descricao={`Chapa cortada a laser — ${p.nomeArquivo}`}
                          detalhamentoTecnico={`Material: ${MATERIAIS.find((m) => m.valor === p.material)?.label}, espessura ${p.espessuraMm}mm. Peso ${p.pesoKg.toFixed(3)}kg/un. Área ${(p.resultado.areaMm2 / 1e6).toFixed(4)}m², perímetro ${(p.resultado.perimetroMm / 1000).toFixed(3)}m. Tempo de corte estimado ${p.tempoCorteMin.toFixed(1)}min (laser ${p.potenciaKw}kW).`}
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
