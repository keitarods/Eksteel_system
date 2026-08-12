import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { mapClienteOrcamento } from "@/lib/orcamentos/types";
import OrcamentoForm from "@/components/orcamentos/orcamento-form";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NovoOrcamentoPage() {
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

  const { data: clientesRaw } = await supabase.from("clientes_orcamento").select("*").order("nome");
  const clientes = (clientesRaw ?? []).map(mapClienteOrcamento);

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-5 text-[#ECEFF1] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-4xl">
        <Link href="/orcamentos" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]">
          <ArrowLeft className="h-4 w-4" />
          Voltar aos orçamentos
        </Link>
        <p className="text-sm font-semibold text-[#90A4AE]">Orçamentos</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Novo orçamento</h1>

        <div className="mt-6 rounded-3xl border border-[#333333] bg-[#212121] p-4 shadow-sm sm:p-6">
          <OrcamentoForm usuarioId={user.id} dataHoje={hojeIso()} clientesIniciais={clientes} />
        </div>
      </section>
    </main>
  );
}
