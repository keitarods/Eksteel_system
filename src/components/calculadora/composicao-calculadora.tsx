"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { calcularComposicao, type ItemComposicao } from "@/lib/calculo-custo/composicao";
import type { Parametro } from "@/lib/calculo-custo/parametros";
import { TIPOS_CALCULO, type CalculoPeca } from "@/lib/calculo-custo/types";
import { Botao, Campo, Cartao, FeedbackBloco, Th, Td } from "@/components/orcamentos/ui";
import AdicionarAoOrcamentoBotao from "./adicionar-ao-orcamento-botao";

type LinhaLivre = { id: string; descricao: string; valor: string };

// Chaves reais de parametros_custo (antes desse ajuste, "Solda MIG/TIG" e
// "Usinagem" apontavam pra chaves que nunca chegaram a ser seedadas —
// hora_soldador_mig/tig e as hora-máquina de usinagem são específicas por
// equipamento agora, sem uma chave única representativa; a opção de usinagem
// foi removida daqui porque o módulo dedicado (com seleção de equipamento)
// já cobre esse caso via "Peças já calculadas" acima.
const PROCESSOS = [
  { chave: "hora_soldador_mig", label: "Solda MIG" },
  { chave: "hora_soldador_tig", label: "Solda TIG" },
  { chave: "hora_maquina_dobra", label: "Dobra" },
];

function novaLinha(): LinhaLivre {
  return { id: crypto.randomUUID(), descricao: "", valor: "0" };
}

// Cada tipo_calculo guarda características diferentes (chapa tem espessura,
// torneamento/fresamento/soldagem não necessariamente) — resume o que faz
// sentido mostrar por tipo em vez de assumir sempre "material, espessura".
function resumoPeca(p: CalculoPeca): string {
  const tipoLabel = TIPOS_CALCULO.find((t) => t.valor === p.tipoCalculo)?.label ?? p.tipoCalculo;
  if (p.tipoCalculo.startsWith("chapa_")) {
    return `${tipoLabel}, ${p.material}, ${p.espessuraMm}mm, ${p.quantidade}x`;
  }
  return `${tipoLabel}, ${p.material}, ${p.quantidade}x`;
}

export default function ComposicaoCalculadora({
  usuarioId,
  parametros,
  pecasIniciais,
}: {
  usuarioId: string;
  parametros: Record<string, Parametro>;
  pecasIniciais: CalculoPeca[];
}) {
  const [pecasSelecionadas, setPecasSelecionadas] = useState<Set<string>>(new Set());
  const [horasProcesso, setHorasProcesso] = useState<Record<string, string>>({
    hora_soldador_mig: "0",
    hora_soldador_tig: "0",
    hora_maquina_dobra: "0",
  });
  const [maoDeObraExtra, setMaoDeObraExtra] = useState<LinhaLivre[]>([]);
  const [insumos, setInsumos] = useState<LinhaLivre[]>([]);

  const [usarScrapCustom, setUsarScrapCustom] = useState(false);
  const [scrapCustom, setScrapCustom] = useState(String(parametros["scrap_factor"]?.valor ?? 12));
  const [usarMargemCustom, setUsarMargemCustom] = useState(false);
  const [margemCustom, setMargemCustom] = useState(String(parametros["margem_lucro_padrao"]?.valor ?? 30));

  const [usarDeslocamento, setUsarDeslocamento] = useState(false);
  const [kmDeslocamento, setKmDeslocamento] = useState("0");
  const [diariaDeslocamento, setDiariaDeslocamento] = useState("0");

  const [usarComplexidade, setUsarComplexidade] = useState(false);
  const [complexidadePercentual, setComplexidadePercentual] = useState("15");

  const [descricaoItem, setDescricaoItem] = useState("Peça fabricada");

  function parseNumero(valor: string) {
    const n = Number(valor.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function alternarPeca(id: string) {
    setPecasSelecionadas((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const custoKm = parametros["custo_km_deslocamento"]?.valor ?? 0;
  const valorDeslocamento = usarDeslocamento ? parseNumero(kmDeslocamento) * custoKm + parseNumero(diariaDeslocamento) : 0;

  const itensBase: ItemComposicao[] = [
    ...pecasIniciais
      .filter((p) => pecasSelecionadas.has(p.id))
      .map((p) => ({ descricao: `${p.nome} (${p.quantidade}x)`, valor: p.custoTotal * p.quantidade })),
    ...PROCESSOS.filter((proc) => parseNumero(horasProcesso[proc.chave]) > 0).map((proc) => ({
      descricao: `${proc.label} (${horasProcesso[proc.chave]}h)`,
      valor: parseNumero(horasProcesso[proc.chave]) * (parametros[proc.chave]?.valor ?? 0),
    })),
    ...maoDeObraExtra.filter((l) => l.descricao.trim()).map((l) => ({ descricao: l.descricao, valor: parseNumero(l.valor) })),
    ...insumos.filter((l) => l.descricao.trim()).map((l) => ({ descricao: l.descricao, valor: parseNumero(l.valor) })),
    ...(valorDeslocamento > 0 ? [{ descricao: "Deslocamento/instalação", valor: valorDeslocamento }] : []),
  ];

  const subtotalDireto = itensBase.reduce((s, i) => s + i.valor, 0);
  const complexidadePct = parseNumero(complexidadePercentual);
  const valorComplexidade = usarComplexidade ? subtotalDireto * (complexidadePct / 100) : 0;

  const itens: ItemComposicao[] = [
    ...itensBase,
    ...(valorComplexidade > 0 ? [{ descricao: `Fator de complexidade (+${complexidadePct}%, peça sob medida)`, valor: valorComplexidade }] : []),
  ];

  const scrapPercentual = usarScrapCustom ? parseNumero(scrapCustom) : (parametros["scrap_factor"]?.valor ?? 0);
  const margemPercentual = usarMargemCustom ? parseNumero(margemCustom) : (parametros["margem_lucro_padrao"]?.valor ?? 0);

  const resultado = calcularComposicao(itens, scrapPercentual, margemPercentual);

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBloco mensagem="" erro="" />

      {pecasIniciais.length > 0 && (
        <Cartao>
          <p className="mb-3 text-sm font-semibold text-steel">Peças já calculadas (histórico)</p>
          <div className="flex flex-col gap-2">
            {pecasIniciais.map((p) => (
              <label key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-panel-hover bg-background px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pecasSelecionadas.has(p.id)}
                    onChange={() => alternarPeca(p.id)}
                    className="h-4 w-4 accent-accent"
                  />
                  {p.nome} <span className="text-xs text-muted">({resumoPeca(p)})</span>
                </span>
                <span className="font-semibold text-steel">
                  {(p.custoTotal * p.quantidade).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </label>
            ))}
          </div>
        </Cartao>
      )}

      <Cartao>
        <p className="mb-3 text-sm font-semibold text-steel">Mão de obra estimada</p>
        <div className="grid gap-3 sm:grid-cols-4">
          {PROCESSOS.map((proc) => (
            <Campo
              key={proc.chave}
              label={`${proc.label} (h)`}
              value={horasProcesso[proc.chave] ?? "0"}
              onChange={(v) => setHorasProcesso((prev) => ({ ...prev, [proc.chave]: v }))}
            />
          ))}
        </div>
      </Cartao>

      <Cartao>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-steel">Mão de obra extra</p>
          <button type="button" onClick={() => setMaoDeObraExtra((prev) => [...prev, novaLinha()])} className="inline-flex h-8 items-center gap-1 rounded-xl border border-line bg-panel px-2 text-xs font-semibold text-muted hover:bg-panel-hover">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
        {maoDeObraExtra.map((linha) => (
          <div key={linha.id} className="mt-2 flex gap-2">
            <input type="text" value={linha.descricao} onChange={(e) => setMaoDeObraExtra((prev) => prev.map((l) => l.id === linha.id ? { ...l, descricao: e.target.value } : l))} placeholder="Descrição" className="h-9 flex-1 rounded-xl border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-accent" />
            <input type="text" value={linha.valor} onChange={(e) => setMaoDeObraExtra((prev) => prev.map((l) => l.id === linha.id ? { ...l, valor: e.target.value } : l))} placeholder="0,00" className="h-9 w-28 rounded-xl border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-accent" />
            <button type="button" onClick={() => setMaoDeObraExtra((prev) => prev.filter((l) => l.id !== linha.id))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </Cartao>

      <Cartao>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-steel">Insumos (eletrodo, arame MIG, disco de corte...)</p>
          <button type="button" onClick={() => setInsumos((prev) => [...prev, novaLinha()])} className="inline-flex h-8 items-center gap-1 rounded-xl border border-line bg-panel px-2 text-xs font-semibold text-muted hover:bg-panel-hover">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
        {insumos.map((linha) => (
          <div key={linha.id} className="mt-2 flex gap-2">
            <input type="text" value={linha.descricao} onChange={(e) => setInsumos((prev) => prev.map((l) => l.id === linha.id ? { ...l, descricao: e.target.value } : l))} placeholder="Descrição" className="h-9 flex-1 rounded-xl border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-accent" />
            <input type="text" value={linha.valor} onChange={(e) => setInsumos((prev) => prev.map((l) => l.id === linha.id ? { ...l, valor: e.target.value } : l))} placeholder="0,00" className="h-9 w-28 rounded-xl border border-line bg-background px-3 text-sm text-foreground outline-none focus:border-accent" />
            <button type="button" onClick={() => setInsumos((prev) => prev.filter((l) => l.id !== linha.id))} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </Cartao>

      <Cartao>
        <p className="mb-3 text-sm font-semibold text-steel">Deslocamento e complexidade</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-panel-hover bg-background p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={usarDeslocamento} onChange={(e) => setUsarDeslocamento(e.target.checked)} className="h-4 w-4 accent-accent" />
              Cobrar deslocamento/instalação (R$ {custoKm.toFixed(2)}/km)
            </label>
            {usarDeslocamento && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Campo label="Km rodado (ida e volta)" value={kmDeslocamento} onChange={setKmDeslocamento} />
                <Campo label="Diária fixa (R$, opcional)" value={diariaDeslocamento} onChange={setDiariaDeslocamento} />
              </div>
            )}
          </div>
          <div className="rounded-lg border border-panel-hover bg-background p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={usarComplexidade} onChange={(e) => setUsarComplexidade(e.target.checked)} className="h-4 w-4 accent-accent" />
              Aplicar fator de complexidade (peça sob medida, sem histórico)
            </label>
            {usarComplexidade && (
              <div className="mt-2">
                <Campo label="Complexidade (% sobre o custo direto)" value={complexidadePercentual} onChange={setComplexidadePercentual} />
              </div>
            )}
          </div>
        </div>
      </Cartao>

      <Cartao>
        <p className="mb-3 text-sm font-semibold text-steel">Perda de material e margem</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-panel-hover bg-background p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={usarScrapCustom} onChange={(e) => setUsarScrapCustom(e.target.checked)} className="h-4 w-4 accent-accent" />
              Usar scrap factor customizado (padrão: {parametros["scrap_factor"]?.valor ?? 0}%)
            </label>
            {usarScrapCustom && (
              <div className="mt-2">
                <Campo label="Scrap factor (%)" value={scrapCustom} onChange={setScrapCustom} />
              </div>
            )}
          </div>
          <div className="rounded-lg border border-panel-hover bg-background p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={usarMargemCustom} onChange={(e) => setUsarMargemCustom(e.target.checked)} className="h-4 w-4 accent-accent" />
              Usar margem customizada (padrão: {parametros["margem_lucro_padrao"]?.valor ?? 0}%)
            </label>
            {usarMargemCustom && (
              <div className="mt-2">
                <Campo label="Margem de lucro (%)" value={margemCustom} onChange={setMargemCustom} />
              </div>
            )}
          </div>
        </div>
      </Cartao>

      <Cartao>
        <p className="mb-3 text-sm font-semibold text-steel">Breakdown do custo</p>
        <div className="overflow-x-auto rounded-lg border border-panel-hover">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="bg-surface text-steel"><tr><Th>Item</Th><Th>Valor</Th></tr></thead>
            <tbody>
              {resultado.itens.map((item, i) => (
                <tr key={i} className="border-t border-panel-hover">
                  <Td>{item.descricao}</Td>
                  <Td>{item.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</Td>
                </tr>
              ))}
              {resultado.itens.length === 0 && (
                <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-muted">Nenhum item adicionado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-steel">Subtotal</span><span className="font-semibold">{resultado.subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
          <div className="flex justify-between"><span className="text-steel">Perda de material ({scrapPercentual}%)</span><span className="font-semibold">{resultado.scrapValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
          <div className="flex justify-between"><span className="text-steel">Custo com perda</span><span className="font-semibold">{resultado.custoComScrap.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
          <div className="flex justify-between"><span className="text-steel">Margem ({margemPercentual}%)</span><span className="font-semibold">{resultado.margemValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
          <div className="flex justify-between border-t border-panel-hover pt-2 text-base font-bold"><span>Preço sugerido</span><span className="text-steel">{resultado.precoSugerido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-panel-hover pt-5 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Campo label="Descrição do item pro orçamento" value={descricaoItem} onChange={setDescricaoItem} />
          </div>
          <AdicionarAoOrcamentoBotao
            usuarioId={usuarioId}
            tipoItem="servico"
            descricao={descricaoItem}
            detalhamentoTecnico={resultado.itens.map((i) => `${i.descricao}: ${i.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`).join("; ")}
            quantidade={1}
            valorUnitario={resultado.precoSugerido}
          />
        </div>
      </Cartao>
    </div>
  );
}
