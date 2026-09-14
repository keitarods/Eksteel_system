import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarParametrosVigentes, buscarTemposSoldaPadrao } from "@/lib/calculo-custo/parametros";
import SoldagemCalculadora from "@/components/calculadora/soldagem-calculadora";
import SoldagemParametrosForm from "@/components/calculadora/soldagem-parametros-form";
import AbasModulo from "@/components/calculadora/abas-modulo";

export default async function SoldagemPage() {
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

  const [parametros, temposSolda] = await Promise.all([
    buscarParametrosVigentes(supabase),
    buscarTemposSoldaPadrao(supabase),
  ]);

  return (
    <main className="min-h-screen bg-background px-3 py-5 text-foreground sm:px-6 sm:py-8">
      <section className="mx-auto max-w-4xl">
        <Link href="/calculadora" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-steel transition hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Voltar à calculadora
        </Link>
        <p className="text-sm font-semibold text-steel">Calculadora</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Soldagem</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Orientado por junta — tipo de junta e espessura definem o tempo padrão por metro de cordão, ajustado
          por processo e posição de solda.
        </p>

        <div className="mt-6">
          <AbasModulo
            abaCalculadora={<SoldagemCalculadora usuarioId={user.id} parametros={parametros} temposSolda={temposSolda} />}
            abaParametros={
              <SoldagemParametrosForm usuarioId={user.id} parametrosIniciais={parametros} temposSoldaIniciais={temposSolda} />
            }
          />
        </div>
      </section>
    </main>
  );
}
