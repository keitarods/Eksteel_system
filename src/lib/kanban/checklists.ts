export type ItemChecklist = { id: string; texto: string; concluido: boolean };
export type Checklist = { id: string; titulo: string; itens: ItemChecklist[] };
export const MAX_CHECKLISTS = 20;
export const MAX_ITENS = 100;

export function progressoChecklists(checklists: Checklist[]) {
  const itens = checklists.flatMap(c => c.itens);
  const concluidos = itens.filter(i => i.concluido).length;
  return { total: itens.length, concluidos, percentual: itens.length ? Math.round(concluidos / itens.length * 100) : 0 };
}

export function validarChecklists(checklists: Checklist[]): string | null {
  if (checklists.length > MAX_CHECKLISTS) return `Use até ${MAX_CHECKLISTS} checklists por atividade.`;
  for (const lista of checklists) {
    if (!lista.titulo.trim() || lista.titulo.trim().length > 100) return "Informe um título de até 100 caracteres para cada checklist.";
    if (lista.itens.length > MAX_ITENS) return `Use até ${MAX_ITENS} itens por checklist.`;
    if (lista.itens.some(i => !i.texto.trim() || i.texto.trim().length > 500)) return "Preencha os itens do checklist (até 500 caracteres) ou remova os itens vazios.";
  }
  return null;
}
