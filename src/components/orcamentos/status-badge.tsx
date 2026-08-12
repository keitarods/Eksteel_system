import type { StatusOrcamento } from "@/lib/orcamentos/types";

const ESTILOS: Record<StatusOrcamento, string> = {
  rascunho: "bg-[#333333]/40 text-[#90A4AE]",
  enviado: "bg-blue-900/20 text-blue-400",
  aprovado: "bg-emerald-900/20 text-emerald-400",
  recusado: "bg-red-900/20 text-red-400",
  expirado: "bg-amber-900/30 text-amber-400",
};

const LABELS: Record<StatusOrcamento, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
};

export default function StatusBadge({ status }: { status: StatusOrcamento }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${ESTILOS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
