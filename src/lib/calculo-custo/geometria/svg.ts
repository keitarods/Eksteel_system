import type { Contorno } from "../types";

// Gera um <svg> autocontido a partir dos contornos (coordenadas em mm), pra
// preview do DXF na tela sem precisar guardar/re-renderizar o arquivo original.
export function contornosParaSvg(contornos: Contorno[], opcoes?: { larguraPx?: number; corTraco?: string }): string {
  const larguraPx = opcoes?.larguraPx ?? 400;
  const corTraco = opcoes?.corTraco ?? "#546E7A";

  const todosPontos = contornos.flatMap((c) => c.pontos);
  if (todosPontos.length === 0) {
    return `<svg viewBox="0 0 ${larguraPx} 120" width="${larguraPx}" height="120" xmlns="http://www.w3.org/2000/svg"></svg>`;
  }

  const xs = todosPontos.map((p) => p.x);
  const ys = todosPontos.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const largura = maxX - minX || 1;
  const altura = maxY - minY || 1;
  const margem = Math.max(largura, altura) * 0.08;

  const alturaPx = larguraPx * ((altura + margem * 2) / (largura + margem * 2));
  const espessuraTraco = ((largura + margem * 2) / larguraPx) * 1.5;

  // SVG cresce Y pra baixo; DXF cresce Y pra cima — inverte no path.
  const paths = contornos
    .map((c) => {
      const d = c.pontos
        .map(
          (p, i) =>
            `${i === 0 ? "M" : "L"}${(p.x - minX + margem).toFixed(3)},${(maxY - p.y + margem).toFixed(3)}`
        )
        .join(" ");
      return `<path d="${d}" fill="none" stroke="${corTraco}" stroke-width="${espessuraTraco.toFixed(4)}" stroke-linejoin="round" />`;
    })
    .join("");

  return `<svg viewBox="0 0 ${(largura + margem * 2).toFixed(3)} ${(altura + margem * 2).toFixed(3)}" width="${larguraPx}" height="${alturaPx.toFixed(0)}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
}
