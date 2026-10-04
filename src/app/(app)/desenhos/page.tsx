import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BibliotecaDesenhos from "@/components/desenhos/biblioteca-desenhos";

export default async function DesenhosPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: membro } = await db.from("usuarios_empresa").select("papel").eq("usuario_id", user.id).maybeSingle();
  if (!membro || !["admin", "socio"].includes(membro.papel)) redirect("/pendente");
  return <main className="min-h-screen bg-background px-3 py-6 text-foreground sm:px-6 sm:py-10">
    <section className="mx-auto max-w-7xl space-y-6">
      <Link href="/app" className="inline-flex items-center gap-2 text-sm font-semibold text-steel hover:text-foreground"><ArrowLeft size={16} /> Voltar ao início</Link>
      <header className="flex items-start gap-4">
        <span className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-3 text-sky-300"><FolderOpen size={26} /></span>
        <div><p className="text-xs font-semibold uppercase tracking-widest text-muted">Engenharia · Model System Eksteel</p><h1 className="mt-1 text-3xl font-bold">Desenhos</h1><p className="mt-2 text-sm leading-6 text-muted">Consulte as pastas, visualize e baixe os PDFs publicados pelo sistema de modelamento.</p></div>
      </header>
      <BibliotecaDesenhos usuarioId={user.id} />
    </section>
  </main>;
}
