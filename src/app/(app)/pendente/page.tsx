import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/auth/logout-button";

export default async function PendentePage() {
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

  if (vinculo && vinculo.papel !== "pendente") redirect("/app");

  const nome = user.user_metadata?.nome_completo || user.email || "usuário";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1e1e1e] p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[#90A4AE]/30 bg-[#546E7A]/20">
          <Clock className="h-7 w-7 text-[#90A4AE]" />
        </div>

        <h1 className="text-2xl font-bold">Aguardando aprovação</h1>

        <p className="mt-4 text-sm leading-6 text-gray-400">
          Olá,{" "}
          <span className="font-semibold text-white">{nome}</span>. Sua conta
          foi criada com sucesso, mas ainda precisa ser aprovada pelo
          administrador para acessar o sistema.
        </p>

        <p className="mt-2 text-sm text-gray-500">
          Entre em contato com o responsável pelo sistema para liberar seu
          acesso.
        </p>

        <div className="mt-8 flex justify-center">
          <LogoutButton
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#90A4AE]/40 bg-white/10 px-5 text-sm font-semibold text-[#90A4AE] transition hover:bg-white/15"
            label="Sair da conta"
          />
        </div>
      </div>
    </main>
  );
}
