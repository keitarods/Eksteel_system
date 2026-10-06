export const BUCKET_NOTAS = "notas-fiscais";
export const LIMITE_NOTA = 20 * 1024 * 1024;
const tipos: Record<string, string> = { pdf: "application/pdf", xml: "application/xml", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
export function validarNota(arquivo: { name: string; size: number }) {
  const extensao = arquivo.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = tipos[extensao];
  if (!contentType) throw new Error("Selecione uma nota em PDF, XML, JPG ou PNG.");
  if (arquivo.size <= 0 || arquivo.size > LIMITE_NOTA) throw new Error("O arquivo deve ter conteúdo e no máximo 20 MB.");
  const nome = arquivo.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (nome.length > 180) throw new Error("Use um nome de arquivo com até 180 caracteres.");
  return { nome, contentType };
}
