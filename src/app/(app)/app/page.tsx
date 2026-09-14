import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Calculator,
  ClipboardList,
  DollarSign,
  FileText,
  Layers,
  PackagePlus,
  Ruler,
  Scale,
  ShoppingCart,
  SquareStack,
  TrendingUp,
} from "lucide-react";
import LogoutButton from "@/components/auth/logout-button";
import { createClient } from "@/lib/supabase/server";

export default async function AppPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: vinculo } = await supabase
    .from("usuarios_empresa")
    .select("papel")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (!vinculo || vinculo.papel === "pendente") {
    redirect("/pendente");
  }

  const nomeUsuario =
    user.user_metadata?.nome_completo || user.email || "usuário";

  return (
    <main className="min-h-screen bg-background px-3 py-6 text-foreground sm:px-6 sm:py-10">
      <section className="mx-auto max-w-7xl">

        {/* ── Header ── */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <Image
                src="/images/Eksteel-logo.png"
                alt="Eksteel"
                width={160}
                height={50}
                priority
                unoptimized
                className="h-11 w-auto object-contain"
              />
              <div className="h-8 w-px bg-line" />
              <p className="text-sm font-semibold text-steel">
                Ambiente interno
              </p>
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">
              Olá, {nomeUsuario}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted md:text-base">
              Central de controle operacional e financeiro da empresa. Acesse os
              módulos abaixo para acompanhar resultados, estoque e indicadores.
            </p>
          </div>

          <div className="flex self-start items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 shadow-sm backdrop-blur-sm sm:shrink-0">
            <div className="flex flex-col">
              <span className="max-w-[200px] truncate text-sm font-semibold text-steel">
                {nomeUsuario}
              </span>
              {user.email ? (
                <span className="max-w-[200px] truncate text-xs text-muted">
                  {user.email}
                </span>
              ) : null}
            </div>
            <LogoutButton />
          </div>
        </div>

        {/* ── Cards ── */}
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">

          {/* Dashboard Geral */}
          <article className="flex flex-col rounded-xl border border-line bg-panel p-5 shadow-sm sm:p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/20 text-steel">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm font-semibold text-steel">
              Operacional
            </p>
            <h2 className="mt-1 text-xl font-bold">Dashboard Geral</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Visualize vendas por marketplace, cadastre produtos, controle
              estoque e acompanhe indicadores financeiros.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  ["Vendas", BarChart3],
                  ["Estoque", Boxes],
                  ["Resultado", TrendingUp],
                  ["Compras", PackagePlus],
                ] as const
              ).map(([label, Icon]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-panel-hover bg-surface px-3 py-2"
                >
                  <Icon className="h-4 w-4 shrink-0 text-steel" />
                  <p className="text-xs font-semibold text-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-5">
              <Link
                href="/dashboard"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-background transition hover:bg-accent-dark"
              >
                Acessar dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          {/* Financeiro */}
          <article className="flex flex-col rounded-xl border border-line bg-panel p-5 shadow-sm sm:p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/20 text-steel">
              <DollarSign className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm font-semibold text-steel">
              Financeiro
            </p>
            <h2 className="mt-1 text-xl font-bold">Relatórios gerenciais</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Consulte os itens mais vendidos, a DRE gerencial, despesas e
              a posição parcial do patrimônio disponível no estoque.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  ["Despesas", DollarSign],
                  ["Receita", TrendingUp],
                  ["Margem", BarChart3],
                  ["Estoque", Scale],
                ] as const
              ).map(([label, Icon]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-panel-hover bg-surface px-3 py-2"
                >
                  <Icon className="h-4 w-4 shrink-0 text-steel" />
                  <p className="text-xs font-semibold text-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-5">
              <Link
                href="/dashboard?aba=relatorios"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-steel transition hover:bg-panel-hover"
              >
                Ver relatórios
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          {/* Estoque */}
          <article className="flex flex-col rounded-xl border border-line bg-panel p-5 shadow-sm sm:p-6 md:col-span-2 xl:col-span-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/20 text-steel">
              <Boxes className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm font-semibold text-steel">
              Inventário
            </p>
            <h2 className="mt-1 text-xl font-bold">Controle de Estoque</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Monitore o saldo de produtos, alertas de estoque mínimo e
              movimentações de entrada e saída.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
              {(
                [
                  ["Produtos", Boxes],
                  ["Fabricação", PackagePlus],
                  ["Alertas", TrendingUp],
                  ["Compras", ShoppingCart],
                ] as const
              ).map(([label, Icon]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-panel-hover bg-surface px-3 py-2"
                >
                  <Icon className="h-4 w-4 shrink-0 text-steel" />
                  <p className="text-xs font-semibold text-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-5">
              <Link
                href="/dashboard?aba=estoque"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-steel transition hover:bg-panel-hover"
              >
                Ver estoque
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          {/* Orçamentos */}
          <article className="flex flex-col rounded-xl border border-line bg-panel p-5 shadow-sm sm:p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/20 text-steel">
              <FileText className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm font-semibold text-steel">
              Comercial
            </p>
            <h2 className="mt-1 text-xl font-bold">Orçamentos</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Monte propostas comerciais e de engenharia item a item e gere a
              folha de orçamento em PDF pra enviar ao cliente.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  ["Clientes", ClipboardList],
                  ["Itens", Boxes],
                  ["PDF", FileText],
                  ["Status", Scale],
                ] as const
              ).map(([label, Icon]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-panel-hover bg-surface px-3 py-2"
                >
                  <Icon className="h-4 w-4 shrink-0 text-steel" />
                  <p className="text-xs font-semibold text-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-5">
              <Link
                href="/orcamentos"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-background transition hover:bg-accent-dark"
              >
                Acessar orçamentos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          {/* Calculadora de custos */}
          <article className="flex flex-col rounded-xl border border-line bg-panel p-5 shadow-sm sm:p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent/20 text-steel">
              <Calculator className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm font-semibold text-steel">
              Comercial
            </p>
            <h2 className="mt-1 text-xl font-bold">Calculadora de Custos</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Precifique chapa (DXF), tubos/perfis e a composição final de uma
              peça, com parâmetros de mercado editáveis.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  ["Chapa DXF", Layers],
                  ["Perfis", Ruler],
                  ["Composição", SquareStack],
                  ["Parâmetros", Boxes],
                ] as const
              ).map(([label, Icon]) => (
                <div
                  key={label}
                  className="flex items-center gap-2 rounded-lg border border-panel-hover bg-surface px-3 py-2"
                >
                  <Icon className="h-4 w-4 shrink-0 text-steel" />
                  <p className="text-xs font-semibold text-foreground">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-5">
              <Link
                href="/calculadora"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-steel transition hover:bg-panel-hover"
              >
                Acessar calculadora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </div>

        {/* ── Footer ── */}
        <p className="mt-10 text-center text-xs text-muted">
          Eksteel &copy; {new Date().getFullYear()} · Sistema interno
        </p>
      </section>
    </main>
  );
}
