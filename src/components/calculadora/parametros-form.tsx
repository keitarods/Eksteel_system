"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Parametro, VelocidadeCorte } from "@/lib/calculo-custo/parametros";
import { Botao, Cartao, Campo, FeedbackBloco } from "@/components/orcamentos/ui";

const GRUPOS: { titulo: string; chaves: string[] }[] = [
  {
    titulo: "Preço do material (R$/kg)",
    chaves: ["preco_kg_aco_carbono", "preco_kg_inox_304", "preco_kg_inox_316", "preco_kg_aluminio", "preco_kg_galvanizado"],
  },
  {
    titulo: "Densidade do material (kg/m³)",
    chaves: ["densidade_aco_carbono", "densidade_inox_304", "densidade_inox_316", "densidade_aluminio", "densidade_galvanizado"],
  },
  {
    titulo: "Hora-máquina e mão de obra (R$/h)",
    chaves: [
      "hora_maquina_laser",
      "custo_gas_corte_hora",
      "hora_maquina_dobra",
      "hora_maquina_solda_mig",
      "hora_maquina_solda_tig",
      "hora_maquina_usinagem",
    ],
  },
  {
    titulo: "Fatores gerais (%)",
    chaves: ["scrap_factor", "margem_lucro_padrao", "frete_logistica_padrao"],
  },
];

const ESPESSURAS = [1, 2, 3, 4, 6];
const POTENCIAS = [1, 2, 3, 4, 6];
const MATERIAIS_VELOCIDADE: { valor: string; label: string }[] = [
  { valor: "aco_carbono", label: "Aço carbono" },
  { valor: "inox", label: "Inox (304/316)" },
];

export default function ParametrosForm({
  usuarioId,
  parametrosIniciais,
  velocidadesIniciais,
}: {
  usuarioId: string;
  parametrosIniciais: Record<string, Parametro>;
  velocidadesIniciais: VelocidadeCorte[];
}) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(parametrosIniciais).map(([chave, p]) => [chave, String(p.valor)]))
  );
  const [velocidades, setVelocidades] = useState<Record<string, string>>(
    Object.fromEntries(
      velocidadesIniciais.map((v) => [`${v.material}|${v.espessuraMm}|${v.potenciaKw}`, String(v.velocidadeMMin)])
    )
  );
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  function parseNumero(valor: string) {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  async function handleSalvar() {
    setSalvando(true);
    setMensagem("");
    setErro("");
    const supabase = createClient();
    const hoje = new Date().toISOString().slice(0, 10);

    const parametrosAlterados = Object.entries(valores).filter(([chave, valor]) => {
      const original = parametrosIniciais[chave];
      return !original || parseNumero(valor) !== original.valor;
    });

    if (parametrosAlterados.length > 0) {
      const { error } = await supabase.from("parametros_custo").insert(
        parametrosAlterados.map(([chave, valor]) => ({
          criado_por: usuarioId,
          chave,
          valor: parseNumero(valor),
          unidade: parametrosIniciais[chave]?.unidade ?? "",
          descricao: parametrosIniciais[chave]?.descricao ?? "",
          vigente_desde: hoje,
        }))
      );
      if (error) { setSalvando(false); setErro(error.message); return; }
    }

    const velocidadesOriginais = Object.fromEntries(
      velocidadesIniciais.map((v) => [`${v.material}|${v.espessuraMm}|${v.potenciaKw}`, v.velocidadeMMin])
    );
    const velocidadesAlteradas = Object.entries(velocidades).filter(([chave, valor]) => {
      const original = velocidadesOriginais[chave];
      return original === undefined || parseNumero(valor) !== original;
    });

    if (velocidadesAlteradas.length > 0) {
      const { error } = await supabase.from("velocidades_corte").insert(
        velocidadesAlteradas.map(([chave, valor]) => {
          const [material, espessuraMm, potenciaKw] = chave.split("|");
          return {
            criado_por: usuarioId,
            material,
            espessura_mm: Number(espessuraMm),
            potencia_kw: Number(potenciaKw),
            velocidade_m_min: parseNumero(valor),
            vigente_desde: hoje,
          };
        })
      );
      if (error) { setSalvando(false); setErro(error.message); return; }
    }

    setSalvando(false);
    setMensagem("Parâmetros atualizados.");
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
                onChange={(v) => setValores((prev) => ({ ...prev, [chave]: v }))}
              />
            ))}
          </div>
        </Cartao>
      ))}

      <Cartao>
        <p className="mb-1 text-sm font-semibold text-[#90A4AE]">Velocidade de corte a laser (m/min)</p>
        <p className="mb-4 text-xs text-[#78909C]">Por material, espessura da chapa (mm) e potência do laser (kW).</p>
        {MATERIAIS_VELOCIDADE.map((mat) => (
          <div key={mat.valor} className="mb-6 last:mb-0">
            <p className="mb-2 text-xs font-semibold text-[#78909C]">{mat.label}</p>
            <div className="overflow-x-auto rounded-2xl border border-[#2a2a2a]">
              <table className="w-full min-w-[420px] text-center text-xs">
                <thead className="bg-[#181818] text-[#90A4AE]">
                  <tr>
                    <th className="px-3 py-2 text-left">Espessura \ Potência</th>
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
                        const chave = `${mat.valor}|${esp}|${pot}`;
                        return (
                          <td key={pot} className="px-1.5 py-1.5">
                            <input
                              type="text"
                              value={velocidades[chave] ?? ""}
                              onChange={(e) => setVelocidades((prev) => ({ ...prev, [chave]: e.target.value }))}
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
