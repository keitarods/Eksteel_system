"use client";

// Hooks de edição client-side reutilizados por cada aba de Parâmetros dos
// módulos da calculadora — encapsulam o padrão "insert-only versionado por
// vigente_desde" (nunca UPDATE) que parametros_custo, velocidades_corte e
// tempos_solda_padrao seguem, sem repetir a lógica de diff/insert em cada
// formulário.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Parametro, TempoSoldaPadrao, VelocidadeCorte } from "./parametros";

function parseNumero(valor: string) {
  const n = Number(valor.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export function useParametrosCustoEditor(usuarioId: string, iniciais: Record<string, Parametro>) {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(iniciais).map(([chave, p]) => [chave, String(p.valor)]))
  );

  function setValor(chave: string, valor: string) {
    setValores((prev) => ({ ...prev, [chave]: valor }));
  }

  async function salvar(): Promise<string | null> {
    const alterados = Object.entries(valores).filter(([chave, valor]) => {
      const original = iniciais[chave];
      return !original || parseNumero(valor) !== original.valor;
    });
    if (alterados.length === 0) return null;

    const supabase = createClient();
    const { error } = await supabase.from("parametros_custo").insert(
      alterados.map(([chave, valor]) => ({
        criado_por: usuarioId,
        chave,
        valor: parseNumero(valor),
        unidade: iniciais[chave]?.unidade ?? "",
        descricao: iniciais[chave]?.descricao ?? "",
        vigente_desde: hoje(),
      }))
    );
    return error ? error.message : null;
  }

  return { valores, setValor, salvar };
}

export function useVelocidadesEditor(usuarioId: string, iniciais: VelocidadeCorte[]) {
  const chaveDe = (v: { processo: string; material: string; espessuraMm: number; potenciaKw: number }) =>
    `${v.processo}|${v.material}|${v.espessuraMm}|${v.potenciaKw}`;

  const [velocidades, setVelocidades] = useState<Record<string, string>>(
    Object.fromEntries(iniciais.map((v) => [chaveDe(v), String(v.velocidadeMMin)]))
  );

  function setVelocidade(chave: string, valor: string) {
    setVelocidades((prev) => ({ ...prev, [chave]: valor }));
  }

  async function salvar(): Promise<string | null> {
    const originais = Object.fromEntries(iniciais.map((v) => [chaveDe(v), v.velocidadeMMin]));
    const alterados = Object.entries(velocidades).filter(([chave, valor]) => {
      const original = originais[chave];
      return original === undefined || parseNumero(valor) !== original;
    });
    if (alterados.length === 0) return null;

    const supabase = createClient();
    const { error } = await supabase.from("velocidades_corte").insert(
      alterados.map(([chave, valor]) => {
        const [processo, material, espessuraMm, potenciaKw] = chave.split("|");
        return {
          criado_por: usuarioId,
          processo,
          material,
          espessura_mm: Number(espessuraMm),
          potencia_kw: Number(potenciaKw),
          velocidade_m_min: parseNumero(valor),
          vigente_desde: hoje(),
        };
      })
    );
    return error ? error.message : null;
  }

  return { velocidades, setVelocidade, salvar };
}

export function useTemposSoldaEditor(usuarioId: string, iniciais: TempoSoldaPadrao[]) {
  const chaveDe = (t: { tipoJunta: string; espessuraMm: number }) => `${t.tipoJunta}|${t.espessuraMm}`;

  const [tempos, setTempos] = useState<Record<string, string>>(
    Object.fromEntries(iniciais.map((t) => [chaveDe(t), String(t.tempoMinPorMetro)]))
  );

  function setTempo(chave: string, valor: string) {
    setTempos((prev) => ({ ...prev, [chave]: valor }));
  }

  async function salvar(): Promise<string | null> {
    const originais = Object.fromEntries(iniciais.map((t) => [chaveDe(t), t.tempoMinPorMetro]));
    const alterados = Object.entries(tempos).filter(([chave, valor]) => {
      const original = originais[chave];
      return original === undefined || parseNumero(valor) !== original;
    });
    if (alterados.length === 0) return null;

    const supabase = createClient();
    const { error } = await supabase.from("tempos_solda_padrao").insert(
      alterados.map(([chave, valor]) => {
        const [tipoJunta, espessuraMm] = chave.split("|");
        return {
          criado_por: usuarioId,
          tipo_junta: tipoJunta,
          espessura_mm: Number(espessuraMm),
          tempo_min_por_metro: parseNumero(valor),
          vigente_desde: hoje(),
        };
      })
    );
    return error ? error.message : null;
  }

  return { tempos, setTempo, salvar };
}
