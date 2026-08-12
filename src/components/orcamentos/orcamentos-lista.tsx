"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { STATUS_ORCAMENTO, type ClienteOrcamento, type Orcamento } from "@/lib/orcamentos/types";
import { formatarData, formatarMoeda } from "@/lib/orcamentos/calculos";
import { Th, Td } from "./ui";
import StatusBadge from "./status-badge";

export default function OrcamentosLista({
  orcamentos,
  clientes,
}: {
  orcamentos: Orcamento[];
  clientes: ClienteOrcamento[];
}) {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");

  const filtrados = orcamentos.filter((o) => {
    const termo = busca.trim().toLowerCase();
    if (termo && !o.numero.toLowerCase().includes(termo) && !o.clienteNome.toLowerCase().includes(termo)) return false;
    if (status && o.status !== status) return false;
    if (clienteId && o.clienteId !== clienteId) return false;
    if (de && o.dataEmissao < de) return false;
    if (ate && o.dataEmissao > ate) return false;
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <label className="mb-1 block text-sm font-medium">Buscar</label>
          <Search className="pointer-events-none absolute left-4 top-[42px] h-4 w-4 -translate-y-1/2 text-[#90A4AE]" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Número ou cliente"
            className="h-11 w-full rounded-2xl border border-[#333333] bg-[#141414] pl-11 pr-4 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-11 rounded-2xl border border-[#333333] bg-[#141414] px-4 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]">
            <option value="">Todos</option>
            {STATUS_ORCAMENTO.map((s) => <option key={s.valor} value={s.valor}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Cliente</label>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="h-11 rounded-2xl border border-[#333333] bg-[#141414] px-4 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]">
            <option value="">Todos</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">De</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-11 rounded-2xl border border-[#333333] bg-[#141414] px-4 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Até</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-11 rounded-2xl border border-[#333333] bg-[#141414] px-4 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A]" />
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-3xl border border-[#333333]">
        {filtrados.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] bg-[#212121] text-left text-sm">
              <thead className="bg-[#181818] text-[#90A4AE]">
                <tr>
                  <Th>Número</Th>
                  <Th>Cliente</Th>
                  <Th>Tipo</Th>
                  <Th>Emissão</Th>
                  <Th>Total</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((o) => (
                  <tr key={o.id} className="border-t border-[#2a2a2a] transition hover:bg-[#2a2a2a]">
                    <Td className="font-semibold">
                      <Link href={`/orcamentos/${o.id}`} className="hover:underline">{o.numero}</Link>
                    </Td>
                    <Td>{o.clienteNome || "-"}</Td>
                    <Td className="text-xs text-[#78909C] capitalize">{o.tipo.replace("_", " ")}</Td>
                    <Td>{formatarData(o.dataEmissao)}</Td>
                    <Td className="font-semibold text-[#90A4AE]">{formatarMoeda(o.total)}</Td>
                    <Td><StatusBadge status={o.status} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-12 text-center text-sm text-[#78909C]">Nenhum orçamento encontrado.</div>
        )}
      </div>
    </div>
  );
}
