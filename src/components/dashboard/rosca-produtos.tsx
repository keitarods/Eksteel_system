"use client";

import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export type ItemRoscaProduto = { id: string; codigo: string; nome: string; value: number };
const moeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// A cor depende da identidade, não da posição no ranking ou do valor vendido.
function corProduto(id: string) {
  let hash = 0;
  for (const letra of id) hash = (Math.imul(hash, 31) + letra.charCodeAt(0)) | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash ^= hash >>> 16;
  return `hsl(${(hash >>> 0) % 360} 65% 58%)`;
}
export default function RoscaProdutos({ itens, titulo }: { itens: ItemRoscaProduto[]; titulo: string }) {
  const [destacado, setDestacado] = useState<string | null>(null);
  return <div className="mt-4 min-w-0">
    <div className="h-48 min-w-0" aria-label={titulo}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={itens} dataKey="value" nameKey="codigo" cx="50%" cy="50%" innerRadius={48} outerRadius={76} onMouseEnter={(_, index) => setDestacado(itens[index].id)} onMouseLeave={() => setDestacado(null)}>
            {itens.map(item => <Cell key={item.id} fill={corProduto(item.id)} opacity={destacado && destacado !== item.id ? .35 : 1} />)}
          </Pie>
          <Tooltip content={({ active, payload }) => {
            const item = payload?.[0]?.payload as ItemRoscaProduto | undefined;
            return active && item ? <div className="max-w-64 rounded-lg border border-line bg-panel p-3 text-sm shadow-lg"><p className="font-semibold text-foreground">{item.nome}</p><p className="mt-1 text-muted">{item.codigo} · {moeda(item.value)}</p></div> : null;
          }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
    <ul aria-label={`Legenda: ${titulo}`} className="mt-2 flex max-h-36 flex-wrap justify-center gap-x-4 gap-y-2 overflow-y-auto px-1 py-2">
      {itens.map(item => <li key={item.id}><button type="button" title={`${item.nome} · ${moeda(item.value)}`} aria-label={`${item.codigo}: ${item.nome}, ${moeda(item.value)}`} onMouseEnter={() => setDestacado(item.id)} onMouseLeave={() => setDestacado(null)} onFocus={() => setDestacado(item.id)} onBlur={() => setDestacado(null)} onClick={() => setDestacado(item.id)} className="flex min-h-8 items-center gap-2 rounded px-1 text-xs text-foreground focus-visible:outline-2 focus-visible:outline-accent"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: corProduto(item.id) }} />{item.codigo}</button></li>)}
    </ul>
    {destacado && <p role="status" className="mt-1 break-words text-center text-xs text-muted">{itens.find(i => i.id === destacado)?.nome} · {moeda(itens.find(i => i.id === destacado)?.value ?? 0)}</p>}
  </div>;
}
