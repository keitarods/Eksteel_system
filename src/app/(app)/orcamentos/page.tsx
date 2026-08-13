import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listarOrcamentos } from "@/lib/orcamentos/queries";
import { mapClienteOrcamento } from "@/lib/orcamentos/types";
import OrcamentosLista from "@/components/orcamentos/orcamentos-lista";

export default async function OrcamentosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vinculo } = await supabase
    .from("usuarios_empresa")
    .select("papel")
    .eq("usuario_id", user.id)
    .maybeSingle();
  if (!vinculo || vinculo.papel === "pendente") redirect("/pendente");

  const [orcamentos, { data: clientesRaw }] = await Promise.all([
    listarOrcamentos(supabase),
    supabase.from("clientes_orcamento").select("*").order("nome"),
  ]);
  const clientes = (clientesRaw ?? []).map(mapClienteOrcamento);

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-5 text-[#ECEFF1] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/app" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao início
            </Link>
            <p className="text-sm font-semibold text-[#90A4AE]">Orçamentos</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Orçamentos comerciais e de engenharia</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C]">
              Monte propostas item a item e gere a folha de orçamento em PDF pronta pra enviar ao cliente.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/orcamentos/configuracoes"
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#333333] bg-[#212121] px-4 text-sm font-semibold text-[#90A4AE] transition hover:bg-[#2a2a2a]"
            >
              <Settings className="h-4 w-4" />
              Dados da empresa
            </Link>
            <Link
              href="/orcamentos/novo"
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#546E7A] px-5 text-sm font-semibold text-white transition hover:bg-[#455A64]"
            >
              <Plus className="h-4 w-4" />
              Novo orçamento
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-[#333333] bg-[#212121] p-4 shadow-sm sm:p-6">
          <OrcamentosLista orcamentos={orcamentos} clientes={clientes} />
        </div>
      </section>
    </main>
  );
}
