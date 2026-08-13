import type { Contorno, Ponto, ResultadoGeometria } from "../types";

// Fórmula de Shoelace — retorna área com sinal (positivo = sentido anti-horário).
function areaComSinal(pontos: Ponto[]): number {
  let soma = 0;
  for (let i = 0; i < pontos.length - 1; i++) {
    soma += pontos[i].x * pontos[i + 1].y - pontos[i + 1].x * pontos[i].y;
  }
  return soma / 2;
}

function comprimento(pontos: Ponto[]): number {
  let total = 0;
  for (let i = 0; i < pontos.length - 1; i++) {
    total += Math.hypot(pontos[i + 1].x - pontos[i].x, pontos[i + 1].y - pontos[i].y);
  }
  return total;
}

// Ray casting — testa se um ponto está dentro de um polígono fechado.
function pontoDentroDoPoligono(ponto: Ponto, pontos: Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = pontos.length - 2; i < pontos.length - 1; j = i++) {
    const pi = pontos[i];
    const pj = pontos[j];
    const intersecta =
      pi.y > ponto.y !== pj.y > ponto.y &&
      ponto.x < ((pj.x - pi.x) * (ponto.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersecta) dentro = !dentro;
  }
  return dentro;
}

// Área líquida (contorno externo menos furos) e perímetro total (externo + furos,
// já que o laser corta os dois). Assume um nível de aninhamento (furos dentro do
// contorno externo maior) — cobre o caso comum de peças de chapa; não trata
// "ilha dentro de furo dentro de peça" (raro nesse contexto). Não inclui
// dobrasDetectadas — isso é adicionado por calcularGeometriaDxf, que é quem tem
// acesso às entidades brutas (camadas) usadas pra sugerir o número de dobras.
export function calcularAreaEPerimetro(contornos: Contorno[]): Omit<ResultadoGeometria, "dobrasDetectadas"> {
  const fechados = contornos.filter((c) => c.fechado && c.pontos.length >= 4);

  const comArea = fechados
    .map((c) => ({ contorno: c, area: areaComSinal(c.pontos) }))
    .sort((a, b) => Math.abs(b.area) - Math.abs(a.area));

  let areaTotal = 0;
  let perimetroTotal = 0;
  let furos = 0;

  comArea.forEach(({ contorno, area }, indice) => {
    perimetroTotal += comprimento(contorno.pontos);
    if (indice === 0) {
      areaTotal += Math.abs(area);
      return;
    }
    const externo = comArea[0].contorno.pontos;
    if (pontoDentroDoPoligono(contorno.pontos[0], externo)) {
      areaTotal -= Math.abs(area);
      furos += 1;
    } else {
      areaTotal += Math.abs(area);
    }
  });

  const todosPontos = fechados.flatMap((c) => c.pontos);
  const xs = todosPontos.map((p) => p.x);
  const ys = todosPontos.map((p) => p.y);
  const bbox = {
    larguraMm: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    alturaMm: ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
  };

  return { areaMm2: areaTotal, perimetroMm: perimetroTotal, bbox, contornos: fechados, furos };
}
