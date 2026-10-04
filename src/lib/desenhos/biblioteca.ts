import type { SupabaseClient } from "@supabase/supabase-js";

export type Desenho = {
  id: string;
  owner_id: string;
  folder_name: string;
  source_name: string;
  filename: string;
  kind: "pdf";
  object_path: string;
  byte_size: number;
  created_at: string;
  purpose: string;
};
export type PastaDesenhos = { chave: string; nome: string; autor: string; arquivos: Desenho[] };
export const LIMITE_PDF = 50 * 1024 * 1024;

export function agruparPastas(arquivos: Desenho[]): PastaDesenhos[] {
  const pastas = new Map<string, PastaDesenhos>();
  for (const arquivo of arquivos) {
    // Pastas homônimas de autores diferentes têm permissões independentes.
    const chave = JSON.stringify([arquivo.owner_id, arquivo.folder_name]);
    const pasta = pastas.get(chave) ?? { chave, nome: arquivo.folder_name, autor: arquivo.owner_id, arquivos: [] };
    pasta.arquivos.push(arquivo);
    pastas.set(chave, pasta);
  }
  return [...pastas.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.autor.localeCompare(b.autor));
}

export function correspondeBusca(arquivo: Desenho, busca: string): boolean {
  const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return normalizar([arquivo.filename, arquivo.source_name, arquivo.folder_name, arquivo.purpose].join(" ")).includes(normalizar(busca.trim()));
}

export async function listarDesenhos(db: SupabaseClient): Promise<Desenho[]> {
  const arquivos: Desenho[] = [];
  for (let inicio = 0; ; inicio += 100) {
    const { data, error } = await db.from("eksteel_cad_documents")
      .select("id,owner_id,folder_name,source_name,filename,kind,object_path,byte_size,created_at,purpose")
      .eq("kind", "pdf").order("created_at", { ascending: false }).order("id").range(inicio, inicio + 99);
    if (error) {
      if (["42P01", "PGRST205"].includes(error.code)) throw new Error("A biblioteca do Model System ainda não está configurada neste ambiente. Consulte o administrador para conectar o repositório de desenhos.");
      throw new Error("Não foi possível carregar os desenhos. Verifique sua conexão e o acesso à biblioteca e tente novamente.");
    }
    if (!data) throw new Error("A biblioteca retornou uma resposta incompleta. Tente novamente.");
    arquivos.push(...data as Desenho[]);
    if (data.length < 100) return arquivos;
  }
}

export async function baixarDesenho(db: SupabaseClient, desenho: Desenho): Promise<Blob> {
  if (desenho.byte_size > LIMITE_PDF) throw new Error("O PDF excede o limite de 50 MiB.");
  // Usa a sessão do usuário: o Storage verifica novamente a permissão no download.
  const { data, error } = await db.storage.from("cad-documents").download(desenho.object_path);
  if (error || !data) throw new Error("Não foi possível abrir este PDF. Ele pode estar indisponível ou seu acesso pode ter sido removido.");
  if (!data.size || data.size > LIMITE_PDF || !(await data.slice(0, 5).text()).startsWith("%PDF-")) {
    throw new Error("O arquivo não é um PDF válido ou excede 50 MiB.");
  }
  // O Model System armazena binários como application/octet-stream.
  return new Blob([data], { type: "application/pdf" });
}
