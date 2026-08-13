import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { buscarEmpresaConfig, listarEmpresaCnpjs } from "@/lib/orcamentos/empresa";
import EmpresaForm from "@/components/orcamentos/empresa-form";
import EmpresaCnpjsEditor from "@/components/orcamentos/empresa-cnpjs-editor";

export default async function ConfiguracoesOrcamentosPage() {
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

  const [empresa, cnpjs] = await Promise.all([
    buscarEmpresaConfig(supabase),
    listarEmpresaCnpjs(supabase),
  ]);

  return (
    <main className="min-h-screen bg-[#1e1e1e] px-3 py-5 text-[#ECEFF1] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-2xl">
        <Link href="/orcamentos" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#90A4AE] transition hover:text-[#ECEFF1]">
          <ArrowLeft className="h-4 w-4" />
          Voltar aos orçamentos
        </Link>
        <p className="text-sm font-semibold text-[#90A4AE]">Orçamentos</p>
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Dados da empresa</h1>

        <div className="mt-6 flex flex-col gap-5">
          <EmpresaForm usuarioId={user.id} empresaInicial={empresa} />
          <EmpresaCnpjsEditor usuarioId={user.id} cnpjsIniciais={cnpjs} />
        </div>
      </section>
    </main>
  );
}
