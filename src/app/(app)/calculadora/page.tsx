import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Layers, Ruler, Settings, SquareStack } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const CARDS = [
  {
    href: "/calculadora/chapa",
    icone: Layers,
    titulo: "Chapa (DXF)",
    descricao: "Suba um DXF, calcule peso, custo de material e tempo/custo de corte a laser.",
  },
  {
    href: "/calculadora/tubos-perfis",
    icone: Ruler,
    titulo: "Tubos e perfis",
    descricao: "Calcule peso e custo por metro de tubos, cantoneiras e perfis a partir do catálogo.",
  },
  {
    href: "/calculadora/composicao",
    icone: SquareStack,
    titulo: "Composição final",
    descricao: "Consolide chapas, perfis, mão de obra e insumos num preço final com margem.",
  },
  {
    href: "/calculadora/configuracoes",
    icone: Settings,
    titulo: "Parâmetros de mercado",
    descricao: "Preço do aço, hora-máquina, velocidade de corte, scrap factor e margem padrão.",
  },
];

export default async function CalculadoraPage() {
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

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-5 text-[#ECEFF1] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-6xl">
        <Link href="/app" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]">
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>
        <p className="text-sm font-semibold text-[#90A4AE]">Calculadora</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Custos de fabricação</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#78909C]">
          Precifique chapas cortadas a laser, tubos/perfis e a composição final de uma peça — e mande o resultado
          direto pra um orçamento.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {CARDS.map((card) => {
            const Icone = card.icone;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="flex flex-col rounded-3xl border border-[#333333] bg-[#212121] p-5 shadow-sm transition hover:bg-[#252525] sm:p-6"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#546E7A]/20 text-[#90A4AE]">
                  <Icone className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-bold">{card.titulo}</h2>
                <p className="mt-2 text-sm leading-6 text-[#78909C]">{card.descricao}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#546E7A]">
                  Acessar <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
