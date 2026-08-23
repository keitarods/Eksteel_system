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
  Scale,
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
  Legend,
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
  | "balancete"
  | "usuarios";

type NomeComprador = "Matheus" | "Enyo";

type ItemBalancete = {
  id: string;
  data: string;
  nomeItem: string;
  valorUnitario: number;
  quantidade: number;
  valorTotal: number;
  nomeComprador: NomeComprador;
};

const COMPRADORES_BALANCETE: NomeComprador[] = ["Matheus", "Enyo"];

function identificarComprador(nome: string): NomeComprador | null {
  const n = nome.toLowerCase();
  if (n.includes("matheus")) return "Matheus";
  if (n.includes("enyo")) return "Enyo";
  return null;
}

// Lança automaticamente o valor de uma compra no balancete: dividido 50/50 entre os sócios,
// ou integral para quem registrou a compra. Não bloqueia o registro do pedido em caso de falha.
async function lancarCompraNoBalancete({
  dividir,
  valorTotal,
  data,
  nomeItem,
  usuarioId,
  usuariosMap,
}: {
  dividir: boolean;
  valorTotal: number;
  data: string;
  nomeItem: string;
  usuarioId: string;
  usuariosMap: Record<string, string>;
}): Promise<string | null> {
  if (valorTotal <= 0) return null;
  const supabase = createClient();

  if (dividir) {
    const metade = valorTotal / 2;
    const { error } = await supabase.from("balancete").insert(
      COMPRADORES_BALANCETE.map((nomeComprador) => ({
        criado_por: usuarioId,
        data,
        nome_item: nomeItem,
        valor_unitario: metade,
        quantidade: 1,
        valor_total: metade,
        nome_comprador: nomeComprador,
      }))
    );
    return error ? `Não foi possível dividir no balancete: ${error.message}` : null;
  }

  const comprador = identificarComprador(usuariosMap[usuarioId] ?? "");
  if (!comprador) {
    return "Não foi possível identificar o sócio pra lançar no balancete — lance manualmente.";
  }
  const { error } = await supabase.from("balancete").insert({
    criado_por: usuarioId,
    data,
    nome_item: nomeItem,
    valor_unitario: valorTotal,
    quantidade: 1,
    valor_total: valorTotal,
    nome_comprador: comprador,
  });
  return error ? `Não foi possível lançar no balancete: ${error.message}` : null;
}

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
  kitId: string;
  quantidade: number;
  valorUnitario: number;
  taxaMarketplace: number;
  desconto: number;
  observacao: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoPor: string;
  atualizadoEm: string;
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
  materiaPrimaId: string;
  nomePeca: string;
  quantidade: number;
  linkCompra: string;
};

type KitItem = {
  id: string;
  produtoId: string;
  produtoNome: string;
  produtoCodigo: string;
  quantidade: number;
};

type Kit = {
  id: string;
  nome: string;
  descricao: string;
  itens: KitItem[];
};

type ItemFabricacao = {
  id: string;
  pedidoId: string;
  nomePeca: string;
  qtdPc: number;
  qtdTotal: number;
  fornecedorNome: string;
  precoUnitario: number;
  precoTotal: number;
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
  criadoPor: string;
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
  criadoPor: string;
  criadoEm: string;
  atualizadoPor: string;
  atualizadoEm: string;
};

// Detalhamento opcional do pedido de compra — um pedido sem itens continua
// funcionando só com valorTotal digitado na mão (compatível com pedidos já
// lançados antes dessa feature existir).
type ItemPedidoCompra = {
  id: string;
  pedidoCompraId: string;
  materiaPrimaId: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

// Linha em edição (form) — valores como string, igual ao resto do formulário,
// parseados só na hora de calcular/salvar. materiaPrimaId vazio = item avulso
// (descrição livre, sem vínculo com o cadastro de matérias-primas).
type LinhaItemPedido = { id: string; materiaPrimaId: string; descricao: string; quantidade: string; valorUnitario: string };

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

const CORES = [
  "#1976D2", // azul
  "#E53935", // vermelho
  "#F9A825", // amarelo
  "#E65100", // laranja
  "#6A1B9A", // roxo
  "#00838F", // ciano escuro
  "#2E7D32", // verde escuro
  "#AD1457", // rosa escuro
  "#4527A0", // índigo
  "#558B2F", // verde oliva
];

// Paleta para gráficos de receita — sem vermelho (vermelho remete a despesa)
const CORES_RECEITA = [
  "#1976D2", "#F9A825", "#6A1B9A", "#00838F", "#558B2F",
  "#0277BD", "#F57F17", "#4527A0", "#00695C", "#33691E",
];

// Paleta para gráficos de despesa — tons de vermelho e laranja
const CORES_DESPESA = [
  "#C62828", "#E53935", "#E65100", "#BF360C", "#AD1457",
  "#D84315", "#C62828", "#6A1B9A", "#4E342E", "#F9A825",
];

const TODAS_ABAS = [
  { id: "visao-geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "vendas", label: "Vendas", icon: ShoppingCart },
  { id: "cadastro", label: "Cadastro", icon: ClipboardList },
  { id: "estoque", label: "Estoque", icon: Archive },
  { id: "compras", label: "Compras", icon: PackagePlus },
  { id: "balancete", label: "Balancete", icon: Scale },
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

function formatarDataHora(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Rótulo curto pra eixo de gráfico — o nome completo continua disponível no tooltip.
function truncarRotulo(nome: string, max = 16) {
  return nome.length > max ? `${nome.slice(0, max - 1)}…` : nome;
}

function nomeUsuario(mapa: Record<string, string>, usuarioId: string) {
  if (!usuarioId) return "-";
  return mapa[usuarioId] || "Usuário removido";
}

// Valor bruto: quantidade × valor unitário, sem nenhum desconto.
function totalBrutoVenda(v: Venda) {
  return v.valorUnitario * v.quantidade;
}

// Valor líquido: bruto menos desconto concedido e taxa cobrada pelo marketplace — o que realmente entra no caixa.
function totalLiquidoVenda(v: Venda) {
  return v.valorUnitario * v.quantidade - v.desconto - v.taxaMarketplace;
}

type ConsumoEstoque = { produtoId: string; quantidade: number };

// Decompõe uma venda (de produto avulso ou de kit) na quantidade real consumida de cada produto.
function itensConsumidosPelaVenda(
  venda: { produtoId: string; kitId: string; quantidade: number },
  kits: Kit[]
): ConsumoEstoque[] {
  if (venda.kitId) {
    const kit = kits.find((k) => k.id === venda.kitId);
    if (!kit) return [];
    return kit.itens.map((it) => ({ produtoId: it.produtoId, quantidade: it.quantidade * venda.quantidade }));
  }
  if (venda.produtoId) return [{ produtoId: venda.produtoId, quantidade: venda.quantidade }];
  return [];
}

function precoSugeridoKit(kit: Kit, produtos: Produto[]) {
  return kit.itens.reduce((soma, it) => {
    const produto = produtos.find((p) => p.id === it.produtoId);
    return soma + (produto?.precoVenda ?? 0) * it.quantidade;
  }, 0);
}

// Aplica no estoque a diferença entre o consumo antigo (revertido) e o novo (aplicado) — usado
// tanto pra criar/excluir venda (um dos dois lados vazio) quanto pra editar (os dois preenchidos).
async function aplicarDeltaEstoque(
  supabase: ReturnType<typeof createClient>,
  produtos: Produto[],
  consumoAntigo: ConsumoEstoque[],
  consumoNovo: ConsumoEstoque[]
) {
  const delta: Record<string, number> = {};
  for (const item of consumoAntigo) delta[item.produtoId] = (delta[item.produtoId] ?? 0) + item.quantidade;
  for (const item of consumoNovo) delta[item.produtoId] = (delta[item.produtoId] ?? 0) - item.quantidade;
  await Promise.all(
    Object.entries(delta)
      .filter(([, d]) => d !== 0)
      .map(([produtoId, d]) => {
        const produto = produtos.find((p) => p.id === produtoId);
        if (!produto) return null;
        const novoSaldo = Math.max(0, produto.estoqueAtual + d);
        return supabase.from("produtos").update({ estoque_atual: novoSaldo }).eq("id", produtoId);
      })
  );
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
    <div className="mt-5 sm:mt-8">
      <div className="flex gap-1.5 overflow-x-auto rounded-3xl border border-[#333333] bg-[#141414]/95 p-2 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {abas.map((aba) => {
          const Icon = aba.icon;
          const ativa = abaAtiva === aba.id;

          return (
            <button
              key={aba.id}
              type="button"
              onClick={() => setAbaAtiva(aba.id)}
              className={`flex h-10 shrink-0 items-center gap-2 rounded-2xl px-3 sm:px-4 text-sm font-semibold transition ${
                ativa
                  ? "bg-[#546E7A] text-white shadow-sm"
                  : "text-[#90A4AE] hover:bg-[#2a2a2a]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{aba.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {abaAtiva === "visao-geral" && (
          <VisaoGeral usuarioId={usuarioId} dataHoje={dataHoje} />
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
        {abaAtiva === "balancete" && (
          <BalanceteModulo usuarioId={usuarioId} dataHoje={dataHoje} />
        )}
        {abaAtiva === "usuarios" && isAdmin && (
          <UsuariosModulo usuarioId={usuarioId} />
        )}
      </div>
    </div>
  );
}

// ─── Visão Geral ─────────────────────────────────────────────────────────────

function VisaoGeral({ usuarioId, dataHoje }: { usuarioId: string; dataHoje: string }) {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [pedidosFabricacao, setPedidosFabricacao] = useState<PedidoFabricacao[]>([]);
  const [balancete, setBalancete] = useState<ItemBalancete[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ data: dataHoje, categoria: "", descricao: "", valor: "" });

  const [despesaSelecionada, setDespesaSelecionada] = useState<Despesa | null>(null);
  const [editandoDetalhe, setEditandoDetalhe] = useState(false);
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false);
  const [formDetalhe, setFormDetalhe] = useState({ data: "", categoria: "", descricao: "", valor: "" });

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const [{ data: v }, { data: d }, { data: p }, { data: pf }, { data: bl }, { data: kt }] = await Promise.all([
        supabase.from("vendas").select("*").order("data", { ascending: false }).limit(500),
        supabase.from("despesas").select("*").order("data", { ascending: false }),
        supabase.from("produtos").select("*").eq("ativo", true),
        supabase.from("pedidos_fabricacao").select("*").order("data", { ascending: false }).limit(500),
        supabase.from("balancete").select("*").order("data", { ascending: false }),
        supabase.from("kits").select("id, nome, descricao, kit_itens(id, produto_id, quantidade, produtos(nome, codigo))"),
      ]);
      if (ativo) {
        setVendas((v ?? []).map(mapVenda));
        setDespesas((d ?? []).map(mapDespesa));
        setProdutos((p ?? []).map(mapProduto));
        setPedidosFabricacao((pf ?? []).map(mapPedidoFabricacao));
        setBalancete((bl ?? []).map(mapItemBalancete));
        setKits((kt ?? []).map(mapKit));
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  async function handleSalvarDespesa(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(""); setErro("");
    if (!form.data || !form.descricao.trim() || !form.valor) { setErro("Preencha data, descrição e valor."); return; }
    setSalvando(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("despesas").insert({
      criado_por: usuarioId, data: form.data,
      categoria: form.categoria.trim() || "Outros",
      descricao: form.descricao.trim(),
      valor: parseNumero(form.valor),
    }).select().single();
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    if (data) setDespesas((prev) => [mapDespesa(data), ...prev]);
    setForm({ data: dataHoje, categoria: "", descricao: "", valor: "" });
    setMensagem("Despesa registrada.");
  }

  async function handleExcluirDespesa(id: string) {
    if (!confirm("Excluir esta despesa?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("despesas").delete().eq("id", id);
    if (error) { setErro(error.message); return; }
    setDespesas((prev) => prev.filter((d) => d.id !== id));
    setMensagem("Despesa removida.");
  }

  function abrirDetalheDespesa(despesa: Despesa) {
    setDespesaSelecionada(despesa);
    setEditandoDetalhe(false);
    setFormDetalhe({
      data: despesa.data,
      categoria: despesa.categoria,
      descricao: despesa.descricao,
      valor: String(despesa.valor).replace(".", ","),
    });
  }

  function fecharDetalheDespesa() {
    setDespesaSelecionada(null);
    setEditandoDetalhe(false);
  }

  async function handleSalvarDetalheDespesa() {
    if (!despesaSelecionada) return;
    if (!formDetalhe.data || !formDetalhe.descricao.trim() || !formDetalhe.valor) {
      setErro("Preencha data, descrição e valor.");
      return;
    }
    setSalvandoDetalhe(true);
    setErro("");
    const supabase = createClient();
    const payload = {
      data: formDetalhe.data,
      categoria: formDetalhe.categoria.trim() || "Outros",
      descricao: formDetalhe.descricao.trim(),
      valor: parseNumero(formDetalhe.valor),
    };
    const { error } = await supabase.from("despesas").update(payload).eq("id", despesaSelecionada.id);
    setSalvandoDetalhe(false);
    if (error) { setErro(error.message); return; }
    const atualizada: Despesa = { id: despesaSelecionada.id, ...payload };
    setDespesas((prev) => prev.map((d) => d.id === despesaSelecionada.id ? atualizada : d));
    setDespesaSelecionada(atualizada);
    setEditandoDetalhe(false);
    setMensagem("Despesa atualizada.");
  }

  async function handleExcluirDetalheDespesa() {
    if (!despesaSelecionada) return;
    await handleExcluirDespesa(despesaSelecionada.id);
    fecharDetalheDespesa();
  }

  if (carregando) return <EstadoCarregando texto="Carregando indicadores..." />;

  // ─── Financial calculations ───
  // Receita bruta: valor de tabela × quantidade, sem nenhuma dedução.
  const receitaBruta = vendas.reduce((s, v) => s + totalBrutoVenda(v), 0);
  const descontosConcedidos = vendas.reduce((s, v) => s + v.desconto, 0);
  const taxasMarketplace = vendas.reduce((s, v) => s + v.taxaMarketplace, 0);
  // Receita líquida: o que de fato entra no caixa após descontos e taxas de marketplace.
  const receitaLiquida = receitaBruta - descontosConcedidos - taxasMarketplace;

  // Average fabrication unit cost per product
  const custoUnitFabMap: Record<string, number> = {};
  produtos.forEach((p) => {
    const ordens = pedidosFabricacao.filter((pf) => pf.produtoId === p.id);
    const totalCusto = ordens.reduce((s, pf) => s + pf.valorTotal, 0);
    const totalQtd = ordens.reduce((s, pf) => s + pf.qtdFabricada, 0);
    custoUnitFabMap[p.id] = totalQtd > 0 ? totalCusto / totalQtd : 0;
  });

  // Quantidade de cada produto efetivamente consumida pelas vendas — direta ou via componentes de kit.
  const consumoPorProduto: Record<string, number> = {};
  vendas.forEach((v) => {
    itensConsumidosPelaVenda(v, kits).forEach((item) => {
      consumoPorProduto[item.produtoId] = (consumoPorProduto[item.produtoId] ?? 0) + item.quantidade;
    });
  });

  // COGS: fabrication cost of items actually sold (not total fabricated)
  const custoFabricacaoVendidos = Object.entries(consumoPorProduto).reduce(
    (s, [produtoId, qtd]) => s + qtd * (custoUnitFabMap[produtoId] ?? 0),
    0
  );

  const totalDespesas = despesas.reduce((s, d) => s + d.valor, 0);
  // Lucro bruto (contábil): receita líquida menos o custo do produto vendido (COGS).
  const lucroBruto = receitaLiquida - custoFabricacaoVendidos;
  // Lucro líquido: lucro bruto menos despesas operacionais (frete, marketing, salários etc.).
  const lucroLiquido = lucroBruto - totalDespesas;
  const margemBruta = receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0;
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;

  // ─── Stock calculations (fabrication-based unit cost) ───
  const estoqueMovimentos = produtos.map((p) => {
    const ordens = pedidosFabricacao.filter((pf) => pf.produtoId === p.id);
    const totalCustoFab = ordens.reduce((s, pf) => s + pf.valorTotal, 0);
    const totalQtdFab = ordens.reduce((s, pf) => s + pf.qtdFabricada, 0);
    const custoUnitFab = totalQtdFab > 0 ? totalCustoFab / totalQtdFab : 0;
    const saidas = consumoPorProduto[p.id] ?? 0;
    const saldoReal = Math.max(0, totalQtdFab - saidas);
    return { ...p, saldoReal, custoUnitFab, capital: saldoReal * custoUnitFab };
  });
  const capitalTotalEstoque = estoqueMovimentos.reduce((s, p) => s + p.capital, 0);
  const totalUnidadesEstoque = estoqueMovimentos.reduce((s, p) => s + p.saldoReal, 0);
  const produtosAbaixoMinimo = estoqueMovimentos.filter((p) => p.saldoReal <= p.estoqueMinimo);

  // ─── Chart data ───
  const ultimos6Meses = obterUltimosMeses(6);
  const evolucaoMensal = ultimos6Meses.map((mes) => ({
    name: mes.label,
    Receita: vendas
      .filter((v) => v.data.startsWith(mes.prefixo))
      .reduce((s, v) => s + totalLiquidoVenda(v), 0),
    Despesas:
      despesas
        .filter((d) => d.data.startsWith(mes.prefixo))
        .reduce((s, d) => s + d.valor, 0) +
      pedidosFabricacao
        .filter((pf) => pf.data.startsWith(mes.prefixo))
        .reduce((s, pf) => s + pf.valorTotal, 0),
  }));
  const vendasPorMarketplace = MARKETPLACES.map((mp) => ({
    name: mp,
    value: vendas.filter((v) => v.marketplace === mp).reduce((s, v) => s + totalLiquidoVenda(v), 0),
  })).filter((x) => x.value > 0);
  const receitaPorProduto = [
    ...produtos.map((p) => ({
      name: p.nome,
      value: vendas.filter((v) => v.produtoId === p.id).reduce((s, v) => s + totalLiquidoVenda(v), 0),
    })),
    ...kits.map((k) => ({
      name: k.nome,
      value: vendas.filter((v) => v.kitId === k.id).reduce((s, v) => s + totalLiquidoVenda(v), 0),
    })),
  ].filter((x) => x.value > 0);
  const despesasPorCategoria = [
    ...CATEGORIAS_DESPESA.map((cat) => ({
      name: cat,
      value: despesas.filter((d) => d.categoria === cat).reduce((s, d) => s + d.valor, 0),
    })),
    {
      name: "Fabricação",
      value: pedidosFabricacao.reduce((s, pf) => s + pf.valorTotal, 0),
    },
  ].filter((x) => x.value > 0);
  const custoPorProduto = produtos.map((p) => ({
    name: p.nome,
    value: (consumoPorProduto[p.id] ?? 0) * (custoUnitFabMap[p.id] ?? 0),
  })).filter((x) => x.value > 0);

  // ─── Balancete calculations ───
  const somaMatheus = balancete.filter((i) => i.nomeComprador === "Matheus").reduce((s, i) => s + i.valorTotal, 0);
  const somaEnyo = balancete.filter((i) => i.nomeComprador === "Enyo").reduce((s, i) => s + i.valorTotal, 0);
  const diferencaBalancete = somaMatheus - somaEnyo;
  const balancetePorMes = ultimos6Meses.map((mes) => ({
    name: mes.label,
    Matheus: balancete.filter((i) => i.nomeComprador === "Matheus" && i.data.startsWith(mes.prefixo)).reduce((s, i) => s + i.valorTotal, 0),
    Enyo: balancete.filter((i) => i.nomeComprador === "Enyo" && i.data.startsWith(mes.prefixo)).reduce((s, i) => s + i.valorTotal, 0),
  }));
  const balancetePorComprador = COMPRADORES_BALANCETE.map((nome) => ({
    name: nome,
    value: balancete.filter((i) => i.nomeComprador === nome).reduce((s, i) => s + i.valorTotal, 0),
  })).filter((x) => x.value > 0);

  const despesasFiltradas = despesas.filter((d) => {
    const q = termoBusca.toLowerCase();
    return !q || d.descricao.toLowerCase().includes(q) || d.categoria.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">

      {/* ── Indicadores de Receita ── */}
      <DashSecao titulo="Indicadores de Receita" />
      <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard titulo="Receita bruta" valor={formatarMoeda(receitaBruta)} />
          <KpiCard titulo="Receita líquida" valor={formatarMoeda(receitaLiquida)} />
          <KpiCard titulo="Lucro bruto" valor={formatarMoeda(lucroBruto)} destaque={lucroBruto >= 0} alerta={lucroBruto < 0} />
          <KpiCard titulo="Lucro líquido" valor={formatarMoeda(lucroLiquido)} destaque={lucroLiquido >= 0} alerta={lucroLiquido < 0} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard titulo="Descontos concedidos" valor={formatarMoeda(descontosConcedidos)} alerta={descontosConcedidos > 0} />
          <KpiCard titulo="Taxas marketplace" valor={formatarMoeda(taxasMarketplace)} alerta={taxasMarketplace > 0} />
          <KpiCard titulo="Custo de fabricação (COGS)" valor={formatarMoeda(custoFabricacaoVendidos)} alerta={custoFabricacaoVendidos > 0} />
          <KpiCard titulo="Despesas operacionais" valor={formatarMoeda(totalDespesas)} alerta={totalDespesas > 0} />
          <KpiCard titulo="Margem bruta" valor={`${margemBruta.toFixed(1)}%`} destaque={margemBruta >= 0} alerta={margemBruta < 0} />
          <KpiCard titulo="Margem líquida" valor={`${margemLiquida.toFixed(1)}%`} destaque={margemLiquida >= 0} alerta={margemLiquida < 0} />
        </div>
        <p className="mt-4 text-xs leading-5 text-[#78909C]">
          Receita líquida = bruta − descontos − taxas de marketplace. Lucro bruto = receita líquida − custo de fabricação dos itens vendidos. Lucro líquido = lucro bruto − despesas operacionais. Margem calculada sobre a receita líquida.
        </p>
      </div>

      {/* ── Indicadores de Estoque ── */}
      <DashSecao titulo="Indicadores de Estoque" />
      <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard titulo="Capital em estoque" valor={formatarMoeda(capitalTotalEstoque)} destaque />
          <KpiCard titulo="Unidades em estoque" valor={String(totalUnidadesEstoque)} />
          <KpiCard titulo="Produtos abaixo do mínimo" valor={String(produtosAbaixoMinimo.length)} alerta={produtosAbaixoMinimo.length > 0} />
        </div>
        {produtosAbaixoMinimo.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-800/50 bg-amber-900/20 p-4">
            <p className="text-sm font-semibold text-amber-400">
              {produtosAbaixoMinimo.length} produto{produtosAbaixoMinimo.length === 1 ? "" : "s"} abaixo do estoque mínimo
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {produtosAbaixoMinimo.map((p) => (
                <span key={p.id} className="rounded-full border border-amber-700/40 bg-amber-900/20 px-3 py-1 text-xs font-semibold text-amber-400">
                  {p.nome} ({p.saldoReal}/{p.estoqueMinimo})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Evolução Financeira ── */}
      <DashSecao titulo="Evolução Financeira" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#90A4AE]">Últimos 6 meses</p>
          <h3 className="mt-1 text-lg font-bold">Receita líquida — Tempo</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Line type="monotone" dataKey="Receita" stroke="#1976D2" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#90A4AE]">Canais de venda</p>
          <h3 className="mt-1 text-lg font-bold">Receita líquida por marketplace</h3>
          {vendasPorMarketplace.length > 0 ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={vendasPorMarketplace} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={72}>
                    {vendasPorMarketplace.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 py-12 text-center text-sm text-[#78909C]">Nenhuma venda registrada ainda.</div>
          )}
        </div>
        <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#90A4AE]">Produtos</p>
          <h3 className="mt-1 text-lg font-bold">Receita líquida por produto</h3>
          {receitaPorProduto.length > 0 ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={receitaPorProduto} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={72}>
                    {receitaPorProduto.map((_, i) => <Cell key={i} fill={CORES_RECEITA[i % CORES_RECEITA.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 py-12 text-center text-sm text-[#78909C]">Nenhuma venda registrada ainda.</div>
          )}
        </div>
      </div>

      {/* ── Análise de Despesas ── */}
      <DashSecao titulo="Análise de Despesas" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#90A4AE]">Fluxo mensal</p>
          <h3 className="mt-1 text-lg font-bold">Receita vs Despesas</h3>
          <div className="mt-4 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Receita" stackId="a" fill="#1565C0" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Despesas" stackId="a" fill="#C62828" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#90A4AE]">Despesas</p>
          <h3 className="mt-1 text-lg font-bold">Por categoria</h3>
          {despesasPorCategoria.length > 0 ? (
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={despesasPorCategoria} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={68}>
                    {despesasPorCategoria.map((_, i) => <Cell key={i} fill={CORES_DESPESA[i % CORES_DESPESA.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 py-10 text-center text-sm text-[#78909C]">Nenhuma despesa registrada.</div>
          )}
        </div>
        <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#90A4AE]">Custo de fabricação</p>
          <h3 className="mt-1 text-lg font-bold">Por produto vendido</h3>
          {custoPorProduto.length > 0 ? (
            <div className="mt-4 h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={custoPorProduto} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={68}>
                    {custoPorProduto.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 py-10 text-center text-sm text-[#78909C]">Nenhuma venda registrada.</div>
          )}
        </div>
      </div>

      {/* ── Indicadores de Balancete ── */}
      <DashSecao titulo="Indicadores de Balancete" />
      <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KpiCard titulo="Total Matheus" valor={formatarMoeda(somaMatheus)} />
          <KpiCard titulo="Total Enyo" valor={formatarMoeda(somaEnyo)} />
          <KpiCard
            titulo={diferencaBalancete >= 0 ? "Enyo deve a Matheus" : "Matheus deve a Enyo"}
            valor={formatarMoeda(Math.abs(diferencaBalancete) / 2)}
            alerta={Math.abs(diferencaBalancete) > 0}
          />
        </div>
        {balancete.length > 0 && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Gastos mensais por pessoa</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={balancetePorMes}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(Number(v) / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Matheus" fill="#1565C0" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Enyo" fill="#E65100" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Participação no total</p>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={balancetePorComprador} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={72}>
                      {balancetePorComprador.map((_, i) => <Cell key={i} fill={i === 0 ? "#1565C0" : "#E65100"} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Despesas Operacionais ── */}
      <DashSecao titulo="Despesas Operacionais" />
      <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <form onSubmit={handleSalvarDespesa} className="rounded-3xl border border-[#333333] bg-[#181818] p-5">
            <p className="text-sm font-semibold text-[#90A4AE]">Nova despesa</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <CampoCadastro label="Data" type="date" value={form.data} onChange={(v) => setForm((f) => ({ ...f, data: v }))} required />
              <SelectCadastro label="Categoria" value={form.categoria} onChange={(v) => setForm((f) => ({ ...f, categoria: v }))} options={CATEGORIAS_DESPESA} placeholder="Selecione..." />
              <div className="sm:col-span-2">
                <CampoCadastro label="Descrição" value={form.descricao} onChange={(v) => setForm((f) => ({ ...f, descricao: v }))} placeholder="Descrição da despesa" required />
              </div>
              <CampoCadastro label="Valor" value={form.valor} onChange={(v) => setForm((f) => ({ ...f, valor: v }))} placeholder="0,00" required />
            </div>
            <FeedbackBloco mensagem={mensagem} erro={erro} />
            <button type="submit" disabled={salvando}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60">
              <Plus className="h-4 w-4" />
              {salvando ? "Salvando..." : "Registrar despesa"}
            </button>
          </form>
          <div>
            <div className="mb-4 flex items-center gap-3">
              <h3 className="text-lg font-bold">Despesas lançadas</h3>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90A4AE]" />
                <input type="search" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)}
                  className="h-10 w-full rounded-2xl border border-[#333333] bg-[#141414] pl-9 pr-4 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
                  placeholder="Buscar" />
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl border border-[#333333]">
              {despesasFiltradas.length > 0 ? (
                <div className="max-h-[400px] overflow-auto">
                  <table className="min-w-[480px] w-full bg-[#212121] text-left text-sm">
                    <thead className="sticky top-0 bg-[#181818] text-[#90A4AE]">
                      <tr><Th>Data</Th><Th>Categoria</Th><Th>Descrição</Th><Th>Valor</Th><Th>Ações</Th></tr>
                    </thead>
                    <tbody>
                      {despesasFiltradas.map((d) => (
                        <tr
                          key={d.id}
                          onClick={() => abrirDetalheDespesa(d)}
                          className="cursor-pointer border-t border-[#2a2a2a] transition hover:bg-[#2a2a2a]"
                        >
                          <Td>{formatarData(d.data)}</Td>
                          <Td><span className="rounded-full bg-[#CFD8DC] px-2 py-0.5 text-xs font-semibold text-[#546E7A]">{d.categoria}</span></Td>
                          <Td>{d.descricao}</Td>
                          <Td className="font-semibold text-red-600">{formatarMoeda(d.valor)}</Td>
                          <Td>
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleExcluirDespesa(d.id); }}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-900/50 bg-red-900/10 px-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/30">
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

      {despesaSelecionada && (
        <Modal
          titulo={editandoDetalhe ? "Editar despesa" : despesaSelecionada.descricao}
          subtitulo="Despesas"
          onClose={fecharDetalheDespesa}
        >
          <FeedbackBloco mensagem="" erro={erro} />
          {editandoDetalhe ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoCadastro label="Data" type="date" value={formDetalhe.data} onChange={(v) => setFormDetalhe((f) => ({ ...f, data: v }))} required />
              <SelectCadastro label="Categoria" value={formDetalhe.categoria} onChange={(v) => setFormDetalhe((f) => ({ ...f, categoria: v }))} options={CATEGORIAS_DESPESA} placeholder="Selecione..." />
              <div className="sm:col-span-2">
                <CampoCadastro label="Descrição" value={formDetalhe.descricao} onChange={(v) => setFormDetalhe((f) => ({ ...f, descricao: v }))} required />
              </div>
              <CampoCadastro label="Valor" value={formDetalhe.valor} onChange={(v) => setFormDetalhe((f) => ({ ...f, valor: v }))} required />
            </div>
          ) : (
            <div>
              <LinhaDetalhe label="Data" valor={formatarData(despesaSelecionada.data)} />
              <LinhaDetalhe label="Categoria" valor={despesaSelecionada.categoria} />
              <LinhaDetalhe label="Descrição" valor={despesaSelecionada.descricao} />
              <LinhaDetalhe label="Valor" valor={formatarMoeda(despesaSelecionada.valor)} alerta />
            </div>
          )}
          <ModalAcoes
            editando={editandoDetalhe}
            salvando={salvandoDetalhe}
            onEditar={() => setEditandoDetalhe(true)}
            onSalvar={handleSalvarDetalheDespesa}
            onCancelar={() => setEditandoDetalhe(false)}
            onExcluir={handleExcluirDetalheDespesa}
          />
        </Modal>
      )}
    </div>
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
  const [kits, setKits] = useState<Kit[]>([]);
  const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [vendaSelecionada, setVendaSelecionada] = useState<Venda | null>(null);
  const [editandoDetalhe, setEditandoDetalhe] = useState(false);
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false);
  const [formDetalhe, setFormDetalhe] = useState({
    data: "",
    marketplace: "" as Marketplace | "",
    produtoId: "",
    kitId: "",
    quantidade: "",
    valorUnitario: "",
    taxaMarketplace: "",
    desconto: "",
    observacao: "",
  });

  const [form, setForm] = useState({
    data: dataHoje,
    marketplace: "" as Marketplace | "",
    produtoId: "",
    kitId: "",
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
      const [{ data: v }, { data: p }, { data: kt }, { data: u }] = await Promise.all([
        supabase
          .from("vendas")
          .select("*")

          .order("data", { ascending: false }),
        supabase
          .from("produtos")
          .select("*")

          .eq("ativo", true)
          .order("nome"),
        supabase.from("kits").select("id, nome, descricao, kit_itens(id, produto_id, quantidade, produtos(nome, codigo))").order("nome"),
        supabase.from("usuarios_empresa").select("usuario_id, nome, email"),
      ]);
      if (ativo) {
        setVendas((v ?? []).map(mapVenda));
        setProdutos((p ?? []).map(mapProduto));
        setKits((kt ?? []).map(mapKit));
        setUsuariosMap(
          Object.fromEntries((u ?? []).map((m) => [String(m.usuario_id), String(m.nome || m.email || "")]))
        );
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  function selecionarItemVenda(value: string) {
    if (value.startsWith("produto:")) {
      const produto = produtos.find((p) => p.id === value.slice("produto:".length));
      setForm((f) => ({
        ...f,
        produtoId: produto?.id ?? "",
        kitId: "",
        valorUnitario: produto ? String(produto.precoVenda).replace(".", ",") : f.valorUnitario,
      }));
    } else if (value.startsWith("kit:")) {
      const kit = kits.find((k) => k.id === value.slice("kit:".length));
      setForm((f) => ({
        ...f,
        produtoId: "",
        kitId: kit?.id ?? "",
        valorUnitario: kit ? String(precoSugeridoKit(kit, produtos)).replace(".", ",") : f.valorUnitario,
      }));
    } else {
      setForm((f) => ({ ...f, produtoId: "", kitId: "" }));
    }
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    setErro("");

    if (!form.data || !form.marketplace || !(form.produtoId || form.kitId)) {
      setErro("Preencha data, marketplace e produto ou kit.");
      return;
    }

    if (parseNumero(form.quantidade) <= 0 || parseNumero(form.valorUnitario) <= 0) {
      setErro("Quantidade e valor unitário devem ser maiores que zero.");
      return;
    }

    const produto = form.produtoId ? produtos.find((p) => p.id === form.produtoId) : null;
    const kit = form.kitId ? kits.find((k) => k.id === form.kitId) : null;
    const quantidade = parseNumero(form.quantidade);
    setSalvando(true);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("vendas")
      .insert({
        criado_por: usuarioId,
        data: form.data,
        marketplace: form.marketplace,
        produto_id: form.produtoId || null,
        kit_id: form.kitId || null,
        produto_nome: produto?.nome ?? kit?.nome ?? "",
        quantidade,
        valor_unitario: parseNumero(form.valorUnitario),
        taxa_marketplace: parseNumero(form.taxaMarketplace),
        desconto: parseNumero(form.desconto),
        observacao: form.observacao.trim(),
      })
      .select()
      .single();

    if (error) {
      setSalvando(false);
      setErro(error.message);
      return;
    }

    if (data) {
      setVendas((prev) => [mapVenda(data), ...prev]);
    }

    // Decrement stock (do produto direto, ou de cada item do kit vendido)
    const consumo = itensConsumidosPelaVenda({ produtoId: form.produtoId, kitId: form.kitId, quantidade }, kits);
    await aplicarDeltaEstoque(supabase, produtos, [], consumo);
    setSalvando(false);

    setForm({
      data: dataHoje,
      marketplace: "",
      produtoId: "",
      kitId: "",
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
    const venda = vendas.find((v) => v.id === id);

    const supabase = createClient();
    const { error } = await supabase.from("vendas").delete().eq("id", id);

    if (error) {
      setErro(error.message);
      return;
    }

    // Restore stock on sale deletion
    if (venda) {
      const consumo = itensConsumidosPelaVenda(venda, kits);
      await aplicarDeltaEstoque(supabase, produtos, consumo, []);
    }

    setVendas((prev) => prev.filter((v) => v.id !== id));
    setMensagem("Venda removida.");
  }

  function abrirDetalhe(venda: Venda) {
    setVendaSelecionada(venda);
    setEditandoDetalhe(false);
    setFormDetalhe({
      data: venda.data,
      marketplace: venda.marketplace,
      produtoId: venda.produtoId,
      kitId: venda.kitId,
      quantidade: String(venda.quantidade),
      valorUnitario: String(venda.valorUnitario).replace(".", ","),
      taxaMarketplace: String(venda.taxaMarketplace).replace(".", ","),
      desconto: String(venda.desconto).replace(".", ","),
      observacao: venda.observacao,
    });
  }

  function fecharDetalhe() {
    setVendaSelecionada(null);
    setEditandoDetalhe(false);
  }

  async function handleSalvarDetalhe() {
    if (!vendaSelecionada) return;
    if (!formDetalhe.data || !formDetalhe.marketplace || !(formDetalhe.produtoId || formDetalhe.kitId)) {
      setErro("Preencha data, marketplace e produto ou kit.");
      return;
    }
    if (parseNumero(formDetalhe.quantidade) <= 0 || parseNumero(formDetalhe.valorUnitario) <= 0) {
      setErro("Quantidade e valor unitário devem ser maiores que zero.");
      return;
    }

    setSalvandoDetalhe(true);
    setErro("");
    const supabase = createClient();
    const produtoNovo = formDetalhe.produtoId ? produtos.find((p) => p.id === formDetalhe.produtoId) : null;
    const kitNovo = formDetalhe.kitId ? kits.find((k) => k.id === formDetalhe.kitId) : null;
    const payload = {
      data: formDetalhe.data,
      marketplace: formDetalhe.marketplace,
      produto_id: formDetalhe.produtoId || null,
      kit_id: formDetalhe.kitId || null,
      produto_nome: produtoNovo?.nome ?? kitNovo?.nome ?? vendaSelecionada.produtoNome,
      quantidade: parseNumero(formDetalhe.quantidade),
      valor_unitario: parseNumero(formDetalhe.valorUnitario),
      taxa_marketplace: parseNumero(formDetalhe.taxaMarketplace),
      desconto: parseNumero(formDetalhe.desconto),
      observacao: formDetalhe.observacao.trim(),
      atualizado_por: usuarioId,
      atualizado_em: new Date().toISOString(),
    };

    const { error } = await supabase.from("vendas").update(payload).eq("id", vendaSelecionada.id);
    setSalvandoDetalhe(false);
    if (error) { setErro(error.message); return; }

    // Reconcile stock: reverte o consumo antigo (produto ou kit) e aplica o novo
    const consumoAntigo = itensConsumidosPelaVenda(vendaSelecionada, kits);
    const consumoNovo = itensConsumidosPelaVenda(
      { produtoId: payload.produto_id ?? "", kitId: payload.kit_id ?? "", quantidade: payload.quantidade },
      kits
    );
    await aplicarDeltaEstoque(supabase, produtos, consumoAntigo, consumoNovo);

    const vendaAtualizada: Venda = {
      ...vendaSelecionada,
      ...mapVenda({ id: vendaSelecionada.id, criado_por: vendaSelecionada.criadoPor, criado_em: vendaSelecionada.criadoEm, ...payload }),
    };
    setVendas((prev) => prev.map((v) => v.id === vendaSelecionada.id ? vendaAtualizada : v));
    setVendaSelecionada(vendaAtualizada);
    setEditandoDetalhe(false);
    setMensagem("Venda atualizada.");
  }

  async function handleExcluirDetalhe() {
    if (!vendaSelecionada) return;
    await handleExcluir(vendaSelecionada.id);
    fecharDetalhe();
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

  const totalBruto = vendas.reduce((s, v) => s + totalBrutoVenda(v), 0);
  const totalLiquido = vendas.reduce((s, v) => s + totalLiquidoVenda(v), 0);
  const totalItens = vendas.reduce((s, v) => s + v.quantidade, 0);

  return (
    <section className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
      <SectionHeader
        tag="Vendas"
        titulo="Registro de vendas"
        descricao="Cadastre vendas por marketplace e acompanhe o faturamento consolidado."
      />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard titulo="Vendas registradas" valor={String(vendas.length)} />
        <KpiCard titulo="Itens vendidos" valor={String(totalItens)} />
        <KpiCard titulo="Receita bruta" valor={formatarMoeda(totalBruto)} />
        <KpiCard titulo="Receita líquida" valor={formatarMoeda(totalLiquido)} destaque />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          onSubmit={handleSalvar}
          className="rounded-3xl border border-[#333333] bg-[#181818] p-5 min-w-0"
        >
          <p className="text-sm font-semibold text-[#90A4AE]">Nova venda</p>
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
              <label className="mb-1 block text-sm font-medium">Produto ou kit</label>
              <select
                value={form.produtoId ? `produto:${form.produtoId}` : form.kitId ? `kit:${form.kitId}` : ""}
                onChange={(e) => selecionarItemVenda(e.target.value)}
                className="w-full rounded-2xl border border-[#333333] bg-[#141414] px-4 py-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
              >
                <option value="">Selecione um produto ou kit...</option>
                <optgroup label="Produtos">
                  {produtos.map((p) => (
                    <option key={p.id} value={`produto:${p.id}`}>
                      {p.codigo ? `[${p.codigo}] ` : ""}{p.nome}
                    </option>
                  ))}
                </optgroup>
                {kits.length > 0 && (
                  <optgroup label="Kits">
                    {kits.map((k) => (
                      <option key={k.id} value={`kit:${k.id}`}>{k.nome}</option>
                    ))}
                  </optgroup>
                )}
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
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60 sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {salvando ? "Salvando..." : "Registrar venda"}
          </button>
        </form>

        <div className="min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#90A4AE]">Histórico</p>
              <h3 className="mt-1 text-xl font-bold">Vendas registradas</h3>
              <p className="mt-0.5 text-xs text-[#78909C]">Clique em uma venda para ver detalhes e editar.</p>
            </div>
            <div className="relative sm:min-w-64">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90A4AE]" />
              <input
                type="search"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="h-11 w-full rounded-2xl border border-[#333333] bg-[#141414] pl-11 pr-4 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
                placeholder="Buscar venda"
              />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-[#333333]">
            {vendasFiltradas.length > 0 ? (
              <div className="max-h-[480px] overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[560px] bg-[#212121] text-left text-sm">
                  <thead className="sticky top-0 bg-[#181818] text-[#90A4AE]">
                    <tr>
                      <Th>Data</Th>
                      <Th>Marketplace</Th>
                      <Th>Produto</Th>
                      <Th>Qtd</Th>
                      <Th>Bruto</Th>
                      <Th>Líquido</Th>
                      <Th>Lançado por</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasFiltradas.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => abrirDetalhe(v)}
                        className="cursor-pointer border-t border-[#2a2a2a] transition hover:bg-[#2a2a2a]"
                      >
                        <Td>{formatarData(v.data)}</Td>
                        <Td>
                          <MarketplaceBadge marketplace={v.marketplace} />
                        </Td>
                        <Td className="font-semibold">
                          {v.produtoNome || "-"}
                          {v.kitId && (
                            <span className="ml-1.5 rounded-full bg-[#546E7A]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#90A4AE]">kit</span>
                          )}
                        </Td>
                        <Td>{v.quantidade}</Td>
                        <Td>{formatarMoeda(totalBrutoVenda(v))}</Td>
                        <Td className="font-semibold text-[#90A4AE]">{formatarMoeda(totalLiquidoVenda(v))}</Td>
                        <Td className="text-xs text-[#78909C]">{nomeUsuario(usuariosMap, v.criadoPor)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EstadoTabelaVazia texto="Nenhuma venda registrada." />
            )}
          </div>
        </div>
      </div>

      {vendaSelecionada && (
        <Modal
          titulo={editandoDetalhe ? "Editar venda" : vendaSelecionada.produtoNome || "Detalhe da venda"}
          subtitulo="Vendas"
          onClose={fecharDetalhe}
          largo={editandoDetalhe}
        >
          <FeedbackBloco mensagem="" erro={erro} />
          {editandoDetalhe ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoCadastro label="Data" type="date" value={formDetalhe.data} onChange={(v) => setFormDetalhe((f) => ({ ...f, data: v }))} required />
              <SelectCadastro label="Marketplace" value={formDetalhe.marketplace} onChange={(v) => setFormDetalhe((f) => ({ ...f, marketplace: v as Marketplace }))} options={MARKETPLACES} placeholder="Selecione..." />
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Produto ou kit</label>
                <select
                  value={formDetalhe.produtoId ? `produto:${formDetalhe.produtoId}` : formDetalhe.kitId ? `kit:${formDetalhe.kitId}` : ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.startsWith("produto:")) {
                      setFormDetalhe((f) => ({ ...f, produtoId: value.slice("produto:".length), kitId: "" }));
                    } else if (value.startsWith("kit:")) {
                      setFormDetalhe((f) => ({ ...f, produtoId: "", kitId: value.slice("kit:".length) }));
                    } else {
                      setFormDetalhe((f) => ({ ...f, produtoId: "", kitId: "" }));
                    }
                  }}
                  className="w-full rounded-2xl border border-[#333333] bg-[#141414] px-4 py-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
                >
                  <option value="">Selecione um produto ou kit...</option>
                  <optgroup label="Produtos">
                    {produtos.map((p) => (
                      <option key={p.id} value={`produto:${p.id}`}>{p.codigo ? `[${p.codigo}] ` : ""}{p.nome}</option>
                    ))}
                  </optgroup>
                  {kits.length > 0 && (
                    <optgroup label="Kits">
                      {kits.map((k) => (
                        <option key={k.id} value={`kit:${k.id}`}>{k.nome}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
              <CampoCadastro label="Quantidade" value={formDetalhe.quantidade} onChange={(v) => setFormDetalhe((f) => ({ ...f, quantidade: v }))} required />
              <CampoCadastro label="Valor unitário" value={formDetalhe.valorUnitario} onChange={(v) => setFormDetalhe((f) => ({ ...f, valorUnitario: v }))} required />
              <CampoCadastro label="Taxa marketplace" value={formDetalhe.taxaMarketplace} onChange={(v) => setFormDetalhe((f) => ({ ...f, taxaMarketplace: v }))} />
              <CampoCadastro label="Desconto" value={formDetalhe.desconto} onChange={(v) => setFormDetalhe((f) => ({ ...f, desconto: v }))} />
              <div className="sm:col-span-2">
                <CampoCadastro label="Observação" value={formDetalhe.observacao} onChange={(v) => setFormDetalhe((f) => ({ ...f, observacao: v }))} />
              </div>
            </div>
          ) : (
            <div>
              <LinhaDetalhe label="Data" valor={formatarData(vendaSelecionada.data)} />
              <LinhaDetalhe label="Marketplace" valor={<MarketplaceBadge marketplace={vendaSelecionada.marketplace} />} />
              <LinhaDetalhe label={vendaSelecionada.kitId ? "Kit" : "Produto"} valor={vendaSelecionada.produtoNome || "-"} />
              <LinhaDetalhe label="Quantidade" valor={vendaSelecionada.quantidade} />
              {vendaSelecionada.kitId && (() => {
                const kit = kits.find((k) => k.id === vendaSelecionada.kitId);
                return kit ? (
                  <div className="border-b border-[#2a2a2a] py-2.5 text-sm">
                    <span className="text-[#90A4AE]">Consumo do estoque</span>
                    <ul className="mt-1.5 space-y-1 text-xs text-[#78909C]">
                      {kit.itens.map((it) => (
                        <li key={it.id}>
                          {it.quantidade * vendaSelecionada.quantidade}× {it.produtoNome}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })()}
              <LinhaDetalhe label="Valor unitário" valor={formatarMoeda(vendaSelecionada.valorUnitario)} />
              <LinhaDetalhe label="Subtotal bruto" valor={formatarMoeda(vendaSelecionada.valorUnitario * vendaSelecionada.quantidade)} />
              <LinhaDetalhe label="Desconto" valor={`- ${formatarMoeda(vendaSelecionada.desconto)}`} alerta={vendaSelecionada.desconto > 0} />
              <LinhaDetalhe label="Taxa marketplace" valor={`- ${formatarMoeda(vendaSelecionada.taxaMarketplace)}`} alerta={vendaSelecionada.taxaMarketplace > 0} />
              <LinhaDetalhe label="Valor líquido recebido" valor={formatarMoeda(totalLiquidoVenda(vendaSelecionada))} destaque />
              {vendaSelecionada.observacao && <LinhaDetalhe label="Observação" valor={vendaSelecionada.observacao} />}
              <HistoricoRegistro
                usuariosMap={usuariosMap}
                criadoPor={vendaSelecionada.criadoPor}
                criadoEm={vendaSelecionada.criadoEm}
                atualizadoPor={vendaSelecionada.atualizadoPor}
                atualizadoEm={vendaSelecionada.atualizadoEm}
              />
            </div>
          )}
          <ModalAcoes
            editando={editandoDetalhe}
            salvando={salvandoDetalhe}
            onEditar={() => setEditandoDetalhe(true)}
            onSalvar={handleSalvarDetalhe}
            onCancelar={() => setEditandoDetalhe(false)}
            onExcluir={handleExcluirDetalhe}
          />
        </Modal>
      )}
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
  type AbaC = "produtos" | "materias-primas" | "clientes" | "fornecedores" | "kits";
  const [aba, setAba] = useState<AbaC>("produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const [{ data: p }, { data: mp }, { data: cl }, { data: fo }, { data: kt }] = await Promise.all([
        supabase.from("produtos").select("*").order("nome"),
        supabase.from("materias_primas").select("*").eq("ativo", true).order("nome"),
        supabase.from("clientes").select("*").order("nome"),
        supabase.from("fornecedores").select("*").order("nome"),
        supabase.from("kits").select("id, nome, descricao, kit_itens(id, produto_id, quantidade, produtos(nome, codigo))").order("nome"),
      ]);
      if (ativo) {
        setProdutos((p ?? []).map(mapProduto));
        setMateriasPrimas((mp ?? []).map(mapMateriaPrima));
        setClientes((cl ?? []).map(mapCliente));
        setFornecedores((fo ?? []).map(mapFornecedor));
        setKits((kt ?? []).map(mapKit));
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
    { id: "kits", label: "Kits" },
  ];

  return (
    <section className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          tag="Cadastro"
          titulo="Cadastros do sistema"
          descricao="Produtos, matérias-primas, clientes e fornecedores."
        />
        <div className="flex flex-wrap gap-2 rounded-3xl border border-[#333333] bg-[#181818] p-2 shrink-0">
          {ABAS_C.map((t) => (
            <button key={t.id} type="button" onClick={() => setAba(t.id)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                aba === t.id ? "bg-[#546E7A] text-white" : "text-[#90A4AE] hover:bg-[#2a2a2a]"
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
      {aba === "kits" && (
        <KitsSubModulo usuarioId={usuarioId} isAdmin={isAdmin} produtos={produtos} kits={kits} setKits={setKits} />
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

  const [form, setForm] = useState(() => ({
    codigo: proximoCodigo(produtos, "EK-"),
    nome: "",
    categoria: "",
    custo: "",
    precoVenda: "",
    estoqueMinimo: "",
    ativo: true,
  }));
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

  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [componentesDetalhe, setComponentesDetalhe] = useState<ComponenteProduto[]>([]);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

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
    setForm({
      codigo: proximoCodigo(produtos, "EK-"),
      nome: "",
      categoria: "",
      custo: "",
      precoVenda: "",
      estoqueMinimo: "",
      ativo: true,
    });
    setCompRascunho([]); setCompEdicao([]);
    setEditandoId(null); setMensagem(""); setErro("");
  }

  async function iniciarEdicao(produto: Produto) {
    setForm({
      codigo: produto.codigo,
      nome: produto.nome,
      categoria: produto.categoria,
      custo: produto.custo ? String(produto.custo).replace(".", ",") : "",
      precoVenda: produto.precoVenda ? String(produto.precoVenda).replace(".", ",") : "",
      estoqueMinimo: produto.estoqueMinimo ? String(produto.estoqueMinimo) : "",
      ativo: produto.ativo,
    });
    setCompRascunho([]);
    setEditandoId(produto.id);
    setCarregandoComp(true);
    const supabase = createClient();
    const { data } = await supabase.from("componentes_produto").select("*").eq("produto_id", produto.id).order("created_at");
    setCompEdicao((data ?? []).map(mapComponente));
    setCarregandoComp(false);
    setFormComp({ materiaPrimaId: "", nomePeca: "", quantidade: "1", linkCompra: "" });
  }

  async function abrirDetalhe(produto: Produto) {
    setProdutoSelecionado(produto);
    setCarregandoDetalhe(true);
    const supabase = createClient();
    const { data } = await supabase.from("componentes_produto").select("*").eq("produto_id", produto.id).order("created_at");
    setComponentesDetalhe((data ?? []).map(mapComponente));
    setCarregandoDetalhe(false);
  }

  function fecharDetalhe() {
    setProdutoSelecionado(null);
    setComponentesDetalhe([]);
  }

  function handleEditarDoDetalhe() {
    if (!produtoSelecionado) return;
    const produto = produtoSelecionado;
    fecharDetalhe();
    iniciarEdicao(produto);
  }

  async function handleExcluirDoDetalhe() {
    if (!produtoSelecionado) return;
    const id = produtoSelecionado.id;
    fecharDetalhe();
    await handleExcluir(id);
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
    const payload = {
      criado_por: usuarioId,
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      categoria: form.categoria.trim(),
      custo: parseNumero(form.custo),
      preco_venda: parseNumero(form.precoVenda),
      estoque_minimo: parseNumero(form.estoqueMinimo),
      ativo: form.ativo,
    };
    if (editandoId) {
      const { error } = await supabase.from("produtos").update(payload).eq("id", editandoId);
      setSalvando(false);
      if (error) { setErro(error.message); return; }
      setProdutos((prev) => prev.map((p) => p.id === editandoId ? {
        ...p,
        codigo: payload.codigo,
        nome: payload.nome,
        categoria: payload.categoria,
        custo: payload.custo,
        precoVenda: payload.preco_venda,
        estoqueMinimo: payload.estoque_minimo,
        ativo: payload.ativo,
      } : p));
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
    const { error } = await supabase.from("produtos").delete().eq("id", id);
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
      <form onSubmit={handleSalvar} className="rounded-3xl border border-[#333333] bg-[#181818] p-5 self-start">
        <p className="text-sm font-semibold text-[#90A4AE]">{editandoId ? "Editando produto" : "Novo produto"}</p>
        <FeedbackBloco mensagem={mensagem} erro={erro} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Código (SKU)</label>
            <div className="flex h-[46px] items-center gap-2 rounded-2xl border border-[#333333] bg-[#CFD8DC] px-4 text-sm font-semibold text-[#546E7A] select-none">
              <span>{form.codigo}</span>
              <span className="ml-auto text-xs font-normal text-[#90A4AE]">automático</span>
            </div>
          </div>
          <CampoCadastro label="Nome" value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome do produto" required />
          <div className="sm:col-span-2">
            <CampoCadastro label="Categoria" value={form.categoria} onChange={(v) => setForm((f) => ({ ...f, categoria: v }))} placeholder="Ex: Patins, Estrutura..." />
          </div>
          <CampoCadastro label="Custo" value={form.custo} onChange={(v) => setForm((f) => ({ ...f, custo: v }))} placeholder="0,00" />
          <CampoCadastro label="Preço de venda sugerido" value={form.precoVenda} onChange={(v) => setForm((f) => ({ ...f, precoVenda: v }))} placeholder="0,00" />
          <CampoCadastro label="Estoque mínimo" value={form.estoqueMinimo} onChange={(v) => setForm((f) => ({ ...f, estoqueMinimo: v }))} placeholder="0" />
          <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-[#333333] bg-[#212121] px-4 py-3 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded border-[#333333] accent-[#546E7A]" />
            <span className="font-semibold">Ativo</span>
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-[#333333] bg-[#212121] p-4">
          <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Matérias-primas do produto</p>
          {carregandoComp ? (
            <p className="py-2 text-xs text-[#78909C]">Carregando componentes...</p>
          ) : (
            <>
              {componentesAtivos.length > 0 && (
                <div className="mb-3 overflow-hidden rounded-xl border border-[#2a2a2a]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#181818] text-[#90A4AE]">
                      <tr><Th>Matéria-prima</Th><Th>Qtd</Th>{editandoId && <Th>Link</Th>}<Th>{" "}</Th></tr>
                    </thead>
                    <tbody>
                      {editandoId
                        ? compEdicao.map((c) => (
                            <tr key={c.id} className="border-t border-[#2a2a2a]">
                              <Td className="font-semibold">{c.nomePeca}</Td>
                              <Td>{c.quantidade}</Td>
                              <Td>{c.linkCompra ? <a href={c.linkCompra} target="_blank" rel="noopener noreferrer" className="text-[#90A4AE] underline">ver</a> : <span className="text-[#90A4AE]">—</span>}</Td>
                              <Td><button type="button" onClick={() => removerCompEdicao(c.id)} className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20"><X className="h-3 w-3" /></button></Td>
                            </tr>
                          ))
                        : compRascunho.map((c) => (
                            <tr key={c.tempId} className="border-t border-[#2a2a2a]">
                              <Td className="font-semibold">{c.nomePeca}</Td>
                              <Td>{c.quantidade}</Td>
                              <Td><button type="button" onClick={() => setCompRascunho((prev) => prev.filter((x) => x.tempId !== c.tempId))} className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20"><X className="h-3 w-3" /></button></Td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <select value={formComp.materiaPrimaId}
                  onChange={(e) => selecionarMP(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                  className="h-10 w-full rounded-xl border border-[#333333] bg-[#212121] px-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]">
                  <option value="">Selecionar matéria-prima...</option>
                  {materiasPrimas.map((mp) => (
                    <option key={mp.id} value={mp.id}>{mp.codigo ? `[${mp.codigo}] ` : ""}{mp.nome}</option>
                  ))}
                </select>
                <div className="flex gap-2">
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
                    className="h-10 w-24 rounded-xl border border-[#333333] bg-[#212121] px-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (editandoId) {
                        adicionarCompEdicao(editandoId);
                      } else {
                        adicionarCompRascunho();
                      }
                    }}
                    disabled={salvandoComp}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4 shrink-0" />
                    {salvandoComp ? "Salvando..." : "Adicionar"}
                  </button>
                </div>
              </div>
              {materiasPrimas.length === 0 && (
                <p className="mt-2 text-xs text-amber-400">Cadastre matérias-primas na aba <strong>Matérias-primas</strong> primeiro.</p>
              )}
            </>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={salvando}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60">
            <Save className="h-4 w-4" />{salvando ? "Salvando..." : editandoId ? "Atualizar" : "Cadastrar produto"}
          </button>
          {editandoId && (
            <button type="button" onClick={limparForm}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#333333] bg-[#212121] px-4 text-sm font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </form>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold">{produtos.length} produto(s)</h3>
          <div className="relative sm:min-w-56">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90A4AE]" />
            <input type="search" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)}
              className="h-11 w-full rounded-2xl border border-[#333333] bg-[#141414] pl-11 pr-4 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
              placeholder="Buscar produto" />
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#333333]">
          {produtosFiltrados.length > 0 ? (
            <div className="max-h-[600px] overflow-auto">
              <table className="min-w-[420px] w-full bg-[#212121] text-left text-sm">
                <thead className="sticky top-0 bg-[#181818] text-[#90A4AE]">
                  <tr><Th>Código</Th><Th>Nome</Th><Th>Categoria</Th><Th>Preço venda</Th><Th>Ativo</Th><Th>Ações</Th></tr>
                </thead>
                <tbody>
                  {produtosFiltrados.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => abrirDetalhe(p)}
                      className={`cursor-pointer border-t border-[#2a2a2a] transition hover:bg-[#2a2a2a] ${editandoId === p.id ? "bg-[#CFD8DC]" : ""}`}
                    >
                      <Td className="text-xs text-[#78909C]">{p.codigo || "-"}</Td>
                      <Td className="font-semibold">{p.nome}</Td>
                      <Td>{p.categoria || "-"}</Td>
                      <Td>{p.precoVenda > 0 ? formatarMoeda(p.precoVenda) : <span className="text-[#90A4AE]">—</span>}</Td>
                      <Td><span className={`text-xs font-semibold ${p.ativo ? "text-emerald-400" : "text-[#90A4AE]"}`}>{p.ativo ? "Sim" : "Não"}</span></Td>
                      <Td>
                        <div className="flex gap-1">
                          <button type="button" onClick={(e) => { e.stopPropagation(); iniciarEdicao(p); }}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-2 text-xs font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]">
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleExcluir(p.id); }}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-900/50 bg-red-900/10 px-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/30">
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

      {produtoSelecionado && (
        <Modal
          titulo={produtoSelecionado.nome}
          subtitulo="Produtos"
          onClose={fecharDetalhe}
        >
          <div>
            <LinhaDetalhe label="Código" valor={produtoSelecionado.codigo || "-"} />
            <LinhaDetalhe label="Categoria" valor={produtoSelecionado.categoria || "-"} />
            <LinhaDetalhe label="Custo" valor={produtoSelecionado.custo > 0 ? formatarMoeda(produtoSelecionado.custo) : "—"} />
            <LinhaDetalhe label="Preço de venda" valor={produtoSelecionado.precoVenda > 0 ? formatarMoeda(produtoSelecionado.precoVenda) : "—"} destaque />
            <LinhaDetalhe label="Estoque mínimo" valor={produtoSelecionado.estoqueMinimo} />
            <LinhaDetalhe
              label="Ativo"
              valor={produtoSelecionado.ativo ? "Sim" : "Não"}
              alerta={!produtoSelecionado.ativo}
            />

            <p className="mb-2 mt-5 text-sm font-semibold text-[#90A4AE]">Matérias-primas que compõem o produto</p>
            {carregandoDetalhe ? (
              <p className="py-3 text-xs text-[#78909C]">Carregando componentes...</p>
            ) : componentesDetalhe.length > 0 ? (
              <div className="overflow-auto rounded-xl border border-[#2a2a2a]">
                <table className="min-w-[420px] w-full text-left text-xs">
                  <thead className="bg-[#181818] text-[#90A4AE]">
                    <tr><Th>Matéria-prima</Th><Th>Qtd</Th><Th>Link</Th></tr>
                  </thead>
                  <tbody>
                    {componentesDetalhe.map((c) => (
                      <tr key={c.id} className="border-t border-[#2a2a2a]">
                        <Td className="font-semibold">{c.nomePeca}</Td>
                        <Td>{c.quantidade}</Td>
                        <Td>
                          {c.linkCompra ? (
                            <a href={c.linkCompra} target="_blank" rel="noopener noreferrer" className="text-[#90A4AE] underline">Ver</a>
                          ) : <span className="text-[#90A4AE]">—</span>}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-3 text-xs text-[#78909C]">Nenhuma matéria-prima cadastrada para este produto.</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-[#2a2a2a] pt-5">
            <button
              type="button"
              onClick={handleEditarDoDetalhe}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64]"
            >
              <Pencil className="h-4 w-4" /> Editar
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleExcluirDoDetalhe}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-red-900/50 bg-red-900/10 px-4 text-sm font-semibold text-red-400 transition hover:bg-red-900/30"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Kits ───────────────────────────────────────────────────────────────────

type KitItemRascunho = { tempId: string; produtoId: string; produtoNome: string; produtoCodigo: string; quantidade: number };

function KitsSubModulo({
  usuarioId,
  isAdmin,
  produtos,
  kits,
  setKits,
}: {
  usuarioId: string;
  isAdmin: boolean;
  produtos: Produto[];
  kits: Kit[];
  setKits: React.Dispatch<React.SetStateAction<Kit[]>>;
}) {
  const [salvando, setSalvando] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [form, setForm] = useState({ nome: "", descricao: "" });
  const [itensRascunho, setItensRascunho] = useState<KitItemRascunho[]>([]);
  const [itensEdicao, setItensEdicao] = useState<KitItem[]>([]);
  const [salvandoItem, setSalvandoItem] = useState(false);
  const [formItem, setFormItem] = useState({ produtoId: "", quantidade: "1" });

  const [kitSelecionado, setKitSelecionado] = useState<Kit | null>(null);

  function selecionarProdutoItem(produtoId: string) {
    const produto = produtos.find((p) => p.id === produtoId);
    setFormItem(produto
      ? { produtoId, quantidade: "1" }
      : { produtoId: "", quantidade: "1" }
    );
  }

  function adicionarItemRascunho() {
    const produto = produtos.find((p) => p.id === formItem.produtoId);
    if (!produto) { setErro("Selecione um produto."); return; }
    setErro("");
    setItensRascunho((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        produtoId: produto.id,
        produtoNome: produto.nome,
        produtoCodigo: produto.codigo,
        quantidade: parseNumero(formItem.quantidade) || 1,
      },
    ]);
    setFormItem({ produtoId: "", quantidade: "1" });
  }

  async function adicionarItemEdicao(kitId: string) {
    const produto = produtos.find((p) => p.id === formItem.produtoId);
    if (!produto) { setErro("Selecione um produto."); return; }
    setSalvandoItem(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("kit_itens")
      .insert({
        kit_id: kitId,
        criado_por: usuarioId,
        produto_id: produto.id,
        quantidade: parseNumero(formItem.quantidade) || 1,
      })
      .select("id, produto_id, quantidade, produtos(nome, codigo)")
      .single();
    setSalvandoItem(false);
    if (error) { setErro(error.message); return; }
    if (data) setItensEdicao((prev) => [...prev, mapKitItem(data)]);
    setFormItem({ produtoId: "", quantidade: "1" });
  }

  async function removerItemEdicao(itemId: string) {
    if (!confirm("Remover este item do kit?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("kit_itens").delete().eq("id", itemId);
    if (error) { setErro(error.message); return; }
    setItensEdicao((prev) => prev.filter((i) => i.id !== itemId));
  }

  function limparForm() {
    setForm({ nome: "", descricao: "" });
    setItensRascunho([]); setItensEdicao([]);
    setFormItem({ produtoId: "", quantidade: "1" });
    setEditandoId(null); setMensagem(""); setErro("");
  }

  function iniciarEdicao(kit: Kit) {
    setForm({ nome: kit.nome, descricao: kit.descricao });
    setItensRascunho([]);
    setItensEdicao(kit.itens);
    setEditandoId(kit.id);
    setFormItem({ produtoId: "", quantidade: "1" });
    setMensagem(""); setErro("");
  }

  function abrirDetalhe(kit: Kit) {
    setKitSelecionado(kit);
  }

  function fecharDetalhe() {
    setKitSelecionado(null);
  }

  function handleEditarDoDetalhe() {
    if (!kitSelecionado) return;
    const kit = kitSelecionado;
    fecharDetalhe();
    iniciarEdicao(kit);
  }

  async function handleExcluirDoDetalhe() {
    if (!kitSelecionado) return;
    const id = kitSelecionado.id;
    fecharDetalhe();
    await handleExcluir(id);
  }

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(""); setErro("");
    if (!form.nome.trim()) { setErro("Informe o nome do kit."); return; }
    setSalvando(true);
    const supabase = createClient();
    const payload = {
      criado_por: usuarioId,
      nome: form.nome.trim(),
      descricao: form.descricao.trim(),
    };
    if (editandoId) {
      const { error } = await supabase.from("kits").update(payload).eq("id", editandoId);
      setSalvando(false);
      if (error) { setErro(error.message); return; }
      setKits((prev) => prev.map((k) => k.id === editandoId ? { ...k, nome: payload.nome, descricao: payload.descricao, itens: itensEdicao } : k));
      setMensagem("Kit atualizado."); limparForm();
    } else {
      if (itensRascunho.length === 0) { setSalvando(false); setErro("Adicione pelo menos um item ao kit."); return; }
      const { data, error } = await supabase.from("kits").insert(payload).select().single();
      if (error) { setSalvando(false); setErro(error.message); return; }
      await supabase.from("kit_itens").insert(
        itensRascunho.map((it) => ({ kit_id: data.id, criado_por: usuarioId, produto_id: it.produtoId, quantidade: it.quantidade }))
      );
      setSalvando(false);
      setKits((prev) => [
        {
          id: String(data.id),
          nome: payload.nome,
          descricao: payload.descricao,
          itens: itensRascunho.map((it) => ({ id: it.tempId, produtoId: it.produtoId, produtoNome: it.produtoNome, produtoCodigo: it.produtoCodigo, quantidade: it.quantidade })),
        },
        ...prev,
      ]);
      setMensagem(`Kit cadastrado com ${itensRascunho.length} item(ns).`); limparForm();
    }
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir este kit?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("kits").delete().eq("id", id);
    if (error) { setErro(error.message); return; }
    setKits((prev) => prev.filter((k) => k.id !== id));
    if (editandoId === id) limparForm();
    setMensagem("Kit removido.");
  }

  const kitsFiltrados = kits.filter((k) => {
    const q = termoBusca.toLowerCase();
    return !q || k.nome.toLowerCase().includes(q) || k.itens.some((i) => i.produtoNome.toLowerCase().includes(q) || i.produtoCodigo.toLowerCase().includes(q));
  });

  const itensAtivos = editandoId ? itensEdicao : itensRascunho;

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form onSubmit={handleSalvar} className="rounded-3xl border border-[#333333] bg-[#181818] p-5 self-start">
        <p className="text-sm font-semibold text-[#90A4AE]">{editandoId ? "Editando kit" : "Novo kit"}</p>
        <FeedbackBloco mensagem={mensagem} erro={erro} />
        <div className="mt-4 grid gap-4">
          <CampoCadastro label="Nome do kit" value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Ex: Kit 2 Carrinhos 400kg" required />
          <CampoCadastro label="Descrição" value={form.descricao} onChange={(v) => setForm((f) => ({ ...f, descricao: v }))} placeholder="Observação opcional" />
        </div>

        <div className="mt-5 rounded-2xl border border-[#333333] bg-[#212121] p-4">
          <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Produtos do kit</p>
          {itensAtivos.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-xl border border-[#2a2a2a]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#181818] text-[#90A4AE]">
                  <tr><Th>Produto</Th><Th>Qtd</Th><Th>{" "}</Th></tr>
                </thead>
                <tbody>
                  {editandoId
                    ? itensEdicao.map((it) => (
                        <tr key={it.id} className="border-t border-[#2a2a2a]">
                          <Td className="font-semibold">{it.produtoCodigo ? `[${it.produtoCodigo}] ` : ""}{it.produtoNome}</Td>
                          <Td>{it.quantidade}</Td>
                          <Td><button type="button" onClick={() => removerItemEdicao(it.id)} className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20"><X className="h-3 w-3" /></button></Td>
                        </tr>
                      ))
                    : itensRascunho.map((it) => (
                        <tr key={it.tempId} className="border-t border-[#2a2a2a]">
                          <Td className="font-semibold">{it.produtoCodigo ? `[${it.produtoCodigo}] ` : ""}{it.produtoNome}</Td>
                          <Td>{it.quantidade}</Td>
                          <Td><button type="button" onClick={() => setItensRascunho((prev) => prev.filter((x) => x.tempId !== it.tempId))} className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20"><X className="h-3 w-3" /></button></Td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <select value={formItem.produtoId}
              onChange={(e) => selecionarProdutoItem(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              className="h-10 w-full rounded-xl border border-[#333333] bg-[#212121] px-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]">
              <option value="">Selecionar produto...</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.codigo ? `[${p.codigo}] ` : ""}{p.nome}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                type="text"
                value={formItem.quantidade}
                onChange={(e) => setFormItem((f) => ({ ...f, quantidade: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (formItem.produtoId && !salvandoItem) {
                      editandoId ? adicionarItemEdicao(editandoId) : adicionarItemRascunho();
                    }
                  }
                }}
                placeholder="Qtd"
                className="h-10 w-24 rounded-xl border border-[#333333] bg-[#212121] px-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (editandoId) {
                    adicionarItemEdicao(editandoId);
                  } else {
                    adicionarItemRascunho();
                  }
                }}
                disabled={salvandoItem}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-50"
              >
                <Plus className="h-4 w-4 shrink-0" />
                {salvandoItem ? "Salvando..." : "Adicionar"}
              </button>
            </div>
          </div>
          {produtos.length === 0 && (
            <p className="mt-2 text-xs text-amber-400">Cadastre produtos na aba <strong>Produtos</strong> primeiro.</p>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={salvando}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60">
            <Save className="h-4 w-4" />{salvando ? "Salvando..." : editandoId ? "Atualizar" : "Cadastrar kit"}
          </button>
          {editandoId && (
            <button type="button" onClick={limparForm}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#333333] bg-[#212121] px-4 text-sm font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </form>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold">{kits.length} kit(s)</h3>
          <div className="relative sm:min-w-56">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90A4AE]" />
            <input type="search" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)}
              className="h-11 w-full rounded-2xl border border-[#333333] bg-[#141414] pl-11 pr-4 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
              placeholder="Buscar kit ou produto" />
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#333333]">
          {kitsFiltrados.length > 0 ? (
            <div className="max-h-[600px] overflow-auto">
              <table className="min-w-[420px] w-full bg-[#212121] text-left text-sm">
                <thead className="sticky top-0 bg-[#181818] text-[#90A4AE]">
                  <tr><Th>Kit</Th><Th>Itens</Th><Th>Ações</Th></tr>
                </thead>
                <tbody>
                  {kitsFiltrados.map((k) => (
                    <tr
                      key={k.id}
                      onClick={() => abrirDetalhe(k)}
                      className={`cursor-pointer border-t border-[#2a2a2a] transition hover:bg-[#2a2a2a] ${editandoId === k.id ? "bg-[#CFD8DC]" : ""}`}
                    >
                      <Td className="font-semibold">{k.nome}</Td>
                      <Td className="text-xs text-[#78909C]">{k.itens.length} produto{k.itens.length === 1 ? "" : "s"}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <button type="button" onClick={(e) => { e.stopPropagation(); iniciarEdicao(k); }}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-2 text-xs font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]">
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); handleExcluir(k.id); }}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-900/50 bg-red-900/10 px-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/30">
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
            <EstadoTabelaVazia texto="Nenhum kit cadastrado." />
          )}
        </div>
      </div>

      {kitSelecionado && (
        <Modal
          titulo={kitSelecionado.nome}
          subtitulo="Kits"
          onClose={fecharDetalhe}
        >
          <div>
            {kitSelecionado.descricao && <LinhaDetalhe label="Descrição" valor={kitSelecionado.descricao} />}
            <p className="mb-2 mt-5 text-sm font-semibold text-[#90A4AE]">Produtos que compõem o kit</p>
            {kitSelecionado.itens.length > 0 ? (
              <div className="overflow-auto rounded-xl border border-[#2a2a2a]">
                <table className="min-w-[320px] w-full text-left text-xs">
                  <thead className="bg-[#181818] text-[#90A4AE]">
                    <tr><Th>Produto</Th><Th>Qtd</Th></tr>
                  </thead>
                  <tbody>
                    {kitSelecionado.itens.map((it) => (
                      <tr key={it.id} className="border-t border-[#2a2a2a]">
                        <Td className="font-semibold">{it.produtoCodigo ? `[${it.produtoCodigo}] ` : ""}{it.produtoNome}</Td>
                        <Td>{it.quantidade}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-3 text-xs text-[#78909C]">Nenhum produto cadastrado para este kit.</p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3 border-t border-[#2a2a2a] pt-5">
            <button
              type="button"
              onClick={handleEditarDoDetalhe}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64]"
            >
              <Pencil className="h-4 w-4" /> Editar
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleExcluirDoDetalhe}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-red-900/50 bg-red-900/10 px-4 text-sm font-semibold text-red-400 transition hover:bg-red-900/30"
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
            )}
          </div>
        </Modal>
      )}
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
    const { error } = await supabase.from("materias_primas").delete().eq("id", id);
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
      <form onSubmit={handleSalvar} className="rounded-3xl border border-[#333333] bg-[#181818] p-5">
        <p className="text-sm font-semibold text-[#90A4AE]">
          {editandoId ? "Editando matéria-prima" : "Nova matéria-prima"}
        </p>
        <FeedbackBloco mensagem={mensagem} erro={erro} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Código</label>
            <div className="flex h-[46px] items-center gap-2 rounded-2xl border border-[#333333] bg-[#CFD8DC] px-4 text-sm font-semibold text-[#546E7A] select-none">
              <span>{form.codigo}</span>
              <span className="ml-auto text-xs font-normal text-[#90A4AE]">automático</span>
            </div>
          </div>
          <CampoCadastro label="Nome" value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome da matéria-prima" required />
          <CampoCadastro label="Unidade" value={form.unidade} onChange={(v) => setForm((f) => ({ ...f, unidade: v }))} placeholder="un, kg, m..." />
          <div className="sm:col-span-2">
            <CampoCadastro label="Link de compra (e-commerce)" value={form.linkCompra} onChange={(v) => setForm((f) => ({ ...f, linkCompra: v }))} placeholder="https://..." />
          </div>
          <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-[#333333] bg-[#212121] px-4 py-3 text-sm">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))}
              className="h-4 w-4 rounded border-[#333333] accent-[#546E7A]" />
            <span className="font-semibold">Ativo</span>
          </label>
        </div>
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={salvando}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60">
            <Save className="h-4 w-4" />
            {salvando ? "Salvando..." : editandoId ? "Atualizar" : "Cadastrar"}
          </button>
          {editandoId && (
            <button type="button" onClick={limparForm}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#333333] bg-[#212121] px-4 text-sm font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </form>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold">Catálogo</h3>
          <div className="relative sm:min-w-64">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90A4AE]" />
            <input type="search" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)}
              className="h-11 w-full rounded-2xl border border-[#333333] bg-[#141414] pl-11 pr-4 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
              placeholder="Buscar" />
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#333333]">
          {filtradas.length > 0 ? (
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-[580px] w-full bg-[#212121] text-left text-sm">
                <thead className="sticky top-0 bg-[#181818] text-[#90A4AE]">
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
                    <tr key={m.id} className="border-t border-[#2a2a2a]">
                      <Td className="text-xs text-[#78909C]">{m.codigo || "-"}</Td>
                      <Td className="font-semibold">{m.nome}</Td>
                      <Td>{m.unidade}</Td>
                      <Td>
                        {m.linkCompra ? (
                          <a href={m.linkCompra} target="_blank" rel="noopener noreferrer"
                            className="text-[#90A4AE] underline text-xs">Ver</a>
                        ) : <span className="text-[#90A4AE]">—</span>}
                      </Td>
                      <Td>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => iniciarEdicao(m)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-2 text-xs font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={() => handleExcluir(m.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-900/50 bg-red-900/10 px-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/30">
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
    const { error } = await supabase.from("clientes").delete().eq("id", id);
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
      <form onSubmit={handleSalvar} className="rounded-3xl border border-[#333333] bg-[#181818] p-5 self-start">
        <p className="text-sm font-semibold text-[#90A4AE]">{editandoId ? "Editando cliente" : "Novo cliente"}</p>
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
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60">
            <Save className="h-4 w-4" />{salvando ? "Salvando..." : editandoId ? "Atualizar" : "Cadastrar"}
          </button>
          {editandoId && (
            <button type="button" onClick={limpar}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#333333] bg-[#212121] px-4 text-sm font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </form>
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold">{clientes.length} cliente(s)</h3>
          <div className="relative sm:min-w-56">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90A4AE]" />
            <input type="search" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)}
              className="h-11 w-full rounded-2xl border border-[#333333] bg-[#141414] pl-11 pr-4 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
              placeholder="Buscar" />
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#333333]">
          {filtrados.length > 0 ? (
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-[500px] w-full bg-[#212121] text-left text-sm">
                <thead className="sticky top-0 bg-[#181818] text-[#90A4AE]">
                  <tr><Th>Nome</Th><Th>Contato</Th><Th>Cidade</Th><Th>Ações</Th></tr>
                </thead>
                <tbody>
                  {filtrados.map((c) => (
                    <tr key={c.id} className={`border-t border-[#2a2a2a] ${editandoId === c.id ? "bg-[#CFD8DC]" : ""}`}>
                      <Td className="font-semibold">{c.nome}</Td>
                      <Td>{c.contato || "-"}</Td>
                      <Td>{c.cidade || "-"}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => iniciarEdicao(c)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-2 text-xs font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={() => handleExcluir(c.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-900/50 bg-red-900/10 px-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/30">
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
    const { error } = await supabase.from("fornecedores").delete().eq("id", id);
    if (error) { setErro(error.message); return; }
    setFornecedores((prev) => prev.filter((f) => f.id !== id));
    if (editandoId === id) limpar();
    setMensagem("Fornecedor removido.");
  }

  return (
    <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <form onSubmit={handleSalvar} className="rounded-3xl border border-[#333333] bg-[#181818] p-5 self-start">
        <p className="text-sm font-semibold text-[#90A4AE]">{editandoId ? "Editando fornecedor" : "Novo fornecedor"}</p>
        <FeedbackBloco mensagem={mensagem} erro={erro} />
        <div className="mt-4 grid gap-4">
          <CampoCadastro label="Nome / Razão social" value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} placeholder="Nome do fornecedor" required />
          <CampoCadastro label="Contato" value={form.contato} onChange={(v) => setForm((f) => ({ ...f, contato: v }))} placeholder="Telefone, e-mail..." />
          <CampoCadastro label="Observação" value={form.observacao} onChange={(v) => setForm((f) => ({ ...f, observacao: v }))} placeholder="Prazo, condições..." />
        </div>
        <div className="mt-5 flex gap-3">
          <button type="submit" disabled={salvando}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60">
            <Save className="h-4 w-4" />{salvando ? "Salvando..." : editandoId ? "Atualizar" : "Cadastrar"}
          </button>
          {editandoId && (
            <button type="button" onClick={limpar}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#333333] bg-[#212121] px-4 text-sm font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]">
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </form>
      <div>
        <h3 className="text-xl font-bold">{fornecedores.length} fornecedor(es)</h3>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#333333]">
          {fornecedores.length > 0 ? (
            <div className="max-h-[480px] overflow-auto">
              <table className="min-w-[400px] w-full bg-[#212121] text-left text-sm">
                <thead className="sticky top-0 bg-[#181818] text-[#90A4AE]">
                  <tr><Th>Nome</Th><Th>Contato</Th><Th>Observação</Th><Th>Ações</Th></tr>
                </thead>
                <tbody>
                  {fornecedores.map((f) => (
                    <tr key={f.id} className={`border-t border-[#2a2a2a] ${editandoId === f.id ? "bg-[#CFD8DC]" : ""}`}>
                      <Td className="font-semibold">{f.nome}</Td>
                      <Td>{f.contato || "-"}</Td>
                      <Td className="text-[#78909C]">{f.observacao || "-"}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <button type="button" onClick={() => iniciarEdicao(f)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-2 text-xs font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {isAdmin && (
                            <button type="button" onClick={() => handleExcluir(f.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-900/50 bg-red-900/10 px-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/30">
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
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [pedidosFabricacao, setPedidosFabricacao] = useState<PedidoFabricacao[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [termoBusca, setTermoBusca] = useState("");

  async function carregar() {
    setCarregando(true);
    const supabase = createClient();
    const [{ data: prod }, { data: v }, { data: pf }, { data: kt }] = await Promise.all([
      supabase.from("produtos").select("*").eq("ativo", true).order("nome"),
      supabase.from("vendas").select("*"),
      supabase.from("pedidos_fabricacao").select("*"),
      supabase.from("kits").select("id, nome, descricao, kit_itens(id, produto_id, quantidade, produtos(nome, codigo))").order("nome"),
    ]);
    setProdutos((prod ?? []).map(mapProduto));
    setVendas((v ?? []).map(mapVenda));
    setPedidosFabricacao((pf ?? []).map(mapPedidoFabricacao));
    setKits((kt ?? []).map(mapKit));
    setCarregando(false);
  }

  useEffect(() => {
    let ativo = true;
    carregar().then(() => { if (!ativo) return; });
    return () => { ativo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId]);

  // Saídas por produto, considerando vendas diretas e o consumo indireto de vendas de kit.
  const saidasPorProduto: Record<string, number> = {};
  vendas.forEach((v) => {
    itensConsumidosPelaVenda(v, kits).forEach((item) => {
      saidasPorProduto[item.produtoId] = (saidasPorProduto[item.produtoId] ?? 0) + item.quantidade;
    });
  });

  // Calculate stock per product from movements; unit cost = avg fabrication cost
  const movimentos = produtos.map((p) => {
    const ordens = pedidosFabricacao.filter((pf) => pf.produtoId === p.id);
    const totalCustoFab = ordens.reduce((s, pf) => s + pf.valorTotal, 0);
    const entradas = ordens.reduce((s, pf) => s + pf.qtdFabricada, 0);
    const custoUnitFab = entradas > 0 ? totalCustoFab / entradas : 0;
    const saidas = saidasPorProduto[p.id] ?? 0;
    const saldo = Math.max(0, entradas - saidas);
    return { produto: p, entradas, saidas, saldo, custoUnitFab, capital: saldo * custoUnitFab };
  });

  const movimentosFiltrados = movimentos.filter((m) => {
    const q = termoBusca.toLowerCase();
    return !q || m.produto.nome.toLowerCase().includes(q) || m.produto.codigo.toLowerCase().includes(q);
  });

  const capitalTotal = movimentos.reduce((s, m) => s + m.capital, 0);
  const abaixoMinimo = movimentos.filter((m) => m.saldo <= m.produto.estoqueMinimo);
  const totalUnidades = movimentos.reduce((s, m) => s + m.saldo, 0);

  // Quantos kits dá pra montar com o estoque atual: o gargalo é o item com menor saldo relativo à quantidade exigida.
  const kitsComEstoque = kits.map((kit) => {
    const quantidadeMontavel = kit.itens.length === 0 ? 0 : Math.min(
      ...kit.itens.map((it) => {
        const saldoItem = movimentos.find((m) => m.produto.id === it.produtoId)?.saldo ?? 0;
        return it.quantidade > 0 ? Math.floor(saldoItem / it.quantidade) : 0;
      })
    );
    return { kit, quantidadeMontavel };
  });

  const dadosGraficoEstoque = movimentos.map((m) => ({
    rotulo: m.produto.codigo || truncarRotulo(m.produto.nome, 10),
    nome: m.produto.nome,
    saldo: m.saldo,
    abaixo: m.saldo <= m.produto.estoqueMinimo,
  }));
  const dadosGraficoKits = kitsComEstoque.map(({ kit, quantidadeMontavel }) => ({
    rotulo: truncarRotulo(kit.nome, 10),
    nome: kit.nome,
    quantidade: quantidadeMontavel,
    indisponivel: quantidadeMontavel <= 0,
  }));

  if (carregando) return <EstadoCarregando texto="Carregando estoque..." />;

  return (
    <section className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
      <SectionHeader
        tag="Estoque"
        titulo="Inventário de produtos"
        descricao="Saldo calculado automaticamente: entradas via fabricação e saídas via vendas."
      />

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard titulo="Unidades em estoque" valor={String(totalUnidades)} />
        <KpiCard titulo="Abaixo do mínimo" valor={String(abaixoMinimo.length)} alerta={abaixoMinimo.length > 0} />
        <KpiCard titulo="Capital em estoque" valor={formatarMoeda(capitalTotal)} destaque />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-[#333333] bg-[#181818] p-4 sm:p-6">
          <p className="text-sm font-semibold text-[#90A4AE]">Itens avulsos</p>
          <h3 className="mt-1 text-lg font-bold">Saldo por produto</h3>
          {dadosGraficoEstoque.length > 0 ? (
            <div className="mt-4 max-h-80 overflow-y-auto">
              <div style={{ height: Math.max(dadosGraficoEstoque.length * 34, 120) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGraficoEstoque} layout="vertical" barCategoryGap="35%" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#78909C" }} axisLine={{ stroke: "#333333" }} tickLine={false} />
                    <YAxis type="category" dataKey="rotulo" width={64} tick={{ fontSize: 11, fill: "#90A4AE" }} axisLine={{ stroke: "#333333" }} tickLine={false} />
                    <Tooltip
                      formatter={(v) => [`${Number(v)} un.`, "Saldo"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.nome ?? ""}
                      contentStyle={{ backgroundColor: "#181818", border: "1px solid #333333", borderRadius: 12 }}
                      labelStyle={{ color: "#ECEFF1", fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ color: "#90A4AE" }}
                      cursor={{ fill: "#2a2a2a" }}
                    />
                    <Bar dataKey="saldo" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {dadosGraficoEstoque.map((d, i) => (
                        <Cell key={i} fill={d.abaixo ? "#C62828" : "#1565C0"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="mt-4 py-10 text-center text-sm text-[#78909C]">Nenhum produto ativo cadastrado.</div>
          )}
        </div>

        <div className="rounded-3xl border border-[#333333] bg-[#181818] p-4 sm:p-6">
          <p className="text-sm font-semibold text-[#90A4AE]">Kits</p>
          <h3 className="mt-1 text-lg font-bold">Quantidade montável</h3>
          {dadosGraficoKits.length > 0 ? (
            <div className="mt-4 max-h-80 overflow-y-auto">
              <div style={{ height: Math.max(dadosGraficoKits.length * 34, 120) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGraficoKits} layout="vertical" barCategoryGap="35%" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#78909C" }} axisLine={{ stroke: "#333333" }} tickLine={false} />
                    <YAxis type="category" dataKey="rotulo" width={90} tick={{ fontSize: 11, fill: "#90A4AE" }} axisLine={{ stroke: "#333333" }} tickLine={false} />
                    <Tooltip
                      formatter={(v) => [`${Number(v)} kit(s)`, "Montável"]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.nome ?? ""}
                      contentStyle={{ backgroundColor: "#181818", border: "1px solid #333333", borderRadius: 12 }}
                      labelStyle={{ color: "#ECEFF1", fontWeight: 600, marginBottom: 4 }}
                      itemStyle={{ color: "#90A4AE" }}
                      cursor={{ fill: "#2a2a2a" }}
                    />
                    <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} maxBarSize={20}>
                      {dadosGraficoKits.map((d, i) => (
                        <Cell key={i} fill={d.indisponivel ? "#C62828" : "#1565C0"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="mt-4 py-10 text-center text-sm text-[#78909C]">Nenhum kit cadastrado.</div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="relative flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90A4AE]" />
          <input
            type="search"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="h-11 w-full rounded-2xl border border-[#333333] bg-[#141414] pl-11 pr-4 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
            placeholder="Buscar produto"
          />
        </div>
        <button
          type="button"
          onClick={carregar}
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#333333] bg-[#212121] px-4 text-sm font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-3xl border border-[#333333]">
        {movimentosFiltrados.length > 0 ? (
          <div className="overflow-auto">
            <table className="min-w-[820px] w-full bg-[#212121] text-left text-sm">
              <thead className="bg-[#181818] text-[#90A4AE]">
                <tr>
                  <Th>Código</Th>
                  <Th>Produto</Th>
                  <Th>Entradas</Th>
                  <Th>Saídas</Th>
                  <Th>Saldo</Th>
                  <Th>Mínimo</Th>
                  <Th>Custo unit.</Th>
                  <Th>Capital</Th>
                </tr>
              </thead>
              <tbody>
                {movimentosFiltrados.map(({ produto: p, entradas, saidas, saldo, custoUnitFab, capital }) => {
                  const abaixo = saldo <= p.estoqueMinimo;
                  return (
                    <tr key={p.id} className={`border-t border-[#2a2a2a] ${abaixo ? "bg-red-900/10" : ""}`}>
                      <Td className="text-xs text-[#78909C]">{p.codigo || "-"}</Td>
                      <Td className="font-semibold">{p.nome}</Td>
                      <Td>
                        <span className="font-semibold text-emerald-400">{entradas}</span>
                      </Td>
                      <Td>
                        <span className="font-semibold text-red-600">{saidas}</span>
                      </Td>
                      <Td>
                        <span className={`font-bold text-base ${abaixo ? "text-red-600" : "text-[#90A4AE]"}`}>
                          {saldo}
                        </span>
                        {abaixo && (
                          <span className="ml-1.5 rounded-full bg-red-900/20 px-1.5 py-0.5 text-xs font-semibold text-red-400">
                            baixo
                          </span>
                        )}
                      </Td>
                      <Td className="text-[#78909C]">{p.estoqueMinimo}</Td>
                      <Td>{custoUnitFab > 0 ? formatarMoeda(custoUnitFab) : <span className="text-[#90A4AE]">—</span>}</Td>
                      <Td className="font-semibold text-[#ECEFF1]">{capital > 0 ? formatarMoeda(capital) : <span className="text-[#90A4AE]">—</span>}</Td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-[#333333] bg-[#181818]">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#78909C]">
                    Total
                  </td>
                  <td className="px-4 py-3 font-bold text-[#90A4AE]">{totalUnidades}</td>
                  <td />
                  <td />
                  <td className="px-4 py-3 font-bold text-[#90A4AE]">{formatarMoeda(capitalTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <EstadoTabelaVazia texto="Nenhum produto ativo cadastrado." />
        )}
      </div>

      {kits.length > 0 && (
        <div className="mt-8">
          <p className="text-sm font-semibold text-[#90A4AE]">Kits</p>
          <h3 className="mt-1 text-xl font-bold">Quantidade montável com o estoque atual</h3>
          <p className="mt-0.5 text-xs text-[#78909C]">
            Calculado pelo item do kit com menor saldo disponível em relação à quantidade exigida.
          </p>
          <div className="mt-4 overflow-hidden rounded-3xl border border-[#333333]">
            <div className="overflow-auto">
              <table className="min-w-[560px] w-full bg-[#212121] text-left text-sm">
                <thead className="bg-[#181818] text-[#90A4AE]">
                  <tr>
                    <Th>Kit</Th>
                    <Th>Composição</Th>
                    <Th>Dá pra montar</Th>
                  </tr>
                </thead>
                <tbody>
                  {kitsComEstoque.map(({ kit, quantidadeMontavel }) => (
                    <tr key={kit.id} className={`border-t border-[#2a2a2a] ${quantidadeMontavel <= 0 ? "bg-red-900/10" : ""}`}>
                      <Td className="font-semibold">{kit.nome}</Td>
                      <Td className="text-xs text-[#78909C]">
                        {kit.itens.map((it, i) => (
                          <span key={it.id}>
                            {i > 0 && ", "}
                            {it.quantidade}× {it.produtoNome}
                          </span>
                        ))}
                      </Td>
                      <Td>
                        <span className={`font-bold text-base ${quantidadeMontavel <= 0 ? "text-red-600" : "text-[#90A4AE]"}`}>
                          {quantidadeMontavel}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
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
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aba, setAba] = useState<"pedidos" | "fabricacao" | "historico-precos">("fabricacao");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  const [formPedido, setFormPedido] = useState({
    fornecedorId: "",
    data: dataHoje,
    status: "pendente" as PedidoCompra["status"],
    valorTotal: "",
    observacao: "",
  });
  const [itensNovoPedido, setItensNovoPedido] = useState<LinhaItemPedido[]>([]);
  const [dividirBalancete, setDividirBalancete] = useState(false);

  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoCompra | null>(null);
  const [editandoDetalhe, setEditandoDetalhe] = useState(false);
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false);
  const [formDetalhe, setFormDetalhe] = useState({
    fornecedorId: "",
    data: "",
    status: "pendente" as PedidoCompra["status"],
    valorTotal: "",
    observacao: "",
  });
  const [itensPedidoSelecionado, setItensPedidoSelecionado] = useState<ItemPedidoCompra[]>([]);
  const [itensFormDetalhe, setItensFormDetalhe] = useState<LinhaItemPedido[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);
  // Custo unitário médio de cada pedido (valor total dos itens ÷ soma das
  // quantidades) — pra mostrar direto na linha da lista, sem abrir o pedido.
  // Fica de fora (—) pra pedido sem item lançado, já que não tem quantidade
  // pra dividir.
  const [custoUnitPorPedido, setCustoUnitPorPedido] = useState<Record<string, number>>({});

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const [{ data: p }, { data: f }, { data: u }, { data: mp }, { data: itensTodos }] = await Promise.all([
        supabase
          .from("pedidos_compra")
          .select("*, fornecedores(nome)")

          .order("data", { ascending: false }),
        supabase
          .from("fornecedores")
          .select("*")

          .order("nome"),
        supabase.from("usuarios_empresa").select("usuario_id, nome, email"),
        supabase.from("materias_primas").select("*").eq("ativo", true).order("nome"),
        supabase.from("pedido_compra_itens").select("pedido_compra_id, quantidade, valor_total"),
      ]);
      if (ativo) {
        setPedidos((p ?? []).map(mapPedidoCompra));
        setFornecedores((f ?? []).map(mapFornecedor));
        setMateriasPrimas((mp ?? []).map(mapMateriaPrima));
        setUsuariosMap(
          Object.fromEntries((u ?? []).map((m) => [String(m.usuario_id), String(m.nome || m.email || "")]))
        );
        setCustoUnitPorPedido(calcularCustoUnitPorPedido(itensTodos ?? []));
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
    const itensValidosNovoPedido = itensPreenchidos(itensNovoPedido);
    const valorTotal = itensValidosNovoPedido.length > 0 ? somaItensPedido(itensValidosNovoPedido) : parseNumero(formPedido.valorTotal);
    const { data, error } = await supabase
      .from("pedidos_compra")
      .insert({
        criado_por: usuarioId,
        fornecedor_id: formPedido.fornecedorId,
        data: formPedido.data,
        status: formPedido.status,
        valor_total: valorTotal,
        observacao: formPedido.observacao.trim(),
      })
      .select("*, fornecedores(nome)")
      .single();

    if (error) { setSalvando(false); setErro(error.message); return; }
    if (data) setPedidos((prev) => [mapPedidoCompra(data), ...prev]);

    if (data && itensValidosNovoPedido.length > 0) {
      await supabase.from("pedido_compra_itens").insert(
        itensValidosNovoPedido.map((item) => ({
          pedido_compra_id: data.id,
          materia_prima_id: item.materiaPrimaId || null,
          descricao: item.descricao,
          quantidade: parseNumero(item.quantidade) || 1,
          valor_unitario: parseNumero(item.valorUnitario),
          valor_total: (parseNumero(item.quantidade) || 1) * parseNumero(item.valorUnitario),
        }))
      );
      const totalQtd = itensValidosNovoPedido.reduce((s, item) => s + (parseNumero(item.quantidade) || 1), 0);
      if (totalQtd > 0) {
        setCustoUnitPorPedido((prev) => ({ ...prev, [data.id]: valorTotal / totalQtd }));
      }
    }

    const fornecedorNome = fornecedores.find((f) => f.id === formPedido.fornecedorId)?.nome ?? "";
    const nomeItem = `Compra${fornecedorNome ? ` - ${fornecedorNome}` : ""}`;
    const avisoBalancete = await lancarCompraNoBalancete({
      dividir: dividirBalancete,
      valorTotal,
      data: formPedido.data,
      nomeItem,
      usuarioId,
      usuariosMap,
    });

    setSalvando(false);
    setFormPedido({ fornecedorId: "", data: dataHoje, status: "pendente", valorTotal: "", observacao: "" });
    setItensNovoPedido([]);
    setDividirBalancete(false);
    setMensagem(
      avisoBalancete
        ? `Pedido de compra registrado. ${avisoBalancete}`
        : valorTotal > 0
        ? "Pedido de compra registrado e lançado no balancete."
        : "Pedido de compra registrado."
    );
  }

  async function handleAtualizarStatusPedido(id: string, status: PedidoCompra["status"]) {
    const supabase = createClient();
    const atualizadoEm = new Date().toISOString();
    const { error } = await supabase
      .from("pedidos_compra")
      .update({ status, atualizado_por: usuarioId, atualizado_em: atualizadoEm })
      .eq("id", id);
    if (error) { setErro(error.message); return; }
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, status, atualizadoPor: usuarioId, atualizadoEm } : p)));
    if (pedidoSelecionado?.id === id) {
      setPedidoSelecionado((sel) => sel && { ...sel, status, atualizadoPor: usuarioId, atualizadoEm });
    }
    setMensagem("Status atualizado.");
  }

  async function handleExcluirPedido(id: string) {
    if (!confirm("Excluir este pedido de compra?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("pedidos_compra").delete().eq("id", id);
    if (error) { setErro(error.message); return; }
    setPedidos((prev) => prev.filter((p) => p.id !== id));
    setMensagem("Pedido removido.");
  }

  async function abrirDetalhePedido(pedido: PedidoCompra) {
    setPedidoSelecionado(pedido);
    setEditandoDetalhe(false);
    setFormDetalhe({
      fornecedorId: pedido.fornecedorId,
      data: pedido.data,
      status: pedido.status,
      valorTotal: String(pedido.valorTotal).replace(".", ","),
      observacao: pedido.observacao,
    });
    setItensPedidoSelecionado([]);
    setItensFormDetalhe([]);
    setCarregandoItens(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("pedido_compra_itens")
      .select("*")
      .eq("pedido_compra_id", pedido.id)
      .order("criado_em");
    const itens = (data ?? []).map(mapItemPedidoCompra);
    setItensPedidoSelecionado(itens);
    // Já deixa uma linha em branco pronta pro editor quando o pedido não tem
    // item nenhum — direto aqui, e não no clique de "Editar", pra não correr
    // o risco de a busca assíncrona terminar depois do clique e sobrescrever
    // a linha recém-adicionada de volta pra vazio.
    setItensFormDetalhe(itens.length > 0 ? itens.map(itemParaLinha) : [novaLinhaItemPedido()]);
    setCarregandoItens(false);
  }

  function fecharDetalhePedido() {
    setPedidoSelecionado(null);
    setEditandoDetalhe(false);
  }

  // Ao entrar em edição de um pedido que ainda não tem nenhum item lançado,
  // já abre uma linha vazia — igual acontece ao clicar em "Adicionar item"
  // no formulário de lançar um pedido novo, sem exigir esse clique extra.
  // Se o pedido já tem itens, não mexe (não força linha em cima do que já
  // foi lançado).
  function iniciarEdicaoPedido() {
    setEditandoDetalhe(true);
    if (itensFormDetalhe.length === 0) {
      setItensFormDetalhe([novaLinhaItemPedido()]);
    }
  }

  async function handleSalvarDetalhePedido() {
    if (!pedidoSelecionado) return;
    if (!formDetalhe.data || !formDetalhe.fornecedorId) {
      setErro("Preencha data e fornecedor.");
      return;
    }
    setSalvandoDetalhe(true);
    setErro("");
    const supabase = createClient();
    const fornecedor = fornecedores.find((f) => f.id === formDetalhe.fornecedorId);
    const atualizadoEm = new Date().toISOString();
    const itensValidosFormDetalhe = itensPreenchidos(itensFormDetalhe);
    const valorTotal = itensValidosFormDetalhe.length > 0 ? somaItensPedido(itensValidosFormDetalhe) : parseNumero(formDetalhe.valorTotal);
    const payload = {
      fornecedor_id: formDetalhe.fornecedorId,
      data: formDetalhe.data,
      status: formDetalhe.status,
      valor_total: valorTotal,
      observacao: formDetalhe.observacao.trim(),
      atualizado_por: usuarioId,
      atualizado_em: atualizadoEm,
    };
    const { error } = await supabase.from("pedidos_compra").update(payload).eq("id", pedidoSelecionado.id);
    if (error) { setSalvandoDetalhe(false); setErro(error.message); return; }

    // Sincroniza os itens: apaga tudo e regrava do zero — lista curta por
    // pedido, mais simples e seguro do que diffar linha a linha. Linhas em
    // branco (ex.: a pré-carregada ao entrar em edição, se ficou sem uso)
    // não são gravadas.
    await supabase.from("pedido_compra_itens").delete().eq("pedido_compra_id", pedidoSelecionado.id);
    let itensAtualizados: ItemPedidoCompra[] = [];
    if (itensValidosFormDetalhe.length > 0) {
      const { data: itensSalvos } = await supabase
        .from("pedido_compra_itens")
        .insert(
          itensValidosFormDetalhe.map((item) => ({
            pedido_compra_id: pedidoSelecionado.id,
            materia_prima_id: item.materiaPrimaId || null,
            descricao: item.descricao,
            quantidade: parseNumero(item.quantidade) || 1,
            valor_unitario: parseNumero(item.valorUnitario),
            valor_total: (parseNumero(item.quantidade) || 1) * parseNumero(item.valorUnitario),
          }))
        )
        .select();
      itensAtualizados = (itensSalvos ?? []).map(mapItemPedidoCompra);
    }
    const totalQtd = itensValidosFormDetalhe.reduce((s, item) => s + (parseNumero(item.quantidade) || 1), 0);
    setCustoUnitPorPedido((prev) => {
      const novo = { ...prev };
      if (totalQtd > 0) novo[pedidoSelecionado.id] = valorTotal / totalQtd;
      else delete novo[pedidoSelecionado.id];
      return novo;
    });
    setSalvandoDetalhe(false);

    const pedidoAtualizado: PedidoCompra = {
      ...pedidoSelecionado,
      fornecedorId: payload.fornecedor_id,
      fornecedorNome: fornecedor?.nome ?? pedidoSelecionado.fornecedorNome,
      data: payload.data,
      status: payload.status,
      valorTotal: payload.valor_total,
      observacao: payload.observacao,
      atualizadoPor: usuarioId,
      atualizadoEm,
    };
    setPedidos((prev) => prev.map((p) => p.id === pedidoSelecionado.id ? pedidoAtualizado : p));
    setPedidoSelecionado(pedidoAtualizado);
    setItensPedidoSelecionado(itensAtualizados);
    setItensFormDetalhe(itensAtualizados.map(itemParaLinha));
    setEditandoDetalhe(false);
    setMensagem("Pedido atualizado.");
  }

  async function handleExcluirDetalhePedido() {
    if (!pedidoSelecionado) return;
    await handleExcluirPedido(pedidoSelecionado.id);
    fecharDetalhePedido();
  }

  const totalCompras = pedidos.reduce((s, p) => s + p.valorTotal, 0);
  const pendentes = pedidos.filter((p) => p.status === "pendente").length;

  if (carregando) return <EstadoCarregando texto="Carregando compras..." />;

  return (
    <section className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          tag="Compras"
          titulo="Pedidos de compra"
          descricao="Registre pedidos de compra e ordens de fabricação."
        />
        <div className="flex flex-wrap gap-2 rounded-3xl border border-[#333333] bg-[#181818] p-2 self-start">
          {(["pedidos", "fabricacao", "historico-precos"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAba(t)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                aba === t
                  ? "bg-[#546E7A] text-white"
                  : "text-[#90A4AE] hover:bg-[#2a2a2a]"
              }`}
            >
              {t === "pedidos" ? "Pedidos" : t === "fabricacao" ? "Fabricação" : "Estatísticas"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard titulo="Total de pedidos" valor={String(pedidos.length)} />
        <KpiCard titulo="Pedidos pendentes" valor={String(pendentes)} alerta={pendentes > 0} />
        <KpiCard titulo="Total em compras" valor={formatarMoeda(totalCompras)} />
      </div>

      <FeedbackBloco mensagem={mensagem} erro={erro} className="mt-5" />

      {aba === "pedidos" && (
        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <form
            onSubmit={handleSalvarPedido}
            className="rounded-3xl border border-[#333333] bg-[#181818] p-5"
          >
            <p className="text-sm font-semibold text-[#90A4AE]">Novo pedido</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Fornecedor</label>
                <select
                  value={formPedido.fornecedorId}
                  onChange={(e) => setFormPedido((f) => ({ ...f, fornecedorId: e.target.value }))}
                  className="w-full rounded-2xl border border-[#333333] bg-[#212121] px-4 py-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
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
              {itensPreenchidos(itensNovoPedido).length === 0 && (
                <CampoCadastro label="Valor total" value={formPedido.valorTotal} onChange={(v) => setFormPedido((f) => ({ ...f, valorTotal: v }))} placeholder="0,00" />
              )}
              <CampoCadastro label="Observação" value={formPedido.observacao} onChange={(v) => setFormPedido((f) => ({ ...f, observacao: v }))} placeholder="Detalhes do pedido" />
              <ItensPedidoEditor itens={itensNovoPedido} onChange={setItensNovoPedido} materiasPrimas={materiasPrimas} />
            </div>

            <button
              type="button"
              onClick={() => setDividirBalancete((v) => !v)}
              className={`mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                dividirBalancete
                  ? "border-[#546E7A] bg-[#546E7A]/15"
                  : "border-[#333333] bg-[#212121] hover:bg-[#2a2a2a]"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold text-[#ECEFF1]">Dividir no balancete entre os sócios</span>
                <span className="mt-0.5 block text-xs text-[#78909C]">
                  {dividirBalancete
                    ? "Ligado: lança metade do valor pra Matheus e metade pra Enyo."
                    : "Desligado: lança o valor integral no balancete pra quem estiver registrando."}
                </span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${dividirBalancete ? "bg-[#546E7A]" : "bg-[#333333]"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${dividirBalancete ? "left-5" : "left-0.5"}`} />
              </span>
            </button>

            <button
              type="submit"
              disabled={salvando}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {salvando ? "Salvando..." : "Registrar pedido"}
            </button>
          </form>

          <div className="overflow-hidden rounded-3xl border border-[#333333]">
            {pedidos.length > 0 ? (
              <div className="max-h-[480px] overflow-auto">
                <table className="min-w-[560px] w-full bg-[#212121] text-left text-sm">
                  <thead className="sticky top-0 bg-[#181818] text-[#90A4AE]">
                    <tr>
                      <Th>Data</Th>
                      <Th>Fornecedor</Th>
                      <Th>Valor</Th>
                      <Th>Custo unit.</Th>
                      <Th>Status</Th>
                      <Th>Lançado por</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((p) => (
                      <tr
                        key={p.id}
                        onClick={() => abrirDetalhePedido(p)}
                        className="cursor-pointer border-t border-[#2a2a2a] transition hover:bg-[#2a2a2a]"
                      >
                        <Td>{formatarData(p.data)}</Td>
                        <Td className="font-semibold">{p.fornecedorNome || "-"}</Td>
                        <Td>{formatarMoeda(p.valorTotal)}</Td>
                        <Td>
                          {custoUnitPorPedido[p.id] !== undefined ? (
                            `${formatarMoeda(custoUnitPorPedido[p.id])}/un`
                          ) : (
                            <span className="text-[#78909C]">—</span>
                          )}
                        </Td>
                        <Td>
                          <select
                            value={p.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => handleAtualizarStatusPedido(p.id, e.target.value as PedidoCompra["status"])}
                            className={`rounded-full px-3 py-1 text-xs font-semibold outline-none ${
                              p.status === "recebido"
                                ? "bg-emerald-900/20 text-emerald-400"
                                : p.status === "cancelado"
                                ? "bg-red-900/20 text-red-400"
                                : "bg-amber-900/30 text-amber-400"
                            }`}
                          >
                            <option value="pendente">Pendente</option>
                            <option value="recebido">Recebido</option>
                            <option value="cancelado">Cancelado</option>
                          </select>
                        </Td>
                        <Td className="text-xs text-[#78909C]">{nomeUsuario(usuariosMap, p.criadoPor)}</Td>
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
          usuariosMap={usuariosMap}
        />
      )}

      {aba === "historico-precos" && <HistoricoPrecosModulo materiasPrimas={materiasPrimas} />}

      {pedidoSelecionado && (
        <Modal
          titulo={editandoDetalhe ? "Editar pedido de compra" : pedidoSelecionado.fornecedorNome || "Detalhe do pedido"}
          subtitulo="Compras"
          onClose={fecharDetalhePedido}
          largo
        >
          <FeedbackBloco mensagem="" erro={erro} />
          {editandoDetalhe ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Fornecedor</label>
                <select
                  value={formDetalhe.fornecedorId}
                  onChange={(e) => setFormDetalhe((f) => ({ ...f, fornecedorId: e.target.value }))}
                  className="w-full rounded-2xl border border-[#333333] bg-[#141414] px-4 py-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
                >
                  <option value="">Selecione...</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>{f.nome}</option>
                  ))}
                </select>
              </div>
              <CampoCadastro label="Data" type="date" value={formDetalhe.data} onChange={(v) => setFormDetalhe((f) => ({ ...f, data: v }))} required />
              <SelectCadastro
                label="Status"
                value={formDetalhe.status}
                onChange={(v) => setFormDetalhe((f) => ({ ...f, status: v as PedidoCompra["status"] }))}
                options={["pendente", "recebido", "cancelado"]}
                placeholder=""
              />
              {itensPreenchidos(itensFormDetalhe).length === 0 && (
                <CampoCadastro label="Valor total" value={formDetalhe.valorTotal} onChange={(v) => setFormDetalhe((f) => ({ ...f, valorTotal: v }))} />
              )}
              <div className="sm:col-span-2">
                <CampoCadastro label="Observação" value={formDetalhe.observacao} onChange={(v) => setFormDetalhe((f) => ({ ...f, observacao: v }))} />
              </div>
              <ItensPedidoEditor itens={itensFormDetalhe} onChange={setItensFormDetalhe} materiasPrimas={materiasPrimas} />
            </div>
          ) : (
            <div>
              <LinhaDetalhe label="Fornecedor" valor={pedidoSelecionado.fornecedorNome || "-"} />
              <LinhaDetalhe label="Data" valor={formatarData(pedidoSelecionado.data)} />
              <LinhaDetalhe
                label="Status"
                valor={pedidoSelecionado.status === "recebido" ? "Recebido" : pedidoSelecionado.status === "cancelado" ? "Cancelado" : "Pendente"}
                alerta={pedidoSelecionado.status === "cancelado"}
                destaque={pedidoSelecionado.status === "recebido"}
              />
              <LinhaDetalhe label="Valor total" valor={formatarMoeda(pedidoSelecionado.valorTotal)} destaque />
              {pedidoSelecionado.observacao && <LinhaDetalhe label="Observação" valor={pedidoSelecionado.observacao} />}

              {carregandoItens && <p className="mt-3 text-xs text-[#78909C]">Carregando itens...</p>}
              {!carregandoItens && itensPedidoSelecionado.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold text-[#90A4AE]">Itens</p>
                  <div className="overflow-x-auto rounded-2xl border border-[#2a2a2a]">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead className="bg-[#181818] text-[#90A4AE]">
                        <tr>
                          <Th>Descrição</Th>
                          <Th>Qtd.</Th>
                          <Th>Valor un.</Th>
                          <Th>Subtotal</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensPedidoSelecionado.map((item) => (
                          <tr key={item.id} className="border-t border-[#2a2a2a]">
                            <Td>{item.descricao}</Td>
                            <Td>{item.quantidade}</Td>
                            <Td>{formatarMoeda(item.valorUnitario)}</Td>
                            <Td className="font-semibold text-[#90A4AE]">{formatarMoeda(item.valorTotal)}</Td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#2a2a2a] bg-[#181818]">
                          <Td colSpan={3} className="text-right font-semibold text-[#90A4AE]">Total</Td>
                          <Td className="font-semibold text-[#90A4AE]">
                            {formatarMoeda(itensPedidoSelecionado.reduce((s, i) => s + i.valorTotal, 0))}
                          </Td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              <HistoricoRegistro
                usuariosMap={usuariosMap}
                criadoPor={pedidoSelecionado.criadoPor}
                criadoEm={pedidoSelecionado.criadoEm}
                atualizadoPor={pedidoSelecionado.atualizadoPor}
                atualizadoEm={pedidoSelecionado.atualizadoEm}
              />
            </div>
          )}
          <ModalAcoes
            editando={editandoDetalhe}
            salvando={salvandoDetalhe}
            onEditar={iniciarEdicaoPedido}
            onSalvar={handleSalvarDetalhePedido}
            onCancelar={() => setEditandoDetalhe(false)}
            onExcluir={handleExcluirDetalhePedido}
          />
        </Modal>
      )}
    </section>
  );
}

type PontoPrecoMateriaPrima = {
  data: string;
  valorUnitario: number;
  origem: "compra" | "fabricacao";
  referencia: string;
};

// Qual matéria-prima está com o preço em foco no gráfico — id vazio quando
// veio de um componente de produto sem vínculo (materia_prima_id) com o
// cadastro, aí só dá pra casar pelo nome da peça (só cobre fabricação).
type SelecaoPreco = { materiaPrimaId: string; nome: string };

type PontoCustoProduto = { data: string; qtdFabricada: number; valorTotal: number };

const COR_ORIGEM_COMPRA = "#1976D2";
const COR_ORIGEM_FABRICACAO = "#6A1B9A";

function DotOrigemPreco({ cx, cy, payload }: { cx?: number; cy?: number; payload?: PontoPrecoMateriaPrima }) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const cor = payload.origem === "compra" ? COR_ORIGEM_COMPRA : COR_ORIGEM_FABRICACAO;
  return <circle cx={cx} cy={cy} r={4} fill={cor} stroke="#141414" strokeWidth={1} />;
}

// Estatísticas de custo — duas portas de entrada pro mesmo gráfico de preço:
// (1) escolher direto uma matéria-prima, ou (2) escolher um produto e
// "descer" (drilldown) pros componentes (matérias-primas) daquele produto.
// Itens de pedido de compra são ligados por materia_prima_id (vínculo
// confiável); itens de fabricação só têm o nome da peça salvo (sem FK), então
// o casamento aí é por nome — funciona bem quando o componente do produto foi
// montado a partir da matéria-prima cadastrada.
function HistoricoPrecosModulo({ materiasPrimas }: { materiasPrimas: MateriaPrima[] }) {
  const [modo, setModo] = useState<"produto" | "materia-prima">("produto");

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [produtoId, setProdutoId] = useState("");
  const [pontosProduto, setPontosProduto] = useState<PontoCustoProduto[]>([]);
  const [componentes, setComponentes] = useState<ComponenteProduto[]>([]);
  const [carregandoProduto, setCarregandoProduto] = useState(false);

  const [selecao, setSelecao] = useState<SelecaoPreco | null>(null);
  const [pontosPreco, setPontosPreco] = useState<PontoPrecoMateriaPrima[]>([]);
  const [carregandoPreco, setCarregandoPreco] = useState(false);
  const [erro, setErro] = useState("");

  // "Ver todas de uma vez": clicando no gráfico do produto, busca o histórico
  // de preço de cada matéria-prima da BOM em paralelo e mostra um mini-gráfico
  // por componente, sem precisar clicar chip por chip.
  const [precosPorComponente, setPrecosPorComponente] = useState<Record<string, PontoPrecoMateriaPrima[]>>({});
  const [carregandoTodos, setCarregandoTodos] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(false);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const { data } = await supabase.from("produtos").select("*").eq("ativo", true).order("nome");
      if (ativo) {
        setProdutos((data ?? []).map(mapProduto));
        setCarregandoProdutos(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setMostrarTodos(false);
      setPrecosPorComponente({});
      if (!produtoId) { setPontosProduto([]); setComponentes([]); return; }
      setCarregandoProduto(true);
      const supabase = createClient();
      const [{ data: fab }, { data: comp }] = await Promise.all([
        supabase.from("pedidos_fabricacao").select("data, qtd_fabricada, valor_total").eq("produto_id", produtoId).order("data"),
        supabase.from("componentes_produto").select("*").eq("produto_id", produtoId).order("nome_peca"),
      ]);
      if (!ativo) return;
      setPontosProduto(
        (fab ?? []).map((r) => ({ data: String(r.data ?? ""), qtdFabricada: Number(r.qtd_fabricada ?? 0), valorTotal: Number(r.valor_total ?? 0) }))
      );
      const comps = (comp ?? []).map(mapComponente);
      setComponentes(comps);
      setCarregandoProduto(false);

      // Já mostra a variação de preço de todas as matérias-primas por
      // padrão, sem precisar de um clique extra no gráfico.
      if (comps.length > 0) {
        setMostrarTodos(true);
        setCarregandoTodos(true);
        const resultados = await Promise.all(
          comps.map((c) => buscarHistoricoPreco(supabase, { materiaPrimaId: c.materiaPrimaId, nome: c.nomePeca }))
        );
        if (!ativo) return;
        const mapa: Record<string, PontoPrecoMateriaPrima[]> = {};
        comps.forEach((c, i) => { mapa[c.id] = resultados[i].pontos; });
        setPrecosPorComponente(mapa);
        setCarregandoTodos(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [produtoId]);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      if (!selecao) { setPontosPreco([]); return; }
      setCarregandoPreco(true);
      setErro("");
      const supabase = createClient();
      const { pontos, erro: erroBusca } = await buscarHistoricoPreco(supabase, selecao);
      if (!ativo) return;
      if (erroBusca) setErro(erroBusca);
      setPontosPreco(pontos);
      setCarregandoPreco(false);
    }
    carregar();
    return () => { ativo = false; };
  }, [selecao?.materiaPrimaId, selecao?.nome]);

  async function verVariacaoDeTodasAsMateriasPrimas() {
    setMostrarTodos(true);
    if (componentes.length === 0 || carregandoTodos) return;
    setCarregandoTodos(true);
    const supabase = createClient();
    const resultados = await Promise.all(
      componentes.map((comp) => buscarHistoricoPreco(supabase, { materiaPrimaId: comp.materiaPrimaId, nome: comp.nomePeca }))
    );
    const mapa: Record<string, PontoPrecoMateriaPrima[]> = {};
    componentes.forEach((comp, i) => { mapa[comp.id] = resultados[i].pontos; });
    setPrecosPorComponente(mapa);
    setCarregandoTodos(false);
  }

  function selecionarComponente(comp: ComponenteProduto) {
    setSelecao({ materiaPrimaId: comp.materiaPrimaId, nome: comp.nomePeca });
  }

  const dadosGraficoProduto = [...pontosProduto]
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    .map((p) => ({ name: formatarData(p.data), custo: p.qtdFabricada > 0 ? p.valorTotal / p.qtdFabricada : 0 }));

  const dadosGraficoPreco = [...pontosPreco]
    .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
    .map((p) => ({ name: formatarData(p.data), valorUnitario: p.valorUnitario, origem: p.origem, referencia: p.referencia }));

  const valoresPreco = pontosPreco.map((p) => p.valorUnitario);
  const menor = valoresPreco.length > 0 ? Math.min(...valoresPreco) : 0;
  const maior = valoresPreco.length > 0 ? Math.max(...valoresPreco) : 0;
  const media = valoresPreco.length > 0 ? valoresPreco.reduce((s, v) => s + v, 0) / valoresPreco.length : 0;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader
            tag="Compras"
            titulo="Estatísticas de custo"
            descricao="Custo por unidade fabricada de um produto, com drilldown pras matérias-primas usadas — ou veja direto o histórico de preço de uma matéria-prima."
          />
          <div className="flex flex-wrap gap-2 rounded-3xl border border-[#333333] bg-[#181818] p-2 self-start">
            {(["produto", "materia-prima"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setModo(m); setSelecao(null); }}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  modo === m ? "bg-[#546E7A] text-white" : "text-[#90A4AE] hover:bg-[#2a2a2a]"
                }`}
              >
                {m === "produto" ? "Por produto" : "Por matéria-prima"}
              </button>
            ))}
          </div>
        </div>

        {modo === "produto" ? (
          <div className="mt-5">
            <div className="max-w-sm">
              <label className="mb-1 block text-sm font-medium">Produto</label>
              <select
                value={produtoId}
                onChange={(e) => { setProdutoId(e.target.value); setSelecao(null); }}
                className="w-full rounded-2xl border border-[#333333] bg-[#181818] px-4 py-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
              >
                <option value="">{carregandoProdutos ? "Carregando..." : "Selecione..."}</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} — ` : ""}{p.nome}</option>
                ))}
              </select>
            </div>

            {produtoId && (
              carregandoProduto ? (
                <p className="mt-5 text-sm text-[#78909C]">Carregando...</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="mb-2 mt-5 text-sm font-semibold text-[#90A4AE]">Custo por unidade fabricada</p>
                    {componentes.length > 0 && (
                      <button
                        type="button"
                        onClick={verVariacaoDeTodasAsMateriasPrimas}
                        disabled={carregandoTodos}
                        className="mb-2 mt-5 inline-flex h-8 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-2 text-xs font-semibold text-[#546E7A] hover:bg-[#2a2a2a] disabled:opacity-60"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Atualizar variação
                      </button>
                    )}
                  </div>
                  {dadosGraficoProduto.length > 0 ? (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dadosGraficoProduto}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Number(v).toFixed(0)}`} />
                          <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                          <Line type="monotone" dataKey="custo" stroke="#1976D2" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="py-6 text-center text-sm text-[#78909C]">Nenhum pedido de fabricação registrado pra esse produto ainda.</p>
                  )}

                  <p className="mb-2 mt-6 text-sm font-semibold text-[#90A4AE]">
                    Matérias-primas usadas — clique numa pra focar o histórico dela sozinha
                  </p>
                  {componentes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {componentes.map((comp) => (
                        <button
                          key={comp.id}
                          type="button"
                          onClick={() => selecionarComponente(comp)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            selecao?.nome === comp.nomePeca
                              ? "border-[#546E7A] bg-[#546E7A]/20 text-[#ECEFF1]"
                              : "border-[#333333] bg-[#181818] text-[#90A4AE] hover:bg-[#2a2a2a]"
                          }`}
                        >
                          {comp.nomePeca}
                          {!comp.materiaPrimaId && <span className="ml-1 text-[#78909C]">(sem vínculo)</span>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#78909C]">Esse produto não tem matérias-primas cadastradas na BOM.</p>
                  )}

                  {mostrarTodos && (
                    <div className="mt-6">
                      <p className="mb-3 text-sm font-semibold text-[#90A4AE]">Variação de preço — todas as matérias-primas</p>
                      {carregandoTodos ? (
                        <p className="text-sm text-[#78909C]">Carregando...</p>
                      ) : (
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {componentes.map((comp) => {
                            const pontosComp = precosPorComponente[comp.id] ?? [];
                            const dadosMini = [...pontosComp]
                              .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0))
                              .map((p) => ({ name: formatarData(p.data), valorUnitario: p.valorUnitario, origem: p.origem }));
                            return (
                              <button
                                key={comp.id}
                                type="button"
                                onClick={() => selecionarComponente(comp)}
                                className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-3 text-left transition hover:border-[#546E7A]"
                              >
                                <p className="truncate text-xs font-semibold text-[#90A4AE]">{comp.nomePeca}</p>
                                {dadosMini.length > 0 ? (
                                  <div className="mt-2 h-24">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <LineChart data={dadosMini}>
                                        <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                        <Line type="monotone" dataKey="valorUnitario" stroke="#546E7A" strokeWidth={2} dot={DotOrigemPreco as any} />
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                ) : (
                                  <p className="mt-2 py-6 text-center text-xs text-[#78909C]">Sem preço registrado ainda.</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )
            )}
          </div>
        ) : (
          <div className="mt-5 max-w-sm">
            <label className="mb-1 block text-sm font-medium">Matéria-prima</label>
            <select
              value={selecao?.materiaPrimaId ?? ""}
              onChange={(e) => {
                const mp = materiasPrimas.find((m) => m.id === e.target.value);
                setSelecao(mp ? { materiaPrimaId: mp.id, nome: mp.nome } : null);
              }}
              className="w-full rounded-2xl border border-[#333333] bg-[#181818] px-4 py-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
            >
              <option value="">{materiasPrimas.length === 0 ? "Nenhuma matéria-prima cadastrada" : "Selecione..."}</option>
              {materiasPrimas.map((mp) => (
                <option key={mp.id} value={mp.id}>{mp.codigo ? `${mp.codigo} — ` : ""}{mp.nome}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {selecao && (
        <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#90A4AE]">Histórico de preço</p>
              <h3 className="mt-1 text-lg font-bold">{selecao.nome}</h3>
            </div>
            {modo === "produto" && (
              <button
                type="button"
                onClick={() => setSelecao(null)}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#333333] bg-[#181818] px-3 text-xs font-semibold text-[#546E7A] hover:bg-[#2a2a2a]"
              >
                ← Voltar aos componentes
              </button>
            )}
          </div>

          {erro && <p className="mt-3 text-sm text-amber-400">{erro}</p>}

          {carregandoPreco ? (
            <p className="mt-5 text-sm text-[#78909C]">Carregando histórico...</p>
          ) : pontosPreco.length === 0 ? (
            <p className="mt-5 text-sm text-[#78909C]">Nenhum preço registrado ainda (nem em compras, nem em fabricação).</p>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <KpiCard titulo="Menor preço" valor={formatarMoeda(menor)} />
                <KpiCard titulo="Preço médio" valor={formatarMoeda(media)} />
                <KpiCard titulo="Maior preço" valor={formatarMoeda(maior)} />
              </div>

              <div className="mt-5 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosGraficoPreco}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${Number(v).toFixed(0)}`} />
                    <Tooltip
                      formatter={(v, _n, item) => [formatarMoeda(Number(v)), item?.payload?.origem === "compra" ? "Compra" : "Fabricação"]}
                    />
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Line type="monotone" dataKey="valorUnitario" stroke="#546E7A" strokeWidth={2} dot={DotOrigemPreco as any} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-[#78909C]">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_ORIGEM_COMPRA }} /> Compra</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_ORIGEM_FABRICACAO }} /> Fabricação</span>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-[#2a2a2a]">
                <table className="min-w-[480px] w-full text-left text-sm">
                  <thead className="bg-[#181818] text-[#90A4AE]">
                    <tr><Th>Data</Th><Th>Origem</Th><Th>Referência</Th><Th>Preço unitário</Th></tr>
                  </thead>
                  <tbody>
                    {pontosPreco.map((p, i) => (
                      <tr key={i} className="border-t border-[#2a2a2a]">
                        <Td>{formatarData(p.data)}</Td>
                        <Td className="text-xs text-[#78909C]">{p.origem === "compra" ? "Compra" : "Fabricação"}</Td>
                        <Td>{p.referencia}</Td>
                        <Td className="font-semibold text-[#90A4AE]">{formatarMoeda(p.valorUnitario)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPontoPrecoCompra(r: any): PontoPrecoMateriaPrima {
  return {
    data: String(r.pedidos_compra?.data ?? ""),
    valorUnitario: Number(r.valor_unitario ?? 0),
    origem: "compra",
    referencia: r.pedidos_compra?.fornecedores?.nome || "—",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPontoPrecoFabricacao(r: any): PontoPrecoMateriaPrima {
  return {
    data: String(r.pedidos_fabricacao?.data ?? ""),
    valorUnitario: Number(r.preco_unitario ?? 0),
    origem: "fabricacao",
    referencia: r.fornecedor_nome || "Fabricação",
  };
}

// Busca combinada usada tanto pro gráfico único (uma matéria-prima escolhida)
// quanto pro modo "ver todas de uma vez" (um por componente do produto) — pra
// não duplicar a lógica de juntar compra + fabricação e tratar erro.
async function buscarHistoricoPreco(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  selecao: SelecaoPreco
): Promise<{ pontos: PontoPrecoMateriaPrima[]; erro: string | null }> {
  const buscaFab = supabase
    .from("itens_fabricacao")
    .select("preco_unitario, fornecedor_nome, pedidos_fabricacao(data)")
    .eq("nome_peca", selecao.nome);
  const buscaCompra = selecao.materiaPrimaId
    ? supabase
        .from("pedido_compra_itens")
        .select("valor_unitario, pedidos_compra(data, fornecedores(nome))")
        .eq("materia_prima_id", selecao.materiaPrimaId)
    : null;

  const [{ data: fab, error: errFab }, resCompra] = await Promise.all([
    buscaFab,
    buscaCompra ?? Promise.resolve({ data: [] as unknown[], error: null }),
  ]);

  const pontosFab = errFab ? [] : (fab ?? []).map(mapPontoPrecoFabricacao).filter((p: PontoPrecoMateriaPrima) => p.data);
  const pontosCompra = resCompra.error ? [] : (resCompra.data ?? []).map(mapPontoPrecoCompra).filter((p: PontoPrecoMateriaPrima) => p.data);

  let erro: string | null = null;
  if (resCompra.error) {
    erro = resCompra.error.message.includes("does not exist")
      ? "Falta rodar a migration que adiciona materia_prima_id em pedido_compra_itens — mostrando por enquanto só o histórico de fabricação."
      : resCompra.error.message;
  } else if (errFab) {
    erro = errFab.message;
  }

  const pontos = [...pontosCompra, ...pontosFab].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return { pontos, erro };
}

// ─── Fabricação ───────────────────────────────────────────────────────────────

function FabricacaoSubModulo({
  usuarioId,
  dataHoje,
  fornecedores,
  usuariosMap,
}: {
  usuarioId: string;
  dataHoje: string;
  fornecedores: Fornecedor[];
  usuariosMap: Record<string, string>;
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
  const [dividirBalancete, setDividirBalancete] = useState(false);

  const [pedidoSelecionado, setPedidoSelecionado] = useState<PedidoFabricacao | null>(null);
  const [itensDetalhe, setItensDetalhe] = useState<ItemFabricacao[]>([]);
  // Só preço e fornecedor do item já lançado são editáveis — quantidade e
  // peça ficam travadas porque são elas que afetam o estoque (ver aviso na
  // tela). Corrigir isso não mexe em nenhum saldo de estoque, só no custo/
  // fornecedor registrado do pedido.
  const [itensPrecoForm, setItensPrecoForm] = useState<Record<string, string>>({});
  const [itensFornecedorForm, setItensFornecedorForm] = useState<Record<string, string>>({});
  const [carregandoItensDetalhe, setCarregandoItensDetalhe] = useState(false);
  const [editandoDetalhe, setEditandoDetalhe] = useState(false);
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false);
  const [formDetalhe, setFormDetalhe] = useState({ data: "", observacao: "" });

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const [{ data: p }, { data: ped }] = await Promise.all([
        supabase.from("produtos").select("*").eq("ativo", true).order("nome"),
        supabase.from("pedidos_fabricacao").select("*").order("data", { ascending: false }).limit(50),
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

    // Increment stock after fabrication
    const produtoFab = produtos.find((p) => p.id === produtoId);
    if (produtoFab) {
      const qtdFab = parseNumero(qtdFabricada);
      await supabase.from("produtos").update({
        estoque_atual: produtoFab.estoqueAtual + qtdFab,
      }).eq("id", produtoId);
      setProdutos((prev) => prev.map((p) =>
        p.id === produtoId ? { ...p, estoqueAtual: p.estoqueAtual + qtdFab } : p
      ));
    }

    const nomeItemBalancete = `Fabricação${produto?.nome ? ` - ${produto.nome}` : ""}`;
    const avisoBalancete = await lancarCompraNoBalancete({
      dividir: dividirBalancete,
      valorTotal: valorTotalGeral,
      data: dataFab,
      nomeItem: nomeItemBalancete,
      usuarioId,
      usuariosMap,
    });

    setProdutoId("");
    setQtdFabricada("1");
    setDataFab(dataHoje);
    setObservacao("");
    setItens([]);
    setComponentesCarregados(false);
    setDividirBalancete(false);
    setMensagem(
      avisoBalancete
        ? `Pedido de fabricação registrado. ${avisoBalancete}`
        : valorTotalGeral > 0
        ? "Pedido de fabricação registrado e lançado no balancete."
        : "Pedido de fabricação registrado."
    );
  }

  async function abrirDetalhePedido(pedido: PedidoFabricacao) {
    setPedidoSelecionado(pedido);
    setEditandoDetalhe(false);
    setFormDetalhe({ data: pedido.data, observacao: pedido.observacao });
    setCarregandoItensDetalhe(true);
    const supabase = createClient();
    const { data } = await supabase.from("itens_fabricacao").select("*").eq("pedido_id", pedido.id).order("nome_peca");
    const itens = (data ?? []).map(mapItemFabricacao);
    setItensDetalhe(itens);
    setItensPrecoForm(Object.fromEntries(itens.map((it) => [it.id, String(it.precoUnitario).replace(".", ",")])));
    setItensFornecedorForm(Object.fromEntries(itens.map((it) => [it.id, it.fornecedorNome])));
    setCarregandoItensDetalhe(false);
  }

  function fecharDetalhePedido() {
    setPedidoSelecionado(null);
    setEditandoDetalhe(false);
    setItensDetalhe([]);
  }

  async function handleSalvarDetalhePedido() {
    if (!pedidoSelecionado) return;
    if (!formDetalhe.data) { setErro("Informe a data."); return; }
    setSalvandoDetalhe(true);
    setErro("");
    const supabase = createClient();

    // Corrige preço unitário/total e fornecedor de cada item que mudou — sem
    // tocar em qtd_pc/qtd_total/nome_peca, que são o que afeta o estoque.
    const itensAtualizados = itensDetalhe.map((item) => {
      const novoPrecoUnitario = parseNumero(itensPrecoForm[item.id] ?? String(item.precoUnitario));
      const novoFornecedorNome = itensFornecedorForm[item.id] ?? item.fornecedorNome;
      return { ...item, precoUnitario: novoPrecoUnitario, precoTotal: item.qtdTotal * novoPrecoUnitario, fornecedorNome: novoFornecedorNome };
    });
    const itensAlterados = itensAtualizados.filter(
      (item, i) => item.precoUnitario !== itensDetalhe[i].precoUnitario || item.fornecedorNome !== itensDetalhe[i].fornecedorNome
    );
    for (const item of itensAlterados) {
      const { error: errItem } = await supabase
        .from("itens_fabricacao")
        .update({ preco_unitario: item.precoUnitario, preco_total: item.precoTotal, fornecedor_nome: item.fornecedorNome })
        .eq("id", item.id);
      if (errItem) { setSalvandoDetalhe(false); setErro(errItem.message); return; }
    }
    const novoValorTotal = itensAtualizados.reduce((s, item) => s + item.precoTotal, 0);

    const payload = { data: formDetalhe.data, observacao: formDetalhe.observacao.trim(), valor_total: novoValorTotal };
    const { error } = await supabase.from("pedidos_fabricacao").update(payload).eq("id", pedidoSelecionado.id);
    setSalvandoDetalhe(false);
    if (error) { setErro(error.message); return; }
    const atualizado: PedidoFabricacao = { ...pedidoSelecionado, data: payload.data, observacao: payload.observacao, valorTotal: novoValorTotal };
    setPedidos((prev) => prev.map((p) => p.id === pedidoSelecionado.id ? atualizado : p));
    setPedidoSelecionado(atualizado);
    setItensDetalhe(itensAtualizados);
    setEditandoDetalhe(false);
    setMensagem("Pedido de fabricação atualizado.");
  }

  async function handleExcluirDetalhePedido() {
    if (!pedidoSelecionado) return;
    if (!confirm("Excluir este pedido de fabricação? O estoque produzido será estornado.")) return;
    const supabase = createClient();
    const { error } = await supabase.from("pedidos_fabricacao").delete().eq("id", pedidoSelecionado.id);
    if (error) { setErro(error.message); return; }
    await supabase.from("itens_fabricacao").delete().eq("pedido_id", pedidoSelecionado.id);

    const produtoFab = produtos.find((p) => p.id === pedidoSelecionado.produtoId);
    if (produtoFab) {
      const novoSaldo = Math.max(0, produtoFab.estoqueAtual - pedidoSelecionado.qtdFabricada);
      await supabase.from("produtos").update({ estoque_atual: novoSaldo }).eq("id", pedidoSelecionado.produtoId);
      setProdutos((prev) => prev.map((p) => p.id === pedidoSelecionado.produtoId ? { ...p, estoqueAtual: novoSaldo } : p));
    }

    setPedidos((prev) => prev.filter((p) => p.id !== pedidoSelecionado.id));
    fecharDetalhePedido();
    setMensagem("Pedido de fabricação removido.");
  }

  if (carregando) return <EstadoCarregando texto="Carregando fabricação..." />;

  return (
    <div className="mt-6 space-y-6">
      <FeedbackBloco mensagem={mensagem} erro={erro} />

      {/* Formulário de novo pedido */}
      <div className="rounded-3xl border border-[#333333] bg-[#181818] p-5">
        <p className="text-sm font-semibold text-[#90A4AE]">Novo pedido de fabricação</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium">Produto fabricado</label>
            <select
              value={produtoId}
              onChange={(e) => { setProdutoId(e.target.value); setComponentesCarregados(false); setItens([]); }}
              className="w-full rounded-2xl border border-[#333333] bg-[#212121] px-4 py-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
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
          className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl border border-[#546E7A] bg-[#212121] px-4 text-sm font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a] disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          {carregandoComp ? "Carregando..." : "Carregar matérias-primas"}
        </button>

        {componentesCarregados && itens.length > 0 && (
          <>
            <div className="mt-5 overflow-auto rounded-2xl border border-[#333333]">
              <table className="min-w-[800px] w-full bg-[#212121] text-left text-sm">
                <thead className="bg-[#181818] text-[#90A4AE]">
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
                    <tr key={it.componenteId} className="border-t border-[#2a2a2a]">
                      <Td className="font-semibold">{it.nomePeca}</Td>
                      <Td>{it.qtdPc}</Td>
                      <Td className="font-semibold text-[#90A4AE]">{qtdTotal(it.qtdPc)}</Td>
                      <Td>
                        {it.linkCompra ? (
                          <a href={it.linkCompra} target="_blank" rel="noopener noreferrer"
                            className="text-[#90A4AE] underline text-xs">Ver</a>
                        ) : <span className="text-[#90A4AE]">—</span>}
                      </Td>
                      <Td>
                        <select
                          value={it.fornecedorNome}
                          onChange={(e) => atualizarItem(idx, "fornecedorNome", e.target.value)}
                          className="w-36 rounded-xl border border-[#333333] bg-[#212121] px-2 py-1.5 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
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
                          className="w-24 rounded-xl border border-[#333333] bg-[#212121] px-2 py-1.5 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
                          placeholder="0,00"
                        />
                      </Td>
                      <Td className="font-semibold">{formatarMoeda(precoTotal(it))}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={() => setDividirBalancete((v) => !v)}
              className={`mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                dividirBalancete
                  ? "border-[#546E7A] bg-[#546E7A]/15"
                  : "border-[#333333] bg-[#212121] hover:bg-[#2a2a2a]"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold text-[#ECEFF1]">Dividir no balancete entre os sócios</span>
                <span className="mt-0.5 block text-xs text-[#78909C]">
                  {dividirBalancete
                    ? "Ligado: lança metade do custo pra Matheus e metade pra Enyo."
                    : "Desligado: lança o custo integral no balancete pra quem estiver registrando."}
                </span>
              </span>
              <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${dividirBalancete ? "bg-[#546E7A]" : "bg-[#333333]"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${dividirBalancete ? "left-5" : "left-0.5"}`} />
              </span>
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                Custo total estimado:{" "}
                <span className="text-[#90A4AE]">{formatarMoeda(valorTotalGeral)}</span>
              </p>
              <button
                type="button"
                onClick={handleSalvar}
                disabled={salvando}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-5 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {salvando ? "Salvando..." : "Registrar fabricação"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Histórico */}
      <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
        <p className="text-sm font-semibold text-[#90A4AE]">Histórico de fabricação</p>
        <p className="mt-0.5 text-xs text-[#78909C]">Clique em um pedido para ver os itens usados e editar.</p>
        <div className="mt-4 overflow-hidden rounded-3xl border border-[#333333]">
          {pedidos.length > 0 ? (
            <div className="max-h-72 overflow-auto">
              <table className="min-w-[560px] w-full bg-[#212121] text-left text-sm">
                <thead className="sticky top-0 bg-[#181818] text-[#90A4AE]">
                  <tr>
                    <Th>Data</Th>
                    <Th>Produto</Th>
                    <Th>Qtd fabricada</Th>
                    <Th>Custo unit.</Th>
                    <Th>Custo total</Th>
                    <Th>Lançado por</Th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => abrirDetalhePedido(p)}
                      className="cursor-pointer border-t border-[#2a2a2a] transition hover:bg-[#2a2a2a]"
                    >
                      <Td>{formatarData(p.data)}</Td>
                      <Td className="font-semibold">{p.produtoNome}</Td>
                      <Td>{p.qtdFabricada}</Td>
                      <Td>
                        {p.qtdFabricada > 0 ? (
                          `${formatarMoeda(p.valorTotal / p.qtdFabricada)}/un`
                        ) : (
                          <span className="text-[#78909C]">—</span>
                        )}
                      </Td>
                      <Td className="font-semibold text-[#90A4AE]">{formatarMoeda(p.valorTotal)}</Td>
                      <Td className="text-xs text-[#78909C]">{nomeUsuario(usuariosMap, p.criadoPor)}</Td>
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

      {pedidoSelecionado && (
        <Modal
          titulo={editandoDetalhe ? "Editar pedido de fabricação" : pedidoSelecionado.produtoNome || "Detalhe da fabricação"}
          subtitulo="Fabricação"
          onClose={fecharDetalhePedido}
          largo
        >
          <FeedbackBloco mensagem="" erro={erro} />
          {editandoDetalhe ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoCadastro label="Data" type="date" value={formDetalhe.data} onChange={(v) => setFormDetalhe((f) => ({ ...f, data: v }))} required />
              <div className="sm:col-span-2">
                <CampoCadastro label="Observação" value={formDetalhe.observacao} onChange={(v) => setFormDetalhe((f) => ({ ...f, observacao: v }))} />
              </div>
              <p className="sm:col-span-2 text-xs text-[#78909C]">
                Produto, quantidade fabricada e peça de cada item não podem ser editados aqui — eles afetam o estoque. Para corrigir isso, exclua este pedido e registre novamente. Preço e fornecedor de cada item podem ser corrigidos abaixo, sem mexer no estoque.
              </p>

              {itensDetalhe.length > 0 && (
                <div className="sm:col-span-2">
                  <p className="mb-2 text-sm font-semibold text-[#90A4AE]">Corrigir preço e fornecedor dos itens usados</p>
                  <div className="overflow-x-auto rounded-2xl border border-[#2a2a2a]">
                    <table className="min-w-[560px] w-full text-left text-xs">
                      <thead className="bg-[#181818] text-[#90A4AE]">
                        <tr><Th>Peça</Th><Th>Qtd total</Th><Th>Fornecedor</Th><Th>Preço unit.</Th><Th>Preço total</Th></tr>
                      </thead>
                      <tbody>
                        {itensDetalhe.map((item) => {
                          const precoUnitario = parseNumero(itensPrecoForm[item.id] ?? "0");
                          return (
                            <tr key={item.id} className="border-t border-[#2a2a2a]">
                              <Td className="font-semibold">{item.nomePeca}</Td>
                              <Td>{item.qtdTotal}</Td>
                              <Td>
                                <select
                                  value={itensFornecedorForm[item.id] ?? ""}
                                  onChange={(e) => setItensFornecedorForm((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  className="h-8 w-36 rounded-lg border border-[#333333] bg-[#141414] px-2 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
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
                                  value={itensPrecoForm[item.id] ?? ""}
                                  onChange={(e) => setItensPrecoForm((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                  className="h-8 w-24 rounded-lg border border-[#333333] bg-[#141414] px-2 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
                                />
                              </Td>
                              <Td>{formatarMoeda(item.qtdTotal * precoUnitario)}</Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <LinhaDetalhe label="Produto" valor={pedidoSelecionado.produtoNome} />
              <LinhaDetalhe label="Data" valor={formatarData(pedidoSelecionado.data)} />
              <LinhaDetalhe label="Quantidade fabricada" valor={pedidoSelecionado.qtdFabricada} />
              <LinhaDetalhe label="Custo total" valor={formatarMoeda(pedidoSelecionado.valorTotal)} destaque />
              {pedidoSelecionado.observacao && <LinhaDetalhe label="Observação" valor={pedidoSelecionado.observacao} />}

              <p className="mb-2 mt-5 text-sm font-semibold text-[#90A4AE]">Itens usados</p>
              {carregandoItensDetalhe ? (
                <p className="py-3 text-xs text-[#78909C]">Carregando itens...</p>
              ) : itensDetalhe.length > 0 ? (
                <div className="overflow-auto rounded-xl border border-[#2a2a2a]">
                  <table className="min-w-[480px] w-full text-left text-xs">
                    <thead className="bg-[#181818] text-[#90A4AE]">
                      <tr><Th>Peça</Th><Th>Qtd total</Th><Th>Fornecedor</Th><Th>Preço total</Th></tr>
                    </thead>
                    <tbody>
                      {itensDetalhe.map((it) => (
                        <tr key={it.id} className="border-t border-[#2a2a2a]">
                          <Td className="font-semibold">{it.nomePeca}</Td>
                          <Td>{it.qtdTotal}</Td>
                          <Td>{it.fornecedorNome || "—"}</Td>
                          <Td>{formatarMoeda(it.precoTotal)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-3 text-xs text-[#78909C]">Nenhum item registrado para este pedido.</p>
              )}
            </div>
          )}
          <ModalAcoes
            editando={editandoDetalhe}
            salvando={salvandoDetalhe}
            onEditar={() => setEditandoDetalhe(true)}
            onSalvar={handleSalvarDetalhePedido}
            onCancelar={() => setEditandoDetalhe(false)}
            onExcluir={handleExcluirDetalhePedido}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── Balancete ────────────────────────────────────────────────────────────────

function BalanceteModulo({ usuarioId, dataHoje }: { usuarioId: string; dataHoje: string }) {
  const [itens, setItens] = useState<ItemBalancete[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [termoBusca, setTermoBusca] = useState("");
  const [form, setForm] = useState({
    data: dataHoje,
    nomeItem: "",
    valorUnitario: "",
    quantidade: "1",
    nomeComprador: "" as NomeComprador | "",
  });

  const [itemSelecionado, setItemSelecionado] = useState<ItemBalancete | null>(null);
  const [editandoDetalhe, setEditandoDetalhe] = useState(false);
  const [salvandoDetalhe, setSalvandoDetalhe] = useState(false);
  const [formDetalhe, setFormDetalhe] = useState({
    data: "",
    nomeItem: "",
    valorUnitario: "",
    quantidade: "",
    nomeComprador: "" as NomeComprador | "",
  });

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      const supabase = createClient();
      const { data } = await supabase
        .from("balancete")
        .select("*")
        
        .order("data", { ascending: false });
      if (ativo) {
        setItens((data ?? []).map(mapItemBalancete));
        setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, [usuarioId]);

  const valorTotalForm =
    parseNumero(form.valorUnitario) * parseNumero(form.quantidade || "1");

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setMensagem(""); setErro("");
    if (!form.data || !form.nomeItem.trim() || !form.valorUnitario || !form.nomeComprador) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }
    setSalvando(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("balancete")
      .insert({
        criado_por: usuarioId,
        data: form.data,
        nome_item: form.nomeItem.trim(),
        valor_unitario: parseNumero(form.valorUnitario),
        quantidade: parseNumero(form.quantidade || "1"),
        valor_total: valorTotalForm,
        nome_comprador: form.nomeComprador,
      })
      .select()
      .single();
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    if (data) setItens((prev) => [mapItemBalancete(data), ...prev]);
    setForm({ data: dataHoje, nomeItem: "", valorUnitario: "", quantidade: "1", nomeComprador: "" });
    setMensagem("Item adicionado.");
  }

  async function handleExcluir(id: string) {
    if (!confirm("Excluir este item?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("balancete").delete().eq("id", id);
    if (error) { setErro(error.message); return; }
    setItens((prev) => prev.filter((i) => i.id !== id));
    setMensagem("Item removido.");
  }

  function abrirDetalhe(item: ItemBalancete) {
    setItemSelecionado(item);
    setEditandoDetalhe(false);
    setFormDetalhe({
      data: item.data,
      nomeItem: item.nomeItem,
      valorUnitario: String(item.valorUnitario).replace(".", ","),
      quantidade: String(item.quantidade),
      nomeComprador: item.nomeComprador,
    });
  }

  function fecharDetalhe() {
    setItemSelecionado(null);
    setEditandoDetalhe(false);
  }

  const valorTotalFormDetalhe =
    parseNumero(formDetalhe.valorUnitario) * parseNumero(formDetalhe.quantidade || "1");

  async function handleSalvarDetalhe() {
    if (!itemSelecionado) return;
    if (!formDetalhe.data || !formDetalhe.nomeItem.trim() || !formDetalhe.valorUnitario || !formDetalhe.nomeComprador) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }
    setSalvandoDetalhe(true);
    setErro("");
    const supabase = createClient();
    const payload = {
      data: formDetalhe.data,
      nome_item: formDetalhe.nomeItem.trim(),
      valor_unitario: parseNumero(formDetalhe.valorUnitario),
      quantidade: parseNumero(formDetalhe.quantidade || "1"),
      valor_total: valorTotalFormDetalhe,
      nome_comprador: formDetalhe.nomeComprador,
    };
    const { error } = await supabase.from("balancete").update(payload).eq("id", itemSelecionado.id);
    setSalvandoDetalhe(false);
    if (error) { setErro(error.message); return; }
    const atualizado: ItemBalancete = {
      id: itemSelecionado.id,
      data: payload.data,
      nomeItem: payload.nome_item,
      valorUnitario: payload.valor_unitario,
      quantidade: payload.quantidade,
      valorTotal: payload.valor_total,
      nomeComprador: payload.nome_comprador as NomeComprador,
    };
    setItens((prev) => prev.map((i) => i.id === itemSelecionado.id ? atualizado : i));
    setItemSelecionado(atualizado);
    setEditandoDetalhe(false);
    setMensagem("Item atualizado.");
  }

  async function handleExcluirDetalhe() {
    if (!itemSelecionado) return;
    await handleExcluir(itemSelecionado.id);
    fecharDetalhe();
  }

  const somaMatheus = itens.filter((i) => i.nomeComprador === "Matheus").reduce((s, i) => s + i.valorTotal, 0);
  const somaEnyo = itens.filter((i) => i.nomeComprador === "Enyo").reduce((s, i) => s + i.valorTotal, 0);
  const diferenca = somaMatheus - somaEnyo;

  const itensFiltrados = itens.filter((i) => {
    const q = termoBusca.toLowerCase();
    return !q || i.nomeItem.toLowerCase().includes(q) || i.nomeComprador.toLowerCase().includes(q);
  });

  if (carregando) return <EstadoCarregando texto="Carregando balancete..." />;

  return (
    <section className="space-y-6">
      {/* Formulário */}
      <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
        <SectionHeader tag="Balancete" titulo="Registrar item" descricao="Adicione despesas e compras de cada sócio para calcular o balancete." />
        <form onSubmit={handleSalvar} className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CampoCadastro label="Data *" type="date" value={form.data} onChange={(v) => setForm((f) => ({ ...f, data: v }))} required />
          <div className="xl:col-span-2">
            <CampoCadastro label="Nome do item *" value={form.nomeItem} onChange={(v) => setForm((f) => ({ ...f, nomeItem: v }))} placeholder="Ex: Material de escritório" required />
          </div>
          <CampoCadastro label="Valor unitário *" value={form.valorUnitario} onChange={(v) => setForm((f) => ({ ...f, valorUnitario: v }))} placeholder="0,00" required />
          <CampoCadastro label="Quantidade" value={form.quantidade} onChange={(v) => setForm((f) => ({ ...f, quantidade: v }))} placeholder="1" />
          <SelectCadastro
            label="Nome do comprador *"
            value={form.nomeComprador}
            onChange={(v) => setForm((f) => ({ ...f, nomeComprador: v as NomeComprador }))}
            options={COMPRADORES_BALANCETE}
            placeholder="Selecione..."
          />
          <div className="flex items-end">
            <div className="flex-1 rounded-2xl border border-[#333333] bg-[#181818] px-4 py-3 text-sm">
              <p className="text-xs text-[#78909C]">Valor total</p>
              <p className="font-bold text-[#90A4AE]">{formatarMoeda(valorTotalForm)}</p>
            </div>
          </div>
          <div className="sm:col-span-2 xl:col-span-3">
            <FeedbackBloco mensagem={mensagem} erro={erro} />
            <button type="submit" disabled={salvando}
              className="mt-2 inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-5 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60">
              <Plus className="h-4 w-4" />
              {salvando ? "Salvando..." : "Adicionar item"}
            </button>
          </div>
        </form>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard titulo="Total Matheus" valor={formatarMoeda(somaMatheus)} />
        <KpiCard titulo="Total Enyo" valor={formatarMoeda(somaEnyo)} />
        <KpiCard
          titulo={diferenca >= 0 ? "Enyo deve a Matheus" : "Matheus deve a Enyo"}
          valor={formatarMoeda(Math.abs(diferenca) / 2)}
          alerta={Math.abs(diferenca) > 0}
        />
      </div>

      {/* Tabela */}
      <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">Itens registrados</h3>
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#90A4AE]" />
            <input type="search" value={termoBusca} onChange={(e) => setTermoBusca(e.target.value)}
              className="h-10 w-full rounded-2xl border border-[#333333] bg-[#141414] pl-9 pr-4 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
              placeholder="Buscar item ou comprador" />
          </div>
        </div>
        <div className="overflow-hidden rounded-3xl border border-[#333333]">
          {itensFiltrados.length > 0 ? (
            <div className="overflow-auto">
              <table className="min-w-[720px] w-full bg-[#212121] text-left text-sm">
                <thead className="sticky top-0 bg-[#181818] text-[#90A4AE]">
                  <tr>
                    <Th>Data</Th>
                    <Th>Nome do item</Th>
                    <Th>Valor un.</Th>
                    <Th>Qtd.</Th>
                    <Th>Valor total</Th>
                    <Th>Comprador</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {itensFiltrados.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => abrirDetalhe(item)}
                      className="cursor-pointer border-t border-[#2a2a2a] transition hover:bg-[#2a2a2a]"
                    >
                      <Td>{formatarData(item.data)}</Td>
                      <Td>{item.nomeItem}</Td>
                      <Td>{formatarMoeda(item.valorUnitario)}</Td>
                      <Td>{item.quantidade}</Td>
                      <Td className="font-semibold text-[#90A4AE]">{formatarMoeda(item.valorTotal)}</Td>
                      <Td>
                        <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
                          item.nomeComprador === "Matheus"
                            ? "bg-[#CFD8DC] text-[#546E7A]"
                            : "bg-[#37474F]/10 text-[#37474F]"
                        }`}>
                          {item.nomeComprador}
                        </span>
                      </Td>
                      <Td>
                        <button type="button" onClick={(e) => { e.stopPropagation(); handleExcluir(item.id); }}
                          className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-900/50 bg-red-900/10 px-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/30">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-[#333333] bg-[#181818]">
                  <tr>
                    <Td colSpan={4} className="font-bold text-[#90A4AE]">Total geral</Td>
                    <Td className="font-bold text-[#90A4AE]">{formatarMoeda(itens.reduce((s, i) => s + i.valorTotal, 0))}</Td>
                    <Td colSpan={2}>{""}</Td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <EstadoTabelaVazia texto="Nenhum item registrado ainda." />
          )}
        </div>
      </div>

      {itemSelecionado && (
        <Modal
          titulo={editandoDetalhe ? "Editar item do balancete" : itemSelecionado.nomeItem}
          subtitulo="Balancete"
          onClose={fecharDetalhe}
        >
          <FeedbackBloco mensagem="" erro={erro} />
          {editandoDetalhe ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <CampoCadastro label="Data" type="date" value={formDetalhe.data} onChange={(v) => setFormDetalhe((f) => ({ ...f, data: v }))} required />
              <div className="sm:col-span-2">
                <CampoCadastro label="Nome do item" value={formDetalhe.nomeItem} onChange={(v) => setFormDetalhe((f) => ({ ...f, nomeItem: v }))} required />
              </div>
              <CampoCadastro label="Valor unitário" value={formDetalhe.valorUnitario} onChange={(v) => setFormDetalhe((f) => ({ ...f, valorUnitario: v }))} required />
              <CampoCadastro label="Quantidade" value={formDetalhe.quantidade} onChange={(v) => setFormDetalhe((f) => ({ ...f, quantidade: v }))} />
              <SelectCadastro
                label="Comprador"
                value={formDetalhe.nomeComprador}
                onChange={(v) => setFormDetalhe((f) => ({ ...f, nomeComprador: v as NomeComprador }))}
                options={COMPRADORES_BALANCETE}
                placeholder="Selecione..."
              />
              <div className="rounded-2xl border border-[#333333] bg-[#181818] px-4 py-3 text-sm">
                <p className="text-xs text-[#78909C]">Valor total</p>
                <p className="font-bold text-[#90A4AE]">{formatarMoeda(valorTotalFormDetalhe)}</p>
              </div>
            </div>
          ) : (
            <div>
              <LinhaDetalhe label="Data" valor={formatarData(itemSelecionado.data)} />
              <LinhaDetalhe label="Nome do item" valor={itemSelecionado.nomeItem} />
              <LinhaDetalhe label="Valor unitário" valor={formatarMoeda(itemSelecionado.valorUnitario)} />
              <LinhaDetalhe label="Quantidade" valor={itemSelecionado.quantidade} />
              <LinhaDetalhe label="Valor total" valor={formatarMoeda(itemSelecionado.valorTotal)} destaque />
              <LinhaDetalhe label="Comprador" valor={itemSelecionado.nomeComprador} />
            </div>
          )}
          <ModalAcoes
            editando={editandoDetalhe}
            salvando={salvandoDetalhe}
            onEditar={() => setEditandoDetalhe(true)}
            onSalvar={handleSalvarDetalhe}
            onCancelar={() => setEditandoDetalhe(false)}
            onExcluir={handleExcluirDetalhe}
          />
        </Modal>
      )}
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

      <div className="rounded-3xl border border-amber-800/40 bg-[#212121] p-4 sm:p-6 shadow-sm">
        <SectionHeader
          tag="Pendentes"
          titulo="Aguardando aprovação"
          descricao="Usuários que criaram conta e aguardam sua autorização para acessar o sistema."
        />
        <div className="mt-5">
          {pendentes.length === 0 ? (
            <p className="text-sm text-[#78909C]">Nenhum usuário aguardando aprovação.</p>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-amber-800/40">
              <table className="w-full bg-[#212121] text-left text-sm">
                <thead className="bg-amber-900/20 text-[#ECEFF1]">
                  <tr>
                    <Th>Nome</Th>
                    <Th>E-mail</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((m) => (
                    <tr key={m.id} className="border-t border-amber-900/20">
                      <Td className="font-semibold">{m.nome || "-"}</Td>
                      <Td>{m.email || "-"}</Td>
                      <Td>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleAprovar(m.id)}
                            disabled={salvando}
                            className="inline-flex h-8 items-center gap-1 rounded-xl bg-[#546E7A] px-3 text-xs font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Aprovar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemover(m.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-900/50 bg-red-900/10 px-3 text-xs font-semibold text-red-400 transition hover:bg-red-900/30"
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

      <div className="rounded-3xl border border-[#333333] bg-[#212121] p-4 sm:p-6 shadow-sm">
        <SectionHeader
          tag="Acessos"
          titulo="Usuários com acesso"
          descricao="Administradores e sócios com acesso liberado ao sistema."
        />
        <div className="mt-5 overflow-hidden rounded-3xl border border-[#333333]">
          {comAcesso.length === 0 ? (
            <EstadoTabelaVazia texto="Nenhum usuário com acesso." />
          ) : (
            <table className="w-full bg-[#212121] text-left text-sm">
              <thead className="bg-[#181818] text-[#90A4AE]">
                <tr>
                  <Th>Nome</Th>
                  <Th>E-mail</Th>
                  <Th>Papel</Th>
                  <Th>Ações</Th>
                </tr>
              </thead>
              <tbody>
                {comAcesso.map((m) => (
                  <tr key={m.id} className="border-t border-[#2a2a2a]">
                    <Td className="font-semibold">{m.nome || "-"}</Td>
                    <Td>{m.email || "-"}</Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        m.papel === "admin"
                          ? "bg-[#CFD8DC] text-[#546E7A]"
                          : "bg-emerald-900/20 text-emerald-400"
                      }`}>
                        {m.papel === "admin" ? "Admin" : "Sócio"}
                      </span>
                    </Td>
                    <Td>
                      {m.papel !== "admin" && m.usuarioId !== usuarioId && (
                        <button
                          type="button"
                          onClick={() => handleRemover(m.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-xl border border-red-900/50 bg-red-900/10 px-2 text-xs font-semibold text-red-400 transition hover:bg-red-900/30"
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

function DashSecao({ titulo }: { titulo: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-[#CFD8DC]" />
      <span className="text-xs font-bold uppercase tracking-widest text-[#78909C]">
        {titulo}
      </span>
      <div className="h-px flex-1 bg-[#CFD8DC]" />
    </div>
  );
}

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
          ? "border-[#37474F] bg-[#1B2535]"
          : alerta
          ? "border-red-900/50 bg-[#2B1010]"
          : "border-[#333333] bg-[#1e1e1e]"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#78909C]">
        {titulo}
      </p>
      <p
        className={`mt-1.5 text-base sm:text-xl font-bold truncate ${
          destaque
            ? "text-[#90A4AE]"
            : alerta
            ? "text-red-400"
            : "text-[#ECEFF1]"
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
      <p className="text-sm font-semibold text-[#90A4AE]">{tag}</p>
      <h2 className="mt-1 text-2xl font-bold">{titulo}</h2>
      {descricao && (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C]">
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
        className="w-full rounded-2xl border border-[#333333] bg-[#141414] px-4 py-3 text-sm text-[#ECEFF1] outline-none transition placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
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
        className="w-full rounded-2xl border border-[#333333] bg-[#141414] px-4 py-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
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
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 ${className ?? ""}`}>{children}</td>
  );
}

function EstadoTabelaVazia({ texto }: { texto: string }) {
  return (
    <div className="bg-[#212121] px-4 py-12 text-center text-sm text-[#78909C]">
      {texto}
    </div>
  );
}

function EstadoCarregando({ texto }: { texto: string }) {
  return (
    <div className="rounded-3xl border border-[#333333] bg-[#212121] p-12 text-center text-sm text-[#78909C]">
      {texto}
    </div>
  );
}

// Itens opcionais de um pedido de compra — cada linha pode vir do cadastro de
// matérias-primas (puxa nome e custo de referência automaticamente, editável
// depois porque o preço da compra real pode variar) ou ser um item avulso com
// descrição livre. Quantidade × valor unitário soma pro valor total do
// pedido. Reaproveitado tanto no formulário de "Novo pedido" quanto na
// edição do detalhe, pra não duplicar a UI de adicionar/remover linha.
function ItensPedidoEditor({
  itens,
  onChange,
  materiasPrimas,
}: {
  itens: LinhaItemPedido[];
  onChange: (itens: LinhaItemPedido[]) => void;
  materiasPrimas: MateriaPrima[];
}) {
  function atualizar(id: string, campo: "descricao" | "quantidade" | "valorUnitario", valor: string) {
    onChange(itens.map((i) => (i.id === id ? { ...i, [campo]: valor } : i)));
  }
  function remover(id: string) {
    onChange(itens.filter((i) => i.id !== id));
  }
  function adicionar() {
    onChange([...itens, novaLinhaItemPedido()]);
  }
  function selecionarMateriaPrima(id: string, materiaPrimaId: string) {
    const mp = materiasPrimas.find((m) => m.id === materiaPrimaId);
    onChange(
      itens.map((i) =>
        i.id === id
          ? {
              ...i,
              materiaPrimaId,
              descricao: mp ? mp.nome : i.descricao,
              valorUnitario: mp ? String(mp.custo).replace(".", ",") : i.valorUnitario,
            }
          : i
      )
    );
  }

  return (
    <div className="sm:col-span-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">Itens (opcional — some ao valor total)</label>
        <button
          type="button"
          onClick={adicionar}
          className="inline-flex h-8 items-center gap-1 rounded-xl border border-[#333333] bg-[#212121] px-2 text-xs font-semibold text-[#546E7A] hover:bg-[#2a2a2a]"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar item
        </button>
      </div>
      {itens.map((item) => (
        <div key={item.id} className="mt-2 rounded-xl border border-[#333333] bg-[#141414] p-2">
          <div className="flex flex-wrap gap-2">
            <select
              value={item.materiaPrimaId}
              onChange={(e) => selecionarMateriaPrima(item.id, e.target.value)}
              className="h-9 min-w-[180px] flex-1 rounded-xl border border-[#333333] bg-[#181818] px-2 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
            >
              <option value="">Item avulso (digitar descrição)</option>
              {materiasPrimas.map((mp) => (
                <option key={mp.id} value={mp.id}>
                  {mp.codigo ? `${mp.codigo} — ` : ""}{mp.nome}
                </option>
              ))}
            </select>
            {!item.materiaPrimaId && (
              <input
                type="text"
                value={item.descricao}
                onChange={(e) => atualizar(item.id, "descricao", e.target.value)}
                placeholder="Descrição"
                className="h-9 min-w-[160px] flex-1 rounded-xl border border-[#333333] bg-[#181818] px-3 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
              />
            )}
            <input
              type="text"
              value={item.quantidade}
              onChange={(e) => atualizar(item.id, "quantidade", e.target.value)}
              placeholder="Qtd"
              className="h-9 w-16 rounded-xl border border-[#333333] bg-[#181818] px-2 text-center text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
            />
            <input
              type="text"
              value={item.valorUnitario}
              onChange={(e) => atualizar(item.id, "valorUnitario", e.target.value)}
              placeholder="R$ un."
              className="h-9 w-24 rounded-xl border border-[#333333] bg-[#181818] px-2 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]"
            />
            <button
              type="button"
              onClick={() => remover(item.id)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          {item.materiaPrimaId && (
            <p className="mt-1.5 text-xs text-[#78909C]">
              {item.descricao} — valor unitário puxado do cadastro, editável se o preço dessa compra for diferente.
            </p>
          )}
        </div>
      ))}
      {itens.length > 0 && (
        <p className="mt-2 text-right text-sm font-semibold text-[#90A4AE]">
          Soma dos itens: {formatarMoeda(somaItensPedido(itens))}
        </p>
      )}
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
        <div className="rounded-2xl border border-[#333333] bg-[#CFD8DC] px-4 py-3 text-sm text-[#546E7A]">
          {mensagem}
        </div>
      )}
      {erro && (
        <div className="rounded-2xl border border-red-900/50 bg-red-900/15 px-4 py-3 text-sm text-red-400">
          {erro}
        </div>
      )}
    </div>
  );
}

function MarketplaceBadge({ marketplace }: { marketplace: Marketplace }) {
  const cores: Record<Marketplace, string> = {
    "Mercado Livre": "bg-yellow-900/30 text-yellow-400",
    Shopee: "bg-orange-900/30 text-orange-400",
    "Site Próprio": "bg-blue-900/30 text-blue-400",
    Outro: "bg-[#2a2a2a] text-[#90A4AE]",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cores[marketplace]}`}
    >
      {marketplace}
    </span>
  );
}

function Modal({
  titulo,
  subtitulo,
  onClose,
  children,
  largo,
}: {
  titulo: string;
  subtitulo?: string;
  onClose: () => void;
  children: React.ReactNode;
  largo?: boolean;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${largo ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto rounded-3xl border border-[#333333] bg-[#212121] p-6 shadow-xl`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            {subtitulo && <p className="text-sm font-semibold text-[#90A4AE]">{subtitulo}</p>}
            <h3 className="mt-1 text-xl font-bold">{titulo}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#333333] bg-[#181818] text-[#90A4AE] transition hover:bg-[#2a2a2a]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function LinhaDetalhe({
  label,
  valor,
  destaque,
  alerta,
}: {
  label: string;
  valor: React.ReactNode;
  destaque?: boolean;
  alerta?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#2a2a2a] py-2.5 text-sm last:border-0">
      <span className="text-[#90A4AE]">{label}</span>
      <span className={`text-right font-semibold ${alerta ? "text-red-400" : destaque ? "text-[#90A4AE]" : "text-[#ECEFF1]"}`}>
        {valor}
      </span>
    </div>
  );
}

function HistoricoRegistro({
  usuariosMap,
  criadoPor,
  criadoEm,
  atualizadoPor,
  atualizadoEm,
}: {
  usuariosMap: Record<string, string>;
  criadoPor: string;
  criadoEm: string;
  atualizadoPor: string;
  atualizadoEm: string;
}) {
  if (!criadoPor && !atualizadoPor) return null;
  return (
    <div className="mt-3 border-t border-[#2a2a2a] pt-3 text-xs text-[#78909C]">
      {criadoPor && (
        <p>
          Lançado por <span className="font-semibold text-[#90A4AE]">{nomeUsuario(usuariosMap, criadoPor)}</span>
          {criadoEm && ` em ${formatarDataHora(criadoEm)}`}
        </p>
      )}
      {atualizadoPor && (
        <p className="mt-1">
          Última edição por <span className="font-semibold text-[#90A4AE]">{nomeUsuario(usuariosMap, atualizadoPor)}</span>
          {atualizadoEm && ` em ${formatarDataHora(atualizadoEm)}`}
        </p>
      )}
    </div>
  );
}

function ModalAcoes({
  editando,
  salvando,
  onEditar,
  onSalvar,
  onCancelar,
  onExcluir,
}: {
  editando: boolean;
  salvando: boolean;
  onEditar: () => void;
  onSalvar: () => void;
  onCancelar: () => void;
  onExcluir: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3 border-t border-[#2a2a2a] pt-5">
      {editando ? (
        <>
          <button
            type="button"
            onClick={onSalvar}
            disabled={salvando}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {salvando ? "Salvando..." : "Salvar alterações"}
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#333333] bg-[#181818] px-4 text-sm font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]"
          >
            <X className="h-4 w-4" /> Cancelar
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onEditar}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-4 text-sm font-semibold text-white transition hover:bg-[#455A64]"
          >
            <Pencil className="h-4 w-4" /> Editar
          </button>
          <button
            type="button"
            onClick={onExcluir}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-red-900/50 bg-red-900/10 px-4 text-sm font-semibold text-red-400 transition hover:bg-red-900/30"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </>
      )}
    </div>
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
    materiaPrimaId: String(r.materia_prima_id ?? ""),
    nomePeca: String(r.nome_peca ?? ""),
    quantidade: Number(r.quantidade ?? 1),
    linkCompra: String(r.link_compra ?? ""),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapKitItem(it: any): KitItem {
  return {
    id: String(it.id),
    produtoId: String(it.produto_id ?? ""),
    produtoNome: String(it.produtos?.nome ?? ""),
    produtoCodigo: String(it.produtos?.codigo ?? ""),
    quantidade: Number(it.quantidade ?? 1),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapKit(r: any): Kit {
  const itensRaw = Array.isArray(r.kit_itens) ? r.kit_itens : [];
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    descricao: String(r.descricao ?? ""),
    itens: itensRaw.map(mapKitItem),
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
    criadoPor: String(r.criado_por ?? ""),
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
    kitId: String(r.kit_id ?? ""),
    quantidade: Number(r.quantidade ?? 0),
    valorUnitario: Number(r.valor_unitario ?? 0),
    taxaMarketplace: Number(r.taxa_marketplace ?? 0),
    desconto: Number(r.desconto ?? 0),
    observacao: String(r.observacao ?? ""),
    criadoPor: String(r.criado_por ?? ""),
    criadoEm: String(r.criado_em ?? ""),
    atualizadoPor: String(r.atualizado_por ?? ""),
    atualizadoEm: String(r.atualizado_em ?? ""),
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
function mapItemBalancete(r: any): ItemBalancete {
  return {
    id: String(r.id),
    data: String(r.data ?? ""),
    nomeItem: String(r.nome_item ?? ""),
    valorUnitario: Number(r.valor_unitario ?? 0),
    quantidade: Number(r.quantidade ?? 1),
    valorTotal: Number(r.valor_total ?? 0),
    nomeComprador: r.nome_comprador as NomeComprador,
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
function mapItemFabricacao(r: any): ItemFabricacao {
  return {
    id: String(r.id),
    pedidoId: String(r.pedido_id ?? ""),
    nomePeca: String(r.nome_peca ?? ""),
    qtdPc: Number(r.qtd_pc ?? 0),
    qtdTotal: Number(r.qtd_total ?? 0),
    fornecedorNome: String(r.fornecedor_nome ?? ""),
    precoUnitario: Number(r.preco_unitario ?? 0),
    precoTotal: Number(r.preco_total ?? 0),
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
    criadoPor: String(r.criado_por ?? ""),
    criadoEm: String(r.criado_em ?? ""),
    atualizadoPor: String(r.atualizado_por ?? ""),
    atualizadoEm: String(r.atualizado_em ?? ""),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapItemPedidoCompra(r: any): ItemPedidoCompra {
  return {
    id: String(r.id),
    pedidoCompraId: String(r.pedido_compra_id ?? ""),
    materiaPrimaId: String(r.materia_prima_id ?? ""),
    descricao: String(r.descricao ?? ""),
    quantidade: Number(r.quantidade ?? 1),
    valorUnitario: Number(r.valor_unitario ?? 0),
    valorTotal: Number(r.valor_total ?? 0),
  };
}

function novaLinhaItemPedido(): LinhaItemPedido {
  return { id: crypto.randomUUID(), materiaPrimaId: "", descricao: "", quantidade: "1", valorUnitario: "0" };
}

function itemParaLinha(item: ItemPedidoCompra): LinhaItemPedido {
  return {
    id: item.id,
    materiaPrimaId: item.materiaPrimaId,
    descricao: item.descricao,
    quantidade: String(item.quantidade),
    valorUnitario: String(item.valorUnitario).replace(".", ","),
  };
}

// Ignora linhas em branco (descrição vazia) — importante porque uma linha
// vazia pode ter sido pré-carregada automaticamente (ver iniciarEdicaoPedido)
// sem o usuário ter escolhido nada ainda; não pode contar como "tem item"
// nem zerar o valor total de um pedido que já tinha um valor salvo.
function itensPreenchidos(itens: LinhaItemPedido[]): LinhaItemPedido[] {
  return itens.filter((i) => i.descricao.trim().length > 0);
}

function somaItensPedido(itens: LinhaItemPedido[]): number {
  return itensPreenchidos(itens).reduce((s, i) => s + parseNumero(i.quantidade) * parseNumero(i.valorUnitario), 0);
}

// Custo unitário médio por pedido = soma do valor_total dos itens ÷ soma das
// quantidades — usado na linha da lista de Pedidos, sem precisar abrir cada um.
function calcularCustoUnitPorPedido(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itens: any[]
): Record<string, number> {
  const acumulado: Record<string, { qtd: number; valor: number }> = {};
  itens.forEach((item) => {
    const pedidoId = String(item.pedido_compra_id ?? "");
    if (!pedidoId) return;
    if (!acumulado[pedidoId]) acumulado[pedidoId] = { qtd: 0, valor: 0 };
    acumulado[pedidoId].qtd += Number(item.quantidade ?? 0);
    acumulado[pedidoId].valor += Number(item.valor_total ?? 0);
  });
  const resultado: Record<string, number> = {};
  Object.entries(acumulado).forEach(([pedidoId, { qtd, valor }]) => {
    if (qtd > 0) resultado[pedidoId] = valor / qtd;
  });
  return resultado;
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
