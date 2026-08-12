"use client";

import { useState } from "react";
import { Plus, Star, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  TIPOS_PERFIL,
  mapPerfilMetalico,
  pesoMetroEfetivo,
  type PerfilMetalico,
  type TipoPerfil,
} from "@/lib/calculo-custo/perfis";
import { MATERIAIS, chavesParametroMaterial, type Material } from "@/lib/calculo-custo/types";
import type { Parametro } from "@/lib/calculo-custo/parametros";
import { Botao, Campo, Cartao, FeedbackBloco, SelectCampo, Th, Td } from "@/components/orcamentos/ui";
import AdicionarAoOrcamentoBotao from "./adicionar-ao-orcamento-botao";

type ItemLote = {
  id: string;
  nome: string;
  material: Material;
  comprimentoM: string;
  quantidade: string;
  pesoMetro: number;
  custoMetro: number;
  custoUnitario: number;
  custoTotal: number;
};

export default function PerfisCalculadora({
  usuarioId,
  parametros,
  perfisIniciais,
}: {
  usuarioId: string;
  parametros: Record<string, Parametro>;
  perfisIniciais: PerfilMetalico[];
}) {
  const [perfis, setPerfis] = useState<PerfilMetalico[]>(perfisIniciais);
  const [modo, setModo] = useState<"catalogo" | "personalizado">("catalogo");
  const [perfilSelecionadoId, setPerfilSelecionadoId] = useState(perfisIniciais[0]?.id ?? "");

  const [tipo, setTipo] = useState<TipoPerfil>("quadrado");
  const [dimensaoA, setDimensaoA] = useState("30");
  const [dimensaoB, setDimensaoB] = useState("");
  const [espessuraParede, setEspessuraParede] = useState("1.5");
  const [material, setMaterial] = useState<Material>("aco_carbono");
  const [salvarNoCatalogo, setSalvarNoCatalogo] = useState(false);

  const [comprimentoM, setComprimentoM] = useState("1");
  const [quantidade, setQuantidade] = useState("1");
  const [lote, setLote] = useState<ItemLote[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function parseNumero(valor: string) {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  const perfilCatalogo = perfis.find((p) => p.id === perfilSelecionadoId) ?? null;
  const materialAtivo: Material = modo === "catalogo" ? ((perfilCatalogo?.material ?? "aco_carbono") as Material) : material;

  const perfilParaCalculo =
    modo === "catalogo"
      ? perfilCatalogo
      : perfilCatalogo === null
      ? {
          tipo,
          dimensaoA: parseNumero(dimensaoA),
          dimensaoB: dimensaoB ? parseNumero(dimensaoB) : null,
          espessuraParede: parseNumero(espessuraParede),
          pesoMetro: null,
          precoReferenciaMetro: null,
        }
      : null;

  const { preco, densidade } = chavesParametroMaterial(materialAtivo);
  const precoKg = parametros[preco]?.valor ?? 0;
  const densidadeKgM3 = parametros[densidade]?.valor ?? 0;

  const pesoMetro = perfilParaCalculo ? pesoMetroEfetivo(perfilParaCalculo, densidadeKgM3) : 0;
  const custoMetro =
    (modo === "catalogo" ? perfilCatalogo?.precoReferenciaMetro : null) ?? pesoMetro * precoKg;
  const comprimento = parseNumero(comprimentoM);
  const qtd = parseNumero(quantidade) || 1;
  const custoUnitario = custoMetro * comprimento;
  const custoTotal = custoUnitario * qtd;

  async function adicionarAoLote() {
    if (modo === "personalizado" && parseNumero(dimensaoA) <= 0) {
      setErro("Informe as dimensões do perfil.");
      return;
    }
    if (modo === "catalogo" && !perfilCatalogo) {
      setErro("Selecione um perfil do catálogo.");
      return;
    }
    setErro("");
    setSalvando(true);

    if (modo === "personalizado" && salvarNoCatalogo) {
      const supabase = createClient();
      const nome = `${TIPOS_PERFIL.find((t) => t.valor === tipo)?.label} ${dimensaoA}${dimensaoB ? `x${dimensaoB}` : ""}x${espessuraParede}mm`;
      const { data } = await supabase
        .from("perfis_metalicos")
        .insert({
          criado_por: usuarioId,
          tipo,
          nome,
          dimensao_a: parseNumero(dimensaoA),
          dimensao_b: dimensaoB ? parseNumero(dimensaoB) : null,
          espessura_parede: parseNumero(espessuraParede),
          material,
          favorito: true,
        })
        .select()
        .single();
      if (data) setPerfis((prev) => [mapPerfilMetalico(data), ...prev]);
    }

    const nomeItem =
      modo === "catalogo"
        ? perfilCatalogo!.nome
        : `${TIPOS_PERFIL.find((t) => t.valor === tipo)?.label} ${dimensaoA}${dimensaoB ? `x${dimensaoB}` : ""}x${espessuraParede}mm`;

    setLote((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nome: nomeItem,
        material: materialAtivo,
        comprimentoM,
        quantidade,
        pesoMetro,
        custoMetro,
        custoUnitario,
        custoTotal,
      },
    ]);
    setComprimentoM("1");
    setQuantidade("1");
    setSalvando(false);
  }

  function removerDoLote(id: string) {
    setLote((prev) => prev.filter((i) => i.id !== id));
  }

  const totalLote = lote.reduce((s, i) => s + i.custoTotal, 0);

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      <Cartao>
        <div className="mb-4 flex gap-2 rounded-2xl border border-[#333333] bg-[#181818] p-1.5 self-start">
          {(["catalogo", "personalizado"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                modo === m ? "bg-[#546E7A] text-white" : "text-[#90A4AE] hover:bg-[#2a2a2a]"
              }`}
            >
              {m === "catalogo" ? "Do catálogo" : "Personalizado"}
            </button>
          ))}
        </div>

        {modo === "catalogo" ? (
          <SelectCampo
            label="Perfil"
            value={perfilSelecionadoId}
            onChange={setPerfilSelecionadoId}
            options={perfis.map((p) => ({ valor: p.id, label: p.nome }))}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectCampo label="Tipo" value={tipo} onChange={(v) => setTipo(v as TipoPerfil)} options={TIPOS_PERFIL} />
            <Campo label="Dimensão A (mm)" value={dimensaoA} onChange={setDimensaoA} />
            <Campo label="Dimensão B (mm, se retangular/U)" value={dimensaoB} onChange={setDimensaoB} />
            <Campo label="Espessura da parede (mm)" value={espessuraParede} onChange={setEspessuraParede} />
            <SelectCampo label="Material" value={material} onChange={(v) => setMaterial(v as Material)} options={MATERIAIS.map((m) => ({ valor: m.valor, label: m.label }))} />
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
              <input type="checkbox" checked={salvarNoCatalogo} onChange={(e) => setSalvarNoCatalogo(e.target.checked)} className="h-4 w-4 accent-[#546E7A]" />
              Salvar como favorito no catálogo
            </label>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Campo label="Comprimento necessário (m)" value={comprimentoM} onChange={setComprimentoM} />
          <Campo label="Quantidade" value={quantidade} onChange={setQuantidade} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-[#78909C]">Peso/metro</p><p className="font-semibold">{pesoMetro.toFixed(3)}kg/m</p></div>
          <div><p className="text-xs text-[#78909C]">Custo/metro</p><p className="font-semibold">{custoMetro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
          <div><p className="text-xs text-[#78909C]">Custo unitário</p><p className="font-semibold">{(custoMetro * comprimento).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
          <div><p className="text-xs text-[#78909C]">Total (qtd.)</p><p className="font-semibold">{custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
        </div>

        <div className="mt-4">
          <Botao onClick={adicionarAoLote} disabled={salvando}>
            <Plus className="h-4 w-4" /> Adicionar ao lote
          </Botao>
        </div>
      </Cartao>

      {lote.length > 0 && (
        <Cartao>
          <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Lote ({lote.length} item{lote.length === 1 ? "" : "s"})</p>
          <div className="overflow-x-auto rounded-2xl border border-[#2a2a2a]">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-[#181818] text-[#90A4AE]">
                <tr>
                  <Th>Perfil</Th>
                  <Th>Comprimento</Th>
                  <Th>Qtd.</Th>
                  <Th>Custo un.</Th>
                  <Th>Total</Th>
                  <Th>{" "}</Th>
                </tr>
              </thead>
              <tbody>
                {lote.map((item) => (
                  <tr key={item.id} className="border-t border-[#2a2a2a] align-top">
                    <Td className="font-semibold">{item.nome}</Td>
                    <Td>{item.comprimentoM}m</Td>
                    <Td>{item.quantidade}</Td>
                    <Td>{(item.custoMetro * parseNumero(item.comprimentoM)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Td>
                    <Td className="font-semibold text-[#90A4AE]">{item.custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Td>
                    <Td>
                      <div className="flex flex-col gap-2">
                        <AdicionarAoOrcamentoBotao
                          usuarioId={usuarioId}
                          tipoItem="produto"
                          descricao={item.nome}
                          detalhamentoTecnico={`Material: ${MATERIAIS.find((m) => m.valor === item.material)?.label}. Peso ${item.pesoMetro.toFixed(3)}kg/m. Comprimento ${item.comprimentoM}m por unidade.`}
                          quantidade={parseNumero(item.quantidade) || 1}
                          valorUnitario={item.custoMetro * parseNumero(item.comprimentoM)}
                        />
                        <button
                          type="button"
                          onClick={() => removerDoLote(item.id)}
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

      <Cartao>
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#90A4AE]">
          <Star className="h-4 w-4" /> Catálogo de perfis
        </p>
        <div className="overflow-x-auto rounded-2xl border border-[#2a2a2a]">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-[#181818] text-[#90A4AE]">
              <tr><Th>Nome</Th><Th>Tipo</Th><Th>Material</Th><Th>Favorito</Th></tr>
            </thead>
            <tbody>
              {perfis.map((p) => (
                <tr key={p.id} className="border-t border-[#2a2a2a]">
                  <Td className="font-semibold">{p.nome}</Td>
                  <Td className="text-xs text-[#78909C]">{TIPOS_PERFIL.find((t) => t.valor === p.tipo)?.label}</Td>
                  <Td className="text-xs text-[#78909C]">{MATERIAIS.find((m) => m.valor === p.material)?.label ?? p.material}</Td>
                  <Td>{p.favorito ? <Star className="h-4 w-4 fill-[#546E7A] text-[#546E7A]" /> : "-"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>
    </div>
  );
}
