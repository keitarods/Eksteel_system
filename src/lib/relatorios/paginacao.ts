/** Avança pela quantidade recebida: também funciona quando o servidor limita a página a menos de 500. */
export async function paginar<T extends { id: unknown }>(buscar: (inicio: number, fim: number) => Promise<T[]>) {
  const linhas: T[] = [];
  const ids = new Set<unknown>();
  for (;;) {
    const pagina = await buscar(linhas.length, linhas.length + 499);
    if (!pagina.length) return linhas;
    for (const linha of pagina) {
      if ((linha.id === null || linha.id === undefined || linha.id === "") || ids.has(linha.id)) throw new Error("Os dados mudaram durante a leitura. Atualize o relatório.");
      ids.add(linha.id);
      linhas.push(linha);
    }
  }
}
