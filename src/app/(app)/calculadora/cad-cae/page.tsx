import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarParametrosVigentes } from "@/lib/calculo-custo/parametros";
import { buscarNiveisResponsabilidadeCad } from "@/lib/calculo-custo/cad-cae";
import CadCaeCalculadora from "@/components/calculadora/cad-cae-calculadora";
import CadCaeParametrosForm from "@/components/calculadora/cad-cae-parametros-form";
import AbasModulo from "@/components/calculadora/abas-modulo";

export default async function CadCaePage() {
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

  const [parametros, niveis] = await Promise.all([
    buscarParametrosVigentes(supabase),
    buscarNiveisResponsabilidadeCad(supabase),
  ]);

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-5 text-[#ECEFF1] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-4xl">
        <Link href="/calculadora" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]">
          <ArrowLeft className="h-4 w-4" />
          Voltar à calculadora
        </Link>
        <p className="text-sm font-semibold text-[#90A4AE]">Calculadora</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">CAD/CAE — desenho e cálculo técnico</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C]">
          Orçamento por hora técnica — desenho 2D/3D, detalhamento de fabricação, dimensionamento e análise
          estrutural. O preço varia por nível de responsabilidade técnica, não só pelo tempo gasto.
        </p>

        <div className="mt-6">
          <AbasModulo
            abaCalculadora={<CadCaeCalculadora usuarioId={user.id} parametros={parametros} niveis={niveis} />}
            abaParametros={
              <CadCaeParametrosForm usuarioId={user.id} parametrosIniciais={parametros} niveisIniciais={niveis} />
            }
          />
        </div>
      </section>
    </main>
  );
}
