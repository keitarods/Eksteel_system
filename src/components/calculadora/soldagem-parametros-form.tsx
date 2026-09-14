"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useParametrosCustoEditor, useTemposSoldaEditor } from "@/lib/calculo-custo/hooks-parametros";
import type { Parametro, TempoSoldaPadrao } from "@/lib/calculo-custo/parametros";
import { Botao, Cartao, Campo, FeedbackBloco } from "@/components/orcamentos/ui";

const GRUPOS: { titulo: string; chaves: string[] }[] = [
  { titulo: "Mão de obra e máquina (R$/h)", chaves: ["hora_soldador_mig", "hora_soldador_tig", "hora_maquina_solda"] },
  { titulo: "Consumíveis", chaves: ["consumo_arame_kg_h", "preco_kg_arame_mig", "custo_gas_solda_hora", "custo_eletrodo_unidade"] },
];

const TIPOS_JUNTA_SOLDA: { valor: TempoSoldaPadrao["tipoJunta"]; label: string }[] = [
  { valor: "filete", label: "Filete" },
  { valor: "topo", label: "Topo" },
  { valor: "sobreposicao", label: "Sobreposição" },
];
const ESPESSURAS_SOLDA = [3, 6, 10];

export default function SoldagemParametrosForm({
  usuarioId,
  parametrosIniciais,
  temposSoldaIniciais,
}: {
  usuarioId: string;
  parametrosIniciais: Record<string, Parametro>;
  temposSoldaIniciais: TempoSoldaPadrao[];
}) {
  const { valores, setValor, salvar: salvarParametros } = useParametrosCustoEditor(usuarioId, parametrosIniciais);
  const { tempos, setTempo, salvar: salvarTempos } = useTemposSoldaEditor(usuarioId, temposSoldaIniciais);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function handleSalvar() {
    setSalvando(true);
    setMensagem("");
    setErro("");
    const erroParametros = await salvarParametros();
    if (erroParametros) { setSalvando(false); setErro(erroParametros); return; }
    const erroTempos = await salvarTempos();
    if (erroTempos) { setSalvando(false); setErro(erroTempos); return; }
    setSalvando(false);
    setMensagem("Parâmetros de soldagem atualizados.");
  }

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      {GRUPOS.map((grupo) => (
        <Cartao key={grupo.titulo}>
          <p className="mb-3 text-sm font-semibold text-steel">{grupo.titulo}</p>
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
        <p className="mb-1 text-sm font-semibold text-steel">Tempo padrão de solda (min por metro de cordão)</p>
        <p className="mb-4 text-xs text-muted">Por tipo de junta e espessura — base do cálculo (MIG, posição plana).</p>
        <div className="overflow-x-auto rounded-lg border border-panel-hover">
          <table className="w-full min-w-[380px] text-center text-xs">
            <thead className="bg-surface text-steel">
              <tr>
                <th className="px-3 py-2 text-left">Junta \ Espessura</th>
                {ESPESSURAS_SOLDA.map((esp) => <th key={esp} className="px-3 py-2">{esp}mm</th>)}
              </tr>
            </thead>
            <tbody>
              {TIPOS_JUNTA_SOLDA.map((junta) => (
                <tr key={junta.valor} className="border-t border-panel-hover">
                  <td className="px-3 py-2 text-left font-semibold text-steel">{junta.label}</td>
                  {ESPESSURAS_SOLDA.map((esp) => {
                    const chave = `${junta.valor}|${esp}`;
                    return (
                      <td key={esp} className="px-1.5 py-1.5">
                        <input
                          type="text"
                          value={tempos[chave] ?? ""}
                          onChange={(e) => setTempo(chave, e.target.value)}
                          className="h-8 w-16 rounded-lg border border-line bg-background px-1 text-center text-xs text-foreground outline-none focus:border-accent"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
