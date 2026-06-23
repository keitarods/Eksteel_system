import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  DollarSign,
  PackagePlus,
  ShoppingCart,
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
    <main className="relative min-h-screen bg-[#f0f7ff] text-[#0d1b2a]">
      <section className="mx-auto max-w-7xl px-6 py-10">
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
                className="h-12 w-auto object-contain"
              />
              <div className="h-8 w-px bg-[#90caf9]" />
              <p className="text-sm font-semibold text-[#1565c0]">
                Ambiente interno
              </p>
            </div>
            <h1 className="text-3xl font-bold md:text-4xl">
              Olá, {nomeUsuario}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#455a80] md:text-base">
              Central de controle operacional e financeiro da empresa. Acesse os
              módulos abaixo para acompanhar resultados, estoque e indicadores.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start rounded-2xl border border-[#90caf9] bg-white/90 px-4 py-3 shadow-sm">
            <div className="flex flex-col">
              <span className="max-w-[200px] truncate text-sm font-semibold text-[#1565c0]">
                {nomeUsuario}
              </span>
              {user.email ? (
                <span className="max-w-[200px] truncate text-xs text-[#455a80]">
                  {user.email}
                </span>
              ) : null}
            </div>
            <LogoutButton />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-3xl border border-[#90caf9] bg-white/90 p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3f0ff] text-[#1565c0]">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <p className="mt-5 text-sm font-semibold text-[#1565c0]">
              Operacional
            </p>
            <h2 className="mt-1 text-xl font-bold">Dashboard Geral</h2>
            <p className="mt-2 text-sm leading-6 text-[#455a80]">
              Visualize vendas por marketplace, cadastre produtos, controle
              estoque e acompanhe indicadores financeiros.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                ["Vendas", BarChart3],
                ["Estoque", Boxes],
                ["Lucro", TrendingUp],
                ["Compras", PackagePlus],
              ].map(([label, Icon]) => (
                <div
                  key={String(label)}
                  className="flex items-center gap-2 rounded-2xl border border-[#e3f0ff] bg-[#f0f7ff] px-3 py-2"
                >
                  <Icon className="h-4 w-4 text-[#1565c0]" />
                  <p className="text-xs font-semibold text-[#1565c0]">
                    {String(label)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <Link
                href="/dashboard"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#1565c0] px-4 text-sm font-semibold text-white transition hover:bg-[#0d47a1]"
              >
                Acessar dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          <article className="rounded-3xl border border-[#90caf9] bg-white/90 p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3f0ff] text-[#1565c0]">
              <DollarSign className="h-6 w-6" />
            </div>
            <p className="mt-5 text-sm font-semibold text-[#1565c0]">
              Financeiro
            </p>
            <h2 className="mt-1 text-xl font-bold">Fluxo de Caixa</h2>
            <p className="mt-2 text-sm leading-6 text-[#455a80]">
              Registre despesas operacionais, acompanhe entradas e saídas e
              visualize o resultado líquido do período.
            </p>
            <div className="mt-5">
              <Link
                href="/dashboard?aba=financeiro"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#90caf9] bg-white px-4 text-sm font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]"
              >
                Ver financeiro
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>

          <article className="rounded-3xl border border-[#90caf9] bg-white/90 p-6 shadow-sm md:col-span-2 xl:col-span-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3f0ff] text-[#1565c0]">
              <Boxes className="h-6 w-6" />
            </div>
            <p className="mt-5 text-sm font-semibold text-[#1565c0]">
              Inventário
            </p>
            <h2 className="mt-1 text-xl font-bold">Controle de Estoque</h2>
            <p className="mt-2 text-sm leading-6 text-[#455a80]">
              Monitore o saldo de produtos, alertas de estoque mínimo e
              movimentações de entrada e saída.
            </p>
            <div className="mt-5">
              <Link
                href="/dashboard?aba=estoque"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[#90caf9] bg-white px-4 text-sm font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff]"
              >
                Ver estoque
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
