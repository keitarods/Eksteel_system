import { writeFileSync } from "node:fs";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import OrcamentoPdfDocument from "../src/components/orcamentos/orcamento-pdf-document";
import type { Orcamento, OrcamentoItem, ClienteOrcamento } from "../src/lib/orcamentos/types";
import type { EmpresaConfig } from "../src/lib/orcamentos/empresa";

const orcamento: Orcamento = {
  id: "1",
  numero: "ORC-2026-0002",
  clienteId: "1",
  clienteNome: "xxx",
  tipo: "servico_engenharia",
  status: "rascunho",
  dataEmissao: "2026-08-13",
  validadeDias: 15,
  condicoesPagamento: "",
  prazoEntrega: "",
  observacoes: "",
  responsavelTecnico: "",
  cnpjEmissor: "00.000.000/0001-00",
  cnpjEmissorLabel: "Sócio (MEI) — dado fictício, só pra testar o layout",
  subtotal: 1500,
  desconto: 0,
  total: 1500,
  aprovadoEm: "",
  criadoPor: "",
  criadoEm: "",
  atualizadoPor: "",
  atualizadoEm: "",
};

const itens: OrcamentoItem[] = [
  {
    id: "1",
    orcamentoId: "1",
    tipoItem: "servico",
    descricao: "Soldagem",
    detalhamentoTecnico: "",
    unidade: "un",
    quantidade: 1,
    valorUnitario: 1500,
    valorTotal: 1500,
    ordem: 0,
  },
];

const cliente: ClienteOrcamento = {
  id: "1",
  nome: "xxx",
  cnpjCpf: "5454545",
  telefone: "455454",
  email: "xxxx",
  endereco: "xxxxx",
  cidade: "xxx",
  uf: "XX",
  criadoEm: "",
};

const empresa: EmpresaConfig = {
  id: "1",
  razaoSocial: "Eksteel Soluções em Aço",
  endereco: "Rua Fictícia, 123 — Cidade/UF",
  telefone: "(00) 00000-0000",
  email: "contato@exemplo.com.br",
  site: "www.exemplo.com.br",
};

async function main() {
  const buffer = await renderToBuffer(
    <OrcamentoPdfDocument orcamento={orcamento} itens={itens} cliente={cliente} empresa={empresa} />
  );
  const saida = path.join(__dirname, "..", "tmp-teste-orcamento.pdf");
  writeFileSync(saida, buffer);
  console.log("PDF gerado em", saida);
}

main();
