// Script de validação do Fase 0 — roda com `npx tsx scripts/testar-geometria-dxf.ts`.
// Não faz parte do app; só prova que a extração de área/perímetro (inclusive com
// furo subtraído) bate com o cálculo manual antes de construir qualquer UI em cima.
import { readFileSync } from "node:fs";
import path from "node:path";
import { calcularGeometriaDxf } from "../src/lib/calculo-custo/geometria";

const casos = [
  {
    arquivo: "retangulo-simples.dxf",
    descricao: "Retângulo 100×50mm (4 LINEs)",
    esperado: { areaMm2: 5000, perimetroMm: 300, furos: 0 },
  },
  {
    arquivo: "retangulo-com-furo.dxf",
    descricao: "Retângulo 100×50mm (LWPOLYLINE fechada) com furo circular raio 10mm",
    esperado: { areaMm2: 5000 - Math.PI * 10 ** 2, perimetroMm: 300 + 2 * Math.PI * 10, furos: 1 },
  },
  {
    arquivo: "circulo-via-bulge.dxf",
    descricao: "Círculo raio 10mm construído com 2 vértices + bulge (valida a fórmula de bulge)",
    esperado: { areaMm2: Math.PI * 10 ** 2, perimetroMm: 2 * Math.PI * 10, furos: 0 },
  },
  {
    arquivo: "retangulo-polyline-antigo.dxf",
    descricao: "Retângulo 100×50mm via POLYLINE antigo (VERTEX/SEQEND) — regressão do bug real encontrado",
    esperado: { areaMm2: 5000, perimetroMm: 300, furos: 0 },
  },
  {
    arquivo: "circulo-bulge-negativo-polyline.dxf",
    descricao: "Círculo raio 10mm via POLYLINE antigo com bulge NEGATIVO (sentido horário)",
    esperado: { areaMm2: Math.PI * 10 ** 2, perimetroMm: 2 * Math.PI * 10, furos: 0 },
  },
];

let algumFalhou = false;

for (const caso of casos) {
  const conteudo = readFileSync(path.join(__dirname, "fixtures", caso.arquivo), "utf-8");
  const resultado = calcularGeometriaDxf(conteudo);

  const erroArea = Math.abs(resultado.areaMm2 - caso.esperado.areaMm2);
  const erroPerimetro = Math.abs(resultado.perimetroMm - caso.esperado.perimetroMm);
  const toleranciaArea = caso.esperado.areaMm2 * 0.01; // 1% (amostragem de arco não é exata)
  const toleranciaPerimetro = caso.esperado.perimetroMm * 0.01;
  const passou =
    erroArea <= toleranciaArea &&
    erroPerimetro <= toleranciaPerimetro &&
    resultado.furos === caso.esperado.furos;

  console.log(`\n${passou ? "✅" : "❌"} ${caso.descricao}`);
  console.log(
    `   área:      calculado=${resultado.areaMm2.toFixed(3)}mm²   esperado=${caso.esperado.areaMm2.toFixed(3)}mm²   erro=${erroArea.toFixed(4)}`
  );
  console.log(
    `   perímetro: calculado=${resultado.perimetroMm.toFixed(3)}mm   esperado=${caso.esperado.perimetroMm.toFixed(3)}mm   erro=${erroPerimetro.toFixed(4)}`
  );
  console.log(`   furos:     calculado=${resultado.furos}   esperado=${caso.esperado.furos}`);
  console.log(`   bbox:      ${resultado.bbox.larguraMm.toFixed(2)}mm × ${resultado.bbox.alturaMm.toFixed(2)}mm`);

  if (!passou) algumFalhou = true;
}

console.log(algumFalhou ? "\nAlgum caso falhou.\n" : "\nTodos os casos bateram com o cálculo manual.\n");
process.exit(algumFalhou ? 1 : 0);
