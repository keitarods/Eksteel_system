import type { Contorno, Ponto } from "../types";

const TOLERANCIA_MM = 1e-6;

function pontosIguais(a: Ponto, b: Ponto, tolerancia = TOLERANCIA_MM) {
  return Math.abs(a.x - b.x) < tolerancia && Math.abs(a.y - b.y) < tolerancia;
}

// Recebe as polylines de cada entidade (algumas já fechadas — LWPOLYLINE/CIRCLE —
// outras abertas — LINE/ARC soltos) e costura as abertas pelas pontas até formar
// contornos fechados. Necessário porque uma peça real geralmente é desenhada como
// vários segmentos separados que só formam um contorno fechado quando unidos.
export function encadearContornos(polylines: Ponto[][]): Contorno[] {
  const resultado: Contorno[] = [];
  const abertos: Ponto[][] = [];

  for (const pl of polylines) {
    if (pl.length < 2) continue;
    if (pontosIguais(pl[0], pl[pl.length - 1])) {
      resultado.push({ pontos: pl, fechado: true });
    } else {
      abertos.push(pl);
    }
  }

  while (abertos.length > 0) {
    let atual = abertos.shift()!;
    let progrediu = true;
    while (!pontosIguais(atual[0], atual[atual.length - 1]) && progrediu) {
      progrediu = false;
      for (let i = 0; i < abertos.length; i++) {
        const candidato = abertos[i];
        const ponta = atual[atual.length - 1];
        if (pontosIguais(ponta, candidato[0])) {
          atual = atual.concat(candidato.slice(1));
          abertos.splice(i, 1);
          progrediu = true;
          break;
        }
        if (pontosIguais(ponta, candidato[candidato.length - 1])) {
          atual = atual.concat(candidato.slice(0, -1).reverse());
          abertos.splice(i, 1);
          progrediu = true;
          break;
        }
      }
    }
    resultado.push({ pontos: atual, fechado: pontosIguais(atual[0], atual[atual.length - 1]) });
  }

  return resultado;
}
