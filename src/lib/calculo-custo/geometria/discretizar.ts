import type { IArcEntity, ICircleEntity, IEntity, ILineEntity, ILwpolylineEntity, IPolylineEntity, ISplineEntity } from "dxf-parser";
import type { Ponto } from "../types";

// Resolução de amostragem de arcos/círculos — ~5°, suficiente pra estimar
// área/perímetro com boa precisão sem gerar pontos demais.
const PASSO_ANGULO = Math.PI / 36;

function amostrarArco(cx: number, cy: number, raio: number, anguloInicial: number, varredura: number): Ponto[] {
  const passos = Math.max(2, Math.ceil(Math.abs(varredura) / PASSO_ANGULO));
  const pontos: Ponto[] = [];
  for (let i = 0; i <= passos; i++) {
    const angulo = anguloInicial + (varredura * i) / passos;
    pontos.push({ x: cx + raio * Math.cos(angulo), y: cy + raio * Math.sin(angulo) });
  }
  return pontos;
}

// Converte um segmento de LWPOLYLINE com bulge (arco entre dois vértices) em
// centro/raio/ângulo. Fórmula de referência: bulge = tan(Δ/4), onde Δ é o ângulo
// incluso (sinal = sentido: positivo = anti-horário). Fonte: Lee Mac Programming
// (referência amplamente usada na comunidade AutoLISP/DXF para essa conversão).
function bulgeParaArco(p1: Ponto, p2: Ponto, bulge: number) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const d = Math.hypot(dx, dy);
  if (d === 0 || bulge === 0) return null;

  const r = (d * (1 + bulge * bulge)) / (4 * bulge); // raio com sinal
  const anguloP1P2 = Math.atan2(dy, dx);
  const anguloCentro = anguloP1P2 + (Math.PI / 2 - 2 * Math.atan(bulge));
  const cx = p1.x + r * Math.cos(anguloCentro);
  const cy = p1.y + r * Math.sin(anguloCentro);

  return {
    cx,
    cy,
    raio: Math.abs(r),
    anguloInicial: Math.atan2(p1.y - cy, p1.x - cx),
    varredura: 4 * Math.atan(bulge),
  };
}

// Compartilhado entre LWPOLYLINE (vértices num único grupo) e POLYLINE (formato
// antigo, com sub-entidades VERTEX) — as duas têm a mesma semântica de bulge.
function discretizarVertices(vertices: { x: number; y: number; bulge?: number }[], fechado: boolean): Ponto[] {
  if (vertices.length < 2) return [];
  const totalSegmentos = fechado ? vertices.length : vertices.length - 1;

  const pontos: Ponto[] = [];
  for (let i = 0; i < totalSegmentos; i++) {
    const atual = vertices[i];
    const proximo = vertices[(i + 1) % vertices.length];
    pontos.push({ x: atual.x, y: atual.y });
    const bulge = atual.bulge || 0;
    if (bulge !== 0) {
      const arco = bulgeParaArco({ x: atual.x, y: atual.y }, { x: proximo.x, y: proximo.y }, bulge);
      if (arco) {
        const intermediarios = amostrarArco(arco.cx, arco.cy, arco.raio, arco.anguloInicial, arco.varredura);
        pontos.push(...intermediarios.slice(1, -1));
      }
    }
  }
  if (fechado) pontos.push({ ...pontos[0] });
  return pontos;
}

// Decompõe uma entidade DXF numa (ou mais) polylines de pontos 2D. Suporte:
// LINE, ARC, CIRCLE, LWPOLYLINE e POLYLINE (formato antigo, com VERTEX
// separados — ainda comum em exports de CAD reais), ambas respeitando bulge.
// SPLINE é aproximada pelos fitPoints (se existirem, ficam exatamente sobre a
// curva) ou controlPoints como fallback grosseiro — sem avaliação NURBS
// completa por enquanto; testar com arquivo real antes de confiar em peças
// com curvas livres complexas.
export function discretizarEntidade(entidade: IEntity): Ponto[][] {
  switch (entidade.type) {
    case "LINE": {
      const e = entidade as unknown as ILineEntity;
      if (e.vertices.length < 2) return [];
      return [[{ x: e.vertices[0].x, y: e.vertices[0].y }, { x: e.vertices[1].x, y: e.vertices[1].y }]];
    }

    case "ARC": {
      const e = entidade as unknown as IArcEntity;
      let varredura = e.endAngle - e.startAngle;
      if (varredura <= 0) varredura += 2 * Math.PI; // DXF: arco sempre anti-horário de start pra end
      return [amostrarArco(e.center.x, e.center.y, e.radius, e.startAngle, varredura)];
    }

    case "CIRCLE": {
      const e = entidade as unknown as ICircleEntity;
      const inicio = e.startAngle ?? 0;
      const fim = e.endAngle ?? inicio + 2 * Math.PI;
      let varredura = fim - inicio;
      if (varredura <= 0) varredura += 2 * Math.PI;
      return [amostrarArco(e.center.x, e.center.y, e.radius, inicio, varredura)];
    }

    case "LWPOLYLINE": {
      // "shape" é como o dxf-parser expõe o bit "fechado" (código 70) do LWPOLYLINE.
      const e = entidade as unknown as ILwpolylineEntity;
      return [discretizarVertices(e.vertices, e.shape)];
    }

    case "POLYLINE": {
      // Formato antigo de polilinha (vértices como sub-entidades VERTEX em vez de
      // embutidos na própria entidade) — ainda comum em DXFs exportados de CAD
      // real. Ignora polylines 3D/malha (is3dPolyline/is3dPolygonMesh): não fazem
      // sentido num desenho de corte 2D.
      const e = entidade as unknown as IPolylineEntity;
      if (e.is3dPolyline || e.is3dPolygonMesh || e.isPolyfaceMesh) return [];
      return [discretizarVertices(e.vertices, e.shape)];
    }

    case "SPLINE": {
      const e = entidade as unknown as ISplineEntity;
      const base = e.fitPoints && e.fitPoints.length > 0 ? e.fitPoints : (e.controlPoints ?? []);
      if (base.length < 2) return [];
      const pontos = base.map((p) => ({ x: p.x, y: p.y }));
      if (e.closed) pontos.push({ ...pontos[0] });
      return [pontos];
    }

    default:
      return [];
  }
}
