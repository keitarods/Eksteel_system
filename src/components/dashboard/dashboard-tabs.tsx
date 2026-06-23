"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  BarChart3,
  Boxes,
  ClipboardList,
  DollarSign,
  LayoutDashboard,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type AbaDashboard =
  | "visao-geral"
  | "vendas"
  | "cadastro"
  | "estoque"
  | "compras"
  | "financeiro"
  | "usuarios";

type Marketplace = "Mercado Livre" | "Shopee" | "Site Próprio" | "Outro";

type Produto = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  custo: number;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  ativo: boolean;
};

type Venda = {
  id: string;
  data: string;
  marketplace: Marketplace;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  valorUnitario: number;
  taxaMarketplace: number;
  desconto: number;
  observacao: string;
};

type Despesa = {
  id: string;
  data: string;
  categoria: string;
  descricao: string;
  valor: number;
};

type Fornecedor = {
  id: string;
  nome: string;
  contato: string;
  observacao: string;
};

type Cliente = {
  id: string;
  nome: string;
  contato: string;
  email: string;
  cidade: string;
  observacao: string;
};

type MateriaPrima = {
  id: string;
  codigo: string;
  nome: string;
  unidade: string;
  custo: number;
  linkCompra: string;
  ativo: boolean;
};

type ComponenteProduto = {
  id: string;
  produtoId: string;
  nomePeca: string;
  quantidade: number;
  linkCompra: string;
};

type ItemFabricacaoRascunho = {
  componenteId: string;
  nomePeca: string;
  qtdPc: number;
  linkCompra: string;
  fornecedorNome: string;
  precoUnitario: string;
};

type PedidoFabricacao = {
  id: string;
  produtoId: string;
  produtoNome: string;
  qtdFabricada: number;
  data: string;
  valorTotal: number;
  observacao: string;
};

type MembroEmpresa = {
  id: string;
  usuarioId: string;
  nome: string;
  email: string;
  papel: "admin" | "socio" | "pendente";
};

type PedidoCompra = {
  id: string;
  fornecedorId: string;
  fornecedorNome: string;
  data: string;
  status: "pendente" | "recebido" | "cancelado";
  valorTotal: number;
  observacao: string;
};

type DashboardTabsProps = {
  usuarioId: string;
  isAdmin: boolean;
  dataHoje: string;
  abaInicial?: AbaDashboard;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const MARKETPLACES: Marketplace[] = [
  "Mercado Livre",
  "Shopee",
  "Site Próprio",
  "Outro",
];

const CATEGORIAS_DESPESA = [
  "Frete",
  "Embalagem",
  "Marketing",
  "Taxas marketplace",
  "Manutenção",
  "Salários",
  "Aluguel",
  "Software",
  "Outros",
];

const CORES = ["#1565c0", "#1976d2", "#42a5f5", "#90caf9", "#bbdefb"];

const TODAS_ABAS = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "vendas", label: "Vendas", icon: ShoppingCart },
  { id: "cadastro", label: "Cadastro", icon: ClipboardList },
  { id: "estoque", label: "Estoque", icon: Archive },
  { id: "compras", label: "Compras", icon: PackagePlus },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "usuarios", label: "Usuários", icon: Users },
] satisfies Array<{
  id: AbaDashboard;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}>;

// ─── Utils ───────────────────────────────────────────────────────────────────

function proximoCodigo(lista: { codigo: string }[], prefixo: string): string {
  const re = new RegExp(`^${prefixo}(\\d+)$`, "i");
  const usados = new Set<number>();
  for (const item of lista) {
    const m = item.codigo.match(re);
    if (m) usados.add(parseInt(m[1], 10));
  }
  let n = 1;
  while (usados.has(n)) n++;
  return `${prefixo}${String(n).padStart(3, "0")}`;
}

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseNumero(valor: string) {
  return parseFloat(valor.replace(",", ".")) || 0;
}

function formatarData(iso: string) {
  if (!iso) return "-";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function DashboardTabs({
  usuarioId,
  isAdmin,
  dataHoje,
  abaInicial = "visao-geral",
}: DashboardTabsProps) {
  const [abaAtiva, setAbaAtiva] = useState<AbaDashboard>(abaInicial);

  const abas = isAdmin
    ? TODAS_ABAS
    : TODAS_ABAS.filter((a) => a.id !== "usuarios");

  return (
    <div className="mt-8">
      <div className="flex gap-2 overflow-x-auto rounded-3xl border border-[#90caf9] bg-white/80 p-2 shadow-sm">
        {abas.map((aba) => {
          const Icon = aba.icon;
          const ativa = abaAtiva === aba.id;

          return (
            <button
              key={aba.id}
              type="button"
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition ${
                ativa
                  ? "bg-[#1565c0] text-white shadow-sm"
                  : "text-[#1565c0] hover:bg-[#e3f0ff]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {aba.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {abaAtiva === "visao-geral" && (
          <VisaoGeral usuarioId={usuarioId} />
        )}
        {abaAtiva === "vendas" && (
          <VendasModulo usuarioId={usuarioId} dataHoje={dataHoje} />
        )}
        {abaAtiva === "cadastro" && (
          <CadastroModulo usuarioId={usuarioId} isAdmin={isAdmin} dataHoje={dataHoje} />
        )}
        {abaAtiva === "estoque" && (
          <EstoqueModulo usuarioId={usuarioId} />
        )}
        {abaAtiva === "compras" && (
          <ComprasModulo usuarioId={usuarioId} dataHoje={dataHoje} />
        )}
        {abaAtiva === "financeiro" && (
          <FinanceiroModulo usuarioId={usuarioId} dataHoje={dataHoje} />
        )}
        {abaAtiva === "usuarios" && isAdmin && (
          <UsuariosModulo usuarioId={usuarioId} />
        )}
      </div>
    </div>
  );
}

// ─── Visão Geral ─────────────────────────────────────────────────────────────

function VisaoGeral({ usuarioId }: { usuarioId: string }) {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const [{ data: v }, { data: d }, { data: p }] = await Promise.all([
        supabase
          .from("vendas")
          .select("*")
          .eq("criado_por", usuarioId)
          .order("data", { ascending: false })
          .limit(200),
        supabase
          .from("despesas")
          .select("*")
          .eq("criado_por", usuarioId)
          .order("data", { ascending: false })
          .limit(200),
        supabase
          .from("produtos")
          .select("*")
          .eq("criado_por", usuarioId)
          .eq("ativo", true),
      ]);
      if (ativo) {
        setVendas((v ?? []).map(mapVenda));
        setDespesas((d ?? []).map(mapDespesa));
        setProdutos((p ?? []).map(mapProduto));
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  if (carregando) {
    return <EstadoCarregando texto="Carregando indicadores..." />;
  }

  const receitaBruta = vendas.reduce(
    (s, v) => s + v.valorUnitario * v.quantidade - v.desconto,
    0
  );
  const taxasMarketplace = vendas.reduce(
    (s, v) => s + v.taxaMarketplace,
    0
  );
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0);
  const custoProdutosVendidos = vendas.reduce((s, v) => {
    const produto = produtos.find((p) => p.id === v.produtoId);
    return s + (produto?.custo ?? 0) * v.quantidade;
  }, 0);
  const lucroBruto = receitaBruta - taxasMarketplace - custoProdutosVendidos;
  const lucroLiquido = lucroBruto - totalDespesas;
  const margem = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

  const produtosAbaixoMinimo = produtos.filter(
    (p) => p.estoqueAtual <= p.estoqueMinimo
  );

  const vendasPorMarketplace = MARKETPLACES.map((mp) => {
    const total = vendas
      .filter((v) => v.marketplace === mp)
      .reduce((s, v) => s + v.valorUnitario * v.quantidade - v.desconto, 0);
    return { name: mp, value: total };
  }).filter((x) => x.value > 0);

  const ultimos6Meses = obterUltimosMeses(6);
  const vendasPorMes = ultimos6Meses.map((mes) => ({
    name: mes.label,
    Receita: vendas
      .filter((v) => v.data.startsWith(mes.prefixo))
      .reduce((s, v) => s + v.valorUnitario * v.quantidade - v.desconto, 0),
    Despesas: despesas
      .filter((d) => d.data.startsWith(mes.prefixo))
      .reduce((s, d) => s + d.valor, 0),
  }));

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
        <SectionHeader
          tag="Resumo"
          titulo="Indicadores do período"
          descricao="Consolidado de vendas, custos e resultado estimado."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard titulo="Receita bruta" valor={formatarMoeda(receitaBruta)} />
          <KpiCard titulo="Lucro bruto" valor={formatarMoeda(lucroBruto)} destaque />
          <KpiCard titulo="Lucro líquido" valor={formatarMoeda(lucroLiquido)} destaque />
          <KpiCard titulo="Margem líquida" valor={`${margem.toFixed(1)}%`} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <KpiCard titulo="Taxas marketplace" valor={formatarMoeda(taxasMarketplace)} alerta />
          <KpiCard titulo="Custo produtos" valor={formatarMoeda(custoProdutosVendidos)} alerta />
          <KpiCard titulo="Despesas operacionais" valor={formatarMoeda(totalDespesas)} alerta />
        </div>
      </div>

      {produtosAbaixoMinimo.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-800">
            {produtosAbaixoMinimo.length} produto{produtosAbaixoMinimo.length === 1 ? "" : "s"} abaixo do estoque mínimo
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {produtosAbaixoMinimo.map((p) => (
              <span
                key={p.id}
                className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-700"
              >
                {p.nome} ({p.estoqueAtual}/{p.estoqueMinimo})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1565c0]">Evolução mensal</p>
          <h3 className="mt-1 text-lg font-bold">Receita vs Despesas</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={vendasPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3f0ff" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Line type="monotone" dataKey="Receita" stroke="#1565c0" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Despesas" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1565c0]">Canais de venda</p>
          <h3 className="mt-1 text-lg font-bold">Receita por marketplace</h3>
          {vendasPorMarketplace.length > 0 ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vendasPorMarketplace}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {vendasPorMarketplace.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 py-12 text-center text-sm text-[#455a80]">
              Nenhuma venda registrada ainda.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Vendas ──────────────────────────────────────────────────────────────────

function VendasModulo({
  usuarioId,
  dataHoje,
}: {
  usuarioId: string;
  dataHoje: string;
}) {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({
    data: dataHoje,
    marketplace: "" as Marketplace | "",
    produtoId: "",
    quantidade: "1",
    valorUnitario: "",
    taxaMarketplace: "0",
    desconto: "0",
    observacao: "",
  });

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const [{ data: v }, { data: p }] = await Promise.all([
        supabase
          .from("vendas")
          .select("*")
          .eq("criado_por", usuarioId)
          .order("data", { ascending: false }),
        supabase
          .from("produtos")
          .select("*")
          .eq("criado_por", usuarioId)
          .eq("ativo", true)
          .order("nome"),
      ]);
      if (ativo) {
        setVendas((v ?? []).map(mapVenda));
        setProdutos((p ?? []).map(mapProduto));
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  function preencherPrecoProduto(produtoId: string) {
    const produto = produtos.find((p) => p.id === produtoId);
    if (produto) {
      setForm((f) => ({
        ...f,
        produtoId,
        valorUnitario: String(produto.precoVenda).replace(".", ","),
      }));
    } else {
      setForm((f) => ({ ...f, produtoId }));
    }
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    setErro("");

    if (!form.data || !form.marketplace || !form.produtoId) {
      setErro("Preencha data, marketplace e produto.");
      return;
    }

    if (parseNumero(form.quantidade) <= 0 || parseNumero(form.valorUnitario) <= 0) {
      setErro("Quantidade e valor unitário devem ser maiores que zero.");
      return;
    }

    const produto = produtos.find((p) => p.id === form.produtoId);
    setSalvando(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("vendas")
      .insert({
        criado_por: usuarioId,
        data: form.data,
        marketplace: form.marketplace,
        produto_id: form.produtoId,
        produto_nome: produto?.nome ?? "",
        quantidade: parseNumero(form.quantidade),
        valor_unitario: parseNumero(form.valorUnitario),
        taxa_marketplace: parseNumero(form.taxaMarketplace),
        desconto: parseNumero(form.desconto),
        observacao: form.observacao.trim(),
      })
      .select()
      .single();

    setSalvando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    if (data) {
      setVendas((prev) => [mapVenda(data), ...prev]);
    }

    setForm({
      data: dataHoje,
      marketplace: "",
      produtoId: "",
      quantidade: "1",
      valorUnitario: "",
      taxaMarketplace: "0",
      desconto: "0",
      observacao: "",
    });
    setMensagem("Venda registrada com sucesso.");
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir esta venda?")) return;

    const supabase = createClient();
    const { error } = await supabase.from("vendas").delete().eq("id", id).eq("criado_por", usuarioId);

    if (error) {
      setErro(error.message);
      return;
    }

    setVendas((prev) => prev.filter((v) => v.id !== id));
    setMensagem("Venda removida.");
  }

  const vendasFiltradas = vendas.filter((v) => {
    const q = termoBusca.toLowerCase();
    return (
      !q ||
      v.produtoNome.toLowerCase().includes(q) ||
      v.marketplace.toLowerCase().includes(q) ||
      v.data.includes(q)
    );
  });

  const totalReceita = vendas.reduce(
    (s, v) => s + v.valorUnitario * v.quantidade - v.desconto,
    0
  );
  const totalItens = vendas.reduce((s, v) => s + v.quantidade, 0);

  return (
    <section className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
      <SectionHeader
        tag="Vendas"
        titulo="Registro de vendas"
        descricao="Cadastre vendas por marketplace e acompanhe o faturamento consolidado."
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <KpiCard titulo="Vendas registradas" valor={String(vendas.length)} />
        <KpiCard titulo="Itens vendidos" valor={String(totalItens)} />
        <KpiCard titulo="Receita total" valor={formatarMoeda(totalReceita)} destaque />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          onSubmit={handleSalvar}
          className="rounded-3xl border border-[#90caf9] bg-[#f0f7ff] p-5"
        >
          <p className="text-sm font-semibold text-[#1565c0]">Nova venda</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoCadastro
              label="Data"
              type="date"
              value={form.data}
              onChange={(v) => setForm((f) => ({ ...f, data: v }))}
              required
            />
            <SelectCadastro
              label="Marketplace"
              value={form.marketplace}
              onChange={(v) => setForm((f) => ({ ...f, marketplace: v as Marketplace }))}
              options={MARKETPLACES}
              placeholder="Selecione..."
            />
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Produto</label>
              <select
                value={form.produtoId}
                onChange={(e) => preencherPrecoProduto(e.target.value)}
                className="w-full rounded-2xl border border-[#90caf9] bg-white px-4 py-3 text-sm text-[#0d1b2a] outline-none focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
              >
                <option value="">Selecione um produto...</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo ? `[${p.codigo}] ` : ""}{p.nome}
                  </option>
                ))}
              </select>
            </div>
            <CampoCadastro
              label="Quantidade"
              value={form.quantidade}
              onChange={(v) => setForm((f) => ({ ...f, quantidade: v }))}
              placeholder="1"
              required
            />
            <CampoCadastro
              label="Valor unitário"
              value={form.valorUnitario}
              onChange={(v) => setForm((f) => ({ ...f, valorUnitario: v }))}
              placeholder="0,00"
              required
            />
            <CampoCadastro
              label="Taxa marketplace"
              value={form.taxaMarketplace}
              onChange={(v) => setForm((f) => ({ ...f, taxaMarketplace: v }))}
              placeholder="0,00"
            />
            <CampoCadastro
              label="Desconto"
              value={form.desconto}
              onChange={(v) => setForm((f) => ({ ...f, desconto: v }))}
              placeholder="0,00"
            />
            <div className="sm:col-span-2">
              <CampoCadastro
                label="Observação"
                value={form.observacao}
                onChange={(v) => setForm((f) => ({ ...f, observacao: v }))}
                placeholder="Pedido, campanha ou detalhe"
              />
            </div>
          </div>

          <FeedbackBloco mensagem={mensagem} erro={erro} />

          <button
            type="submit"
            disabled={salvando || carregando}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#1565c0] px-4 text-sm font-semibold text-white transition hover:bg-[#0d47a1] disabled:opacity-60 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {salvando ? "Salvando..." : "Registrar venda"}
          </button>
        </form>

        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1565c0]">Histórico</p>
              <h3 className="mt-1 text-xl font-bold">Vendas registradas</h3>
            </div>
            <div className="relative sm:min-w-64">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90aac8]" />
              <input
                type="search"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="h-11 w-full rounded-2xl border border-[#90caf9] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
                placeholder="Buscar venda"
              />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-[#90caf9]">
            {vendasFiltradas.length > 0 ? (
              <div className="max-h-[480px] overflow-auto">
                <table className="min-w-[700px] w-full bg-white text-left text-sm">
                  <thead className="sticky top-0 bg-[#f0f7ff] text-[#1565c0]">
                    <tr>
                      <Th>Data</Th>
                      <Th>Marketplace</Th>
                      <Th>Produto</Th>
                      <Th>Qtd</Th>
                      <Th>Total</Th>
                      <Th>Ações</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasFiltradas.map((v) => {
                      const total =
                        v.valorUnitario * v.quantidade - v.desconto;
                      return (
                        <tr
                          key={v.id}
                          className="border-t border-[#e3f0ff]"
                        >
                          <Td>{formatarData(v.data)}</Td>
                          <Td>
                            <MarketplaceBadge marketplace={v.marketplace} />
                          </Td>
                          <Td className="font-semibold">{v.produtoNome || "-"}</Td>
                          <Td>{v.quantidade}</Td>
                          <Td>{formatarMoeda(total)}</Td>
                          <Td>
                            <button
                              type="button"
                              onClick={() => handleExcluir(v.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EstadoTabelaVazia texto="Nenhuma venda registrada." />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Cadastro ─────────────────────────────────────────────────────────────────

function CadastroModulo({
  usuarioId,
  isAdmin,
  dataHoje,
}: {
  usuarioId: string;
  isAdmin: boolean;
  dataHoje: string;
}) {
  type AbaC = "produtos" | "materias-primas" | "clientes" | "fornecedores";
  const [aba, setAba] = useState<AbaC>("produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const [{ data: p }, { data: mp }, { data: cl }, { data: fo }] = await Promise.all([
        supabase.from("produtos").select("*").eq("criado_por", usuarioId).order("nome"),
        supabase.from("materias_primas").select("*").eq("criado_por", usuarioId).eq("ativo", true).order("nome"),
        supabase.from("clientes").select("*").eq("criado_por", usuarioId).order("nome"),
        supabase.from("fornecedores").select("*").eq("criado_por", usuarioId).order("nome"),
      ]);
      if (ativo) {
        setProdutos((p ?? []).map(mapProduto));
        setMateriasPrimas((mp ?? []).map(mapMateriaPrima));
        setClientes((cl ?? []).map(mapCliente));
        setFornecedores((fo ?? []).map(mapFornecedor));
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  if (carregando) return <EstadoCarregando texto="Carregando cadastros..." />;

  const ABAS_C: { id: AbaC; label: string }[] = [
    { id: "produtos", label: "Produtos" },
    { id: "materias-primas", label: "Matérias-primas" },
    { id: "clientes", label: "Clientes" },
    { id: "fornecedores", label: "Fornecedores" },
  ];

  return (
    <section className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          tag="Cadastro"
          titulo="Cadastros do sistema"
          descricao="Produtos, matérias-primas, clientes e fornecedores."
        />
        <div className="flex flex-wrap gap-2 rounded-3xl border border-[#90caf9] bg-[#f0f7ff] p-2 shrink-0">
          {ABAS_C.map((t) => (
            <button key={t.id} type="button" onClick={() => setAba(t.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                aba === t.id ? "bg-[#1565c0] text-white" : "text-[#1565c0] hover:bg-[#e3f0ff]"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {aba === "produtos" && (
        <ProdutosSubModulo usuarioId={usuarioId} isAdmin={isAdmin} produtos={produtos} setProdutos={setProdutos} materiasPrimas={materiasPrimas} />
      )}
      {aba === "materias-primas" && (
        <MateriasPrimasSubModulo usuarioId={usuarioId} isAdmin={isAdmin} materiasPrimas={materiasPrimas} setMateriasPrimas={setMateriasPrimas}
          mensagem="" setMensagem={() => {}} erro="" setErro={() => {}} />
      )}
      {aba === "clientes" && (
        <ClientesSubModulo usuarioId={usuarioId} isAdmin={isAdmin} clientes={clientes} setClientes={setClientes} />
      )}
      {aba === "fornecedores" && (
        <FornecedoresSubModulo usuarioId={usuarioId} isAdmin={isAdmin} fornecedores={fornecedores} setFornecedores={setFornecedores} />
      )}
    </section>
  );
}

// ─── Produtos sub-módulo ──────────────────────────────────────────────────────

type CompRascunho = { tempId: string; materiaPrimaId: string; nomePeca: string; quantidade: number; linkCompra: string };

function ProdutosSubModulo({
  usuarioId,
  isAdmin,
  produtos,
  setProdutos,
  materiasPrimas,
}: {
  usuarioId: string;
  isAdmin: boolean;
  produtos: Produto[];
  setProdutos: React.Dispatch<React.SetStateAction<Produto[]>>;
  materiasPrimas: MateriaPrima[];
}) {
  const [salvando, setSalvando] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [form, setForm] = useState(() => ({ codigo: proximoCodigo(produtos, "EK-"), nome: "", categoria: "", ativo: true }));
  const [compRascunho, setCompRascunho] = useState<CompRascunho[]>([]);

  useEffect(() => {
    if (!editandoId) {
      setForm((f) => ({ ...f, codigo: proximoCodigo(produtos, "EK-") }));
    }
  }, [produtos, editandoId]);
  const [compEdicao, setCompEdicao] = useState<ComponenteProduto[]>([]);
  const [carregandoComp, setCarregandoComp] = useState(false);
  const [salvandoComp, setSalvandoComp] = useState(false);
  const [formComp, setFormComp] = useState({ materiaPrimaId: "", nomePeca: "", quantidade: "1", linkCompra: "" });

  function selecionarMP(mpId: string) {
    const mp = materiasPrimas.find((m) => m.id === mpId);
    setFormComp(mp
      ? { materiaPrimaId: mpId, nomePeca: mp.nome, quantidade: "1", linkCompra: mp.linkCompra }
      : { materiaPrimaId: "", nomePeca: "", quantidade: "1", linkCompra: "" }
    );
  }

  function adicionarCompRascunho() {
    if (!formComp.nomePeca) { setErro("Selecione uma matéria-prima."); return; }
    setErro("");
    setCompRascunho((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), ...formComp, quantidade: parseNumero(formComp.quantidade) || 1 },
    ]);
    setFormComp({ materiaPrimaId: "", nomePeca: "", quantidade: "1", linkCompra: "" });
  }

  async function adicionarCompEdicao(produtoId: string) {
    if (!formComp.nomePeca) { setErro("Selecione uma matéria-prima."); return; }
    setSalvandoComp(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("componentes_produto").insert({
      produto_id: produtoId,
      criado_por: usuarioId,
      materia_prima_id: formComp.materiaPrimaId || null,
      nome_peca: formComp.nomePeca.trim(),
      quantidade: parseNumero(formComp.quantidade) || 1,
      link_compra: formComp.linkCompra.trim(),
    }).select().single();
    setSalvandoComp(false);
    if (error) { setErro(error.message); return; }
    if (data) setCompEdicao((prev) => [...prev, mapComponente(data)]);
    setFormComp({ materiaPrimaId: "", nomePeca: "", quantidade: "1", linkCompra: "" });
  }

  async function removerCompEdicao(compId: string) {
    if (!confirm("Remover este componente?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("componentes_produto").delete().eq("id", compId);
    if (error) { setErro(error.message); return; }
    setCompEdicao((prev) => prev.filter((c) => c.id !== compId));
  }

  function limparForm() {
    setForm({ codigo: proximoCodigo(produtos, "EK-"), nome: "", categoria: "", ativo: true });
    setCompRascunho([]); setCompEdicao([]);
    setEditandoId(null); setMensagem(""); setErro("");
  }

  async function iniciarEdicao(produto: Produto) {
    setForm({ codigo: produto.codigo, nome: produto.nome, categoria: produto.categoria, ativo: produto.ativo });
    setCompRascunho([]);
    setEditandoId(produto.id);
    setCarregandoComp(true);
    const supabase = createClient();
    const { data } = await supabase.from("componentes_produto").select("*").eq("produto_id", produto.id).order("created_at");
    setCompEdicao((data ?? []).map(mapComponente));
    setCarregandoComp(false);
    setFormComp({ materiaPrimaId: "", nomePeca: "", quantidade: "1", linkCompra: "" });
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(""); setErro("");
    if (!form.nome.trim()) { setErro("Informe o nome do produto."); return; }
    if (form.codigo.trim()) {
      const cod = form.codigo.trim().toLowerCase();
      const duplicado = produtos.some((p) => p.codigo.trim().toLowerCase() === cod && p.id !== editandoId);
      if (duplicado) { setErro("Este código já está em uso por outro produto."); return; }
    }
    setSalvando(true);
    const supabase = createClient();
    const payload = { criado_por: usuarioId, codigo: form.codigo.trim(), nome: form.nome.trim(), categoria: form.categoria.trim(), ativo: form.ativo };
    if (editandoId) {
      const { error } = await supabase.from("produtos").update(payload).eq("id", editandoId);
      setSalvando(false);
      if (error) { setErro(error.message); return; }
      setProdutos((prev) => prev.map((p) => p.id === editandoId ? { ...p, ...{ codigo: payload.codigo, nome: payload.nome, categoria: payload.categoria, ativo: payload.ativo } } : p));
      setMensagem("Produto atualizado."); limparForm();
    } else {
      const { data, error } = await supabase.from("produtos").insert(payload).select().single();
      if (error) { setSalvando(false); setErro(error.message); return; }
      if (compRascunho.length > 0) {
        await supabase.from("componentes_produto").insert(
          compRascunho.map((c) => ({ produto_id: data.id, criado_por: usuarioId, materia_prima_id: c.materiaPrimaId || null, nome_peca: c.nomePeca, quantidade: c.quantidade, link_compra: c.linkCompra }))
        );
      }
      setSalvando(false);
      setProdutos((prev) => [mapProduto(data), ...prev]);
      setMensagem(`Produto cadastrado com ${compRascunho.length} componente(s).`); limparForm();
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir este produto e seus componentes?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("produtos").delete().eq("id", id).eq("criado_por", usuarioId);
    if (error) { setErro(error.message); return; }
    setProdutos((prev) => prev.filter((p) => p.id !== id));
    if (editandoId === id) limparForm();
    setMensagem("Produto removido.");
  }

  const produtosFiltrados = produtos.filter((p) => {
    const q = termoBusca.toLowerCase();
    return !q || p.nome.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q);
  });

  const componentesAtivos = editandoId ? compEdicao : compRascunho;

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form onSubmit={handleSalvar} className="rounded-3xl border border-[#90caf9] bg-[#f0f7ff] p-5 self-start">
        <p className="text-sm font-semibold text-[#1565c0]">{editandoId ? "Editando produto" : "Novo produto"}</p>
        <FeedbackBloco mensagem={mensagem} erro={erro} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Código (SKU)</label>
            <div className="flex h-[46px] items-center gap-2 rounded-2xl border border-[#90caf9] bg-[#e3f0ff] px-4 text-sm font-semibold text-[#1565c0] select-none">
              <span>{form.codigo}</span>
              <span className="ml-auto text-xs font-normal text-[#90aac8]">automático</span>
            </div>
          </div>
          <CampoCadastro label="Nome" value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome do produto" required />
          <div className="sm:col-span-2">
            <CampoCadastro label="Categoria" value={form.categoria} onChange={(v) => setForm((f) => ({ ...f, categoria: v }))} placeholder="Ex: Patins, Estrutura..." />
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-[#90caf9] bg-white px-4 py-3 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded border-[#90caf9] accent-[#1565c0]" />
            <span className="font-semibold">Ativo</span>
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-[#90caf9] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-[#1565c0]">Matérias-primas do produto</p>
          {carregandoComp ? (
            <p className="py-2 text-xs text-[#455a80]">Carregando componentes...</p>
          ) : (
            <>
              {componentesAtivos.length > 0 && (
                <div className="mb-3 overflow-hidden rounded-xl border border-[#e3f0ff]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#f0f7ff] text-[#1565c0]">
                      <tr><Th>Matéria-prima</Th><Th>Qtd</Th>{editandoId && <Th>Link</Th>}<Th>{" "}</Th></tr>
                    </thead>
                    <tbody>
                      {editandoId
                        ? compEdicao.map((c) => (
                            <tr key={c.id} className="border-t border-[#e3f0ff]">
                              <Td className="font-semibold">{c.nomePeca}</Td>
                              <Td>{c.quantidade}</Td>
                              <Td>{c.linkCompra ? <a href={c.linkCompra} target="_blank" rel="noopener noreferrer" className="text-[#1565c0] underline">ver</a> : <span className="text-[#90aac8]">—</span>}</Td>
                              <Td><button type="button" onClick={() => removerCompEdicao(c.id)} className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50"><X className="h-3 w-3" /></button></Td>
                            </tr>
                          ))
                        : compRascunho.map((c) => (
                            <tr key={c.tempId} className="border-t border-[#e3f0ff]">
                              <Td className="font-semibold">{c.nomePeca}</Td>
                              <Td>{c.quantidade}</Td>
                              <Td><button type="button" onClick={() => setCompRascunho((prev) => prev.filter((x) => x.tempId !== c.tempId))} className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50"><X className="h-3 w-3" /></button></Td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-[1fr_80px_auto]">
                <select value={formComp.materiaPrimaId}
                  onChange={(e) => selecionarMP(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  className="h-10 rounded-xl border border-[#90caf9] bg-white px-3 text-sm outline-none focus:border-[#1565c0]">
                  <option value="">Selecionar matéria-prima...</option>
                  {materiasPrimas.map((mp) => (
                    <option key={mp.id} value={mp.id}>{mp.codigo ? `[${mp.codigo}] ` : ""}{mp.nome}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={formComp.quantidade}
                  onChange={(e) => setFormComp((f) => ({ ...f, quantidade: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (formComp.nomePeca && !salvandoComp) {
                        editandoId ? adicionarCompEdicao(editandoId) : adicionarCompRascunho();
                      }
                    }
                  }}
                  placeholder="Qtd"
                  className="h-10 rounded-xl border border-[#90caf9] bg-white px-3 text-sm outline-none focus:border-[#1565c0]"
                />
                <button type="button"
                  onClick={editandoId ? () => adicionarCompEdicao(editandoId) : adicionarCompRascunho}
                  disabled={salvandoComp}
                  className="inline-flex h-10 items-center gap-1 rounded-xl bg-[#1565c0] px-3 text-xs font-semibold text-white disabled:opacity-50">
                  <Plus className="h-3.5 w-3.5" />{salvandoComp ? "..." : "Adicionar"}
                </button>
              </div>
              {materiasPrimas.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">Cadastre matérias-primas na aba <strong>Matérias-primas</strong> primeiro.</p>
              )}
            </>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={salvando}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#1565c0] px-4 text-sm font-semibold text-white transition hover:bg-[#0d47a1] disabled:opacity-60">
            <Save className="h-4 w-4" />{salvando ? "Salvando..." : editandoId ? "Atualizar" : "Cadastrar produto"}
          </button>
          {editandoId && (
            <button type="button" onClick={limparForm}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#90caf9] bg-white px-4 text-sm font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </form>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold">{produtos.length} produto(s)</h3>
          <div className="relative sm:min-w-56">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90aac8]" />
            <input type="search" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)}
              className="h-11 w-full rounded-2xl border border-[#90caf9] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
              placeholder="Buscar produto" />
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#90caf9]">
          {produtosFiltrados.length > 0 ? (
            <div className="max-h-[600px] overflow-auto">
              <table className="min-w-[420px] w-full bg-white text-left text-sm">
                <thead className="sticky top-0 bg-[#f0f7ff] text-[#1565c0]">
                  <tr><Th>Código</Th><Th>Nome</Th><Th>Categoria</Th><Th>Ativo</Th><Th>Ações</Th></tr>
                </thead>
                <tbody>
                  {produtosFiltrados.map((p) => (
                    <tr key={p.id} className={`border-t border-[#e3f0ff] ${editandoId === p.id ? "bg-[#e3f0ff]" : ""}`}>
                      <Td className="text-xs text-[#455a80]">{p.codigo || "-"}</Td>
                      <Td className="font-semibold">{p.nome}</Td>
                      <Td>{p.categoria || "-"}</Td>
                      <Td><span className={`text-xs font-semibold ${p.ativo ? "text-green-600" : "text-[#90aac8]"}`}>{p.ativo ? "Sim" : "Não"}</span></Td>
                      <Td>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => iniciarEdicao(p)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#90caf9] bg-white px-2 text-xs font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]">
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={() => handleExcluir(p.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-200 bg-white px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EstadoTabelaVazia texto="Nenhum produto cadastrado." />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Matérias-primas ──────────────────────────────────────────────────────────

function MateriasPrimasSubModulo({
  usuarioId,
  materiasPrimas,
  setMateriasPrimas,
  isAdmin,
  mensagem,
  setMensagem,
  erro,
  setErro,
}: {
  usuarioId: string;
  materiasPrimas: MateriaPrima[];
  setMateriasPrimas: React.Dispatch<React.SetStateAction<MateriaPrima[]>>;
  isAdmin: boolean;
  mensagem: string;
  setMensagem: (v: string) => void;
  erro: string;
  setErro: (v: string) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState("");
  const [form, setForm] = useState(() => ({
    codigo: proximoCodigo(materiasPrimas, "MP-"), nome: "", unidade: "un", linkCompra: "", ativo: true,
  }));

  useEffect(() => {
    if (!editandoId) {
      setForm((f) => ({ ...f, codigo: proximoCodigo(materiasPrimas, "MP-") }));
    }
  }, [materiasPrimas, editandoId]);

  function limparForm() {
    setForm({ codigo: proximoCodigo(materiasPrimas, "MP-"), nome: "", unidade: "un", linkCompra: "", ativo: true });
    setEditandoId(null);
  }

  function iniciarEdicao(mp: MateriaPrima) {
    setForm({
      codigo: mp.codigo,
      nome: mp.nome,
      unidade: mp.unidade,
      linkCompra: mp.linkCompra,
      ativo: mp.ativo,
    });
    setEditandoId(mp.id);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(""); setErro("");
    if (!form.nome.trim()) { setErro("Informe o nome da matéria-prima."); return; }
    if (form.codigo.trim()) {
      const cod = form.codigo.trim().toLowerCase();
      const duplicado = materiasPrimas.some((m) => m.codigo.trim().toLowerCase() === cod && m.id !== editandoId);
      if (duplicado) { setErro("Este código já está em uso por outra matéria-prima."); return; }
    }
    setSalvando(true);
    const supabase = createClient();
    const payload = {
      criado_por: usuarioId,
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      unidade: form.unidade.trim() || "un",
      link_compra: form.linkCompra.trim(),
      ativo: form.ativo,
    };
    if (editandoId) {
      const { error } = await supabase.from("materias_primas").update(payload).eq("id", editandoId);
      setSalvando(false);
      if (error) { setErro(error.message); return; }
      setMateriasPrimas((prev) => prev.map((m) =>
        m.id === editandoId
          ? { ...m, ...{ codigo: payload.codigo, nome: payload.nome, unidade: payload.unidade, linkCompra: payload.link_compra, ativo: payload.ativo } }
          : m
      ));
      setMensagem("Matéria-prima atualizada.");
    } else {
      const { data, error } = await supabase.from("materias_primas").insert(payload).select().single();
      setSalvando(false);
      if (error) { setErro(error.message); return; }
      if (data) setMateriasPrimas((prev) => [...prev, mapMateriaPrima(data)]);
      setMensagem("Matéria-prima cadastrada.");
    }
    limparForm();
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir esta matéria-prima?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("materias_primas").delete().eq("id", id).eq("criado_por", usuarioId);
    if (error) { setErro(error.message); return; }
    setMateriasPrimas((prev) => prev.filter((m) => m.id !== id));
    setMensagem("Matéria-prima removida.");
  }

  const filtradas = materiasPrimas.filter((m) => {
    const q = termoBusca.toLowerCase();
    return !q || m.nome.toLowerCase().includes(q) || m.codigo.toLowerCase().includes(q);
  });

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <form onSubmit={handleSalvar} className="rounded-3xl border border-[#90caf9] bg-[#f0f7ff] p-5">
        <p className="text-sm font-semibold text-[#1565c0]">
          {editandoId ? "Editando matéria-prima" : "Nova matéria-prima"}
        </p>
        <FeedbackBloco mensagem={mensagem} erro={erro} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Código</label>
            <div className="flex h-[46px] items-center gap-2 rounded-2xl border border-[#90caf9] bg-[#e3f0ff] px-4 text-sm font-semibold text-[#1565c0] select-none">
              <span>{form.codigo}</span>
              <span className="ml-auto text-xs font-normal text-[#90aac8]">automático</span>
            </div>
          </div>
          <CampoCadastro label="Nome" value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome da matéria-prima" required />
          <CampoCadastro label="Unidade" value={form.unidade} onChange={(v) => setForm((f) => ({ ...f, unidade: v }))} placeholder="un, kg, m..." />
          <div className="sm:col-span-2">
            <CampoCadastro label="Link de compra (e-commerce)" value={form.linkCompra} onChange={(v) => setForm((f) => ({ ...f, linkCompra: v }))} placeholder="https://..." />
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-[#90caf9] bg-white px-4 py-3 text-sm">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded border-[#90caf9] accent-[#1565c0]" />
            <span className="font-semibold">Ativo</span>
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={salvando}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#1565c0] px-4 text-sm font-semibold text-white transition hover:bg-[#0d47a1] disabled:opacity-60">
            <Save className="h-4 w-4" />
            {salvando ? "Salvando..." : editandoId ? "Atualizar" : "Cadastrar"}
          </button>
          {editandoId && (
            <button type="button" onClick={limparForm}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#90caf9] bg-white px-4 text-sm font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </form>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold">Catálogo</h3>
          <div className="relative sm:min-w-64">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90aac8]" />
            <input type="search" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)}
              className="h-11 w-full rounded-2xl border border-[#90caf9] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
              placeholder="Buscar" />
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#90caf9]">
          {filtradas.length > 0 ? (
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-[580px] w-full bg-white text-left text-sm">
                <thead className="sticky top-0 bg-[#f0f7ff] text-[#1565c0]">
                  <tr>
                    <Th>Código</Th>
                    <Th>Nome</Th>
                    <Th>Unidade</Th>
                    <Th>Link</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((m) => (
                    <tr key={m.id} className="border-t border-[#e3f0ff]">
                      <Td className="text-xs text-[#455a80]">{m.codigo || "-"}</Td>
                      <Td className="font-semibold">{m.nome}</Td>
                      <Td>{m.unidade}</Td>
                      <Td>
                        {m.linkCompra ? (
                          <a href={m.linkCompra} target="_blank" rel="noopener noreferrer"
                            className="text-[#1565c0] underline text-xs">Ver</a>
                        ) : <span className="text-[#90aac8]">—</span>}
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => iniciarEdicao(m)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#90caf9] bg-white px-2 text-xs font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={() => handleExcluir(m.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-200 bg-white px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EstadoTabelaVazia texto="Nenhuma matéria-prima cadastrada." />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Clientes sub-módulo ─────────────────────────────────────────────────────

function ClientesSubModulo({
  usuarioId,
  isAdmin,
  clientes,
  setClientes,
}: {
  usuarioId: string;
  isAdmin: boolean;
  clientes: Cliente[];
  setClientes: React.Dispatch<React.SetStateAction<Cliente[]>>;
}) {
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [termoBusca, setTermoBusca] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ nome: "", contato: "", email: "", cidade: "", observacao: "" });

  function limpar() {
    setForm({ nome: "", contato: "", email: "", cidade: "", observacao: "" });
    setEditandoId(null); setMensagem(""); setErro("");
  }

  function iniciarEdicao(c: Cliente) {
    setForm({ nome: c.nome, contato: c.contato, email: c.email, cidade: c.cidade, observacao: c.observacao });
    setEditandoId(c.id);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(""); setErro("");
    if (!form.nome.trim()) { setErro("Informe o nome do cliente."); return; }
    setSalvando(true);
    const supabase = createClient();
    const payload = { criado_por: usuarioId, nome: form.nome.trim(), contato: form.contato.trim(), email: form.email.trim(), cidade: form.cidade.trim(), observacao: form.observacao.trim() };
    if (editandoId) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", editandoId);
      setSalvando(false);
      if (error) { setErro(error.message); return; }
      setClientes((prev) => prev.map((c) => c.id === editandoId ? { ...c, ...payload } : c));
      setMensagem("Cliente atualizado."); limpar();
    } else {
      const { data, error } = await supabase.from("clientes").insert(payload).select().single();
      setSalvando(false);
      if (error) { setErro(error.message); return; }
      if (data) setClientes((prev) => [...prev, mapCliente(data)].sort((a, b) => a.nome.localeCompare(b.nome)));
      setMensagem("Cliente cadastrado."); limpar();
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir este cliente?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("clientes").delete().eq("id", id).eq("criado_por", usuarioId);
    if (error) { setErro(error.message); return; }
    setClientes((prev) => prev.filter((c) => c.id !== id));
    if (editandoId === id) limpar();
    setMensagem("Cliente removido.");
  }

  const filtrados = clientes.filter((c) => {
    const q = termoBusca.toLowerCase();
    return !q || c.nome.toLowerCase().includes(q) || c.cidade.toLowerCase().includes(q);
  });

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <form onSubmit={handleSalvar} className="rounded-3xl border border-[#90caf9] bg-[#f0f7ff] p-5 self-start">
        <p className="text-sm font-semibold text-[#1565c0]">{editandoId ? "Editando cliente" : "Novo cliente"}</p>
        <FeedbackBloco mensagem={mensagem} erro={erro} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <CampoCadastro label="Nome" value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome do cliente" required />
          </div>
          <CampoCadastro label="Contato (WhatsApp)" value={form.contato} onChange={(v) => setForm((f) => ({ ...f, contato: v }))} placeholder="(11) 99999-9999" />
          <CampoCadastro label="E-mail" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="email@exemplo.com" />
          <CampoCadastro label="Cidade" value={form.cidade} onChange={(v) => setForm((f) => ({ ...f, cidade: v }))} placeholder="São Paulo" />
          <CampoCadastro label="Observação" value={form.observacao} onChange={(v) => setForm((f) => ({ ...f, observacao: v }))} placeholder="Canal de vendas, anotações..." />
        </div>
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={salvando}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#1565c0] px-4 text-sm font-semibold text-white transition hover:bg-[#0d47a1] disabled:opacity-60">
            <Save className="h-4 w-4" />{salvando ? "Salvando..." : editandoId ? "Atualizar" : "Cadastrar"}
          </button>
          {editandoId && (
            <button type="button" onClick={limpar}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#90caf9] bg-white px-4 text-sm font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </form>
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold">{clientes.length} cliente(s)</h3>
          <div className="relative sm:min-w-56">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90aac8]" />
            <input type="search" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)}
              className="h-11 w-full rounded-2xl border border-[#90caf9] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
              placeholder="Buscar" />
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#90caf9]">
          {filtrados.length > 0 ? (
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-[500px] w-full bg-white text-left text-sm">
                <thead className="sticky top-0 bg-[#f0f7ff] text-[#1565c0]">
                  <tr><Th>Nome</Th><Th>Contato</Th><Th>Cidade</Th><Th>Ações</Th></tr>
                </thead>
                <tbody>
                  {filtrados.map((c) => (
                    <tr key={c.id} className={`border-t border-[#e3f0ff] ${editandoId === c.id ? "bg-[#e3f0ff]" : ""}`}>
                      <Td className="font-semibold">{c.nome}</Td>
                      <Td>{c.contato || "-"}</Td>
                      <Td>{c.cidade || "-"}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => iniciarEdicao(c)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#90caf9] bg-white px-2 text-xs font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={() => handleExcluir(c.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-200 bg-white px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EstadoTabelaVazia texto="Nenhum cliente cadastrado." />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Fornecedores sub-módulo ──────────────────────────────────────────────────

function FornecedoresSubModulo({
  usuarioId,
  isAdmin,
  fornecedores,
  setFornecedores,
}: {
  usuarioId: string;
  isAdmin: boolean;
  fornecedores: Fornecedor[];
  setFornecedores: React.Dispatch<React.SetStateAction<Fornecedor[]>>;
}) {
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ nome: "", contato: "", observacao: "" });

  function limpar() { setForm({ nome: "", contato: "", observacao: "" }); setEditandoId(null); setMensagem(""); setErro(""); }

  function iniciarEdicao(f: Fornecedor) {
    setForm({ nome: f.nome, contato: f.contato, observacao: f.observacao });
    setEditandoId(f.id);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(""); setErro("");
    if (!form.nome.trim()) { setErro("Informe o nome do fornecedor."); return; }
    setSalvando(true);
    const supabase = createClient();
    const payload = { criado_por: usuarioId, nome: form.nome.trim(), contato: form.contato.trim(), observacao: form.observacao.trim() };
    if (editandoId) {
      const { error } = await supabase.from("fornecedores").update(payload).eq("id", editandoId);
      setSalvando(false);
      if (error) { setErro(error.message); return; }
      setFornecedores((prev) => prev.map((f) => f.id === editandoId ? { ...f, ...payload } : f));
      setMensagem("Fornecedor atualizado."); limpar();
    } else {
      const { data, error } = await supabase.from("fornecedores").insert(payload).select().single();
      setSalvando(false);
      if (error) { setErro(error.message); return; }
      if (data) setFornecedores((prev) => [...prev, mapFornecedor(data)].sort((a, b) => a.nome.localeCompare(b.nome)));
      setMensagem("Fornecedor cadastrado."); limpar();
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir este fornecedor?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("fornecedores").delete().eq("id", id).eq("criado_por", usuarioId);
    if (error) { setErro(error.message); return; }
    setFornecedores((prev) => prev.filter((f) => f.id !== id));
    if (editandoId === id) limpar();
    setMensagem("Fornecedor removido.");
  }

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <form onSubmit={handleSalvar} className="rounded-3xl border border-[#90caf9] bg-[#f0f7ff] p-5 self-start">
        <p className="text-sm font-semibold text-[#1565c0]">{editandoId ? "Editando fornecedor" : "Novo fornecedor"}</p>
        <FeedbackBloco mensagem={mensagem} erro={erro} />
        <div className="mt-4 grid gap-4">
          <CampoCadastro label="Nome / Razão social" value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome do fornecedor" required />
          <CampoCadastro label="Contato" value={form.contato} onChange={(v) => setForm((f) => ({ ...f, contato: v }))} placeholder="Telefone, e-mail..." />
          <CampoCadastro label="Observação" value={form.observacao} onChange={(v) => setForm((f) => ({ ...f, observacao: v }))} placeholder="Prazo, condições..." />
        </div>
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={salvando}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#1565c0] px-4 text-sm font-semibold text-white transition hover:bg-[#0d47a1] disabled:opacity-60">
            <Save className="h-4 w-4" />{salvando ? "Salvando..." : editandoId ? "Atualizar" : "Cadastrar"}
          </button>
          {editandoId && (
            <button type="button" onClick={limpar}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#90caf9] bg-white px-4 text-sm font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </form>
      <div>
        <h3 className="text-xl font-bold">{fornecedores.length} fornecedor(es)</h3>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#90caf9]">
          {fornecedores.length > 0 ? (
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-[400px] w-full bg-white text-left text-sm">
                <thead className="sticky top-0 bg-[#f0f7ff] text-[#1565c0]">
                  <tr><Th>Nome</Th><Th>Contato</Th><Th>Observação</Th><Th>Ações</Th></tr>
                </thead>
                <tbody>
                  {fornecedores.map((f) => (
                    <tr key={f.id} className={`border-t border-[#e3f0ff] ${editandoId === f.id ? "bg-[#e3f0ff]" : ""}`}>
                      <Td className="font-semibold">{f.nome}</Td>
                      <Td>{f.contato || "-"}</Td>
                      <Td className="text-[#455a80]">{f.observacao || "-"}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => iniciarEdicao(f)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#90caf9] bg-white px-2 text-xs font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={() => handleExcluir(f.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-200 bg-white px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EstadoTabelaVazia texto="Nenhum fornecedor cadastrado." />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Estoque ──────────────────────────────────────────────────────────────────

function EstoqueModulo({ usuarioId }: { usuarioId: string }) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoSaldo, setNovoSaldo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [termoBusca, setTermoBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const { data } = await supabase
        .from("produtos")
        .select("*")
        .eq("criado_por", usuarioId)
        .eq("ativo", true)
        .order("nome");
      if (ativo) {
        setProdutos((data ?? []).map(mapProduto));
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  async function handleAtualizarSaldo(produtoId: string) {
    const saldo = parseNumero(novoSaldo);
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("produtos")
      .update({ estoque_atual: saldo })
      .eq("id", produtoId);
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setProdutos((prev) =>
      prev.map((p) => (p.id === produtoId ? { ...p, estoqueAtual: saldo } : p))
    );
    setEditandoId(null);
    setNovoSaldo("");
    setMensagem("Saldo atualizado.");
  }

  const produtosFiltrados = produtos.filter((p) => {
    const q = termoBusca.toLowerCase();
    return !q || p.nome.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
  });

  const abaixoMinimo = produtos.filter((p) => p.estoqueAtual <= p.estoqueMinimo);
  const custoTotal = produtos.reduce((s, p) => s + p.custo * p.estoqueAtual, 0);

  if (carregando) return <EstadoCarregando texto="Carregando estoque..." />;

  return (
    <section className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
      <SectionHeader
        tag="Estoque"
        titulo="Controle de inventário"
        descricao="Monitore o saldo de cada produto e atualize manualmente quando necessário."
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <KpiCard titulo="Produtos em estoque" valor={String(produtos.length)} />
        <KpiCard titulo="Abaixo do mínimo" valor={String(abaixoMinimo.length)} alerta={abaixoMinimo.length > 0} />
        <KpiCard titulo="Valor em estoque" valor={formatarMoeda(custoTotal)} destaque />
      </div>

      <FeedbackBloco mensagem={mensagem} erro={erro} className="mt-5" />

      <div className="mt-5 flex items-center gap-3">
        <div className="relative flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90aac8]" />
          <input
            type="search"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="h-11 w-full rounded-2xl border border-[#90caf9] bg-white pl-11 pr-4 text-sm outline-none focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
            placeholder="Buscar produto"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setCarregando(true);
            const supabase = createClient();
            supabase
              .from("produtos")
              .select("*")
              .eq("criado_por", usuarioId)
              .eq("ativo", true)
              .order("nome")
              .then(({ data }) => {
                setProdutos((data ?? []).map(mapProduto));
                setCarregando(false);
              });
          }}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#90caf9] bg-white px-4 text-sm font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-[#90caf9]">
        {produtosFiltrados.length > 0 ? (
          <div className="overflow-auto">
            <table className="min-w-[640px] w-full bg-white text-left text-sm">
              <thead className="bg-[#f0f7ff] text-[#1565c0]">
                <tr>
                  <Th>Código</Th>
                  <Th>Produto</Th>
                  <Th>Saldo atual</Th>
                  <Th>Mínimo</Th>
                  <Th>Custo unit.</Th>
                  <Th>Valor total</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((p) => {
                  const abaixo = p.estoqueAtual <= p.estoqueMinimo;
                  return (
                    <tr key={p.id} className={`border-t border-[#e3f0ff] ${abaixo ? "bg-red-50/40" : ""}`}>
                      <Td className="text-xs text-[#455a80]">{p.codigo || "-"}</Td>
                      <Td className="font-semibold">{p.nome}</Td>
                      <Td>
                        {editandoId === p.id ? (
                          <input
                            type="number"
                            value={novoSaldo}
                            onChange={(e) => setNovoSaldo(e.target.value)}
                            className="w-24 rounded-xl border border-[#90caf9] bg-white px-3 py-1.5 text-sm outline-none focus:border-[#1565c0]"
                            autoFocus
                          />
                        ) : (
                          <span className={`font-bold ${abaixo ? "text-red-600" : "text-[#1565c0]"}`}>
                            {p.estoqueAtual}
                          </span>
                        )}
                      </Td>
                      <Td>{p.estoqueMinimo}</Td>
                      <Td>{formatarMoeda(p.custo)}</Td>
                      <Td>{formatarMoeda(p.custo * p.estoqueAtual)}</Td>
                      <Td>
                        {editandoId === p.id ? (
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleAtualizarSaldo(p.id)}
                              disabled={salvando}
                              className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#1565c0] px-3 text-xs font-semibold text-white transition hover:bg-[#0d47a1] disabled:opacity-60"
                            >
                              <Save className="h-3.5 w-3.5" />
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setEditandoId(null); setNovoSaldo(""); }}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#90caf9] bg-white px-2 text-xs font-semibold text-[#455a80] transition hover:bg-[#e3f0ff]"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditandoId(p.id); setNovoSaldo(String(p.estoqueAtual)); }}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#90caf9] bg-white px-3 text-xs font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Ajustar
                          </button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EstadoTabelaVazia texto="Nenhum produto em estoque." />
        )}
      </div>
    </section>
  );
}

// ─── Compras ──────────────────────────────────────────────────────────────────

function ComprasModulo({
  usuarioId,
  dataHoje,
}: {
  usuarioId: string;
  dataHoje: string;
}) {
  const [pedidos, setPedidos] = useState<PedidoCompra[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<"pedidos" | "fabricacao">("pedidos");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [formPedido, setFormPedido] = useState({
    fornecedorId: "",
    data: dataHoje,
    status: "pendente" as PedidoCompra["status"],
    valorTotal: "",
    observacao: "",
  });


  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const [{ data: p }, { data: f }] = await Promise.all([
        supabase
          .from("pedidos_compra")
          .select("*, fornecedores(nome)")
          .eq("criado_por", usuarioId)
          .order("data", { ascending: false }),
        supabase
          .from("fornecedores")
          .select("*")
          .eq("criado_por", usuarioId)
          .order("nome"),
      ]);
      if (ativo) {
        setPedidos((p ?? []).map(mapPedidoCompra));
        setFornecedores((f ?? []).map(mapFornecedor));
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  async function handleSalvarPedido(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    setErro("");
    if (!formPedido.data || !formPedido.fornecedorId) {
      setErro("Preencha data e fornecedor.");
      return;
    }
    setSalvando(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pedidos_compra")
      .insert({
        criado_por: usuarioId,
        fornecedor_id: formPedido.fornecedorId,
        data: formPedido.data,
        status: formPedido.status,
        valor_total: parseNumero(formPedido.valorTotal),
        observacao: formPedido.observacao.trim(),
      })
      .select("*, fornecedores(nome)")
      .single();
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    if (data) setPedidos((prev) => [mapPedidoCompra(data), ...prev]);
    setFormPedido({ fornecedorId: "", data: dataHoje, status: "pendente", valorTotal: "", observacao: "" });
    setMensagem("Pedido de compra registrado.");
  }

  async function handleAtualizarStatusPedido(id: string, status: PedidoCompra["status"]) {
    const supabase = createClient();
    const { error } = await supabase.from("pedidos_compra").update({ status }).eq("id", id);
    if (error) { setErro(error.message); return; }
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    setMensagem("Status atualizado.");
  }

  const totalCompras = pedidos.reduce((s, p) => s + p.valorTotal, 0);
  const pendentes = pedidos.filter((p) => p.status === "pendente").length;

  if (carregando) return <EstadoCarregando texto="Carregando compras..." />;

  return (
    <section className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          tag="Compras"
          titulo="Pedidos de compra"
          descricao="Registre pedidos de compra e ordens de fabricação."
        />
        <div className="flex gap-2 rounded-3xl border border-[#90caf9] bg-[#f0f7ff] p-2">
          {(["pedidos", "fabricacao"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAba(t)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                aba === t
                  ? "bg-[#1565c0] text-white"
                  : "text-[#1565c0] hover:bg-[#e3f0ff]"
              }`}
            >
              {t === "pedidos" ? "Pedidos" : "Fabricação"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <KpiCard titulo="Total de pedidos" valor={String(pedidos.length)} />
        <KpiCard titulo="Pedidos pendentes" valor={String(pendentes)} alerta={pendentes > 0} />
        <KpiCard titulo="Total em compras" valor={formatarMoeda(totalCompras)} />
      </div>

      <FeedbackBloco mensagem={mensagem} erro={erro} className="mt-5" />

      {aba === "pedidos" && (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <form
            onSubmit={handleSalvarPedido}
            className="rounded-3xl border border-[#90caf9] bg-[#f0f7ff] p-5"
          >
            <p className="text-sm font-semibold text-[#1565c0]">Novo pedido</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Fornecedor</label>
                <select
                  value={formPedido.fornecedorId}
                  onChange={(e) => setFormPedido((f) => ({ ...f, fornecedorId: e.target.value }))}
                  className="w-full rounded-2xl border border-[#90caf9] bg-white px-4 py-3 text-sm outline-none focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
                >
                  <option value="">Selecione...</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <CampoCadastro label="Data" type="date" value={formPedido.data} onChange={(v) => setFormPedido((f) => ({ ...f, data: v }))} required />
              <SelectCadastro
                label="Status"
                value={formPedido.status}
                onChange={(v) => setFormPedido((f) => ({ ...f, status: v as PedidoCompra["status"] }))}
                options={["pendente", "recebido", "cancelado"]}
                placeholder=""
              />
              <CampoCadastro label="Valor total" value={formPedido.valorTotal} onChange={(v) => setFormPedido((f) => ({ ...f, valorTotal: v }))} placeholder="0,00" />
              <CampoCadastro label="Observação" value={formPedido.observacao} onChange={(v) => setFormPedido((f) => ({ ...f, observacao: v }))} placeholder="Detalhes do pedido" />
            </div>
            <button
              type="submit"
              disabled={salvando}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#1565c0] px-4 text-sm font-semibold text-white transition hover:bg-[#0d47a1] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {salvando ? "Salvando..." : "Registrar pedido"}
            </button>
          </form>

          <div className="overflow-hidden rounded-3xl border border-[#90caf9]">
            {pedidos.length > 0 ? (
              <div className="max-h-[480px] overflow-auto">
                <table className="min-w-[560px] w-full bg-white text-left text-sm">
                  <thead className="sticky top-0 bg-[#f0f7ff] text-[#1565c0]">
                    <tr>
                      <Th>Data</Th>
                      <Th>Fornecedor</Th>
                      <Th>Valor</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((p) => (
                      <tr key={p.id} className="border-t border-[#e3f0ff]">
                        <Td>{formatarData(p.data)}</Td>
                        <Td className="font-semibold">{p.fornecedorNome || "-"}</Td>
                        <Td>{formatarMoeda(p.valorTotal)}</Td>
                        <Td>
                          <select
                            value={p.status}
                            onChange={(e) => handleAtualizarStatusPedido(p.id, e.target.value as PedidoCompra["status"])}
                            className={`rounded-full px-3 py-1 text-xs font-semibold outline-none ${
                              p.status === "recebido"
                                ? "bg-green-100 text-green-700"
                                : p.status === "cancelado"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            <option value="pendente">Pendente</option>
                            <option value="recebido">Recebido</option>
                            <option value="cancelado">Cancelado</option>
                          </select>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EstadoTabelaVazia texto="Nenhum pedido de compra registrado." />
            )}
          </div>
        </div>
      )}

      {aba === "fabricacao" && (
        <FabricacaoSubModulo
          usuarioId={usuarioId}
          dataHoje={dataHoje}
          fornecedores={fornecedores}
        />
      )}
    </section>
  );
}

// ─── Fabricação ───────────────────────────────────────────────────────────────

function FabricacaoSubModulo({
  usuarioId,
  dataHoje,
  fornecedores,
}: {
  usuarioId: string;
  dataHoje: string;
  fornecedores: Fornecedor[];
}) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidos, setPedidos] = useState<PedidoFabricacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [produtoId, setProdutoId] = useState("");
  const [qtdFabricada, setQtdFabricada] = useState("1");
  const [dataFab, setDataFab] = useState(dataHoje);
  const [observacao, setObservacao] = useState("");
  const [itens, setItens] = useState<ItemFabricacaoRascunho[]>([]);
  const [componentesCarregados, setComponentesCarregados] = useState(false);
  const [carregandoComp, setCarregandoComp] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const [{ data: p }, { data: ped }] = await Promise.all([
        supabase.from("produtos").select("*").eq("criado_por", usuarioId).eq("ativo", true).order("nome"),
        supabase.from("pedidos_fabricacao").select("*").eq("criado_por", usuarioId).order("data", { ascending: false }).limit(50),
      ]);
      if (ativo) {
        setProdutos((p ?? []).map(mapProduto));
        setPedidos((ped ?? []).map(mapPedidoFabricacao));
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  async function handleCarregarComponentes() {
    setErro("");
    if (!produtoId) { setErro("Selecione um produto."); return; }
    setCarregandoComp(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("componentes_produto")
      .select("*")
      .eq("produto_id", produtoId)
      .order("created_at");
    setCarregandoComp(false);
    const componentes = (data ?? []).map(mapComponente);
    if (componentes.length === 0) {
      setErro("Este produto não possui matérias-primas cadastradas. Acesse a aba Produtos → BOM.");
      return;
    }
    setItens(componentes.map((c) => ({
      componenteId: c.id,
      nomePeca: c.nomePeca,
      qtdPc: c.quantidade,
      linkCompra: c.linkCompra,
      fornecedorNome: "",
      precoUnitario: "0",
    })));
    setComponentesCarregados(true);
  }

  function qtdTotal(qtdPc: number) {
    return qtdPc * (parseNumero(qtdFabricada) || 1);
  }

  function precoTotal(item: ItemFabricacaoRascunho) {
    return qtdTotal(item.qtdPc) * parseNumero(item.precoUnitario);
  }

  const valorTotalGeral = itens.reduce((s, i) => s + precoTotal(i), 0);

  function atualizarItem(idx: number, campo: keyof ItemFabricacaoRascunho, valor: string) {
    setItens((prev) => prev.map((it, i) => i === idx ? { ...it, [campo]: valor } : it));
  }

  async function handleSalvar() {
    setErro("");
    if (!produtoId || !dataFab || itens.length === 0) {
      setErro("Preencha produto, data e carregue os componentes.");
      return;
    }
    const produto = produtos.find((p) => p.id === produtoId);
    setSalvando(true);
    const supabase = createClient();

    const { data: pedido, error: errPedido } = await supabase
      .from("pedidos_fabricacao")
      .insert({
        criado_por: usuarioId,
        produto_id: produtoId,
        produto_nome: produto?.nome ?? "",
        qtd_fabricada: parseNumero(qtdFabricada),
        data: dataFab,
        valor_total: valorTotalGeral,
        observacao: observacao.trim(),
      })
      .select()
      .single();

    if (errPedido || !pedido) {
      setSalvando(false);
      setErro(errPedido?.message ?? "Erro ao salvar pedido.");
      return;
    }

    const linhas = itens.map((it) => ({
      pedido_id: pedido.id,
      nome_peca: it.nomePeca,
      qtd_pc: it.qtdPc,
      qtd_total: qtdTotal(it.qtdPc),
      fornecedor_nome: it.fornecedorNome,
      preco_unitario: parseNumero(it.precoUnitario),
      preco_total: precoTotal(it),
    }));

    const { error: errItens } = await supabase.from("itens_fabricacao").insert(linhas);
    setSalvando(false);
    if (errItens) { setErro(errItens.message); return; }

    setPedidos((prev) => [mapPedidoFabricacao(pedido), ...prev]);
    setProdutoId("");
    setQtdFabricada("1");
    setDataFab(dataHoje);
    setObservacao("");
    setItens([]);
    setComponentesCarregados(false);
    setMensagem("Pedido de fabricação registrado.");
  }

  if (carregando) return <EstadoCarregando texto="Carregando fabricação..." />;

  return (
    <div className="mt-6 space-y-6">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      {/* Formulário de novo pedido */}
      <div className="rounded-3xl border border-[#90caf9] bg-[#f0f7ff] p-5">
        <p className="text-sm font-semibold text-[#1565c0]">Novo pedido de fabricação</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Produto fabricado</label>
            <select
              value={produtoId}
              onChange={(e) => { setProdutoId(e.target.value); setComponentesCarregados(false); setItens([]); }}
              className="w-full rounded-2xl border border-[#90caf9] bg-white px-4 py-3 text-sm outline-none focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
            >
              <option value="">Selecione o produto...</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.codigo ? `[${p.codigo}] ` : ""}{p.nome}</option>
              ))}
            </select>
          </div>
          <CampoCadastro label="Qtd. fabricada" value={qtdFabricada} onChange={setQtdFabricada} placeholder="1" />
          <CampoCadastro label="Data" type="date" value={dataFab} onChange={setDataFab} required />
          <div className="sm:col-span-2">
            <CampoCadastro label="Observação" value={observacao} onChange={setObservacao} placeholder="Detalhe do pedido" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleCarregarComponentes}
          disabled={carregandoComp || !produtoId}
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl border border-[#1565c0] bg-white px-4 text-sm font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff] disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          {carregandoComp ? "Carregando..." : "Carregar matérias-primas"}
        </button>

        {componentesCarregados && itens.length > 0 && (
          <>
            <div className="mt-5 overflow-auto rounded-2xl border border-[#90caf9]">
              <table className="min-w-[800px] w-full bg-white text-left text-sm">
                <thead className="bg-[#f0f7ff] text-[#1565c0]">
                  <tr>
                    <Th>Nome da Peça</Th>
                    <Th>Qtd/un</Th>
                    <Th>Qtd total</Th>
                    <Th>Link</Th>
                    <Th>Fornecedor</Th>
                    <Th>Preço unit.</Th>
                    <Th>Preço total</Th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, idx) => (
                    <tr key={it.componenteId} className="border-t border-[#e3f0ff]">
                      <Td className="font-semibold">{it.nomePeca}</Td>
                      <Td>{it.qtdPc}</Td>
                      <Td className="font-semibold text-[#1565c0]">{qtdTotal(it.qtdPc)}</Td>
                      <Td>
                        {it.linkCompra ? (
                          <a href={it.linkCompra} target="_blank" rel="noopener noreferrer"
                            className="text-[#1565c0] underline text-xs">Ver</a>
                        ) : <span className="text-[#90aac8]">—</span>}
                      </Td>
                      <Td>
                        <select
                          value={it.fornecedorNome}
                          onChange={(e) => atualizarItem(idx, "fornecedorNome", e.target.value)}
                          className="w-36 rounded-xl border border-[#90caf9] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#1565c0]"
                        >
                          <option value="">—</option>
                          {fornecedores.map((f) => (
                            <option key={f.id} value={f.nome}>{f.nome}</option>
                          ))}
                        </select>
                      </Td>
                      <Td>
                        <input
                          type="text"
                          value={it.precoUnitario}
                          onChange={(e) => atualizarItem(idx, "precoUnitario", e.target.value)}
                          className="w-24 rounded-xl border border-[#90caf9] bg-white px-2 py-1.5 text-xs outline-none focus:border-[#1565c0]"
                          placeholder="0,00"
                        />
                      </Td>
                      <Td className="font-semibold">{formatarMoeda(precoTotal(it))}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                Custo total estimado:{" "}
                <span className="text-[#1565c0]">{formatarMoeda(valorTotalGeral)}</span>
              </p>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={salvando}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#1565c0] px-5 text-sm font-semibold text-white transition hover:bg-[#0d47a1] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {salvando ? "Salvando..." : "Registrar fabricação"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Histórico */}
      <div className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#1565c0]">Histórico de fabricação</p>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#90caf9]">
          {pedidos.length > 0 ? (
            <div className="max-h-72 overflow-auto">
              <table className="min-w-[560px] w-full bg-white text-left text-sm">
                <thead className="sticky top-0 bg-[#f0f7ff] text-[#1565c0]">
                  <tr>
                    <Th>Data</Th>
                    <Th>Produto</Th>
                    <Th>Qtd fabricada</Th>
                    <Th>Custo total</Th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => (
                    <tr key={p.id} className="border-t border-[#e3f0ff]">
                      <Td>{formatarData(p.data)}</Td>
                      <Td className="font-semibold">{p.produtoNome}</Td>
                      <Td>{p.qtdFabricada}</Td>
                      <Td className="font-semibold text-[#1565c0]">{formatarMoeda(p.valorTotal)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EstadoTabelaVazia texto="Nenhum pedido de fabricação registrado." />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Financeiro ───────────────────────────────────────────────────────────────

function FinanceiroModulo({
  usuarioId,
  dataHoje,
}: {
  usuarioId: string;
  dataHoje: string;
}) {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({
    data: dataHoje,
    categoria: "",
    descricao: "",
    valor: "",
  });

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const [{ data: d }, { data: v }] = await Promise.all([
        supabase
          .from("despesas")
          .select("*")
          .eq("criado_por", usuarioId)
          .order("data", { ascending: false }),
        supabase
          .from("vendas")
          .select("*")
          .eq("criado_por", usuarioId)
          .order("data", { ascending: false })
          .limit(500),
      ]);
      if (ativo) {
        setDespesas((d ?? []).map(mapDespesa));
        setVendas((v ?? []).map(mapVenda));
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    setErro("");
    if (!form.data || !form.descricao.trim() || !form.valor) {
      setErro("Preencha data, descrição e valor.");
      return;
    }
    setSalvando(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("despesas")
      .insert({
        criado_por: usuarioId,
        data: form.data,
        categoria: form.categoria.trim() || "Outros",
        descricao: form.descricao.trim(),
        valor: parseNumero(form.valor),
      })
      .select()
      .single();
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    if (data) setDespesas((prev) => [mapDespesa(data), ...prev]);
    setForm({ data: dataHoje, categoria: "", descricao: "", valor: "" });
    setMensagem("Despesa registrada.");
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir esta despesa?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("despesas").delete().eq("id", id).eq("criado_por", usuarioId);
    if (error) { setErro(error.message); return; }
    setDespesas((prev) => prev.filter((d) => d.id !== id));
    setMensagem("Despesa removida.");
  }

  const receitaBruta = vendas.reduce(
    (s, v) => s + v.valorUnitario * v.quantidade - v.desconto,
    0
  );
  const taxasTotal = vendas.reduce((s, v) => s + v.taxaMarketplace, 0);
  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0);
  const lucroLiquido = receitaBruta - taxasTotal - totalDespesas;

  const despesasPorCategoria = CATEGORIAS_DESPESA.map((cat) => ({
    name: cat,
    value: despesas
      .filter((d) => d.categoria === cat)
      .reduce((s, d) => s + d.valor, 0),
  })).filter((x) => x.value > 0);

  const ultimos6Meses = obterUltimosMeses(6);
  const fluxoPorMes = ultimos6Meses.map((mes) => ({
    name: mes.label,
    Receita: vendas
      .filter((v) => v.data.startsWith(mes.prefixo))
      .reduce((s, v) => s + v.valorUnitario * v.quantidade - v.desconto, 0),
    Despesas: despesas
      .filter((d) => d.data.startsWith(mes.prefixo))
      .reduce((s, d) => s + d.valor, 0),
  }));

  const despesasFiltradas = despesas.filter((d) => {
    const q = termoBusca.toLowerCase();
    return (
      !q ||
      d.descricao.toLowerCase().includes(q) ||
      d.categoria.toLowerCase().includes(q)
    );
  });

  if (carregando) return <EstadoCarregando texto="Carregando financeiro..." />;

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
        <SectionHeader
          tag="Financeiro"
          titulo="Resultado operacional"
          descricao="Acompanhe entradas, despesas e o resultado líquido do período."
        />
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard titulo="Receita bruta" valor={formatarMoeda(receitaBruta)} />
          <KpiCard titulo="Taxas marketplace" valor={formatarMoeda(taxasTotal)} alerta />
          <KpiCard titulo="Despesas operacionais" valor={formatarMoeda(totalDespesas)} alerta />
          <KpiCard titulo="Lucro líquido" valor={formatarMoeda(lucroLiquido)} destaque={lucroLiquido >= 0} alerta={lucroLiquido < 0} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1565c0]">Fluxo mensal</p>
          <h3 className="mt-1 text-lg font-bold">Receita vs Despesas</h3>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fluxoPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e3f0ff" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Bar dataKey="Receita" fill="#1565c0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#1565c0]">Despesas</p>
          <h3 className="mt-1 text-lg font-bold">Por categoria</h3>
          {despesasPorCategoria.length > 0 ? (
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={despesasPorCategoria}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={72}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {despesasPorCategoria.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 py-10 text-center text-sm text-[#455a80]">
              Nenhuma despesa registrada.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
        <SectionHeader tag="Despesas" titulo="Lançamento de despesas" descricao="" />
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <form
            onSubmit={handleSalvar}
            className="rounded-3xl border border-[#90caf9] bg-[#f0f7ff] p-5"
          >
            <p className="text-sm font-semibold text-[#1565c0]">Nova despesa</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <CampoCadastro label="Data" type="date" value={form.data} onChange={(v) => setForm((f) => ({ ...f, data: v }))} required />
              <SelectCadastro
                label="Categoria"
                value={form.categoria}
                onChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
                options={CATEGORIAS_DESPESA}
                placeholder="Selecione..."
              />
              <div className="sm:col-span-2">
                <CampoCadastro label="Descrição" value={form.descricao} onChange={(v) => setForm((f) => ({ ...f, descricao: v }))} placeholder="Descrição da despesa" required />
              </div>
              <CampoCadastro label="Valor" value={form.valor} onChange={(v) => setForm((f) => ({ ...f, valor: v }))} placeholder="0,00" required />
            </div>

            <FeedbackBloco mensagem={mensagem} erro={erro} />

            <button
              type="submit"
              disabled={salvando}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#1565c0] px-4 text-sm font-semibold text-white transition hover:bg-[#0d47a1] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {salvando ? "Salvando..." : "Registrar despesa"}
            </button>
          </form>

          <div>
            <div className="mb-4 flex items-center gap-3">
              <h3 className="text-lg font-bold">Despesas lançadas</h3>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90aac8]" />
                <input
                  type="search"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="h-10 w-full rounded-2xl border border-[#90caf9] bg-white pl-9 pr-4 text-sm outline-none focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
                  placeholder="Buscar"
                />
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-[#90caf9]">
              {despesasFiltradas.length > 0 ? (
                <div className="max-h-[400px] overflow-auto">
                  <table className="min-w-[480px] w-full bg-white text-left text-sm">
                    <thead className="sticky top-0 bg-[#f0f7ff] text-[#1565c0]">
                      <tr>
                        <Th>Data</Th>
                        <Th>Categoria</Th>
                        <Th>Descrição</Th>
                        <Th>Valor</Th>
                        <Th>Ações</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {despesasFiltradas.map((d) => (
                        <tr key={d.id} className="border-t border-[#e3f0ff]">
                          <Td>{formatarData(d.data)}</Td>
                          <Td>
                            <span className="rounded-full bg-[#e3f0ff] px-2 py-0.5 text-xs font-semibold text-[#1565c0]">
                              {d.categoria}
                            </span>
                          </Td>
                          <Td>{d.descricao}</Td>
                          <Td className="font-semibold text-red-600">{formatarMoeda(d.valor)}</Td>
                          <Td>
                            <button
                              type="button"
                              onClick={() => handleExcluir(d.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-200 bg-white px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EstadoTabelaVazia texto="Nenhuma despesa registrada." />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Usuários ─────────────────────────────────────────────────────────────────

function UsuariosModulo({ usuarioId }: { usuarioId: string }) {
  const [membros, setMembros] = useState<MembroEmpresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const { data } = await supabase
        .from("usuarios_empresa")
        .select("*")
        .order("papel");
      if (ativo) {
        setMembros((data ?? []).map(mapMembro));
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, []);

  async function handleAprovar(id: string) {
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("usuarios_empresa")
      .update({ papel: "socio" })
      .eq("id", id);
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    setMembros((prev) => prev.map((m) => m.id === id ? { ...m, papel: "socio" as const } : m));
    setMensagem("Usuário aprovado com acesso de sócio.");
  }

  async function handleRemover(id: string) {
    if (!confirm("Remover acesso deste usuário?")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("usuarios_empresa")
      .delete()
      .eq("id", id);
    if (error) { setErro(error.message); return; }
    setMembros((prev) => prev.filter((m) => m.id !== id));
    setMensagem("Acesso removido.");
  }

  const pendentes = membros.filter((m) => m.papel === "pendente");
  const comAcesso = membros.filter((m) => m.papel !== "pendente");

  if (carregando) return <EstadoCarregando texto="Carregando usuários..." />;

  return (
    <section className="space-y-6">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm">
        <SectionHeader
          tag="Pendentes"
          titulo="Aguardando aprovação"
          descricao="Usuários que criaram conta e aguardam sua autorização para acessar o sistema."
        />
        <div className="mt-5">
          {pendentes.length === 0 ? (
            <p className="text-sm text-[#455a80]">Nenhum usuário aguardando aprovação.</p>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-amber-200">
              <table className="w-full bg-white text-left text-sm">
                <thead className="bg-amber-50">
                  <tr>
                    <Th>Nome</Th>
                    <Th>E-mail</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((m) => (
                    <tr key={m.id} className="border-t border-amber-100">
                      <Td className="font-semibold">{m.nome || "-"}</Td>
                      <Td>{m.email || "-"}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleAprovar(m.id)}
                            disabled={salvando}
                            className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#1565c0] px-3 text-xs font-semibold text-white transition hover:bg-[#0d47a1] disabled:opacity-60"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Aprovar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemover(m.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Rejeitar
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-[#90caf9] bg-white p-6 shadow-sm">
        <SectionHeader
          tag="Acessos"
          titulo="Usuários com acesso"
          descricao="Administradores e sócios com acesso liberado ao sistema."
        />
        <div className="mt-5 overflow-hidden rounded-3xl border border-[#90caf9]">
          {comAcesso.length === 0 ? (
            <EstadoTabelaVazia texto="Nenhum usuário com acesso." />
          ) : (
            <table className="w-full bg-white text-left text-sm">
              <thead className="bg-[#f0f7ff] text-[#1565c0]">
                <tr>
                  <Th>Nome</Th>
                  <Th>E-mail</Th>
                  <Th>Papel</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {comAcesso.map((m) => (
                  <tr key={m.id} className="border-t border-[#e3f0ff]">
                    <Td className="font-semibold">{m.nome || "-"}</Td>
                    <Td>{m.email || "-"}</Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        m.papel === "admin"
                          ? "bg-[#e3f0ff] text-[#1565c0]"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {m.papel === "admin" ? "Admin" : "Sócio"}
                      </span>
                    </Td>
                    <Td>
                      {m.papel !== "admin" && m.usuarioId !== usuarioId && (
                        <button
                          type="button"
                          onClick={() => handleRemover(m.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-200 bg-white px-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remover
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Shared UI components ─────────────────────────────────────────────────────

function KpiCard({
  titulo,
  valor,
  destaque,
  alerta,
}: {
  titulo: string;
  valor: string;
  destaque?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 ${
        destaque
          ? "border-[#1565c0]/30 bg-[#e3f0ff]"
          : alerta
          ? "border-red-200 bg-red-50"
          : "border-[#90caf9] bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#455a80]">
        {titulo}
      </p>
      <p
        className={`mt-1.5 text-xl font-bold ${
          destaque
            ? "text-[#1565c0]"
            : alerta
            ? "text-red-700"
            : "text-[#0d1b2a]"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

function SectionHeader({
  tag,
  titulo,
  descricao,
}: {
  tag: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#1565c0]">{tag}</p>
      <h2 className="mt-1 text-2xl font-bold">{titulo}</h2>
      {descricao && (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#455a80]">
          {descricao}
        </p>
      )}
    </div>
  );
}

function CampoCadastro({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-[#90caf9] bg-white px-4 py-3 text-sm text-[#0d1b2a] outline-none transition placeholder:text-[#90aac8] focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
      />
    </div>
  );
}

function SelectCadastro({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-[#90caf9] bg-white px-4 py-3 text-sm text-[#0d1b2a] outline-none focus:border-[#1565c0] focus:ring-2 focus:ring-[#e3f0ff]"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 ${className ?? ""}`}>{children}</td>
  );
}

function EstadoTabelaVazia({ texto }: { texto: string }) {
  return (
    <div className="bg-white px-4 py-12 text-center text-sm text-[#455a80]">
      {texto}
    </div>
  );
}

function EstadoCarregando({ texto }: { texto: string }) {
  return (
    <div className="rounded-3xl border border-[#90caf9] bg-white p-12 text-center text-sm text-[#455a80]">
      {texto}
    </div>
  );
}

function FeedbackBloco({
  mensagem,
  erro,
  className,
}: {
  mensagem: string;
  erro: string;
  className?: string;
}) {
  if (!mensagem && !erro) return null;
  return (
    <div className={className ?? "mt-4"}>
      {mensagem && (
        <div className="rounded-2xl border border-[#90caf9] bg-[#e3f0ff] px-4 py-3 text-sm text-[#1565c0]">
          {mensagem}
        </div>
      )}
      {erro && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {erro}
        </div>
      )}
    </div>
  );
}

function MarketplaceBadge({ marketplace }: { marketplace: Marketplace }) {
  const cores: Record<Marketplace, string> = {
    "Mercado Livre": "bg-yellow-100 text-yellow-800",
    Shopee: "bg-orange-100 text-orange-700",
    "Site Próprio": "bg-blue-100 text-blue-700",
    Outro: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cores[marketplace]}`}
    >
      {marketplace}
    </span>
  );
}

// ─── Data mappers ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMateriaPrima(r: any): MateriaPrima {
  return {
    id: String(r.id),
    codigo: String(r.codigo ?? ""),
    nome: String(r.nome ?? ""),
    unidade: String(r.unidade ?? "un"),
    custo: Number(r.custo ?? 0),
    linkCompra: String(r.link_compra ?? ""),
    ativo: Boolean(r.ativo ?? true),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapComponente(r: any): ComponenteProduto {
  return {
    id: String(r.id),
    produtoId: String(r.produto_id ?? ""),
    nomePeca: String(r.nome_peca ?? ""),
    quantidade: Number(r.quantidade ?? 1),
    linkCompra: String(r.link_compra ?? ""),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPedidoFabricacao(r: any): PedidoFabricacao {
  return {
    id: String(r.id),
    produtoId: String(r.produto_id ?? ""),
    produtoNome: String(r.produto_nome ?? ""),
    qtdFabricada: Number(r.qtd_fabricada ?? 1),
    data: String(r.data ?? ""),
    valorTotal: Number(r.valor_total ?? 0),
    observacao: String(r.observacao ?? ""),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMembro(r: any): MembroEmpresa {
  return {
    id: String(r.id),
    usuarioId: String(r.usuario_id ?? ""),
    nome: String(r.nome ?? ""),
    email: String(r.email ?? ""),
    papel: (r.papel ?? "pendente") as MembroEmpresa["papel"],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProduto(r: any): Produto {
  return {
    id: String(r.id),
    codigo: String(r.codigo ?? ""),
    nome: String(r.nome ?? ""),
    categoria: String(r.categoria ?? ""),
    custo: Number(r.custo ?? 0),
    precoVenda: Number(r.preco_venda ?? 0),
    estoqueAtual: Number(r.estoque_atual ?? 0),
    estoqueMinimo: Number(r.estoque_minimo ?? 0),
    ativo: Boolean(r.ativo ?? true),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapVenda(r: any): Venda {
  return {
    id: String(r.id),
    data: String(r.data ?? ""),
    marketplace: String(r.marketplace ?? "Outro") as Marketplace,
    produtoId: String(r.produto_id ?? ""),
    produtoNome: String(r.produto_nome ?? ""),
    quantidade: Number(r.quantidade ?? 0),
    valorUnitario: Number(r.valor_unitario ?? 0),
    taxaMarketplace: Number(r.taxa_marketplace ?? 0),
    desconto: Number(r.desconto ?? 0),
    observacao: String(r.observacao ?? ""),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDespesa(r: any): Despesa {
  return {
    id: String(r.id),
    data: String(r.data ?? ""),
    categoria: String(r.categoria ?? "Outros"),
    descricao: String(r.descricao ?? ""),
    valor: Number(r.valor ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFornecedor(r: any): Fornecedor {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    contato: String(r.contato ?? ""),
    observacao: String(r.observacao ?? ""),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCliente(r: any): Cliente {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    contato: String(r.contato ?? ""),
    email: String(r.email ?? ""),
    cidade: String(r.cidade ?? ""),
    observacao: String(r.observacao ?? ""),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPedidoCompra(r: any): PedidoCompra {
  return {
    id: String(r.id),
    fornecedorId: String(r.fornecedor_id ?? ""),
    fornecedorNome: String(r.fornecedores?.nome ?? ""),
    data: String(r.data ?? ""),
    status: (r.status ?? "pendente") as PedidoCompra["status"],
    valorTotal: Number(r.valor_total ?? 0),
    observacao: String(r.observacao ?? ""),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function obterUltimosMeses(n: number) {
  const meses = [];
  const hoje = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({
      prefixo: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("pt-BR", { month: "short" }),
    });
  }
  return meses;
}
