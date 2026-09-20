import fs from 'node:fs';
import path from 'node:path';

// Auditoria somente leitura. Não transforma compras totais em saldo disponível.
const origem = process.argv[2] ?? 'supabase/local/conciliacao/snapshot-origem.json';
const snapshot = JSON.parse(fs.readFileSync(origem, 'utf8'));
const t = snapshot.tabelas;
const normalizar = valor => String(valor ?? '').normalize('NFC').trim().toLocaleLowerCase('pt-BR');
const numero = valor => {
  const n = Number(valor);
  if (valor === null || valor === undefined || !Number.isFinite(n)) throw Error('Número ausente ou inválido na origem');
  return n;
};
const somar = (linhas, campo) => linhas.reduce((total, linha) => total + numero(linha[campo]), 0);
const formatar = valor => Number(valor.toFixed(6)).toLocaleString('pt-BR', { maximumFractionDigits: 6 });
const vinculos = t.itens_fabricacao.map(item => {
  const candidatos = t.materias_primas.filter(m => normalizar(m.nome) === normalizar(item.nome_peca));
  const pedido = t.pedidos_fabricacao.find(p => p.id === item.pedido_id);
  const problemas = [];
  if (!pedido) problemas.push('Pedido não encontrado');
  if (candidatos.length !== 1) problemas.push('Nome sem correspondência única');
  if (pedido && Math.abs(numero(item.qtd_total) - numero(item.qtd_pc) * numero(pedido.qtd_fabricada)) > 0.000001) problemas.push('Quantidade total diverge da composição');
  if (Math.abs(numero(item.preco_total) - numero(item.qtd_total) * numero(item.preco_unitario)) > 0.010001) problemas.push('Valor total diverge de quantidade × preço');
  return { item_id: item.id, pedido_id: item.pedido_id, produto_id: pedido?.produto_id, data: pedido?.data, materia_prima_id: candidatos.length === 1 ? candidatos[0].id : null, codigo: candidatos.length === 1 ? candidatos[0].codigo : null, quantidade: numero(item.qtd_total), custo_unitario: numero(item.preco_unitario), valor: numero(item.preco_total), problemas };
});
const produtos = t.produtos.map(produto => {
  const pedidos = t.pedidos_fabricacao.filter(p => p.produto_id === produto.id);
  const consumo = t.vendas.flatMap(v => (v.cmv_componentes ?? []).filter(c => c.produto_id === produto.id).map(c => ({ ...c, venda_id: v.id, data: v.data })));
  const semComposicao = t.vendas.filter(v => v.produto_id === produto.id && !v.cmv_componentes?.length);
  const entrada = somar(pedidos, 'qtd_fabricada');
  const saida = somar(consumo, 'quantidade');
  const semItens = pedidos.filter(p => !t.itens_fabricacao.some(i => i.pedido_id === p.id));
  const eventos = [...pedidos.map(p => ({ data: p.data, quantidade: numero(p.qtd_fabricada) })), ...consumo.map(c => ({ data: c.data, quantidade: -numero(c.quantidade) }))].sort((a,b) => a.data.localeCompare(b.data) || b.quantidade-a.quantidade);
  let acumulado = 0;
  const diasNegativos = eventos.filter(e => (acumulado += e.quantidade) < -0.000001).map(e => e.data);
  return { id: produto.id, codigo: produto.codigo, nome: produto.nome, entradas: entrada, saidas: saida, saldo_historico: entrada-saida, saldo_cadastrado: numero(produto.estoque_atual), diferenca: numero(produto.estoque_atual)-(entrada-saida), pedidos_sem_itens: semItens.map(p => ({ id: p.id, data: p.data, quantidade: p.qtd_fabricada, valor: p.valor_total })), vendas_sem_composicao: semComposicao.map(v => v.id), dias_saldo_negativo: [...new Set(diasNegativos)] };
});
const materiais = t.materias_primas.map(m => {
  const itens = vinculos.filter(i => i.materia_prima_id === m.id && !i.problemas.length);
  const quantidade = somar(itens, 'quantidade');
  const valor = itens.reduce((s,i) => s+i.quantidade*i.custo_unitario,0);
  return { id: m.id, codigo: m.codigo, nome: m.nome, ativo: m.ativo, influencia_saldo: m.influencia_saldo, quantidade_comprada_documentada: quantidade, valor_documentado: valor, media_historica_referencia: quantidade ? valor/quantidade : null };
});
const relatorio = { coletado_em: snapshot.coletado_em, somente_auditoria: true, vinculos, produtos, materiais, reposicoes_ja_documentadas: t.reposicoes_produtos.filter(r => t.pedidos_fabricacao.some(p => p.id === r.id)).map(r => r.id), esquema_custos_disponivel: t.materias_primas.every(m => Object.hasOwn(m, 'custo_medio')), movimentos_existentes: t.movimentos_estoque.length };
const linhas = ['# Auditoria da conversão do histórico para matérias-primas', '', `Origem coletada em: ${snapshot.coletado_em}. Nenhum lançamento executado por esta auditoria.`, '', 'Compras documentadas não equivalem ao saldo atual. É necessário descontar o consumo, resolver saldos iniciais ausentes e preservar o estorno das vendas antigas.', '', '## Saldos de produtos', '', '| Código | Entradas | Saídas registradas | Saldo histórico | Saldo cadastrado | Diferença |', '|---|---:|---:|---:|---:|---:|'];
for (const p of produtos) linhas.push(`| ${p.codigo} | ${formatar(p.entradas)} | ${formatar(p.saidas)} | ${formatar(p.saldo_historico)} | ${formatar(p.saldo_cadastrado)} | ${formatar(p.diferenca)} |`);
linhas.push('', '## Pendências', '');
for (const p of produtos) {
  if (p.diferenca) linhas.push(`- ${p.codigo}: confirmar saldo físico; diferença de ${formatar(p.diferenca)} unidades.`);
  for (const pedido of p.pedidos_sem_itens) linhas.push(`- ${p.codigo}: compra ${pedido.id}, ${pedido.data}, ${formatar(numero(pedido.quantidade))} unidades por R$ ${formatar(numero(pedido.valor))}, sem detalhamento de matérias-primas.`);
  if (p.dias_saldo_negativo.length) linhas.push(`- ${p.codigo}: histórico apresenta saldo negativo em ${p.dias_saldo_negativo.join(', ')}; falta saldo inicial ou correção de datas/documentos.`);
  if (p.vendas_sem_composicao.length) linhas.push(`- ${p.codigo}: vendas sem composição registrada: ${p.vendas_sem_composicao.join(', ')}.`);
}
for (const m of materiais.filter(m => !m.ativo && t.componentes_produto.some(c => c.materia_prima_id === m.id))) linhas.push(`- ${m.codigo}: matéria-prima inativa ainda vinculada à composição; influencia_saldo=${m.influencia_saldo}.`);
if (!relatorio.esquema_custos_disponivel) linhas.push('- O banco ainda não contém os campos de custo médio das matérias-primas. Aplicar a atualização estrutural antes da importação com custos.');
linhas.push(`- ${relatorio.reposicoes_ja_documentadas.length} reposições têm o mesmo ID de compras históricas e não podem ser contadas novamente.`, '- Vendas antigas usam estorno por produto. A conversão deve tratar o estorno de forma consistente com os materiais importados, preservando o CMV original.', '', '## Compras de materiais identificadas', '', 'Vínculo pelo nome exato normalizado e único, pois os itens históricos não armazenam código/ID de matéria-prima. A média abaixo é apenas referência das compras documentadas, não custo médio móvel nem saldo disponível.', '', '| Código | Matéria-prima | Quantidade comprada | Valor documentado | Média de referência |', '|---|---|---:|---:|---:|');
for (const m of materiais) linhas.push(`| ${m.codigo} | ${m.nome.replaceAll('|','/')} | ${formatar(m.quantidade_comprada_documentada)} | ${formatar(m.valor_documentado)} | ${m.media_historica_referencia === null ? 'Sem referência' : formatar(m.media_historica_referencia)} |`);
const pasta = path.dirname(origem);
fs.writeFileSync(path.join(pasta, 'auditoria.json'), JSON.stringify(relatorio, null, 2), { mode: 0o600 });
fs.writeFileSync(path.join(pasta, 'auditoria.md'), linhas.join('\n')+'\n', { mode: 0o600 });
console.log(JSON.stringify({ produtos: produtos.length, itens: vinculos.length, itensComProblemas: vinculos.filter(i => i.problemas.length).length, divergenciasSaldo: produtos.filter(p => p.diferenca).length, pedidosSemItens: produtos.flatMap(p => p.pedidos_sem_itens).length, relatorio: path.join(pasta, 'auditoria.md') }, null, 2));
