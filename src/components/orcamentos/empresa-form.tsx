"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { salvarEmpresaConfig, type EmpresaConfig } from "@/lib/orcamentos/empresa";
import { Botao, Campo, Cartao, FeedbackBloco } from "./ui";

export default function EmpresaForm({
  usuarioId,
  empresaInicial,
}: {
  usuarioId: string;
  empresaInicial: EmpresaConfig;
}) {
  const [id, setId] = useState(empresaInicial.id);
  const [razaoSocial, setRazaoSocial] = useState(empresaInicial.razaoSocial);
  const [endereco, setEndereco] = useState(empresaInicial.endereco);
  const [telefone, setTelefone] = useState(empresaInicial.telefone);
  const [email, setEmail] = useState(empresaInicial.email);
  const [site, setSite] = useState(empresaInicial.site);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!razaoSocial.trim()) { setErro("Informe a razão social."); return; }
    setSalvando(true);
    setMensagem("");
    setErro("");
    const supabase = createClient();
    const { error } = await salvarEmpresaConfig(supabase, usuarioId, id, {
      razaoSocial, endereco, telefone, email, site,
    });
    setSalvando(false);
    if (error) { setErro(error); return; }

    if (!id) {
      const { data } = await supabase.from("empresa_config").select("id").order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
      if (data?.id) setId(data.id);
    }
    setMensagem("Dados da empresa atualizados.");
  }

  return (
    <form onSubmit={handleSalvar}>
      <Cartao>
        <FeedbackBloco mensagem={mensagem} erro={erro} />
        <div className="mt-1 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Campo label="Razão social" value={razaoSocial} onChange={setRazaoSocial} required />
          </div>
          <Campo label="Telefone" value={telefone} onChange={setTelefone} placeholder="(00) 00000-0000" />
          <Campo label="E-mail" value={email} onChange={setEmail} placeholder="contato@eksteelsolucoes.com.br" />
          <div className="sm:col-span-2">
            <Campo label="Endereço" value={endereco} onChange={setEndereco} placeholder="Rua, número — Cidade/UF" />
          </div>
          <Campo label="Site" value={site} onChange={setSite} placeholder="gestao.eksteelsolucoes.com.br" />
        </div>
        <p className="mt-4 text-xs text-[#78909C]">
          Esses dados aparecem no cabeçalho e rodapé do PDF de orçamento e na página pública de visualização.
          O CNPJ agora fica na lista logo abaixo — cada orçamento escolhe qual usar.
        </p>
        <div className="mt-4">
          <Botao type="submit" disabled={salvando}>
            <Save className="h-4 w-4" />
            {salvando ? "Salvando..." : "Salvar dados da empresa"}
          </Botao>
        </div>
      </Cartao>
    </form>
  );
}
