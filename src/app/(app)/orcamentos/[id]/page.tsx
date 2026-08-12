import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarOrcamentoCompleto } from "@/lib/orcamentos/queries";
import { mapClienteOrcamento } from "@/lib/orcamentos/types";
import OrcamentoDetalhe from "@/components/orcamentos/orcamento-detalhe";

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

export default async function OrcamentoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const resultado = await buscarOrcamentoCompleto(supabase, id);
  if (!resultado) notFound();

  const [{ data: clientesRaw }, { data: clienteRaw }] = await Promise.all([
    supabase.from("clientes_orcamento").select("*").order("nome"),
    supabase.from("clientes_orcamento").select("*").eq("id", resultado.orcamento.clienteId).maybeSingle(),
  ]);

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-5 text-[#ECEFF1] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-5xl">
        <Link href="/orcamentos" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]">
          <ArrowLeft className="h-4 w-4" />
          Voltar aos orçamentos
        </Link>

        <div className="mt-4">
          <OrcamentoDetalhe
            usuarioId={user.id}
            dataHoje={hojeIso()}
            clientesIniciais={(clientesRaw ?? []).map(mapClienteOrcamento)}
            orcamentoInicial={resultado.orcamento}
            itensIniciais={resultado.itens}
            cliente={clienteRaw ? mapClienteOrcamento(clienteRaw) : null}
          />
        </div>
      </section>
    </main>
  );
}
