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
      <div className="mb-5 flex w-fit gap-2 rounded-2xl border border-[#333333] bg-[#181818] p-1.5">
        <button
          type="button"
          onClick={() => setAba("calculadora")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            aba === "calculadora" ? "bg-[#546E7A] text-white" : "text-[#90A4AE] hover:bg-[#2a2a2a]"
          }`}
        >
          Calculadora
        </button>
        <button
          type="button"
          onClick={() => setAba("parametros")}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            aba === "parametros" ? "bg-[#546E7A] text-white" : "text-[#90A4AE] hover:bg-[#2a2a2a]"
          }`}
        >
          Parâmetros
        </button>
      </div>
      {aba === "calculadora" ? abaCalculadora : abaParametros}
    </div>
  );
}
