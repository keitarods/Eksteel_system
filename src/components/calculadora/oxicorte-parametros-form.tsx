"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useParametrosCustoEditor, useVelocidadesEditor } from "@/lib/calculo-custo/hooks-parametros";
import { chavesParametroMaterial } from "@/lib/calculo-custo/types";
import type { Parametro, VelocidadeCorte } from "@/lib/calculo-custo/parametros";
import { Botao, Cartao, Campo, FeedbackBloco } from "@/components/orcamentos/ui";

const GRUPOS: { titulo: string; chaves: string[] }[] = [
  { titulo: "Oxicorte", chaves: ["hora_maquina_oxicorte", "custo_gas_oxicorte_hora", "aproveitamento_nesting_oxicorte"] },
  { titulo: "Plasma", chaves: ["hora_maquina_plasma", "custo_gas_plasma_hora"] },
];

const ESPESSURAS_OXICORTE = [6, 10, 12, 16, 20, 25, 32, 50];
const ESPESSURAS_PLASMA = [2, 3, 5, 6, 10, 12, 16, 18, 20, 25, 32];
const AMPERAGENS = [40, 65, 105];

export default function OxicorteParametrosForm({
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

  const { preco, densidade } = chavesParametroMaterial("chapa", "aco_carbono");
  const precoChapa = parametrosIniciais[preco]?.valor;
  const densidadeChapa = parametrosIniciais[densidade]?.valor;

  async function handleSalvar() {
    setSalvando(true);
    setMensagem("");
    setErro("");
    const erroParametros = await salvarParametros();
    if (erroParametros) { setSalvando(false); setErro(erroParametros); return; }
    const erroVelocidades = await salvarVelocidades();
    if (erroVelocidades) { setSalvando(false); setErro(erroVelocidades); return; }
    setSalvando(false);
    setMensagem("Parâmetros de oxicorte/plasma atualizados.");
  }

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      <div className="rounded-lg border border-panel-hover bg-background p-3 text-xs text-muted">
        Preço da chapa de aço carbono ({precoChapa !== undefined ? `R$${precoChapa.toFixed(2)}/kg` : "não definido"})
        e densidade ({densidadeChapa !== undefined ? `${densidadeChapa}kg/m³` : "não definida"}) são os mesmos usados
        no laser — editáveis na aba Parâmetros do módulo <span className="font-semibold text-steel">Chapa</span>.
      </div>

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
        <p className="mb-1 text-sm font-semibold text-steel">Velocidade de corte — Oxicorte (m/min)</p>
        <p className="mb-3 text-xs text-muted">Só aço carbono — o mecanismo de corte por combustão não funciona em inox/alumínio.</p>
        <div className="overflow-x-auto rounded-lg border border-panel-hover">
          <table className="w-full min-w-[420px] text-center text-xs">
            <thead className="bg-surface text-steel"><tr><th className="px-3 py-2 text-left">Espessura</th><th className="px-3 py-2">Velocidade</th></tr></thead>
            <tbody>
              {ESPESSURAS_OXICORTE.map((esp) => {
                const chave = `oxicorte|aco_carbono|${esp}|1`;
                return (
                  <tr key={esp} className="border-t border-panel-hover">
                    <td className="px-3 py-2 text-left font-semibold text-steel">{esp}mm</td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="text"
                        value={velocidades[chave] ?? ""}
                        onChange={(e) => setVelocidade(chave, e.target.value)}
                        className="h-8 w-20 rounded-lg border border-line bg-background px-1 text-center text-xs text-foreground outline-none focus:border-accent"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao>
        <p className="mb-1 text-sm font-semibold text-steel">Velocidade de corte — Plasma (m/min)</p>
        <p className="mb-3 text-xs text-muted">Só aço carbono cadastrado por enquanto — &quot;potência&quot; aqui é a amperagem do equipamento.</p>
        <div className="overflow-x-auto rounded-lg border border-panel-hover">
          <table className="w-full min-w-[420px] text-center text-xs">
            <thead className="bg-surface text-steel">
              <tr>
                <th className="px-3 py-2 text-left">Espessura</th>
                {AMPERAGENS.map((a) => <th key={a} className="px-3 py-2">{a}A</th>)}
              </tr>
            </thead>
            <tbody>
              {ESPESSURAS_PLASMA.map((esp) => (
                <tr key={esp} className="border-t border-panel-hover">
                  <td className="px-3 py-2 text-left font-semibold text-steel">{esp}mm</td>
                  {AMPERAGENS.map((amp) => {
                    const chave = `plasma|aco_carbono|${esp}|${amp}`;
                    return (
                      <td key={amp} className="px-1.5 py-1.5">
                        <input
                          type="text"
                          value={velocidades[chave] ?? ""}
                          onChange={(e) => setVelocidade(chave, e.target.value)}
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
