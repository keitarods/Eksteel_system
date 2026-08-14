import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarParametrosVigentes, buscarVelocidadesCorte } from "@/lib/calculo-custo/parametros";
import OxicorteCalculadora from "@/components/calculadora/oxicorte-calculadora";
import OxicorteParametrosForm from "@/components/calculadora/oxicorte-parametros-form";
import AbasModulo from "@/components/calculadora/abas-modulo";

export default async function OxicortePage() {
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

  const [parametros, velocidadesTodas] = await Promise.all([
    buscarParametrosVigentes(supabase),
    buscarVelocidadesCorte(supabase),
  ]);
  const velocidades = velocidadesTodas.filter((v) => v.processo === "oxicorte" || v.processo === "plasma");

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-5 text-[#ECEFF1] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-5xl">
        <Link href="/calculadora" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]">
          <ArrowLeft className="h-4 w-4" />
          Voltar à calculadora
        </Link>
        <p className="text-sm font-semibold text-[#90A4AE]">Calculadora</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Oxicorte e plasma</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C]">
          Chapa grossa cortada por oxicorte (só aço carbono) ou plasma. Use um DXF pra pegar o perímetro
          automaticamente, ou informe área/perímetro na mão — comum não ter desenho CAD nesse tipo de corte.
        </p>

        <div className="mt-6">
          <AbasModulo
            abaCalculadora={<OxicorteCalculadora usuarioId={user.id} parametros={parametros} velocidades={velocidades} />}
            abaParametros={
              <OxicorteParametrosForm usuarioId={user.id} parametrosIniciais={parametros} velocidadesIniciais={velocidades} />
            }
          />
        </div>
      </section>
    </main>
  );
}
