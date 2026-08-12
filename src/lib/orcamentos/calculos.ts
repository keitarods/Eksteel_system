// Helpers de cálculo e formatação do módulo de Orçamentos.
// Deliberadamente não importa nada de dashboard-tabs.tsx — o módulo é isolado por design.

export function parseNumero(valor: string) {
  if (!valor) return 0;
  const normalizado = valor.replace(/\./g, "").replace(",", ".");
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

export function valorTotalItem(quantidade: number, valorUnitario: number) {
  return quantidade * valorUnitario;
}

export function calcularSubtotal(itens: { valorTotal: number }[]) {
  return itens.reduce((s, i) => s + i.valorTotal, 0);
}

export function calcularTotal(subtotal: number, desconto: number) {
  return Math.max(0, subtotal - desconto);
}

export function calcularDataValidade(dataEmissaoIso: string, validadeDias: number) {
  if (!dataEmissaoIso) return "";
  const d = new Date(`${dataEmissaoIso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + validadeDias);
  return d.toISOString().slice(0, 10);
}

export function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarData(iso: string) {
  if (!iso) return "-";
  const [ano, mes, dia] = iso.split("-");
  if (!ano || !mes || !dia) return "-";
  return `${dia}/${mes}/${ano}`;
}
