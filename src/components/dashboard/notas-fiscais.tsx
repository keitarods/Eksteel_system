"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_NOTAS, validarNota } from "@/lib/notas-fiscais/arquivos";

type Anexo = { caminho: string; nome: string };
export default function NotasFiscais({ tipo, registroId }: { tipo: "vendas" | "compras"; registroId: string }) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [versao, setVersao] = useState(0);
  const trava = useRef(false);
  const inputId = useId();
  const prefixo = `${tipo}/${registroId}`;
  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    async function carregar() {
      const storage = createClient().storage.from(BUCKET_NOTAS);
      // Pagina diretórios e arquivos, sem depender do limite padrão do Storage.
      async function listar(pasta: string) {
        const resultado = [];
        for (let offset = 0; ; offset += 100) {
          const { data, error } = await storage.list(pasta, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
          if (error) throw error;
          resultado.push(...data);
          if (data.length < 100) return resultado;
        }
      }
      const pastas = await listar(prefixo);
      const arquivos: Anexo[] = [];
      for (const pasta of pastas) {
        if (pasta.id) continue;
        for (const arquivo of await listar(`${prefixo}/${pasta.name}`)) {
          if (arquivo.id) arquivos.push({ caminho: `${prefixo}/${pasta.name}/${arquivo.name}`, nome: arquivo.name });
        }
      }
      if (ativo) { setAnexos(arquivos); setErro(""); }
    }
    carregar().catch(() => { if (ativo) setErro("Não foi possível carregar as notas. Verifique a conexão e a configuração do Storage (notas-fiscais.sql)."); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [prefixo, versao]);
  async function executar(acao: () => Promise<void>) {
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro(""); setMensagem("");
    try { await acao(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir a operação. Tente novamente."); }
    finally { trava.current = false; setOcupado(false); }
  }
  async function enviar(arquivo: File) {
    await executar(async () => {
      const { nome, contentType } = validarNota(arquivo);
      const caminho = `${prefixo}/${crypto.randomUUID()}/${nome}`;
      const { error } = await createClient().storage.from(BUCKET_NOTAS).upload(caminho, arquivo, { contentType, upsert: false });
      if (error) throw new Error(`Não foi possível anexar a nota: ${error.message}`);
      setMensagem("Nota fiscal anexada."); setVersao(v => v + 1);
    });
  }
  async function baixar(anexo: Anexo) {
    await executar(async () => {
      const { data, error } = await createClient().storage.from(BUCKET_NOTAS).download(anexo.caminho);
      if (error) throw new Error("Não foi possível baixar a nota fiscal.");
      const url = URL.createObjectURL(data);
      const link = document.createElement("a"); link.href = url; link.download = anexo.nome;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }
  async function remover(anexo: Anexo) {
    if (!window.confirm(`Remover a nota fiscal ${anexo.nome}?`)) return;
    await executar(async () => {
      const { error } = await createClient().storage.from(BUCKET_NOTAS).remove([anexo.caminho]);
      if (error) throw new Error("Não foi possível remover a nota fiscal.");
      setMensagem("Nota fiscal removida."); setVersao(v => v + 1);
    });
  }
  return <section className="my-5 min-w-0 space-y-3 rounded-xl border border-line p-3 sm:p-4" aria-label="Notas fiscais">
    <h3 className="font-semibold">Notas fiscais de {tipo === "vendas" ? "venda" : "compra"}</h3>
    <p className="text-xs leading-5 text-muted">Anexe PDF, XML, JPG ou PNG de até 20 MB por arquivo.</p>
    <label htmlFor={inputId} className="block text-sm font-medium">Anexar nota fiscal</label>
    <input id={inputId} type="file" accept=".pdf,.xml,.jpg,.jpeg,.png" disabled={ocupado || carregando} className="block w-full min-w-0 max-w-full rounded-lg border border-line p-2 text-sm file:mr-2 file:rounded-md file:border-0 file:bg-panel file:px-3 file:py-2 file:text-foreground disabled:opacity-50" onChange={e => { const arquivo = e.target.files?.[0]; e.target.value = ""; if (arquivo) void enviar(arquivo); }} />
    {erro && <p role="alert" className="break-words text-sm text-red-400">{erro} <button type="button" disabled={ocupado || carregando} onClick={() => setVersao(v => v + 1)} className="min-h-11 underline">Atualizar</button></p>}
    {mensagem && <p role="status" className="text-sm text-emerald-400">{mensagem}</p>}
    {ocupado && <p role="status" className="text-sm text-muted">Processando arquivo…</p>}
    {carregando ? <p className="text-sm text-muted">Carregando notas…</p> : !erro && !anexos.length ? <p className="text-sm text-muted">Nenhuma nota anexada.</p> : null}
    <ul className="space-y-2">{anexos.map(a => <li key={a.caminho} className="flex min-w-0 flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 text-sm [overflow-wrap:anywhere]">{a.nome}</span>
      <div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={ocupado || carregando} onClick={() => void baixar(a)} className="min-h-11 rounded-lg border border-line px-3 text-sm disabled:opacity-50">Baixar</button><button type="button" disabled={ocupado || carregando} onClick={() => void remover(a)} className="min-h-11 rounded-lg px-3 text-sm text-red-400 disabled:opacity-50">Remover</button></div>
    </li>)}</ul>
  </section>;
}
