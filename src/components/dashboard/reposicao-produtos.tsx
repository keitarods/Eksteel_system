"use client";
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { buscarTodasLinhas } from '@/lib/relatorios/dados';

type Produto = { id: string; nome: string; codigo: string; estoque_atual: number; custo: number; custo_medio: number | null; custo_medio_estimado: boolean; ativo: boolean };
type Reposicao = { id: string; produto_id: string; quantidade: number; valor_total: number; saldo_apos: number; custo_medio_apos: number; criado_em: string };
const real = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const campo = 'mt-1 block min-h-11 w-full rounded-lg border border-line bg-background px-3 text-sm';
async function carregar() {
 const client=createClient();
 const [produtos, result]=await Promise.all([buscarTodasLinhas(client,'produtos','id,nome,codigo,estoque_atual,custo,custo_medio,custo_medio_estimado,ativo'),client.from('reposicoes_produtos').select('*').order('criado_em',{ascending:false}).limit(50)]);
 if(result.error) throw new Error('Configure a migração CMV no Supabase antes de registrar reposições.');
 return { produtos: produtos as unknown as Produto[], historico: (result.data ?? []) as Reposicao[] };
}
export default function ReposicaoProdutos() {
 const [base,setBase]=useState<{produtos:Produto[];historico:Reposicao[]}|null>(null);
 const [form,setForm]=useState({produtoId:'',quantidade:'',valor:'',observacao:''});
 const [erro,setErro]=useState('');const [mensagem,setMensagem]=useState('');const [salvando,setSalvando]=useState(false);const [versao,setVersao]=useState(0);
 const tentativa=useRef<{assinatura:string;id:string}|null>(null);
 useEffect(()=>{let ativo=true;carregar().then(b=>{if(ativo){setBase(b);setErro('');}}).catch(()=>{if(ativo)setErro('Não foi possível ler as reposições. Verifique a conexão e se a migração CMV foi aplicada no Supabase.');});return()=>{ativo=false};},[versao]);
 const produto=base?.produtos.find(p=>p.id===form.produtoId);
 const quantidade=Number(form.quantidade),valor=Number(form.valor);
 const custoAtual=produto ? Number(produto.custo_medio ?? produto.custo) : 0;
 const media=produto && quantidade>0 && valor>0 && (Number(produto.estoque_atual)===0 || custoAtual>0) ? (Number(produto.estoque_atual)*custoAtual+valor)/(Number(produto.estoque_atual)+quantidade) : null;
 async function salvar(e:React.FormEvent){e.preventDefault();setErro('');setMensagem('');
 if(!produto || !Number.isFinite(quantidade) || !Number.isFinite(valor) || quantidade<=0 || valor<=0){setErro('Selecione o produto e informe quantidade e custo total positivos.');return;}
 const assinatura=JSON.stringify(form);if(tentativa.current?.assinatura!==assinatura)tentativa.current={assinatura,id:crypto.randomUUID()};
 setSalvando(true);
 try{const {error}=await createClient().rpc('registrar_reposicao_produto',{p_id:tentativa.current.id,p_produto_id:form.produtoId,p_quantidade:quantidade,p_valor_total:valor,p_observacao:form.observacao.trim()});
 if(error)throw new Error(error.code==='PGRST202'?'Execute a migração CMV no Supabase para ativar a reposição.':error.message);
 tentativa.current=null;setForm({produtoId:'',quantidade:'',valor:'',observacao:''});setMensagem('Reposição registrada. Estoque e custo médio atualizados juntos.');
 setBase(await carregar());
 }catch(e){setErro((e as Error).message);}finally{setSalvando(false);}}
 return <div className="mt-6 space-y-5">
 <div><h3 className="text-xl font-bold">Reposição de produtos para revenda</h3><p className="mt-2 text-sm leading-6 text-muted">Registre apenas mercadorias recebidas. A entrada ocorre agora e atualiza o custo médio; não altera o CMV já gravado nas vendas. Inclua no custo total o frete e demais custos de aquisição atribuídos a este produto.</p></div>
 {erro&&<p role="alert" className="rounded-lg bg-red-900/20 p-3 text-red-300">{erro} <button className="underline" onClick={()=>setVersao(v=>v+1)}>Recarregar</button></p>}{mensagem&&<p role="status" className="text-emerald-300">{mensagem}</p>}
 {!base&&!erro?<p role="status">Carregando reposições…</p>:null}
 {base&&<><form onSubmit={salvar}><fieldset disabled={salvando} className="grid gap-4 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
 <label className="text-sm sm:col-span-2">Produto<select required className={campo} value={form.produtoId} onChange={e=>setForm({...form,produtoId:e.target.value})}><option value="">Selecione</option>{base.produtos.filter(p=>p.ativo).sort((a,b)=>a.nome.localeCompare(b.nome)).map(p=><option key={p.id} value={p.id}>{p.codigo} · {p.nome}</option>)}</select></label>
 <label className="text-sm">Quantidade recebida<input required type="number" min="0.0001" max="100000000" step="any" className={campo} value={form.quantidade} onChange={e=>setForm({...form,quantidade:e.target.value})}/></label>
 <label className="text-sm">Custo total da reposição (R$)<input required type="number" min="0.01" max="1000000000" step="0.01" className={campo} value={form.valor} onChange={e=>setForm({...form,valor:e.target.value})}/></label>
 <label className="text-sm sm:col-span-2">Observação / referência da compra<input maxLength={2000} className={campo} value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})}/></label>
 {produto&&<p className="text-sm leading-6 text-muted sm:col-span-2">Saldo atual: {produto.estoque_atual}. Custo médio após entrada: {media===null?'Não apurado':real(media)}. {produto.custo_medio_estimado&&Number(produto.estoque_atual)>0?'Inclui custo estimado do saldo inicial.':''}</p>}
 <button className="min-h-11 rounded-lg bg-accent px-4 font-semibold text-background disabled:opacity-50 sm:col-span-2" type="submit">{salvando?'Registrando…':'Registrar reposição recebida'}</button>
 </fieldset></form>
 <div className="overflow-x-auto rounded-xl border border-line"><table className="w-full min-w-[600px] text-left text-sm"><caption className="p-3 text-left font-semibold">Últimas 50 reposições recebidas</caption><thead className="bg-surface"><tr>{['Registro','Produto','Quantidade','Custo total','Custo médio após'].map(c=><th className="p-3" key={c}>{c}</th>)}</tr></thead><tbody>{base.historico.map(r=><tr key={r.id} className="border-t border-line"><td className="p-3">{new Date(r.criado_em).toLocaleString('pt-BR')}</td><td className="p-3">{base.produtos.find(p=>p.id===r.produto_id)?.nome??'Produto'}</td><td className="p-3">{r.quantidade}</td><td className="p-3">{real(Number(r.valor_total))}</td><td className="p-3">{real(Number(r.custo_medio_apos))}</td></tr>)}{!base.historico.length&&<tr><td colSpan={5} className="p-4 text-muted">Nenhuma reposição registrada.</td></tr>}</tbody></table></div></>}
 </div>;
}
