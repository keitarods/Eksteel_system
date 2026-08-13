import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { StyleProp } from "@react-pdf/stylesheet";
import type { ClienteOrcamento, Orcamento, OrcamentoItem } from "@/lib/orcamentos/types";
import { calcularDataValidade, formatarData, formatarMoeda } from "@/lib/orcamentos/calculos";
import type { EmpresaConfig } from "@/lib/orcamentos/empresa";

const AZUL_MARCA = "#37474F";
const AZUL_MARCA_CLARO = "#546E7A";
const CINZA_TEXTO = "#263238";
const CINZA_SECUNDARIO = "#607D8B";
const CINZA_BORDA = "#CFD8DC";
const CINZA_FUNDO_TABELA = "#ECEFF1";

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 60,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: CINZA_TEXTO,
  },
  // Cabeçalho e bloco de título ficam em fluxo normal (não position:absolute com
  // coordenadas fixas) — assim o tamanho real do conteúdo (nº de linhas do
  // endereço da empresa etc.) empurra o que vem depois, em vez de precisar
  // acertar na mão quanto espaço reservar. Os dois continuam `fixed` (repetem
  // em toda página), só não são mais sobrepostos manualmente por coordenada.
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 2,
    borderBottomColor: AZUL_MARCA,
    paddingBottom: 10,
  },
  logo: { width: 110, height: 34, objectFit: "contain" },
  empresaInfo: { alignItems: "flex-end", maxWidth: 260 },
  empresaNome: { fontSize: 10, fontWeight: 700, color: AZUL_MARCA, marginBottom: 2 },
  empresaLinha: { fontSize: 7.5, color: CINZA_SECUNDARIO, textAlign: "right" },
  tituloBloco: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  tituloOrcamento: { fontSize: 14, fontWeight: 700, color: AZUL_MARCA, letterSpacing: 1 },
  tituloMeta: { fontSize: 8, color: CINZA_SECUNDARIO, textAlign: "right" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: CINZA_BORDA,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerTexto: { fontSize: 7.5, color: CINZA_SECUNDARIO },
  secao: { marginTop: 14 },
  secaoTitulo: {
    fontSize: 9,
    fontWeight: 700,
    color: AZUL_MARCA,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clienteBox: {
    borderWidth: 1,
    borderColor: CINZA_BORDA,
    borderRadius: 4,
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  clienteCampo: { width: "50%", marginBottom: 4 },
  clienteLabel: { fontSize: 7, color: CINZA_SECUNDARIO },
  clienteValor: { fontSize: 9, color: CINZA_TEXTO, fontWeight: 700 },
  tabela: { borderWidth: 1, borderColor: CINZA_BORDA, borderRadius: 4, overflow: "hidden" },
  tabelaHeader: {
    flexDirection: "row",
    backgroundColor: AZUL_MARCA,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tabelaHeaderTexto: { fontSize: 7.5, color: "#FFFFFF", fontWeight: 700, textTransform: "uppercase" },
  tabelaLinha: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: CINZA_BORDA,
  },
  tabelaLinhaAlt: { backgroundColor: CINZA_FUNDO_TABELA },
  colItem: { width: "6%" },
  colDescricao: { width: "44%" },
  colUnid: { width: "8%", textAlign: "center" },
  colQtd: { width: "10%", textAlign: "center" },
  colValorUnit: { width: "16%", textAlign: "right" },
  colValorTotal: { width: "16%", textAlign: "right" },
  detalhamento: { fontSize: 7.5, color: CINZA_SECUNDARIO, marginTop: 3, lineHeight: 1.4 },
  totaisBox: { marginTop: 10, alignItems: "flex-end" },
  totalLinha: { flexDirection: "row", justifyContent: "space-between", width: 200, marginBottom: 2 },
  totalLabel: { fontSize: 8.5, color: CINZA_SECUNDARIO },
  totalValor: { fontSize: 8.5, color: CINZA_TEXTO, fontWeight: 700 },
  totalGeralLinha: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 200,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: AZUL_MARCA,
  },
  totalGeralLabel: { fontSize: 10, fontWeight: 700, color: AZUL_MARCA },
  totalGeralValor: { fontSize: 11, fontWeight: 700, color: AZUL_MARCA },
  condicoesBox: {
    borderWidth: 1,
    borderColor: CINZA_BORDA,
    borderRadius: 4,
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  condicaoCampo: { width: "50%", marginBottom: 6 },
  assinaturaBox: { marginTop: 26, alignItems: "center" },
  assinaturaLinha: { width: 220, borderTopWidth: 1, borderTopColor: CINZA_TEXTO, marginBottom: 4 },
  assinaturaNome: { fontSize: 9, fontWeight: 700, color: CINZA_TEXTO },
  agradecimento: { marginTop: 16, fontSize: 8.5, color: CINZA_SECUNDARIO, textAlign: "center" },
});

function celulaTabela(estilo: StyleProp, texto: string | number) {
  return <Text style={estilo}>{String(texto)}</Text>;
}

export default function OrcamentoPdfDocument({
  orcamento,
  itens,
  cliente,
  empresa,
  logoSrc,
}: {
  orcamento: Orcamento;
  itens: OrcamentoItem[];
  cliente: ClienteOrcamento | null;
  empresa: EmpresaConfig;
  logoSrc?: string;
}) {
  const dataValidade = calcularDataValidade(orcamento.dataEmissao, orcamento.validadeDias);

  return (
    <Document title={`Orçamento ${orcamento.numero}`}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          {logoSrc ? (
            <Image src={logoSrc} style={styles.logo} />
          ) : (
            <Text style={styles.empresaNome}>EKSTEEL</Text>
          )}
          <View style={styles.empresaInfo}>
            <Text style={styles.empresaNome}>{empresa.razaoSocial}</Text>
            {orcamento.cnpjEmissor && (
              <Text style={styles.empresaLinha}>
                {orcamento.cnpjEmissorLabel} — CNPJ: {orcamento.cnpjEmissor}
              </Text>
            )}
            {empresa.endereco && <Text style={styles.empresaLinha}>{empresa.endereco}</Text>}
            {(empresa.telefone || empresa.email) && (
              <Text style={styles.empresaLinha}>{[empresa.telefone, empresa.email].filter(Boolean).join(" · ")}</Text>
            )}
            {empresa.site && <Text style={styles.empresaLinha}>{empresa.site}</Text>}
          </View>
        </View>

        <View style={styles.tituloBloco} fixed>
          <Text style={styles.tituloOrcamento}>ORÇAMENTO {orcamento.numero}</Text>
          <View>
            <Text style={styles.tituloMeta}>Emissão: {formatarData(orcamento.dataEmissao)}</Text>
            <Text style={styles.tituloMeta}>Validade: {formatarData(dataValidade)} ({orcamento.validadeDias} dias)</Text>
          </View>
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Cliente</Text>
          <View style={styles.clienteBox}>
            <View style={styles.clienteCampo}>
              <Text style={styles.clienteLabel}>Nome / Razão social</Text>
              <Text style={styles.clienteValor}>{cliente?.nome || "-"}</Text>
            </View>
            <View style={styles.clienteCampo}>
              <Text style={styles.clienteLabel}>CNPJ/CPF</Text>
              <Text style={styles.clienteValor}>{cliente?.cnpjCpf || "-"}</Text>
            </View>
            <View style={styles.clienteCampo}>
              <Text style={styles.clienteLabel}>Telefone</Text>
              <Text style={styles.clienteValor}>{cliente?.telefone || "-"}</Text>
            </View>
            <View style={styles.clienteCampo}>
              <Text style={styles.clienteLabel}>E-mail</Text>
              <Text style={styles.clienteValor}>{cliente?.email || "-"}</Text>
            </View>
            <View style={{ width: "100%" }}>
              <Text style={styles.clienteLabel}>Endereço</Text>
              <Text style={styles.clienteValor}>
                {[cliente?.endereco, cliente?.cidade, cliente?.uf].filter(Boolean).join(", ") || "-"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoTitulo}>Itens do orçamento</Text>
          <View style={styles.tabela}>
            <View style={styles.tabelaHeader}>
              {celulaTabela([styles.tabelaHeaderTexto, styles.colItem], "Item")}
              {celulaTabela([styles.tabelaHeaderTexto, styles.colDescricao], "Descrição")}
              {celulaTabela([styles.tabelaHeaderTexto, styles.colUnid], "Unid.")}
              {celulaTabela([styles.tabelaHeaderTexto, styles.colQtd], "Qtd.")}
              {celulaTabela([styles.tabelaHeaderTexto, styles.colValorUnit], "Valor unit.")}
              {celulaTabela([styles.tabelaHeaderTexto, styles.colValorTotal], "Valor total")}
            </View>
            {itens.map((item, idx) => (
              <View
                key={item.id}
                style={idx % 2 === 1 ? [styles.tabelaLinha, styles.tabelaLinhaAlt] : styles.tabelaLinha}
                wrap={false}
              >
                {celulaTabela([{ fontSize: 8 }, styles.colItem], idx + 1)}
                <View style={styles.colDescricao}>
                  <Text style={{ fontSize: 8, fontWeight: 700 }}>{item.descricao}</Text>
                  {item.tipoItem === "servico" && item.detalhamentoTecnico ? (
                    <Text style={styles.detalhamento}>{item.detalhamentoTecnico}</Text>
                  ) : null}
                </View>
                {celulaTabela([{ fontSize: 8 }, styles.colUnid], item.unidade || "-")}
                {celulaTabela([{ fontSize: 8 }, styles.colQtd], item.quantidade)}
                {celulaTabela([{ fontSize: 8 }, styles.colValorUnit], formatarMoeda(item.valorUnitario))}
                {celulaTabela([{ fontSize: 8, fontWeight: 700 }, styles.colValorTotal], formatarMoeda(item.valorTotal))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.totaisBox}>
          <View style={styles.totalLinha}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValor}>{formatarMoeda(orcamento.subtotal)}</Text>
          </View>
          <View style={styles.totalLinha}>
            <Text style={styles.totalLabel}>Desconto</Text>
            <Text style={styles.totalValor}>- {formatarMoeda(orcamento.desconto)}</Text>
          </View>
          <View style={styles.totalGeralLinha}>
            <Text style={styles.totalGeralLabel}>Total geral</Text>
            <Text style={styles.totalGeralValor}>{formatarMoeda(orcamento.total)}</Text>
          </View>
        </View>

        <View style={styles.secao} wrap={false}>
          <Text style={styles.secaoTitulo}>Condições comerciais</Text>
          <View style={styles.condicoesBox}>
            <View style={styles.condicaoCampo}>
              <Text style={styles.clienteLabel}>Forma de pagamento</Text>
              <Text style={styles.clienteValor}>{orcamento.condicoesPagamento || "A combinar"}</Text>
            </View>
            <View style={styles.condicaoCampo}>
              <Text style={styles.clienteLabel}>Prazo de entrega/execução</Text>
              <Text style={styles.clienteValor}>{orcamento.prazoEntrega || "A combinar"}</Text>
            </View>
            <View style={styles.condicaoCampo}>
              <Text style={styles.clienteLabel}>Validade da proposta</Text>
              <Text style={styles.clienteValor}>{orcamento.validadeDias} dias (até {formatarData(dataValidade)})</Text>
            </View>
            {orcamento.observacoes ? (
              <View style={{ width: "100%" }}>
                <Text style={styles.clienteLabel}>Observações</Text>
                <Text style={styles.clienteValor}>{orcamento.observacoes}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.assinaturaBox} wrap={false}>
          <View style={styles.assinaturaLinha} />
          <Text style={styles.assinaturaNome}>{orcamento.responsavelTecnico || empresa.razaoSocial}</Text>
          <Text style={styles.agradecimento}>
            Agradecemos a oportunidade e ficamos à disposição para quaisquer esclarecimentos.
          </Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerTexto}>
            {empresa.telefone} · {empresa.email}
          </Text>
          <Text
            style={styles.footerTexto}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
