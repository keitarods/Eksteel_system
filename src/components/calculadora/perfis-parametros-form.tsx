"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useParametrosCustoEditor } from "@/lib/calculo-custo/hooks-parametros";
import type { Parametro } from "@/lib/calculo-custo/parametros";
import { Botao, Cartao, Campo, FeedbackBloco } from "@/components/orcamentos/ui";

const MATERIAIS_PERFIS = [
  { valor: "aco_carbono", label: "Aço carbono" },
  { valor: "inox_304", label: "Inox 304" },
  { valor: "inox_316", label: "Inox 316" },
  { valor: "aluminio", label: "Alumínio" },
  { valor: "galvanizado", label: "Galvanizado" },
];

const GRUPOS: { titulo: string; chaves: string[] }[] = [
  { titulo: "Preço de tubo/perfil (metalon) (R$/kg)", chaves: MATERIAIS_PERFIS.map((m) => `preco_kg_perfis_${m.valor}`) },
  { titulo: "Densidade (kg/m³)", chaves: MATERIAIS_PERFIS.map((m) => `densidade_perfis_${m.valor}`) },
];

export default function PerfisParametrosForm({
  usuarioId,
  parametrosIniciais,
}: {
  usuarioId: string;
  parametrosIniciais: Record<string, Parametro>;
}) {
  const { valores, setValor, salvar: salvarParametros } = useParametrosCustoEditor(usuarioId, parametrosIniciais);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function handleSalvar() {
    setSalvando(true);
    setMensagem("");
    setErro("");
    const erroParametros = await salvarParametros();
    if (erroParametros) { setSalvando(false); setErro(erroParametros); return; }
    setSalvando(false);
    setMensagem("Parâmetros de tubos e perfis atualizados.");
  }

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-xs text-[#78909C]">
        Preço e densidade aqui são específicos de tubo/perfil (metalon) — diferentes do preço de chapa, já que o
        processo de conformação/solda do tubo tem custo próprio. Um perfil do catálogo com preço de referência
        próprio (R$/metro) ignora esses valores.
      </div>

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

      <div>
        <Botao onClick={handleSalvar} disabled={salvando}>
          <Save className="h-4 w-4" />
          {salvando ? "Salvando..." : "Salvar alterações"}
        </Botao>
      </div>
    </div>
  );
}
