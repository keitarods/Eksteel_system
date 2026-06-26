import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/auth/logout-button";
import DashboardTabs from "@/components/dashboard/dashboard-tabs";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

const ABAS_VALIDAS = [
  "visao-geral",
  "vendas",
  "cadastro",
  "estoque",
  "compras",
  "balancete",
  "usuarios",
] as const;

type AbaDashboard = (typeof ABAS_VALIDAS)[number];

function parseAba(raw: string | undefined): AbaDashboard {
  return ABAS_VALIDAS.includes(raw as AbaDashboard)
    ? (raw as AbaDashboard)
    : "visao-geral";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const { aba } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const nomeUsuario =
    user.user_metadata?.nome_completo || user.email || "usuário";

  const { data: vinculo } = await supabase
    .from("usuarios_empresa")
    .select("papel")
    .eq("usuario_id", user.id)
    .maybeSingle();

  if (!vinculo || vinculo.papel === "pendente") {
    redirect("/pendente");
  }

  const isAdmin = vinculo?.papel === "admin" || vinculo?.papel === "socio";

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-6 py-8 text-[#ECEFF1]">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-2">
            <Link
              href="/app"
              className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao início
            </Link>
            <div className="flex items-center gap-3">
              <Image
                src="/images/Eksteel-logo.png"
                alt="Eksteel"
                width={140}
                height={44}
                priority
                unoptimized
                className="h-11 w-auto object-contain"
              />
              <div className="h-8 w-px bg-[#90A4AE]" />
              <Image
                src="/images/dashboard.png"
                alt="Dashboard"
                width={120}
                height={36}
                unoptimized
                className="h-9 w-auto object-contain"
              />
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Olá, {nomeUsuario}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[#78909C] md:text-base">
              Centralize vendas, produtos, estoque, compras e indicadores
              financeiros em um só lugar.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-3 shadow-sm">
            <div className="flex flex-col md:items-end">
              <span className="max-w-[220px] truncate text-sm font-semibold text-[#90A4AE]">
                {nomeUsuario}
              </span>
              {user.email ? (
                <span className="max-w-[220px] truncate text-xs text-[#78909C]">
                  {user.email}
                </span>
              ) : null}
            </div>
            <LogoutButton />
          </div>
        </div>

        <DashboardTabs
          usuarioId={user.id}
          isAdmin={isAdmin}
          dataHoje={hojeIso()}
          abaInicial={parseAba(aba)}
        />
      </section>
    </main>
  );
}
