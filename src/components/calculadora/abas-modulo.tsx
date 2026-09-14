"use client";

import { useState } from "react";

export default function AbasModulo({
  abaCalculadora,
  abaParametros,
}: {
  abaCalculadora: React.ReactNode;
  abaParametros: React.ReactNode;
}) {
  const [aba, setAba] = useState<"calculadora" | "parametros">("calculadora");

  return (
    <div>
      <div className="mb-5 flex w-fit gap-2 rounded-lg border border-line bg-surface p-1.5">
        <button
          type="button"
          onClick={() => setAba("calculadora")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            aba === "calculadora" ? "bg-accent text-background" : "text-steel hover:bg-panel-hover"
          }`}
        >
          Calculadora
        </button>
        <button
          type="button"
          onClick={() => setAba("parametros")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            aba === "parametros" ? "bg-accent text-background" : "text-steel hover:bg-panel-hover"
          }`}
        >
          Parâmetros
        </button>
      </div>
      {aba === "calculadora" ? abaCalculadora : abaParametros}
    </div>
  );
}
