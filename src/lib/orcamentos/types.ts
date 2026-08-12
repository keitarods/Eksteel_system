export type TipoOrcamento = "produto" | "servico_engenharia" | "misto";
export type StatusOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado" | "expirado";
export type TipoItemOrcamento = "produto" | "servico";

export const TIPOS_ORCAMENTO: { valor: TipoOrcamento; label: string }[] = [
  { valor: "produto", label: "Produto" },
  { valor: "servico_engenharia", label: "Serviço de engenharia" },
  { valor: "misto", label: "Misto" },
];

export const STATUS_ORCAMENTO: { valor: StatusOrcamento; label: string }[] = [
  { valor: "rascunho", label: "Rascunho" },
  { valor: "enviado", label: "Enviado" },
  { valor: "aprovado", label: "Aprovado" },
  { valor: "recusado", label: "Recusado" },
  { valor: "expirado", label: "Expirado" },
];

export type ClienteOrcamento = {
  id: string;
  nome: string;
  cnpjCpf: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  uf: string;
  criadoEm: string;
};

export type OrcamentoItem = {
  id: string;
  orcamentoId: string;
  tipoItem: TipoItemOrcamento;
  descricao: string;
  detalhamentoTecnico: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  ordem: number;
};

export type Orcamento = {
  id: string;
  numero: string;
  clienteId: string;
  clienteNome: string;
  tipo: TipoOrcamento;
  status: StatusOrcamento;
  dataEmissao: string;
  validadeDias: number;
  condicoesPagamento: string;
  prazoEntrega: string;
  observacoes: string;
  responsavelTecnico: string;
  subtotal: number;
  desconto: number;
  total: number;
  aprovadoEm: string;
  criadoPor: string;
  criadoEm: string;
  atualizadoPor: string;
  atualizadoEm: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapClienteOrcamento(r: any): ClienteOrcamento {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ""),
    cnpjCpf: String(r.cnpj_cpf ?? ""),
    telefone: String(r.telefone ?? ""),
    email: String(r.email ?? ""),
    endereco: String(r.endereco ?? ""),
    cidade: String(r.cidade ?? ""),
    uf: String(r.uf ?? ""),
    criadoEm: String(r.criado_em ?? ""),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapOrcamentoItem(r: any): OrcamentoItem {
  return {
    id: String(r.id),
    orcamentoId: String(r.orcamento_id ?? ""),
    tipoItem: (r.tipo_item ?? "produto") as TipoItemOrcamento,
    descricao: String(r.descricao ?? ""),
    detalhamentoTecnico: String(r.detalhamento_tecnico ?? ""),
    unidade: String(r.unidade ?? ""),
    quantidade: Number(r.quantidade ?? 0),
    valorUnitario: Number(r.valor_unitario ?? 0),
    valorTotal: Number(r.valor_total ?? 0),
    ordem: Number(r.ordem ?? 0),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapOrcamento(r: any): Orcamento {
  return {
    id: String(r.id),
    numero: String(r.numero ?? ""),
    clienteId: String(r.cliente_id ?? ""),
    clienteNome: String(r.clientes_orcamento?.nome ?? ""),
    tipo: (r.tipo ?? "produto") as TipoOrcamento,
    status: (r.status ?? "rascunho") as StatusOrcamento,
    dataEmissao: String(r.data_emissao ?? ""),
    validadeDias: Number(r.validade_dias ?? 15),
    condicoesPagamento: String(r.condicoes_pagamento ?? ""),
    prazoEntrega: String(r.prazo_entrega ?? ""),
    observacoes: String(r.observacoes ?? ""),
    responsavelTecnico: String(r.responsavel_tecnico ?? ""),
    subtotal: Number(r.subtotal ?? 0),
    desconto: Number(r.desconto ?? 0),
    total: Number(r.total ?? 0),
    aprovadoEm: String(r.aprovado_em ?? ""),
    criadoPor: String(r.criado_por ?? ""),
    criadoEm: String(r.criado_em ?? ""),
    atualizadoPor: String(r.atualizado_por ?? ""),
    atualizadoEm: String(r.atualizado_em ?? ""),
  };
}
