"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buscarTodasLinhas } from "@/lib/relatorios/dados";
import { calcularUltimoCustoComposicao, ultimosPrecosMateriais, type MovimentoPreco, calcularCustoComposicao, calcularDisponibilidade, faltas, type Material, type ProdutoEstoque, type Componente, type ItemKit } from "@/lib/estoque/disponibilidade";

type Movimento = MovimentoPreco & { id: string; materia_prima_id: string | null; produto_id: string | null; quantidade: number; saldo_apos: number; tipo: string; motivo: string; data: string; criado_em: string; criado_por: string; custo_unitario: number | null; custo_medio_apos: number | null; custo_estimado_apos: boolean };
type Base = { materiais: Material[]; produtos: ProdutoEstoque[]; componentes: Componente[]; kits: { id: string; nome: string }[]; itens: ItemKit[]; movimentos: Movimento[]; usuarios: Record<string,string> };
const input = "w-full rounded-lg border border-line bg-background p-3 text-sm";
const moeda = (valor: number | null | undefined) => valor == null ? "Sem custo" : Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 4 });
const n = (valor: number) => Number(valor).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const dataBr = (data: string) => data.split("-").reverse().join("/");

export default function EstoqueMateriais() {
  const [base, setBase] = useState<Base | null>(null);
  const [aba, setAba] = useState<"produtos" | "materiais">("produtos");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [alvo, setAlvo] = useState<{ id: string; nome: string; saldo: number; material: boolean; unidade: string } | null>(null);
  const [form, setForm] = useState({ tipo: "entrada", quantidade: "", data: hoje(), motivo: "", custo: "" });
  const [filtroHistorico, setFiltroHistorico] = useState("");
  const chave = useRef<string | null>(null);
  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const db = createClient();
      const [materiais, produtos, componentes, kits, itens, movimentos, usuarios] = await Promise.all([
        ...["saldos_materias_primas", "produtos", "componentes_produto", "kits", "kit_itens", "movimentos_estoque"].map(t => buscarTodasLinhas(db, t)),
        db.from("usuarios_empresa").select("usuario_id,nome,email").then(r => { if (r.error) throw r.error; return r.data; }),
      ]);
      setBase({ materiais, produtos, componentes, kits, itens, movimentos, usuarios: Object.fromEntries(usuarios.map(u => [String(u.usuario_id), String(u.nome || u.email || u.usuario_id)])) } as unknown as Base);
      setErro("");
    } catch (e) { setBase(null); setErro(e instanceof Error ? e.message : "Não foi possível carregar o estoque."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    function atualizarAoRetornar() {
      if (document.visibilityState === "visible" && !salvando && !alvo) void carregar();
    }
    window.addEventListener("focus", atualizarAoRetornar);
    return () => window.removeEventListener("focus", atualizarAoRetornar);
  }, [carregar, salvando, alvo]);

  function abrir(item: NonNullable<typeof alvo>) {
    setAlvo(item); setForm({ tipo: "entrada", quantidade: "", data: hoje(), motivo: "", custo: "" }); chave.current = crypto.randomUUID(); setErro(""); setMensagem("");
  }
  function mudarForm(patch: Partial<typeof form>) { setForm(prev => ({ ...prev, ...patch })); chave.current = crypto.randomUUID(); }
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!alvo || salvando) return;
    const quantidade = form.tipo === "ajuste_custo" ? 0 : Number(form.quantidade.replace(",", "."));
    const entradaMaterial = alvo.material && (form.tipo === "entrada" || (form.tipo === "ajuste" && quantidade > alvo.saldo));
    const custo = (entradaMaterial || form.tipo === "ajuste_custo") && form.custo.trim() ? Number(form.custo.replace(",", ".")) : null;
    if ((custo != null && (!Number.isFinite(custo) || custo < 0)) || (form.tipo === "ajuste_custo" && custo == null)) { setErro("Informe um custo unitário válido."); return; }
    if (form.tipo !== "ajuste_custo" && (!form.quantidade.trim() || !Number.isFinite(quantidade) || quantidade < 0 || (form.tipo !== "ajuste" && quantidade === 0))) { setErro("Informe uma quantidade válida."); return; }
    setSalvando(true); setErro("");
    try {
      const { error } = form.tipo === "ajuste_custo"
        ? await createClient().rpc("ajustar_custo_material", { p_id: chave.current, p_material: alvo.id, p_custo: custo, p_saldo_esperado: alvo.saldo, p_motivo: form.motivo.trim() })
        : await createClient().rpc("movimentar_estoque", { p_id: chave.current, p_material: alvo.material ? alvo.id : null, p_produto: alvo.material ? null : alvo.id, p_tipo: form.tipo, p_quantidade: quantidade, p_data: form.data, p_motivo: form.motivo.trim(), p_saldo_esperado: alvo.saldo, p_custo_unitario: entradaMaterial ? custo : null });
      if (error) throw error;
      setAlvo(null); setMensagem("Movimentação registrada com data e responsável."); await carregar();
    } catch (e) { setErro(String((e as { message?: string }).message ?? "Falha ao movimentar estoque.")); }
    finally { setSalvando(false); }
  }

  const materiais = base?.materiais ?? [];
  const produtos = base?.produtos ?? [];
  const ultimosPrecos = ultimosPrecosMateriais(base?.movimentos ?? []);
  const linhas = base ? [
    ...produtos.filter(p => p.ativo).map(p => ({ id: p.id, nome: p.nome, codigo: p.codigo, kit: false, fisico: Number(p.estoque_atual), ultimoCusto: calcularUltimoCustoComposicao([{ produto_id: p.id, quantidade: 1 }], produtos, base.componentes, materiais, ultimosPrecos), custo: calcularCustoComposicao([{ produto_id: p.id, quantidade: 1 }], produtos, base.componentes, materiais), disponibilidade: calcularDisponibilidade([{ produto_id: p.id, quantidade: 1 }], produtos, base.componentes, materiais) })),
    ...base.kits.map(k => ({ id: k.id, nome: k.nome, codigo: "Kit", kit: true, fisico: 0, ultimoCusto: calcularUltimoCustoComposicao(base.itens.filter(i => i.kit_id === k.id), produtos, base.componentes, materiais, ultimosPrecos), custo: calcularCustoComposicao(base.itens.filter(i => i.kit_id === k.id), produtos, base.componentes, materiais), disponibilidade: calcularDisponibilidade(base.itens.filter(i => i.kit_id === k.id), produtos, base.componentes, materiais) })),
  ] : [];
  const filtrar = (nome: string, codigo: string) => `${nome} ${codigo}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"));
  function verHistorico(id: string) {
    setFiltroHistorico(id);
    document.getElementById("historico-estoque")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function resumoHistorico(id: string) {
    const material = materiais.find(m => m.id === id);
    if (!material) return null;
    return <div className="mt-3 border-t border-line pt-3">
      <p className="text-xs font-medium text-muted">Movimentação acumulada</p>
      <dl className="mt-2 grid grid-cols-3 gap-3 text-xs">
        <div><dt className="text-muted">Entradas</dt><dd className="mt-1 font-semibold tabular-nums text-emerald-400">{n(material.entradas)} {material.unidade}</dd></div>
        <div><dt className="text-muted">Saídas</dt><dd className="mt-1 font-semibold tabular-nums text-amber-400">{n(material.saidas)} {material.unidade}</dd></div>
        <div><dt className="text-muted">Saldo atual</dt><dd className="mt-1 font-semibold tabular-nums">{n(material.saldo)} {material.unidade}</dd></div>
      </dl>
      <button type="button" onClick={() => verHistorico(id)} className="mt-3 text-xs font-medium text-accent underline underline-offset-4">Ver entradas e saídas por data</button>
    </div>;
  }
  const historico = (base?.movimentos ?? []).filter(m => !filtroHistorico || m.materia_prima_id === filtroHistorico || m.produto_id === filtroHistorico).sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  return <section className="space-y-5 rounded-xl border border-line bg-panel p-4 sm:p-6">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-bold">Estoque</h2><p className="text-sm text-muted">Entradas, saídas e capacidade de montagem pela composição de cada produto.</p></div><button className="rounded-lg border border-line px-4 py-2" disabled={carregando || salvando} onClick={carregar}>Atualizar saldos e custos</button></div>
    {erro && <p role="alert" className="text-red-400">{erro}</p>}{mensagem && <p role="status" className="text-green-400">{mensagem}</p>}
    <div className="flex flex-wrap gap-2">{[{ id: "produtos", nome: "Produto acabado e kits" }, { id: "materiais", nome: "Matéria-prima" }].map(a => <button key={a.id} aria-pressed={aba === a.id} onClick={() => setAba(a.id as typeof aba)} className={`rounded-lg border border-line px-4 py-3 ${aba === a.id ? "bg-accent text-background" : "bg-surface"}`}>{a.nome}</button>)}</div>
    {carregando ? <p role="status">Carregando estoque…</p> : base && <>
      <div className="grid gap-3 sm:grid-cols-3">{(aba === "materiais" ? [
        ["Matérias-primas ativas", materiais.filter(m => m.ativo).length], ["Limitadoras sem saldo", materiais.filter(m => m.ativo && m.influencia_saldo && Number(m.saldo) <= 0).length], ["Itens de apoio sem saldo", materiais.filter(m => m.ativo && !m.influencia_saldo && Number(m.saldo) <= 0).length],
      ] : [["Produtos disponíveis", linhas.filter(l => !l.kit && l.disponibilidade.saldo > 0).length], ["Kits disponíveis", linhas.filter(l => l.kit && l.disponibilidade.saldo > 0).length], ["Com falta ou cadastro pendente", linhas.filter(l => faltas(l.disponibilidade).length || l.disponibilidade.problemas.length).length]]).map(([label, valor]) => <div key={label} className="rounded-lg border border-line bg-surface p-4"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-3xl font-bold">{valor}</p></div>)}</div>
      <label className="block text-sm">Buscar por nome ou código<input className={input} type="search" value={busca} onChange={e => setBusca(e.target.value)} /></label>
      {aba === "materiais" ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Matéria-prima", "Saldo", "Custo médio", "Valor em estoque", "Entradas", "Saídas", "Regra", "Ações"].map(t => <th className="p-3" key={t}>{t}</th>)}</tr></thead><tbody>{materiais.filter(m => filtrar(m.nome, m.codigo)).map(m => <tr key={m.id} className="border-t border-line"><td className="p-3">{m.nome}<small className="block text-muted">{m.codigo}{!m.ativo ? " • Inativa" : ""}</small></td><td className="p-3 font-bold">{n(m.saldo)} {m.unidade}</td><td className="p-3">{moeda(m.custo_medio)} / {m.unidade}{m.custo_medio_estimado && <small className="block text-muted">Estimado</small>}</td><td className="p-3">{moeda(Number(m.saldo) === 0 ? 0 : m.custo_medio == null ? null : Number(m.saldo) * m.custo_medio)}</td><td className="p-3">{n(m.entradas)}</td><td className="p-3">{n(m.saidas)}</td><td className="p-3">{m.influencia_saldo ? "Influencia o saldo" : "Somente alerta"}</td><td className="space-x-3 p-3"><button disabled={!m.ativo} className="text-accent disabled:opacity-40" onClick={() => abrir({ id: m.id, nome: m.nome, saldo: Number(m.saldo), material: true, unidade: m.unidade })}>Movimentar / ajustar</button><button onClick={() => verHistorico(m.id)}>Histórico</button></td></tr>)}</tbody></table>{!materiais.length && <p className="p-4 text-muted">Cadastre matérias-primas na aba Cadastro.</p>}</div> : <>
        <p className="text-sm text-muted">A disponibilidade é individual: produtos e kits compartilham matérias-primas. Os saldos não devem ser somados. Abra os detalhes para consultar os itens faltantes para uma unidade.</p>
        <div className="grid gap-3 lg:grid-cols-2">{linhas.filter(l => filtrar(l.nome, l.codigo)).map(l => {
          const falta = faltas(l.disponibilidade);
          const referenciaProduto = !l.kit ? produtos.find(p => p.id === l.id)?.custo_medio : null;
          return <article key={`${l.kit}:${l.id}`} className="rounded-lg border border-line bg-surface p-4"><div className="flex justify-between gap-3"><div><h3 className="font-bold">{l.nome}</h3><p className="text-xs text-muted">{l.codigo} • {l.disponibilidade.usaMateriais ? "Disponível pela matéria-prima" : "Estoque de produto acabado"}</p></div><strong className="text-2xl">{n(l.disponibilidade.saldo)}</strong></div>
            <section className="mt-4 rounded-lg border border-line bg-panel p-3" aria-label="Custo do produto ou kit">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">Custo médio por {l.kit ? "kit" : "produto"}</p>
                  <p className={`mt-1 text-xl font-bold tabular-nums ${l.custo.total === null ? "text-amber-400" : "text-foreground"}`}>
                    {l.custo.total === null ? "Custo pendente" : moeda(l.custo.total)}
                  </p>
                </div>
                {l.custo.estimado && l.custo.total !== null && <span className="rounded-full bg-amber-400/10 px-2 py-1 text-xs text-amber-400">Estimado</span>}
              </div>
              {l.disponibilidade.usaMateriais && <div className="mt-3 border-t border-line pt-3">
                <p className="text-xs text-muted">Último custo por {l.kit ? "kit" : "produto"}</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${l.ultimoCusto.total === null ? "text-amber-400" : "text-accent"}`}>{l.ultimoCusto.total === null ? "Custo pendente" : moeda(l.ultimoCusto.total)}</p>
                <p className="mt-1 text-xs text-muted">Consumo × último preço informado em entrada, pela data da movimentação. Inclui itens de apoio.</p>
                {l.ultimoCusto.total === null && <p className="mt-1 text-xs text-amber-400">Falta preço de entrada para algum componente da composição.</p>}
              </div>}
              {l.custo.total === null && referenciaProduto != null && <p className="mt-2 text-xs text-muted">Referência histórica do produto: <strong>{moeda(referenciaProduto)}</strong>. Valor sem distribuição entre os componentes; não incluído na soma atual.</p>}
              <details className="mt-3 border-t border-line pt-3 text-sm">
                <summary className="cursor-pointer text-muted">Ver composição dos custos</summary>
                <p className="mt-3 text-xs text-muted">Quantidades para 1 {l.kit ? "kit" : "produto"}. Subtotal = quantidade × custo unitário.</p>
                <ul className="mt-3 space-y-3">
                  {l.custo.itens.map(i => <li key={i.id} className="rounded-lg border border-line bg-surface p-3">
                    <p className="break-words font-semibold">{i.nome}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div><dt className="text-xs text-muted">Quantidade</dt><dd className="mt-1 font-medium tabular-nums">{n(i.quantidade)} {i.unidade}</dd></div>
                      <div><dt className="text-xs text-muted">Custo unitário</dt><dd className={`mt-1 font-medium tabular-nums ${i.custoUnitario === null ? "text-amber-400" : ""}`}>{i.custoUnitario === null ? "Não lançado" : moeda(i.custoUnitario)}{i.custoUnitario !== null && <span className="text-xs text-muted"> / {i.unidade}</span>}</dd></div>
                      <div><dt className="text-xs text-muted">Subtotal</dt><dd className={`mt-1 font-bold tabular-nums ${i.subtotal === null ? "text-amber-400" : ""}`}>{i.subtotal === null ? "Não lançado" : moeda(i.subtotal)}</dd></div>
                    </dl>
                    {l.disponibilidade.usaMateriais && <p className="mt-3 text-xs text-muted">Último preço de entrada: <strong>{moeda(l.ultimoCusto.itens.find(item => item.id === i.id)?.custoUnitario)}</strong> / {i.unidade} · Subtotal: <strong>{moeda(l.ultimoCusto.itens.find(item => item.id === i.id)?.subtotal)}</strong></p>}
                    {resumoHistorico(i.id)}
                  </li>)}
                </ul>
                {l.custo.total !== null && l.custo.itens.some(i => i.subtotal === null) && <p className="mt-3 text-xs text-amber-400">Total parcial: soma apenas os custos lançados. Itens marcados como “Não lançado” não entram na soma.</p>}
                {l.custo.total === null && <p className="mt-3 rounded-lg bg-amber-400/10 p-3 text-xs text-amber-400">O custo total ainda não está disponível. Confira os componentes e informe os custos pendentes por uma compra ou ajuste de custo da matéria-prima.</p>}
              </details>
            </section>
            <details className="mt-3">
              <summary className={`cursor-pointer text-sm ${falta.length || l.disponibilidade.problemas.length ? "text-amber-400" : "text-muted"}`}>
                {falta.length ? `Atenção: faltam ${falta.length} itens` : l.disponibilidade.problemas.length ? "Composição pendente" : "Ver composição e consumo"}
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                {l.disponibilidade.problemas.map((p, i) => <p key={i} className="text-amber-400">{p}</p>)}
                {(falta.length ? falta : l.disponibilidade.necessidades).map(item => {
                  const faltante = falta.find(f => f.id === item.id);
                  return <div key={item.id} className="rounded-lg border border-line bg-panel p-3">
                    <p className="break-words font-semibold">{item.nome}</p>
                    <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div><dt className="text-xs text-muted">Necessário por {l.kit ? "kit" : "produto"}</dt><dd className="mt-1 font-medium">{n(item.quantidade)} {item.unidade}</dd></div>
                      <div><dt className="text-xs text-muted">Saldo em estoque</dt><dd className="mt-1 font-medium">{n(item.saldo)} {item.unidade}</dd></div>
                      {faltante && <div><dt className="text-xs text-amber-400">Faltam</dt><dd className="mt-1 font-bold text-amber-400">{n(faltante.faltante)} {item.unidade}</dd></div>}
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-line px-2 py-1 text-muted">{item.limita ? "Limita o saldo" : "Somente alerta"}</span>
                      {!item.ativo && <span className="rounded-full bg-amber-400/10 px-2 py-1 text-amber-400">Item inativo</span>}
                    </div>
                    {resumoHistorico(item.id)}
                  </div>;
                })}
                {!l.disponibilidade.necessidades.length && <p>Adicione produtos ao kit para calcular seu saldo.</p>}
              </div>
            </details>
            {!l.kit && !l.disponibilidade.usaMateriais && <button className="mt-3 text-sm text-accent" onClick={() => abrir({ id: l.id, nome: l.nome, saldo: l.fisico, material: false, unidade: "un" })}>Movimentar / ajustar</button>}
            {!l.kit && l.disponibilidade.usaMateriais && l.fisico !== 0 && <p className="mt-3 text-xs text-amber-400">Saldo anterior de produto acabado: {n(l.fisico)}. Concilie a contagem inicial; este saldo não é somado à capacidade da matéria-prima.</p>}
          </article>;
        })}</div>{!linhas.length && <p>Nenhum produto ou kit cadastrado.</p>}
      </>}
      <section id="historico-estoque" className="scroll-mt-6 space-y-3 border-t border-line pt-5"><h3 className="text-lg font-bold">Histórico de movimentações</h3><label className="block text-sm">Filtrar item<select className={input} value={filtroHistorico} onChange={e => setFiltroHistorico(e.target.value)}><option value="">Todos os itens</option>{materiais.map(m => <option key={m.id} value={m.id}>{m.nome} (matéria-prima)</option>)}{produtos.map(p => <option key={p.id} value={p.id}>{p.nome} (produto)</option>)}</select></label><div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{["Data", "Item", "Tipo", "Quantidade", "Saldo após", "Custo unitário", "Média após", "Motivo / responsável"].map(t => <th key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{historico.map(m => <tr key={m.id} className="border-t border-line"><td className="whitespace-nowrap p-2">{dataBr(m.data)}<small className="block text-muted">Registrado: {new Date(m.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small></td><td className="p-2">{materiais.find(p => p.id === m.materia_prima_id)?.nome ?? produtos.find(p => p.id === m.produto_id)?.nome ?? "—"}</td><td className="p-2">{m.tipo.replaceAll("_", " ")}</td><td className="p-2">{Number(m.quantidade) > 0 ? "+" : ""}{n(m.quantidade)}</td><td className="p-2">{n(m.saldo_apos)}</td><td className="p-2">{m.materia_prima_id ? moeda(m.custo_unitario) : "—"}</td><td className="p-2">{m.materia_prima_id ? moeda(m.custo_medio_apos) : "—"}{m.custo_estimado_apos ? " (estimado)" : ""}</td><td className="p-2">{m.motivo}<small className="block text-muted">{base.usuarios[m.criado_por] ?? m.criado_por}</small></td></tr>)}</tbody></table>{!historico.length && <p className="p-3 text-muted">Nenhuma movimentação registrada.</p>}</div></section>
    </>}
    {alvo && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><section role="dialog" aria-modal="true" aria-labelledby="movimento-titulo" className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-line bg-panel p-5"><h3 id="movimento-titulo" className="text-xl font-bold">{alvo.nome}</h3><p className="my-3 text-sm text-muted">Saldo atual: {n(alvo.saldo)} {alvo.unidade}. O ajuste registra a diferença entre o saldo atual e a quantidade contada.</p><form onSubmit={salvar} className="space-y-3"><label className="block text-sm">Operação<select className={input} value={form.tipo} onChange={e => mudarForm({ tipo: e.target.value })}><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste">Ajustar para quantidade contada</option>{alvo.material && <option value="ajuste_custo">Ajustar custo médio (sem mudar quantidade)</option>}</select></label>{form.tipo !== "ajuste_custo" && <label className="block text-sm">{form.tipo === "ajuste" ? "Quantidade contada" : "Quantidade"} ({alvo.unidade})<input autoFocus required inputMode="decimal" className={input} value={form.quantidade} onChange={e => mudarForm({ quantidade: e.target.value })} /></label>}{alvo.material && (form.tipo === "entrada" || form.tipo === "ajuste_custo" || (form.tipo === "ajuste" && Number(form.quantidade.replace(",", ".")) > alvo.saldo)) && <label className="block text-sm">{form.tipo === "ajuste_custo" ? "Novo custo médio" : "Custo unitário da entrada (opcional)"} — R$/{alvo.unidade}<input required={form.tipo === "ajuste_custo"} inputMode="decimal" className={input} value={form.custo} onChange={e => mudarForm({ custo: e.target.value })} /><small className="text-muted">{form.tipo === "ajuste_custo" ? "Conciliação registrada como estimativa, com motivo. Não altera vendas anteriores." : "Informe o custo das unidades adicionadas. Sem valor, usa a média atual como estimativa; sem média conhecida, o custo fica pendente."}</small></label>}<label className="block text-sm">Data<input required type="date" max={hoje()} className={input} disabled={form.tipo === "ajuste_custo"} value={form.tipo === "ajuste_custo" ? hoje() : form.data} onChange={e => mudarForm({ data: e.target.value })} /></label><label className="block text-sm">Motivo<textarea required maxLength={2000} className={input} value={form.motivo} onChange={e => mudarForm({ motivo: e.target.value })} /></label>{erro && <p role="alert" className="text-red-400">{erro}</p>}<div className="flex gap-4"><button disabled={salvando} className="rounded-lg bg-accent px-4 py-3 font-semibold text-background disabled:opacity-50">{salvando ? "Registrando…" : "Registrar"}</button><button disabled={salvando} type="button" onClick={() => setAlvo(null)}>Cancelar</button></div></form></section></div>}
  </section>;
}
