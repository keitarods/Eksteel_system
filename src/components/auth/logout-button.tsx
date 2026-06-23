"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type LogoutButtonProps = {
  className?: string;
  label?: string;
};

export default function LogoutButton({
  className,
  label = "Sair",
}: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    localStorage.removeItem("eksteel_email_login");
    localStorage.setItem("eksteel_manter_conectado", "false");

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={
        className ??
        "inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[#90caf9] bg-white px-4 text-sm font-semibold text-[#1565c0] transition hover:bg-[#e3f0ff] disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <LogOut className="h-4 w-4" />
      {loading ? "Saindo..." : label}
    </button>
  );
}
