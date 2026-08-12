import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarParametrosVigentes } from "@/lib/calculo-custo/parametros";
import { mapPerfilMetalico } from "@/lib/calculo-custo/perfis";
import PerfisCalculadora from "@/components/calculadora/perfis-calculadora";

export default async function TubosPerfisPage() {
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

  const [parametros, { data: perfisRaw }] = await Promise.all([
    buscarParametrosVigentes(supabase),
    supabase.from("perfis_metalicos").select("*").order("favorito", { ascending: false }).order("nome"),
  ]);
  const perfis = (perfisRaw ?? []).map(mapPerfilMetalico);

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-5 text-[#ECEFF1] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-5xl">
        <Link href="/calculadora" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]">
          <ArrowLeft className="h-4 w-4" />
          Voltar à calculadora
        </Link>
        <p className="text-sm font-semibold text-[#90A4AE]">Calculadora</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Tubos e perfis</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C]">
          Escolha um perfil do catálogo ou informe as dimensões — o peso por metro é calculado pela área de
          seção transversal, a menos que você informe um valor de catálogo específico.
        </p>

        <div className="mt-6">
          <PerfisCalculadora usuarioId={user.id} parametros={parametros} perfisIniciais={perfis} />
        </div>
      </section>
    </main>
  );
}
