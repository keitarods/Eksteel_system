"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useParametrosCustoEditor, useVelocidadesEditor } from "@/lib/calculo-custo/hooks-parametros";
import type { Parametro, VelocidadeCorte } from "@/lib/calculo-custo/parametros";
import { Botao, Cartao, Campo, FeedbackBloco } from "@/components/orcamentos/ui";

const MATERIAIS_CHAPA = [
  { valor: "aco_carbono", label: "Aço carbono" },
  { valor: "inox_304", label: "Inox 304" },
  { valor: "inox_316", label: "Inox 316" },
  { valor: "aluminio", label: "Alumínio" },
  { valor: "galvanizado", label: "Galvanizado" },
];

// A tabela de velocidade de corte não tem granularidade por material exato —
// materialParaVelocidadeCorte() (types.ts) agrupa tudo em só 2 famílias, pelo
// comportamento térmico de corte (inox 304/316 usam a mesma curva).
const MATERIAIS_VELOCIDADE = [
  { valor: "aco_carbono", label: "Aço carbono" },
  { valor: "inox", label: "Inox (304/316)" },
];

const ESPESSURAS = [1, 2, 3, 4, 6];
const POTENCIAS = [1, 2, 3, 4, 6];

const GRUPOS: { titulo: string; chaves: string[] }[] = [
  { titulo: "Preço da chapa (R$/kg)", chaves: MATERIAIS_CHAPA.map((m) => `preco_kg_chapa_${m.valor}`) },
  { titulo: "Densidade (kg/m³)", chaves: MATERIAIS_CHAPA.map((m) => `densidade_chapa_${m.valor}`) },
  { titulo: "Corte a laser", chaves: ["hora_maquina_laser", "custo_gas_corte_hora"] },
  { titulo: "Dobra", chaves: ["hora_maquina_dobra", "tempo_padrao_dobra_seg"] },
  { titulo: "Setup de lote (laser + dobra)", chaves: ["tempo_setup_laser_min", "tempo_setup_dobra_min"] },
];

export default function ChapaParametrosForm({
  usuarioId,
  parametrosIniciais,
  velocidadesIniciais,
}: {
  usuarioId: string;
  parametrosIniciais: Record<string, Parametro>;
  velocidadesIniciais: VelocidadeCorte[];
}) {
  const { valores, setValor, salvar: salvarParametros } = useParametrosCustoEditor(usuarioId, parametrosIniciais);
  const { velocidades, setVelocidade, salvar: salvarVelocidades } = useVelocidadesEditor(usuarioId, velocidadesIniciais);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function handleSalvar() {
    setSalvando(true);
    setMensagem("");
    setErro("");
    const erroParametros = await salvarParametros();
    if (erroParametros) { setSalvando(false); setErro(erroParametros); return; }
    const erroVelocidades = await salvarVelocidades();
    if (erroVelocidades) { setSalvando(false); setErro(erroVelocidades); return; }
    setSalvando(false);
    setMensagem("Parâmetros de chapa atualizados.");
  }

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      {GRUPOS.map((grupo) => (
        <Cartao key={grupo.titulo}>
          <p className="mb-3 text-sm font-semibold text-[#90A4AE]">{grupo.titulo}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {grupo.chaves.map((chave) => (
              <Campo
                key={chave}
                label={parametrosIniciais[chave]?.descricao || chave}
                value={valores[chave] ?? ""}
                onChange={(v) => setValor(chave, v)}
              />
            ))}
          </div>
        </Cartao>
      ))}

      <Cartao>
        <p className="mb-1 text-sm font-semibold text-[#90A4AE]">Velocidade de corte a laser (m/min)</p>
        <p className="mb-4 text-xs text-[#78909C]">Por material, espessura da chapa (mm) e potência do laser (kW). Também usada pelo oxicorte/plasma para aço carbono.</p>
        {MATERIAIS_VELOCIDADE.map((mat) => (
          <div key={mat.valor} className="mb-4 last:mb-0">
            <p className="mb-1 text-xs font-semibold text-[#78909C]">{mat.label}</p>
            <div className="overflow-x-auto rounded-2xl border border-[#2a2a2a]">
              <table className="w-full min-w-[420px] text-center text-xs">
                <thead className="bg-[#181818] text-[#90A4AE]">
                  <tr>
                    <th className="px-3 py-2 text-left">Espessura</th>
                    {POTENCIAS.map((p) => (
                      <th key={p} className="px-3 py-2">{p}kW</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ESPESSURAS.map((esp) => (
                    <tr key={esp} className="border-t border-[#2a2a2a]">
                      <td className="px-3 py-2 text-left font-semibold text-[#90A4AE]">{esp}mm</td>
                      {POTENCIAS.map((pot) => {
                        const chave = `laser|${mat.valor}|${esp}|${pot}`;
                        return (
                          <td key={pot} className="px-1.5 py-1.5">
                            <input
                              type="text"
                              value={velocidades[chave] ?? ""}
                              onChange={(e) => setVelocidade(chave, e.target.value)}
                              className="h-8 w-16 rounded-lg border border-[#333333] bg-[#141414] px-1 text-center text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Cartao>

      <div>
        <Botao onClick={handleSalvar} disabled={salvando}>
          <Save className="h-4 w-4" />
          {salvando ? "Salvando..." : "Salvar alterações"}
        </Botao>
      </div>
    </div>
  );
}
