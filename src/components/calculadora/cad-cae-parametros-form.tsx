"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useParametrosCustoEditor } from "@/lib/calculo-custo/hooks-parametros";
import { calcularHoraTecnicaBase, mapNivelResponsabilidadeCad, type NivelResponsabilidadeCad } from "@/lib/calculo-custo/cad-cae";
import type { Parametro } from "@/lib/calculo-custo/parametros";
import { Botao, Cartao, Campo, CampoTextarea, FeedbackBloco } from "@/components/orcamentos/ui";

const GRUPOS: { titulo: string; chaves: string[] }[] = [
  { titulo: "Hora técnica base (Fator K)", chaves: ["salario_referencia_cad", "fator_k", "horas_produtivas_mes"] },
  { titulo: "ART/RRT", chaves: ["valor_art_referencia"] },
];

// Estado local de edição usa string pro multiplicador (mesmo padrão dos
// outros formulários — parseia só na hora de calcular/salvar), diferente do
// tipo NivelResponsabilidadeCad (que vem numérico do banco).
type NivelEditavel = Omit<NivelResponsabilidadeCad, "multiplicadorHora"> & { multiplicadorHora: string };

function paraEditavel(n: NivelResponsabilidadeCad): NivelEditavel {
  return { ...n, multiplicadorHora: String(n.multiplicadorHora) };
}

function parseNumero(valor: string) {
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export default function CadCaeParametrosForm({
  usuarioId,
  parametrosIniciais,
  niveisIniciais,
}: {
  usuarioId: string;
  parametrosIniciais: Record<string, Parametro>;
  niveisIniciais: NivelResponsabilidadeCad[];
}) {
  const { valores, setValor, salvar: salvarParametros } = useParametrosCustoEditor(usuarioId, parametrosIniciais);
  const [niveis, setNiveis] = useState<NivelEditavel[]>(niveisIniciais.map(paraEditavel));
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [novoNome, setNovoNome] = useState("");
  const [novoMultiplicador, setNovoMultiplicador] = useState("1.0");
  const [novoExigeArt, setNovoExigeArt] = useState(false);
  const [novoDescricao, setNovoDescricao] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  const horaTecnicaBase = calcularHoraTecnicaBase(
    parseNumero(valores["salario_referencia_cad"] ?? "0"),
    parseNumero(valores["fator_k"] ?? "0"),
    parseNumero(valores["horas_produtivas_mes"] ?? "0")
  );

  async function handleSalvarParametros() {
    setSalvando(true);
    setMensagem("");
    setErro("");
    const erroParametros = await salvarParametros();
    if (erroParametros) { setSalvando(false); setErro(erroParametros); return; }
    setSalvando(false);
    setMensagem("Parâmetros de CAD/CAE atualizados.");
  }

  function atualizarNivelLocal<K extends keyof NivelEditavel>(id: string, campo: K, valor: NivelEditavel[K]) {
    setNiveis((prev) => prev.map((n) => (n.id === id ? { ...n, [campo]: valor } : n)));
  }

  async function salvarNivel(nivel: NivelEditavel) {
    setErro("");
    const supabase = createClient();
    const { error } = await supabase
      .from("niveis_responsabilidade_cad")
      .update({
        nome: nivel.nome,
        multiplicador_hora: parseNumero(nivel.multiplicadorHora),
        exige_art: nivel.exigeArt,
        descricao: nivel.descricao,
        ativo: nivel.ativo,
      })
      .eq("id", nivel.id);
    if (error) { setErro(error.message); return; }
    setMensagem(`Nível "${nivel.nome}" atualizado.`);
  }

  async function alternarAtivo(nivel: NivelEditavel) {
    const atualizado = { ...nivel, ativo: !nivel.ativo };
    setNiveis((prev) => prev.map((n) => (n.id === nivel.id ? atualizado : n)));
    await salvarNivel(atualizado);
  }

  async function adicionarNivel() {
    if (!novoNome.trim()) { setErro("Dê um nome pro novo nível."); return; }
    setSalvandoNovo(true);
    setErro("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("niveis_responsabilidade_cad")
      .insert({
        criado_por: usuarioId,
        nome: novoNome,
        multiplicador_hora: parseNumero(novoMultiplicador),
        exige_art: novoExigeArt,
        descricao: novoDescricao,
        ativo: true,
      })
      .select()
      .single();
    setSalvandoNovo(false);
    if (error) { setErro(error.message); return; }
    if (data) setNiveis((prev) => [...prev, paraEditavel(mapNivelResponsabilidadeCad(data))]);
    setNovoNome("");
    setNovoMultiplicador("1.0");
    setNovoExigeArt(false);
    setNovoDescricao("");
    setMensagem("Nível cadastrado.");
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

      <div className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-sm">
        Hora técnica base resultante: <span className="font-semibold text-[#90A4AE]">{horaTecnicaBase.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/h</span>
        <span className="ml-2 text-xs text-[#78909C]">(calculada — salário × Fator K ÷ horas produtivas; confira se está coerente antes de aplicar aos níveis abaixo)</span>
      </div>

      <div>
        <Botao onClick={handleSalvarParametros} disabled={salvando}>
          <Save className="h-4 w-4" />
          {salvando ? "Salvando..." : "Salvar parâmetros base"}
        </Botao>
      </div>

      <Cartao>
        <p className="mb-1 text-sm font-semibold text-[#90A4AE]">Níveis de responsabilidade</p>
        <p className="mb-4 text-xs text-[#78909C]">
          Custo/hora de cada nível = hora técnica base × multiplicador. Adicione, edite ou desative níveis
          conforme o tipo de cliente/projeto que for aparecendo — sem precisar mexer em código.
        </p>

        <div className="flex flex-col gap-4">
          {niveis.map((nivel) => (
            <div key={nivel.id} className={`rounded-2xl border p-4 ${nivel.ativo ? "border-[#2a2a2a] bg-[#141414]" : "border-[#2a2a2a] bg-[#141414] opacity-50"}`}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo label="Nome" value={nivel.nome} onChange={(v) => atualizarNivelLocal(nivel.id, "nome", v)} />
                <Campo
                  label="Multiplicador sobre a hora base"
                  value={nivel.multiplicadorHora}
                  onChange={(v) => atualizarNivelLocal(nivel.id, "multiplicadorHora", v)}
                />
                <div>
                  <p className="mb-1 text-sm font-medium">Custo/hora resultante</p>
                  <p className="flex h-11 items-center rounded-2xl border border-[#333333] bg-[#181818] px-4 text-sm font-semibold text-[#90A4AE]">
                    {(horaTecnicaBase * parseNumero(nivel.multiplicadorHora)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/h
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <CampoTextarea
                  label="Descrição (aparece pro Keitaro na hora de escolher o nível)"
                  value={nivel.descricao}
                  onChange={(v) => atualizarNivelLocal(nivel.id, "descricao", v)}
                  rows={2}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={nivel.exigeArt}
                    onChange={(e) => atualizarNivelLocal(nivel.id, "exigeArt", e.target.checked)}
                    className="h-4 w-4 accent-[#546E7A]"
                  />
                  Exige ART/RRT
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={nivel.ativo}
                    onChange={() => alternarAtivo(nivel)}
                    className="h-4 w-4 accent-[#546E7A]"
                  />
                  Ativo (aparece na calculadora)
                </label>
                <button
                  type="button"
                  onClick={() => salvarNivel(nivel)}
                  className="ml-auto inline-flex h-9 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-3 text-xs font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]"
                >
                  <Save className="h-3.5 w-3.5" /> Salvar nível
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-dashed border-[#333333] p-4">
          <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Novo nível</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Nome" value={novoNome} onChange={setNovoNome} placeholder="Ex: Cálculo/CAE — Pleno" />
            <Campo label="Multiplicador sobre a hora base" value={novoMultiplicador} onChange={setNovoMultiplicador} />
            <label className="flex items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" checked={novoExigeArt} onChange={(e) => setNovoExigeArt(e.target.checked)} className="h-4 w-4 accent-[#546E7A]" />
              Exige ART/RRT
            </label>
          </div>
          <div className="mt-3">
            <CampoTextarea label="Descrição" value={novoDescricao} onChange={setNovoDescricao} rows={2} />
          </div>
          <div className="mt-3">
            <Botao onClick={adicionarNivel} disabled={salvandoNovo}>
              <Plus className="h-4 w-4" />
              {salvandoNovo ? "Cadastrando..." : "Cadastrar nível"}
            </Botao>
          </div>
        </div>
      </Cartao>
    </div>
  );
}
