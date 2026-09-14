import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarParametrosVigentes, buscarVelocidadesCorte } from "@/lib/calculo-custo/parametros";
import ChapaCalculadora from "@/components/calculadora/chapa-calculadora";
import ChapaParametrosForm from "@/components/calculadora/chapa-parametros-form";
import AbasModulo from "@/components/calculadora/abas-modulo";

export default async function ChapaCalculadoraPage() {
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
  const velocidadesLaser = velocidades.filter((v) => v.processo === "laser");

  return (
    <main className="min-h-screen bg-background px-3 py-5 text-foreground sm:px-6 sm:py-8">
      <section className="mx-auto max-w-5xl">
        <Link href="/calculadora" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-steel transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Voltar à calculadora
        </Link>
        <p className="text-sm font-semibold text-steel">Calculadora</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Chapa cortada a laser (DXF)</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          O DXF é lido no seu navegador — o arquivo original não é enviado nem guardado, só os números
          calculados (área, perímetro, peso, custo).
        </p>

        <div className="mt-6">
          <AbasModulo
            abaCalculadora={<ChapaCalculadora usuarioId={user.id} parametros={parametros} velocidades={velocidades} />}
            abaParametros={
              <ChapaParametrosForm usuarioId={user.id} parametrosIniciais={parametros} velocidadesIniciais={velocidadesLaser} />
            }
          />
        </div>
      </section>
    </main>
  );
}
