"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { carregarBaseGerencial } from "@/lib/relatorios/dados";
import { agruparValores, dentro, fimMes, gerarCsv, periodosRelatorio, posicaoEstoque, prepararVendas, rankingItens, resumoPeriodo, variacao, type BaseGerencial } from "@/lib/relatorios/metricas";

const real = (v: number | null) => v === null ? "Não apurado" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const percentual = (v: number | null) => v === null ? "Sem base" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const numero = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const dataBr = (d: string) => d.split("-").reverse().join("/");
const mesBr = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" });
const botao = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold hover:bg-panel-hover disabled:opacity-50";
function Painel({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-6"><h3 className="text-lg font-bold">{titulo}</h3>{descricao ? <p className="mt-2 text-sm leading-6 text-muted">{descricao}</p> : null}<div className="mt-5">{children}</div></section>;
}
function Indicador({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return <div className="min-w-0 rounded-xl border border-line bg-panel p-4"><p className="text-xs leading-5 text-muted">{titulo}</p><p className="mt-2 break-words text-xl font-bold sm:text-2xl">{valor}</p>{detalhe ? <p className="mt-2 text-xs leading-5 text-muted">{detalhe}</p> : null}</div>;
}
function Tabela({ cabecalho, linhas, legenda }: { cabecalho: string[]; linhas: React.ReactNode[][]; legenda: string }) {
  return <div className="overflow-x-auto rounded-lg border border-line" tabIndex={0} role="region" aria-label={legenda}>
    <table className="w-full min-w-[540px] text-left text-sm"><caption className="sr-only">{legenda}</caption><thead className="bg-surface text-steel"><tr>{cabecalho.map((c) => <th scope="col" key={c} className="px-4 py-3 font-semibold">{c}</th>)}</tr></thead><tbody>
      {linhas.length ? linhas.map((linha, i) => <tr key={i} className="border-t border-line">{linha.map((celula, j) => <td key={j} className="px-4 py-3 align-top tabular-nums">{celula}</td>)}</tr>) : <tr><td colSpan={cabecalho.length} className="p-5 text-muted">Nenhum lançamento neste período.</td></tr>}
    </tbody></table>
  </div>;
}

export default function RelatoriosModulo({ dataHoje }: { dataHoje: string }) {
  const [base, setBase] = useState<BaseGerencial | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);
  const [mes, setMes] = useState(dataHoje.slice(0, 7));
  const [atualizado, setAtualizado] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    carregarBaseGerencial(controller.signal).then((dados) => {
      if (controller.signal.aborted) return;
      setBase(dados); setAtualizado(new Date().toLocaleString("pt-BR")); setErro(""); setCarregando(false);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setBase(null); setErro(error instanceof Error ? error.message : "Não foi possível carregar os relatórios."); setCarregando(false);
    });
    return () => controller.abort();
  }, [versao]);
  const apuracao = useMemo(() => {
    if (!base) return null;
    const periodos = periodosRelatorio(mes, dataHoje);
    const vendas = prepararVendas(base);
    const mensal = resumoPeriodo(vendas, base.despesas, periodos.mes);
    const anterior = resumoPeriodo(vendas, base.despesas, periodos.anterior);
    const anual = resumoPeriodo(vendas, base.despesas, periodos.ano);
    const evolucao = periodos.meses.map((m) => ({ mes: m, nome: mesBr(m), ...resumoPeriodo(vendas, base.despesas, { inicio: `${m}-01`, fim: m === mes ? periodos.mes.fim : fimMes(m) }) }));
    return { periodos, mensal, anterior, anual, evolucao, rankingMes: rankingItens(vendas, base, periodos.mes), rankingAno: rankingItens(vendas, base, periodos.ano), estoque: posicaoEstoque(base, vendas, dataHoje), canais: agruparValores(vendas.filter((v) => dentro(v.data, periodos.mes)), (v) => v.marketplace, (v) => v.aposDescontos), categorias: agruparValores(base.despesas.filter((d) => dentro(d.data, periodos.mes)), (d) => d.categoria, (d) => d.valor) };
  }, [base, mes, dataHoje]);
  function atualizar() { setCarregando(true); setBase(null); setErro(""); setVersao((v) => v + 1); }
  function exportar() {
    if (!apuracao) return;
    const a = apuracao;
    const linhas: (string | number | null)[][] = [
      ["EKsteel — Relatório gerencial", mes], ["Período mensal", a.periodos.mes.inicio, a.periodos.mes.fim], ["Janela de 12 meses", a.periodos.ano.inicio, a.periodos.ano.fim],
      ["Metodologia", "Estimativas por data de lançamento; não é DRE contábil nem fluxo de caixa. Valores não apurados ficam vazios."],
      ["Vendas com custo estimado", a.mensal.custosEstimados, a.anual.custosEstimados],
      ["CMV", "Custo médio registrado na venda. Histórico sem registro usa custo cadastral estimado. Tributos e resultado financeiro não segregados."],
      ["Indicador complementar", "Mês", "12 meses"], ["Receita líquida gerencial (bruta menos descontos e taxas)", a.mensal.receitaLiquidaGerencial, a.anual.receitaLiquidaGerencial],
      ["DRE gerencial", "Mês", "12 meses"], ...linhasDre(a.mensal, a.anual).map((l) => [l[0], l[1], l[2]]),
      [], ["Evolução mensal", "Após descontos", "CMV estimado", "Taxas", "Despesas", "Resultado estimado", "Vendas sem custo"],
      ...a.evolucao.map((e) => [e.mes, e.receita, e.cpv, e.taxas, e.despesasTotal, e.resultado, e.semCusto]),
      [], ["Mais vendidos no mês", "Tipo", "Quantidade comercial", "Após descontos"], ...a.rankingMes.map((r) => [r.nome, r.tipo, r.quantidade, r.receita]),
      [], ["Mais vendidos em 12 meses", "Tipo", "Quantidade comercial", "Após descontos", "ABC"], ...a.rankingAno.map((r) => [r.nome, r.tipo, r.quantidade, r.receita, r.abc]),
      [], ["Saldos físicos de produtos, sem capacidade por matéria-prima", dataHoje], ["Produto", "Saldo cadastrado", "Valor estimado", "Fonte do custo"], ...a.estoque.itens.map((p) => [p.nome, p.estoqueAtual, p.valor, p.fonte]),
    ];
    const url = URL.createObjectURL(new Blob([gerarCsv(linhas)], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = `eksteel-relatorio-${mes}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const a = apuracao;
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-xs font-semibold uppercase tracking-wider text-steel">Gestão do negócio</p><h2 className="mt-2 text-2xl font-bold sm:text-3xl">Relatórios e indicadores</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Vendas, resultado gerencial e posição de estoque com base nos registros acessíveis à sua conta.</p></div>
      <div className="flex flex-wrap items-end gap-3"><label className="text-sm" htmlFor="relatorio-mes">Mês de referência<input id="relatorio-mes" type="month" min="1900-01" max={dataHoje.slice(0, 7)} value={mes} onChange={(e) => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value) && e.target.value >= "1900-01" && e.target.value <= dataHoje.slice(0, 7)) setMes(e.target.value); }} className="mt-1 block min-h-11 max-w-full rounded-lg border border-line bg-background px-3" /></label><button className={botao} onClick={atualizar} disabled={carregando}><RefreshCw size={16} /> Atualizar</button><button className={botao} onClick={exportar} disabled={!a || carregando}><Download size={16} /> CSV</button></div>
    </div>
    {carregando ? <p role="status" className="rounded-xl border border-line bg-panel p-6 text-muted">Carregando todos os registros para apurar os relatórios…</p> : erro ? <div role="alert" className="rounded-xl border border-red-900/50 bg-red-900/10 p-5 text-red-300">{erro} Nenhum total parcial foi exibido.<button className={`${botao} mt-4 block`} onClick={atualizar}>Tentar novamente</button></div> : null}
    {a && !carregando ? <>
      <p className="text-xs leading-6 text-muted">Mês: {dataBr(a.periodos.mes.inicio)} a {dataBr(a.periodos.mes.fim)} · 12 meses: {dataBr(a.periodos.ano.inicio)} a {dataBr(a.periodos.ano.fim)} · Leitura: {atualizado}. O mês atual é parcial.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Indicador titulo="Receita líquida gerencial · mês" valor={real(a.mensal.receitaLiquidaGerencial)} detalhe="Receita bruta menos descontos e taxas de marketplace; não comprova recebimento em caixa." />
        <Indicador titulo="Receita líquida gerencial · 12 meses" valor={real(a.anual.receitaLiquidaGerencial)} detalhe="Mesmo critério do mês, acumulado na janela selecionada." />
        <Indicador titulo="Vendas após descontos · mês" valor={real(a.mensal.receita)} detalhe={`Variação: ${percentual(variacao(a.mensal.receita, a.anterior.receita))} frente a ${dataBr(a.periodos.anterior.inicio)}–${dataBr(a.periodos.anterior.fim)}.`} />
        <Indicador titulo="Lucro líquido gerencial estimado · mês" valor={real(a.mensal.resultado)} detalhe={`Margem sobre vendas após descontos: ${percentual(a.mensal.margem)}.`} />
        <Indicador titulo="Unidades comerciais vendidas · mês" valor={numero(a.mensal.quantidade)} detalhe={`${a.mensal.lancamentos} lançamentos. Cada kit conta como uma unidade comercial.`} />
        <Indicador titulo="Vendas após descontos · 12 meses" valor={real(a.anual.receita)} detalhe={`Resultado gerencial estimado: ${real(a.anual.resultado)}.`} />
      </div>
      {(a.anual.custosEstimados > 0 || a.anual.semCusto > 0 || a.anual.despesasTaxas > 0 || a.anual.deducoesExcessivas > 0) ? <div role="status" className="rounded-xl border border-amber-800/50 bg-amber-900/10 p-4 text-sm leading-6 text-amber-200">
        <p className="font-semibold">Pontos para conciliar nos 12 meses</p>
        {a.anual.custosEstimados > 0 ? <p>{a.anual.custosEstimados} vendas usam custo estimado do cadastro ou do saldo inicial. Esses valores estão incluídos no CMV e nos resultados.</p> : null}
        {a.anual.semCusto ? <p>{a.anual.semCusto} vendas sem custo cadastral ou histórico completo ou sem composição de kit. CMV e resultado total ficam como “Não apurado”.</p> : null}
        {a.anual.despesasTaxas ? <p>Há {real(a.anual.despesasTaxas)} em despesas “Taxas marketplace”. Confira se também foram lançadas nas vendas. As duas fontes são mantidas, sem deduplicação presumida.</p> : null}
        {a.anual.deducoesExcessivas ? <p>{a.anual.deducoesExcessivas} vendas têm descontos e taxas superiores ao valor bruto. Revise os lançamentos.</p> : null}
      </div> : null}
      <Painel titulo="DRE gerencial" descricao="Apuração por data de lançamento. Não representa lucro líquido contábil: tributos, depreciação e resultado financeiro não estão segregados na base atual.">
        <Tabela legenda="DRE gerencial do mês e dos últimos 12 meses" cabecalho={["Componente", "Mês selecionado", "12 meses"]} linhas={linhasDre(a.mensal, a.anual).map(([nome, mesValor, anoValor]) => [nome, real(mesValor), real(anoValor)])} />
        <p className="mt-3 text-xs leading-6 text-muted">A receita líquida gerencial dos cartões já desconta as taxas. Na DRE abaixo, elas são deduzidas separadamente uma única vez. Taxas de marketplace são despesas comerciais. Reposições e rateios entre sócios não são novamente deduzidos como despesas; o custo de aquisição entra no resultado pelo CMV das unidades vendidas. Sem registro de recebimento/pagamento, vendas e despesas não comprovam movimentação de caixa.</p>
      </Painel>
      <Painel titulo="Evolução dos últimos 12 meses" descricao="Meses sem lançamentos permanecem na série. Resultado não apurado não é substituído por zero.">
        <div className="h-72 min-w-0" aria-label="Gráfico de vendas após descontos e resultado estimado"><ResponsiveContainer width="100%" height="100%"><BarChart data={a.evolucao}><CartesianGrid stroke="var(--line)" strokeDasharray="3 3" /><XAxis dataKey="nome" tick={{ fontSize: 11, fill: "var(--steel)" }} /><YAxis width={65} tick={{ fontSize: 11, fill: "var(--steel)" }} tickFormatter={(v) => `${numero(Number(v) / 1000)} mil`} /><Tooltip contentStyle={{ background: "var(--panel)", borderColor: "var(--line)", color: "var(--foreground)" }} formatter={(v) => real(v == null ? null : Number(v))} /><Legend /><Bar dataKey="receita" name="Após descontos" fill="var(--accent)" radius={[3, 3, 0, 0]} /><Bar dataKey="resultado" name="Resultado estimado" fill="var(--steel)" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
        <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">Ver valores mensais em tabela</summary><Tabela legenda="Valores da evolução mensal" cabecalho={["Mês", "Após descontos", "CMV estimado", "Despesas + taxas", "Resultado"]} linhas={a.evolucao.map((e) => [mesBr(e.mes), real(e.receita), real(e.cpv), real(e.despesasTotal + e.taxas), real(e.resultado)])} /></details>
      </Painel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Painel titulo="Itens que mais saíram no mês" descricao="Ranking por quantidade comercial. Produtos e kits são apresentados separadamente; não duplicamos a receita nos componentes."><Tabela legenda="Mais vendidos no mês" cabecalho={["Item", "Unidades", "Após descontos"]} linhas={a.rankingMes.slice(0, 10).map((r) => [<span key={r.id}>{r.nome}<small className="block text-muted">{r.tipo}</small></span>, numero(r.quantidade), real(r.receita)])} /><p className="mt-3 text-xs text-muted">Top 10 de {a.rankingMes.length} itens. O CSV inclui todos.</p></Painel>
        <Painel titulo="Itens que mais saíram em 12 meses" descricao="ABC por participação na receita após descontos: A até cruzar 80%, B até cruzar 95%, C restante. A ordenação da tabela é por quantidade."><Tabela legenda="Mais vendidos em 12 meses" cabecalho={["Item", "Unidades", "Após descontos", "ABC"]} linhas={a.rankingAno.slice(0, 10).map((r) => [<span key={r.id}>{r.nome}<small className="block text-muted">{r.tipo}</small></span>, numero(r.quantidade), real(r.receita), r.abc])} /><p className="mt-3 text-xs text-muted">Top 10 de {a.rankingAno.length} itens. O CSV inclui todos.</p></Painel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Painel titulo="Canais de venda · mês"><Tabela legenda="Vendas por canal" cabecalho={["Canal", "Após descontos", "Participação"]} linhas={a.canais.map((c) => [c.nome, real(c.total), percentual(a.mensal.receita > 0 ? c.total / a.mensal.receita * 100 : null)])} /><p className="mt-3 text-xs leading-6 text-muted">Taxa efetiva de marketplace: {percentual(a.mensal.taxaEfetiva)}. Valor médio por lançamento: {real(a.mensal.valorMedio)}. Um lançamento não equivale necessariamente a um pedido.</p></Painel>
        <Painel titulo="Despesas registradas · mês"><Tabela legenda="Despesas por categoria" cabecalho={["Categoria", "Valor"]} linhas={a.categorias.map((c) => [c.nome, real(c.total)])} /></Painel>
      </div>
      <Painel titulo="Balanço patrimonial · posição parcial disponível" descricao={`Estoque atual em ${dataBr(dataHoje)}, independente do mês selecionado. Não constitui balanço patrimonial completo; o saldo físico cadastrado é a fonte de quantidade. A capacidade de produtos e kits por matéria-prima está na aba Estoque.`}>
        <div className="grid gap-3 sm:grid-cols-3"><Indicador titulo="Estoque de produtos · estimativa" valor={real(a.estoque.total)} detalhe={a.estoque.semValor ? `${a.estoque.semValor} itens sem valor apurável. Parcela conhecida: ${real(a.estoque.parcial)}.` : "Não inclui matéria-prima nem produção em andamento."} /><Indicador titulo="Produtos ativos no mínimo ou abaixo" valor={String(a.estoque.itens.filter((p) => p.ativo && p.estoqueAtual <= p.estoqueMinimo).length)} detalhe="Revisar necessidades de reposição." /><Indicador titulo="Produtos com saldo e sem saída em 12 meses" valor={a.estoque.kitsSemComposicao ? "Não apurado" : String(a.estoque.itens.filter((p) => p.estoqueAtual > 0 && p.saidas === 0).length)} detalhe="Indicador de estoque parado; kits dependem da composição atual." /></div>
        <div className="mt-5"><Tabela legenda="Posição atual de estoque" cabecalho={["Produto", "Saldo", "Saídas físicas / 12 meses", "Cobertura em dias", "Valor estimado"]} linhas={a.estoque.itens.map((p) => [<span key={p.id}>{p.nome}<small className="block text-muted">{p.fonte}</small></span>, numero(p.estoqueAtual), a.estoque.kitsSemComposicao ? "Incompleto" : numero(p.saidas), p.cobertura === null ? "Sem base" : numero(p.cobertura), real(p.valor)])} /></div>
        <p className="mt-3 text-xs leading-6 text-muted">Cobertura = saldo ÷ média diária das saídas na janela atual de 12 meses ({a.estoque.dias} dias). Não é previsão sazonal. O estoque usa o custo médio de reposição; o saldo inicial e o histórico sem custo usam estimativa cadastral, identificada na tabela.</p>
        <div className="mt-5 rounded-lg border border-line bg-surface p-4"><h4 className="font-semibold">Contas ainda não apuradas</h4><p className="mt-2 text-sm leading-6 text-muted">Caixa e bancos, contas a receber, fornecedores a pagar, tributos, empréstimos, imobilizado e depreciação, capital social e lucros acumulados. Sem esses saldos e conciliação, não calculamos ativo total, passivo total, patrimônio líquido ou liquidez corrente. Pedidos de compra não comprovam dívidas e o rateio entre sócios não comprova capital social.</p></div>
      </Painel>
      <details className="rounded-xl border border-line bg-panel p-5"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Metodologia e qualidade da base</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted"><li>Todos os registros permitidos à conta são paginados. Falhas de leitura bloqueiam totais parciais; produtos inativos são incluídos nas vendas históricas.</li><li>CMV utiliza o custo médio gravado ao registrar a venda. Reposições posteriores não alteram esse valor. O saldo inicial e as vendas antigas são estimados pelo custo cadastral; sem custo positivo, a apuração permanece incompleta.</li><li>Vendas de kits: {a.anual.vendasKit} lançamentos nos 12 meses. Novas vendas preservam a composição no lançamento. Histórico anterior à migração usa a composição disponível naquela configuração inicial. Composição ausente impede apuração.</li><li>As datas são as informadas nos lançamentos, sem comprovação de competência ou liquidação. Tributos, devoluções e cancelamentos precisam estar conciliados na origem. Despesas “Taxas marketplace” são mantidas e sinalizadas para possível duplicidade.</li><li>Resultado gerencial não equivale a lucro líquido, EBITDA ou saldo bancário. O painel “Balancete” existente é um rateio de gastos entre sócios, não um balancete contábil de débitos e créditos.</li></ul></details>
    </> : null}
  </div>;
}
function linhasDre(m: ReturnType<typeof resumoPeriodo>, a: ReturnType<typeof resumoPeriodo>): [string, number | null, number | null][] {
  return [
    ["Receita bruta registrada", m.bruta, a.bruta], ["(−) Descontos concedidos", m.descontos, a.descontos], ["(=) Receita após descontos · antes de tributos não segregados", m.receita, a.receita], ["(−) CMV estimado dos itens vendidos", m.cpv, a.cpv], ["(=) Lucro bruto estimado", m.brutoEstimado, a.brutoEstimado], ["(−) Taxas de marketplace nas vendas", m.taxas, a.taxas], ["(−) Demais despesas registradas", m.despesasTotal, a.despesasTotal], ["(=) Lucro líquido gerencial estimado", m.resultado, a.resultado],
  ];
}
