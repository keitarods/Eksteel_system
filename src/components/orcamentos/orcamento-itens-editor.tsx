"use client";

import { Plus, Trash2 } from "lucide-react";
import type { TipoItemOrcamento } from "@/lib/orcamentos/types";
import { formatarMoeda, parseNumero, valorTotalItem } from "@/lib/orcamentos/calculos";
import { Th, Td } from "./ui";

export type ItemRascunho = {
  tempId: string;
  tipoItem: TipoItemOrcamento;
  descricao: string;
  detalhamentoTecnico: string;
  unidade: string;
  quantidade: string;
  valorUnitario: string;
};

export function criarItemVazio(tempId: string): ItemRascunho {
  return {
    tempId,
    tipoItem: "produto",
    descricao: "",
    detalhamentoTecnico: "",
    unidade: "un",
    quantidade: "1",
    valorUnitario: "0",
  };
}

export default function OrcamentoItensEditor({
  itens,
  onChange,
}: {
  itens: ItemRascunho[];
  onChange: (itens: ItemRascunho[]) => void;
}) {
  function atualizar(tempId: string, campo: keyof ItemRascunho, valor: string) {
    onChange(itens.map((it) => (it.tempId === tempId ? { ...it, [campo]: valor } : it)));
  }

  function remover(tempId: string) {
    onChange(itens.filter((it) => it.tempId !== tempId));
  }

  function adicionar() {
    onChange([...itens, criarItemVazio(crypto.randomUUID())]);
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-[#2a2a2a]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[#181818] text-[#90A4AE]">
              <tr>
                <Th>Tipo</Th>
                <Th>Descrição</Th>
                <Th>Unid.</Th>
                <Th>Qtd.</Th>
                <Th>Valor unit.</Th>
                <Th>Valor total</Th>
                <Th>{" "}</Th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it) => {
                const total = valorTotalItem(parseNumero(it.quantidade), parseNumero(it.valorUnitario));
                return (
                  <tr key={it.tempId} className="border-t border-[#2a2a2a] align-top">
                    <Td>
                      <select
                        value={it.tipoItem}
                        onChange={(e) => atualizar(it.tempId, "tipoItem", e.target.value)}
                        className="h-9 rounded-xl border border-[#333333] bg-[#141414] px-2 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
                      >
                        <option value="produto">Produto</option>
                        <option value="servico">Serviço</option>
                      </select>
                    </Td>
                    <Td className="min-w-[220px]">
                      <input
                        type="text"
                        value={it.descricao}
                        onChange={(e) => atualizar(it.tempId, "descricao", e.target.value)}
                        placeholder="Descrição do item"
                        className="h-9 w-full rounded-xl border border-[#333333] bg-[#141414] px-2 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
                      />
                      {it.tipoItem === "servico" && (
                        <textarea
                          value={it.detalhamentoTecnico}
                          onChange={(e) => atualizar(it.tempId, "detalhamentoTecnico", e.target.value)}
                          placeholder="Detalhamento técnico: material, dimensões, norma, processo de fabricação..."
                          rows={2}
                          className="mt-1.5 w-full rounded-xl border border-[#333333] bg-[#141414] px-2 py-1.5 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
                        />
                      )}
                    </Td>
                    <Td>
                      <input
                        type="text"
                        value={it.unidade}
                        onChange={(e) => atualizar(it.tempId, "unidade", e.target.value)}
                        className="h-9 w-16 rounded-xl border border-[#333333] bg-[#141414] px-2 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
                      />
                    </Td>
                    <Td>
                      <input
                        type="text"
                        value={it.quantidade}
                        onChange={(e) => atualizar(it.tempId, "quantidade", e.target.value)}
                        className="h-9 w-16 rounded-xl border border-[#333333] bg-[#141414] px-2 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
                      />
                    </Td>
                    <Td>
                      <input
                        type="text"
                        value={it.valorUnitario}
                        onChange={(e) => atualizar(it.tempId, "valorUnitario", e.target.value)}
                        placeholder="0,00"
                        className="h-9 w-24 rounded-xl border border-[#333333] bg-[#141414] px-2 text-xs text-[#ECEFF1] outline-none focus:border-[#546E7A]"
                      />
                    </Td>
                    <Td className="font-semibold text-[#90A4AE]">{formatarMoeda(total)}</Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => remover(it.tempId)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </Td>
                  </tr>
                );
              })}
              {itens.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-[#78909C]">
                    Nenhum item adicionado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <button
        type="button"
        onClick={adicionar}
        className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#333333] bg-[#212121] px-4 text-sm font-semibold text-[#546E7A] transition hover:bg-[#2a2a2a]"
      >
        <Plus className="h-4 w-4" /> Adicionar item
      </button>
    </div>
  );
}
