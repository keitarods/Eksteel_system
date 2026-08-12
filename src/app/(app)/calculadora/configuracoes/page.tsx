import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarParametrosVigentes, buscarVelocidadesCorte } from "@/lib/calculo-custo/parametros";
import ParametrosForm from "@/components/calculadora/parametros-form";

export default async function ConfiguracoesCalculadoraPage() {
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

  const [parametros, velocidades] = await Promise.all([
    buscarParametrosVigentes(supabase),
    buscarVelocidadesCorte(supabase),
  ]);

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-5 text-[#ECEFF1] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-4xl">
        <Link href="/calculadora" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]">
          <ArrowLeft className="h-4 w-4" />
          Voltar à calculadora
        </Link>
        <p className="text-sm font-semibold text-[#90A4AE]">Calculadora de custos</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Parâmetros de mercado</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C]">
          Valores pré-preenchidos com uma estimativa de mercado (ver fontes no plano do projeto) — ajuste pra
          refletir seus fornecedores reais. Cada alteração fica registrada com a data, mantendo o histórico de
          reajustes.
        </p>

        <div className="mt-6">
          <ParametrosForm usuarioId={user.id} parametrosIniciais={parametros} velocidadesIniciais={velocidades} />
        </div>
      </section>
    </main>
  );
}
