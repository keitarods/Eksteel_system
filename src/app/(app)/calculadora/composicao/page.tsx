import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarParametrosVigentes } from "@/lib/calculo-custo/parametros";
import { mapCalculoPeca } from "@/lib/calculo-custo/types";
import ComposicaoCalculadora from "@/components/calculadora/composicao-calculadora";

export default async function ComposicaoPage() {
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

  const [parametros, { data: pecasRaw }] = await Promise.all([
    buscarParametrosVigentes(supabase),
    supabase.from("calculos_pecas").select("*").order("criado_em", { ascending: false }).limit(30),
  ]);
  const pecas = (pecasRaw ?? []).map(mapCalculoPeca);

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-5 text-[#ECEFF1] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-4xl">
        <Link href="/calculadora" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]">
          <ArrowLeft className="h-4 w-4" />
          Voltar à calculadora
        </Link>
        <p className="text-sm font-semibold text-[#90A4AE]">Calculadora</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Composição final de custo</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C]">
          Some peças já calculadas, mão de obra e insumos, aplique perda de material e margem — e veja o preço
          sugerido com o detalhamento completo.
        </p>

        <div className="mt-6">
          <ComposicaoCalculadora usuarioId={user.id} parametros={parametros} pecasIniciais={pecas} />
        </div>
      </section>
    </main>
  );
}
