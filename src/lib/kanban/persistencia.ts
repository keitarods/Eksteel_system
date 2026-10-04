import type { SupabaseClient } from "@supabase/supabase-js";
import type { Checklist } from "./checklists";

export async function detectarChecklists(db: SupabaseClient): Promise<boolean> {
  // A consulta funciona mesmo quando o quadro ainda não tem atividades.
  const { error } = await db.from("atividades_kanban").select("checklists").limit(0);
  if (!error) return true;
  if (error.code === "42703" || error.code === "PGRST204") return false;
  throw error;
}

export async function gravarAtividade(
  db: SupabaseClient,
  payload: { checklists: Checklist[]; [campo: string]: unknown },
  id: string | null,
  status: string,
  checklistsDisponiveis: boolean,
  checklistsOriginais: Checklist[],
) {
  const { checklists, ...campos } = payload;
  if (!checklistsDisponiveis && checklists.length) {
    throw new Error("Atualize o quadro antes de salvar os checklists.");
  }
  const valores = checklistsDisponiveis ? { ...campos, checklists } : campos;
  let query;
  if (id) {
    query = db.from("atividades_kanban").update(valores).eq("id", id);
    if (checklistsDisponiveis) query = query.eq("checklists", JSON.stringify(checklistsOriginais));
  } else {
    query = db.from("atividades_kanban").insert({ ...valores, status });
  }
  return query.select().single();
}
