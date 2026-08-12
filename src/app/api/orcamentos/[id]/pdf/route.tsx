import path from "node:path";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { buscarOrcamentoCompleto } from "@/lib/orcamentos/queries";
import { mapClienteOrcamento } from "@/lib/orcamentos/types";
import OrcamentoPdfDocument from "@/components/orcamentos/orcamento-pdf-document";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const resultado = await buscarOrcamentoCompleto(supabase, id);
  if (!resultado) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  const { data: clienteRaw } = await supabase
    .from("clientes_orcamento")
    .select("*")
    .eq("id", resultado.orcamento.clienteId)
    .maybeSingle();

  const logoSrc = path.join(process.cwd(), "public", "images", "Eksteel-logo.png");

  const buffer = await renderToBuffer(
    <OrcamentoPdfDocument
      orcamento={resultado.orcamento}
      itens={resultado.itens}
      cliente={clienteRaw ? mapClienteOrcamento(clienteRaw) : null}
      logoSrc={logoSrc}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${resultado.orcamento.numero}.pdf"`,
    },
  });
}
