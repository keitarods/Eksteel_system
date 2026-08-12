"use client";

// Primitivas visuais pequenas, reaproveitadas só dentro do módulo de Orçamentos.
// Replicam o tom visual do resto do app (dark, cantos arredondados, acento #546E7A)
// sem importar nada de dashboard-tabs.tsx — o módulo fica isolado por design.

export function Campo({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-2xl border border-[#333333] bg-[#141414] px-4 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
      />
    </div>
  );
}

export function CampoTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-[#333333] bg-[#141414] px-4 py-3 text-sm text-[#ECEFF1] outline-none placeholder:text-[#546E7A] focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
      />
    </div>
  );
}

export function SelectCampo({
  label,
  value,
  onChange,
  options,
  placeholder = "Selecione...",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { valor: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-2xl border border-[#333333] bg-[#141414] px-4 text-sm text-[#ECEFF1] outline-none focus:border-[#546E7A] focus:ring-2 focus:ring-[#37474F]"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.valor} value={o.valor}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">{children}</th>;
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

export function Cartao({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-[#333333] bg-[#212121] p-4 shadow-sm sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function Botao({
  children,
  onClick,
  type = "button",
  variante = "primario",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variante?: "primario" | "secundario" | "perigo";
  disabled?: boolean;
  className?: string;
}) {
  const base = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition disabled:opacity-60";
  const estilos = {
    primario: "bg-[#546E7A] text-white hover:bg-[#455A64]",
    secundario: "border border-[#333333] bg-[#212121] text-[#90A4AE] hover:bg-[#2a2a2a]",
    perigo: "border border-red-900/50 bg-red-900/10 text-red-400 hover:bg-red-900/30",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${estilos[variante]} ${className}`}>
      {children}
    </button>
  );
}

export function FeedbackBloco({ mensagem, erro }: { mensagem?: string; erro?: string }) {
  if (!mensagem && !erro) return null;
  return (
    <div
      className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
        erro
          ? "border-red-900/50 bg-red-900/10 text-red-400"
          : "border-emerald-900/50 bg-emerald-900/10 text-emerald-400"
      }`}
    >
      {erro || mensagem}
    </div>
  );
}
