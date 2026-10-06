"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { mesDeslocado } from "@/lib/relatorios/metricas";
import { createClient } from "@/lib/supabase/client";
import { buscarTodasLinhas } from "@/lib/relatorios/dados";

type Produto = { id: string; codigo: string; nome: string };
type Item = { chave: string; codigo: string; quantidade: string; valor: string; ok: boolean };
type Usuario = { usuario_id: string; nome: string | null; email: string | null };
type Registro = { criado_por: string; id: string; data: string; pedido: string; observacao: string; valor_total: number; quantidade: number; itens: { registrados: { codigo: string; nome: string; quantidade: number; em_boas_condicoes: boolean }[] } };
const novoItem = (): Item => ({ chave: crypto.randomUUID(), codigo: "", quantidade: "1", valor: "", ok: true });
const real = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const campo = "mt-2 block min-h-11 w-full min-w-0 max-w-full rounded-lg border border-line bg-background px-3 py-2 text-base sm:text-sm";

export default function DevolucoesModulo({ dataHoje }: { dataHoje: string }) {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioFiltro, setUsuarioFiltro] = useState("");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [data, setData] = useState(dataHoje);
  const [pedido, setPedido] = useState("");
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const tentativa = useRef<{ id: string; payload: string } | null>(null);
  const ocupado = useRef(false);
  const [versao, setVersao] = useState(0);
  useEffect(() => { setItens([novoItem()]); }, []);
  useEffect(() => {
    let ativo = true;
    const client = createClient();
    Promise.all([buscarTodasLinhas(client, "produtos"), buscarTodasLinhas(client, "devolucoes"), client.from("usuarios_empresa").select("usuario_id, nome, email")]).then(([p, d, u]) => {
      if (u.error) throw u.error;
      if (ativo) { setProdutos(p as unknown as Produto[]); setRegistros(d as unknown as Registro[]); setUsuarios((u.data ?? []) as Usuario[]); setErro(""); }
    }).catch(() => { if (ativo) setErro("Não foi possível carregar devoluções. Verifique a conexão, as permissões e se a migração devolucoes.sql foi aplicada."); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [versao]);
  function alterar(chave: string, patch: Partial<Item>) { setItens(atual => atual.map(i => i.chave === chave ? { ...i, ...patch } : i)); }
  function localizar(codigo: string) { return produtos.find(p => p.codigo?.toLowerCase() === codigo.trim().toLowerCase()); }
  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (ocupado.current) return;
    setErro(""); setMensagem("");
    const linhas = itens.map(i => ({ produto_id: localizar(i.codigo)?.id, quantidade: Number(i.quantidade), valor_unitario: Number(i.valor), em_boas_condicoes: i.ok }));
    if (!linhas.length || linhas.some(i => !i.produto_id || !Number.isInteger(i.quantidade) || i.quantidade <= 0 || !Number.isFinite(i.valor_unitario) || i.valor_unitario <= 0)) { setErro("Informe um código cadastrado, quantidade inteira positiva e valor unitário para cada item."); return; }
    const payload = { p_data: data, p_pedido: pedido.trim(), p_observacao: observacao.trim(), p_itens: linhas };
    const serializado = JSON.stringify(payload);
    if (tentativa.current?.payload !== serializado) tentativa.current = { id: crypto.randomUUID(), payload: serializado };
    ocupado.current = true; setSalvando(true);
    try {
      const { error } = await createClient().rpc("registrar_devolucao", { p_id: tentativa.current!.id, ...payload });
      if (error) throw new Error(error.message);
      tentativa.current = null;
      setItens([novoItem()]); setPedido(""); setObservacao("");
      setMensagem("Devolução registrada. Receita e estoque atualizados."); setVersao(v => v + 1);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao registrar devolução. Tente novamente."); }
    finally { ocupado.current = false; setSalvando(false); }
  }
  function nomeUsuario(id: string) {
    const usuario = usuarios.find(u => u.usuario_id === id);
    return usuario?.nome?.trim() || usuario?.email || `Usuário ${id}`;
  }
  const usuariosDisponiveis = [...new Set([...usuarios.map(u => u.usuario_id), ...registros.map(r => r.criado_por)])]
    .map(id => ({ id, nome: nomeUsuario(id) })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const filtradas = registros.filter(r => !usuarioFiltro || r.criado_por === usuarioFiltro);
  const acumuladas = filtradas.filter(r => r.data <= dataHoje);
  const indicadores = [
    { titulo: "Unidades devolvidas · acumulado", valor: String(acumuladas.reduce((s, r) => s + Number(r.quantidade), 0)) },
    { titulo: "Valor devolvido · acumulado", valor: real(acumuladas.reduce((s, r) => s + Number(r.valor_total), 0)) },
    { titulo: "Lançamentos de devolução", valor: String(acumuladas.length) },
  ];
  const evolucao = Array.from({ length: 12 }, (_, index) => {
    const mes = mesDeslocado(dataHoje.slice(0, 7), index - 11);
    return { mes: `${mes.slice(5)}/${mes.slice(0, 4)}`, quantidade: acumuladas.filter(r => r.data.startsWith(mes)).reduce((s, r) => s + Number(r.quantidade), 0) };
  });
  return <div className="min-w-0 space-y-6 [overflow-wrap:anywhere]">
    <div><h2 className="text-xl font-semibold">Devoluções</h2><p className="mt-2 text-sm text-muted">Lance os produtos pelo código. O valor devolvido será deduzido da receita na data informada.</p></div>
    {erro && <p role="alert" className="text-red-400">{erro} <button type="button" onClick={() => setVersao(v => v + 1)} className="underline">Atualizar</button></p>}
    {mensagem && <p role="status" className="text-emerald-400">{mensagem}</p>}
    <div className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-6">
      <label className="block min-w-0 text-sm font-medium sm:max-w-md">Filtrar por usuário
        <select className={campo} value={usuarioFiltro} disabled={carregando} onChange={e => setUsuarioFiltro(e.target.value)}>
          <option value="">Todos os usuários</option>
          {usuariosDisponiveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
      </label>
      <p className="mt-3 text-xs leading-5 text-muted">O filtro considera quem registrou a devolução e se aplica aos indicadores, ao gráfico e ao histórico. Novos lançamentos são atribuídos automaticamente ao usuário conectado.</p>
    </div>
    {!carregando && !erro && <section aria-label="Indicadores de devoluções" className="space-y-4">
      <div className="grid min-w-0 gap-3 md:grid-cols-3">
        {indicadores.map(i => <div key={i.titulo} className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-6"><p className="text-sm text-muted">{i.titulo}</p><p className="mt-2 break-words text-xl font-semibold tabular-nums lg:text-2xl">{i.valor}</p></div>)}
      </div>
      <div className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-6">
        <h3 className="font-semibold">Sazonalidade de devoluções · últimos 12 meses</h3>
        <div className="mt-4 h-64 min-w-0 sm:h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={evolucao}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" minTickGap={24} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} width={45} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="quantidade" name="Unidades devolvidas" fill="var(--accent)" /></BarChart></ResponsiveContainer></div>
        <p className="mt-2 text-xs text-muted">Devoluções reduzem a receita na data do lançamento. Receita bruta preserva o valor original das vendas; os indicadores líquidos já descontam devoluções. O CMV e as taxas originais são mantidos.</p>
      </div>
    </section>}
    {carregando ? <p>Carregando devoluções…</p> : <form onSubmit={salvar} className="min-w-0 rounded-xl border border-line bg-panel p-4 sm:p-6">
      <fieldset disabled={salvando || !produtos.length} className="min-w-0 space-y-6 disabled:opacity-60">
        <div className="grid gap-4 sm:grid-cols-2"><label className="min-w-0 text-sm font-medium">Data da devolução<input className={campo} type="date" required max={dataHoje} value={data} onChange={e => setData(e.target.value)} /></label><label className="min-w-0 text-sm font-medium">Pedido devolvido (opcional)<input className={campo} maxLength={200} value={pedido} onChange={e => setPedido(e.target.value)} placeholder="Número do pedido no ecommerce" /></label></div>
        <datalist id="codigos-devolucao">{produtos.map(p => <option key={p.id} value={p.codigo}>{p.nome}</option>)}</datalist>
        {itens.map((i, index) => <div key={i.chave} className="min-w-0 space-y-4 rounded-xl border border-line bg-background/30 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
            <h3 className="text-sm font-semibold">Item {index + 1}</h3>
            <button type="button" className="min-h-11 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40" disabled={itens.length === 1} onClick={() => setItens(atual => atual.filter(x => x.chave !== i.chave))}>Remover item {index + 1}</button>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="min-w-0 text-sm font-medium sm:col-span-2">Código do produto<input aria-label={`Código do produto ${index + 1}`} className={campo} list="codigos-devolucao" required value={i.codigo} onChange={e => alterar(i.chave, { codigo: e.target.value })} /><span className="mt-2 block break-words text-xs font-normal leading-5 text-muted">{localizar(i.codigo)?.nome || "Selecione um produto"}</span></label>
            <label className="min-w-0 text-sm font-medium">Quantidade<input className={campo} type="number" required min="1" max="1000000" step="1" value={i.quantidade} onChange={e => alterar(i.chave, { quantidade: e.target.value })} /></label>
            <label className="min-w-0 text-sm font-medium">Valor devolvido / un.<input className={campo} type="number" required min="0.01" max="1000000000" step="0.01" value={i.valor} onChange={e => alterar(i.chave, { valor: e.target.value })} /></label>
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-sm leading-6"><input className="mt-1 h-4 w-4 shrink-0 accent-accent" type="checkbox" checked={i.ok} onChange={e => alterar(i.chave, { ok: e.target.checked })} /><span className="min-w-0">Em boas condições<span className="block text-xs leading-5 text-muted">Repor esta quantidade no estoque.</span></span></label>
        </div>)}
        <button type="button" className="min-h-11 w-full rounded-lg border border-line px-4 py-2 text-sm font-semibold text-accent sm:w-auto" disabled={itens.length >= 100} onClick={() => setItens(atual => [...atual, novoItem()])}>+ Adicionar item</button>
        <p className="text-xs leading-6 text-muted">Itens em boas condições retornam ao estoque. Produtos controlados por matérias-primas repõem os componentes equivalentes conforme o cadastro atual. Desmarque para itens avariados; separe em duas linhas quando parte da quantidade estiver avariada. Informe o valor efetivamente devolvido, já considerando descontos.</p>
        <label className="block min-w-0 text-sm font-medium">Observação<textarea rows={3} className={campo} maxLength={2000} value={observacao} onChange={e => setObservacao(e.target.value)} /></label>
        <div className="flex min-w-0 flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between"><strong className="min-w-0 break-words text-lg tabular-nums">Total: {real(itens.reduce((s, i) => s + (Number(i.quantidade) * Number(i.valor) || 0), 0))}</strong><button className="min-h-11 w-full shrink-0 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-background sm:w-auto" type="submit">{salvando ? "Registrando…" : "Registrar devolução"}</button></div>
      </fieldset>
    </form>}
    <section className="space-y-3"><h3 className="font-semibold">Histórico de devoluções</h3>{!carregando && !filtradas.length && <p className="text-muted">Nenhuma devolução encontrada para o filtro selecionado.</p>}{[...filtradas].sort((a, b) => b.data.localeCompare(a.data)).map(r => <details key={r.id} className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm leading-6"><span className="ml-1 inline-grid max-w-full gap-1 align-top"><span className="font-medium">{r.data.split("-").reverse().join("/")} · {r.quantidade} un. · {real(Number(r.valor_total))}</span><span className="break-words text-muted">{r.pedido ? `Pedido ${r.pedido}` : "Sem pedido informado"}</span><span className="break-words text-muted">Registrado por: {nomeUsuario(r.criado_por)}</span></span></summary><ul className="mt-4 space-y-3 border-t border-line pt-4 text-sm leading-6">{r.itens.registrados.map((i, index) => <li key={index}>{i.codigo} — {i.nome} · {i.quantidade} un. · {i.em_boas_condicoes ? "Reposto no estoque" : "Sem reposição (avariado)"}</li>)}</ul>{r.observacao && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{r.observacao}</p>}</details>)}</section>
  </div>;
}
