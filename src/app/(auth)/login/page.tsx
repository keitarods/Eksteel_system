"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AbaAuth = "login" | "cadastro" | "recuperar";

const REGEX_SENHA_FORTE = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$/;
const MAX_TENTATIVAS_LOGIN = 5;
const TEMPO_BLOQUEIO_MS = 5 * 60 * 1000;

function normalizarEmail(email: string) {
  return email.trim().toLowerCase();
}

function temSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function gerarChaveTentativas(email: string) {
  return `eksteel_login_tentativas_${normalizarEmail(email)}`;
}

function gerarChaveBloqueio(email: string) {
  return `eksteel_login_bloqueio_${normalizarEmail(email)}`;
}

function obterTempoRestanteBloqueio(email: string) {
  if (typeof window === "undefined") return 0;

  const bloqueadoAte = Number(
    localStorage.getItem(gerarChaveBloqueio(email)) || 0
  );
  const restante = bloqueadoAte - Date.now();

  return restante > 0 ? restante : 0;
}

function formatarTempoBloqueio(ms: number) {
  const totalSegundos = Math.ceil(ms / 1000);
  const minutos = Math.floor(totalSegundos / 60);
  const segundos = totalSegundos % 60;

  if (minutos <= 0) {
    return `${segundos}s`;
  }

  return `${minutos}min ${String(segundos).padStart(2, "0")}s`;
}

function registrarTentativaErrada(email: string) {
  if (typeof window === "undefined") return 0;

  const chaveTentativas = gerarChaveTentativas(email);
  const tentativasAtuais = Number(localStorage.getItem(chaveTentativas) || 0);
  const novasTentativas = tentativasAtuais + 1;

  localStorage.setItem(chaveTentativas, String(novasTentativas));

  if (novasTentativas >= MAX_TENTATIVAS_LOGIN) {
    localStorage.setItem(
      gerarChaveBloqueio(email),
      String(Date.now() + TEMPO_BLOQUEIO_MS)
    );
    localStorage.setItem(chaveTentativas, "0");
  }

  return novasTentativas;
}

function limparTentativasLogin(email: string) {
  if (typeof window === "undefined") return;

  localStorage.removeItem(gerarChaveTentativas(email));
  localStorage.removeItem(gerarChaveBloqueio(email));
}

function formatarErroRecuperacao(error: Error) {
  const mensagem = error.message.toLowerCase();

  const matchSegundos = error.message.match(/after\s+(\d+)\s+seconds?/i);
  if (matchSegundos) {
    const segundos = parseInt(matchSegundos[1], 10);
    const minutos = Math.floor(segundos / 60);
    const resto = segundos % 60;
    const tempo =
      minutos > 0
        ? `${minutos} min${resto > 0 ? ` e ${resto} seg` : ""}`
        : `${segundos} segundos`;
    return `Por segurança, aguarde ${tempo} antes de solicitar um novo link.`;
  }

  if (
    mensagem.includes("security purposes") ||
    mensagem.includes("rate limit") ||
    mensagem.includes("too many") ||
    mensagem.includes("over_email_send_rate_limit")
  ) {
    return "Muitas solicitações em pouco tempo. Aguarde alguns minutos antes de tentar novamente.";
  }

  if (mensagem.includes("smtp") || mensagem.includes("email")) {
    return "Não foi possível enviar o e-mail agora. Tente novamente em alguns instantes.";
  }

  return error.message;
}

function formatarErroCadastro(error: Error & { status?: number; code?: string }) {
  const mensagem = (error.message ?? "").toLowerCase();

  if (mensagem.includes("user already registered") || mensagem.includes("already registered")) {
    return "Este e-mail já possui uma conta. Faça login ou recupere sua senha.";
  }

  if (
    mensagem.includes("password") &&
    (mensagem.includes("weak") || mensagem.includes("short") || mensagem.includes("length"))
  ) {
    return "A senha não atende aos requisitos mínimos do servidor.";
  }

  if (mensagem.includes("unable to validate") || mensagem.includes("invalid")) {
    return `Credenciais inválidas. Verifique o e-mail e a senha. (${error.message})`;
  }

  if (!error.message || error.message === "{}") {
    const extra = [error.code, error.status].filter(Boolean).join(" / ");
    return `Erro ao criar conta${extra ? ` (${extra})` : ""}. Verifique o console do Supabase para mais detalhes.`;
  }

  return error.message;
}

async function verificarEmailCadastrado(email: string) {
  try {
    const response = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      exists?: boolean | null;
      reason?: "missing_service_role" | "admin_lookup_failed";
    };

    if (data.reason === "missing_service_role") {
      return "missing_service_role";
    }

    return typeof data.exists === "boolean" ? data.exists : null;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();

  const [abaAtiva, setAbaAtiva] = useState<AbaAuth>("login");
  const [emailLogin, setEmailLogin] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("eksteel_email_login") ?? "";
  });
  const [senhaLogin, setSenhaLogin] = useState("");
  const [manterConectado, setManterConectado] = useState(() => {
    if (typeof window === "undefined") return true;
    const manterSalvo = localStorage.getItem("eksteel_manter_conectado");
    return manterSalvo === null ? true : manterSalvo === "true";
  });

  const [nomeCadastro, setNomeCadastro] = useState("");
  const [emailCadastro, setEmailCadastro] = useState("");
  const [senhaCadastro, setSenhaCadastro] = useState("");
  const [confirmarSenhaCadastro, setConfirmarSenhaCadastro] = useState("");
  const [emailRecuperacao, setEmailRecuperacao] = useState("");

  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!temSupabaseConfig()) return;

    let montado = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      if (!montado) return;
      if (data.user) {
        router.replace("/app");
      }
    });

    return () => {
      montado = false;
    };
  }, [router]);

  function limparFeedback() {
    setMensagem("");
    setErro("");
  }

  function validarConfigSupabase(acao: string) {
    if (temSupabaseConfig()) return true;

    setErro(
      `Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local para habilitar ${acao}.`
    );
    return false;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    limparFeedback();

    if (!validarConfigSupabase("o login")) return;

    const email = normalizarEmail(emailLogin);

    if (!email || !senhaLogin.trim()) {
      setErro("Preencha e-mail e senha.");
      return;
    }

    setCarregando(true);

    const emailCadastrado = await verificarEmailCadastrado(email);

    if (emailCadastrado === "missing_service_role") {
      setCarregando(false);
      setErro(
        "A validação de conta existente ainda não está configurada. Adicione SUPABASE_SERVICE_ROLE_KEY no .env.local."
      );
      return;
    }

    if (emailCadastrado === false) {
      limparTentativasLogin(email);
      setCarregando(false);
      setErro(
        "Não encontramos uma conta com esse e-mail. Crie uma conta antes de entrar."
      );
      return;
    }

    const tempoRestante = obterTempoRestanteBloqueio(email);

    if (emailCadastrado === true && tempoRestante > 0) {
      setCarregando(false);
      setErro(
        `Muitas tentativas incorretas. Tente novamente em ${formatarTempoBloqueio(
          tempoRestante
        )}.`
      );
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senhaLogin,
    });

    setCarregando(false);

    if (error) {
      if (emailCadastrado !== true) {
        setErro("Não foi possível entrar. Confira o e-mail e a senha.");
        return;
      }

      const tentativas = registrarTentativaErrada(email);
      const tentativasRestantes = MAX_TENTATIVAS_LOGIN - tentativas;

      if (tentativas >= MAX_TENTATIVAS_LOGIN) {
        setErro(
          "Muitas tentativas incorretas. Seu login foi bloqueado por 5 minutos."
        );
        return;
      }

      setErro(
        tentativasRestantes > 0
          ? `Senha incorreta, tente novamente. Você ainda tem ${tentativasRestantes} tentativa${
              tentativasRestantes === 1 ? "" : "s"
            } antes do bloqueio.`
          : "Senha incorreta, tente novamente."
      );
      return;
    }

    limparTentativasLogin(email);

    if (manterConectado) {
      localStorage.setItem("eksteel_email_login", email);
      localStorage.setItem("eksteel_manter_conectado", "true");
    } else {
      localStorage.removeItem("eksteel_email_login");
      localStorage.setItem("eksteel_manter_conectado", "false");
    }

    router.push("/app");
    router.refresh();
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    limparFeedback();

    if (!validarConfigSupabase("o cadastro")) return;

    if (!nomeCadastro.trim()) {
      setErro("Preencha seu nome.");
      return;
    }

    if (!emailCadastro.trim() || !senhaCadastro.trim()) {
      setErro("Preencha e-mail e senha.");
      return;
    }

    if (!REGEX_SENHA_FORTE.test(senhaCadastro)) {
      setErro(
        "A senha deve ter no mínimo 8 caracteres, 1 letra maiúscula e 1 caractere especial."
      );
      return;
    }

    if (senhaCadastro !== confirmarSenhaCadastro) {
      setErro("As senhas não conferem.");
      return;
    }

    setCarregando(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: normalizarEmail(emailCadastro),
        password: senhaCadastro,
        options: {
          data: { nome_completo: nomeCadastro.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      setCarregando(false);

      if (error) {
        setErro(formatarErroCadastro(error));
        return;
      }

      const user = data?.user ?? null;
      const session = data?.session ?? null;

      if (user && !session) {
        setMensagem(
          "Cadastro realizado. Verifique seu e-mail para confirmar a conta."
        );
        setAbaAtiva("login");
        return;
      }

      if (!user) {
        setErro(
          "Não foi possível criar a conta ou enviar o e-mail de confirmação. Verifique as configurações de SMTP no painel do Supabase (Authentication → Settings)."
        );
        return;
      }

      router.push("/app");
      router.refresh();
    } catch (err) {
      setCarregando(false);
      setErro(
        err instanceof Error
          ? err.message
          : "Erro inesperado ao criar conta. Tente novamente."
      );
    }
  }

  async function handleRecuperacao(e: React.FormEvent) {
    e.preventDefault();
    limparFeedback();

    if (!validarConfigSupabase("a recuperação de senha")) return;

    if (!emailRecuperacao.trim()) {
      setErro("Informe seu e-mail.");
      return;
    }

    setCarregando(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizarEmail(emailRecuperacao),
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      }
    );

    setCarregando(false);

    if (error) {
      setErro(formatarErroRecuperacao(error));
      return;
    }

    setMensagem(
      "Se o e-mail existir na base, enviaremos um link para redefinir sua senha."
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1e1e1e] text-white">
      <div className="absolute inset-0">
        <Image
          src="/images/login-eksteel.webp"
          alt="Gestão operacional Eksteel"
          fill
          priority
          unoptimized
          className="object-cover object-center opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1e1e1e]/95 via-[#1e1e1e]/85 to-[#1e1e1e]/20" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-screen max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-10 lg:grid-cols-[1fr_auto]">
          <div className="flex w-full flex-col justify-center">
            <div className="mb-6 flex w-full items-center">
              <Image
                src="/images/Eksteel-logo.png"
                alt="Eksteel"
                width={360}
                height={108}
                priority
                unoptimized
                className="h-28 w-auto shrink-0 object-contain"
                onError={() => {}}
              />
              <div className="mx-6 h-20 w-px shrink-0 bg-gray-600" />
              <span
                className="flex-1 whitespace-nowrap text-center text-lg uppercase leading-tight tracking-wider bg-gradient-to-r from-[#9e9e9e] to-[#f0f0f0] bg-clip-text text-transparent"
                style={{ fontFamily: "var(--font-oswald)", fontWeight: 700 }}
              >
                Sistema de Gerenciamento Empresarial
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Controle vendas, estoque e lucro da sua empresa.
            </h1>

            <p className="mt-4 text-base leading-7 text-gray-400 md:text-lg">
              Plataforma interna para acompanhar resultados nos marketplaces,
              gerenciar estoque e analisar indicadores financeiros em tempo real.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Marketplaces", "Mercado Livre, Shopee e outros canais."],
                ["Estoque", "Inventário e alertas de reposição."],
                ["Financeiro", "Lucro, margem e fluxo de caixa."],
              ].map(([titulo, descricao]) => (
                <div
                  key={titulo}
                  className="rounded-3xl border border-white/10 bg-white/8 p-4 shadow-sm backdrop-blur-md"
                >
                  <p className="text-sm font-semibold text-[#90A4AE]">{titulo}</p>
                  <p className="mt-1.5 text-sm leading-6 text-gray-400">
                    {descricao}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full self-end rounded-[28px] border border-[#90A4AE] bg-white/90 p-6 shadow-xl shadow-black/5 backdrop-blur-md sm:w-[420px] text-[#1e1e1e]">
            <div className="flex flex-wrap gap-3">
              {[
                ["login", "Entrar"],
                ["cadastro", "Criar conta"],
                ["recuperar", "Esqueci minha senha"],
              ].map(([aba, texto]) => (
                <button
                  key={aba}
                  type="button"
                  onClick={() => {
                    limparFeedback();
                    setAbaAtiva(aba as AbaAuth);
                  }}
                  className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                    abaAtiva === aba
                      ? "bg-[#546E7A] text-white shadow-sm"
                      : "bg-[#ECEFF1] text-[#546E7A] hover:bg-[#CFD8DC]"
                  }`}
                >
                  {texto}
                </button>
              ))}
            </div>

            {mensagem ? (
              <div className="mt-5 rounded-2xl border border-[#90A4AE] bg-[#ECEFF1] px-4 py-3 text-sm text-[#546E7A]">
                {mensagem}
              </div>
            ) : null}

            {erro ? (
              <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {erro}
              </div>
            ) : null}

            {abaAtiva === "login" ? (
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <InputField
                  label="E-mail"
                  type="email"
                  value={emailLogin}
                  onChange={setEmailLogin}
                  placeholder="seuemail@exemplo.com"
                  autoComplete="email"
                />
                <InputField
                  label="Senha"
                  type="password"
                  value={senhaLogin}
                  onChange={setSenhaLogin}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                />

                <div className="rounded-2xl border border-[#90A4AE] bg-[#ECEFF1] px-4 py-3">
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={manterConectado}
                      onChange={(e) => setManterConectado(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[#90A4AE] accent-[#546E7A]"
                    />
                    <span>
                      <span className="block font-semibold">
                        Manter conectado
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[#607D8B]">
                        Mantém seu e-mail salvo neste navegador para facilitar o
                        próximo acesso.
                      </span>
                    </span>
                  </label>
                </div>

                <SubmitButton loading={carregando} idleText="Entrar" />
              </form>
            ) : null}

            {abaAtiva === "cadastro" ? (
              <form onSubmit={handleCadastro} className="mt-6 space-y-4">
                <InputField
                  label="Nome"
                  type="text"
                  value={nomeCadastro}
                  onChange={setNomeCadastro}
                  placeholder="Seu nome"
                  autoComplete="name"
                />
                <InputField
                  label="E-mail"
                  type="email"
                  value={emailCadastro}
                  onChange={setEmailCadastro}
                  placeholder="seuemail@exemplo.com"
                  autoComplete="email"
                />
                <InputField
                  label="Senha"
                  type="password"
                  value={senhaCadastro}
                  onChange={setSenhaCadastro}
                  placeholder="Crie sua senha"
                  autoComplete="new-password"
                  help="Mínimo 8 caracteres, 1 maiúscula e 1 caractere especial."
                />
                <InputField
                  label="Confirmar senha"
                  type="password"
                  value={confirmarSenhaCadastro}
                  onChange={setConfirmarSenhaCadastro}
                  placeholder="Repita sua senha"
                  autoComplete="new-password"
                />
                <SubmitButton loading={carregando} idleText="Criar conta" />
              </form>
            ) : null}

            {abaAtiva === "recuperar" ? (
              <form onSubmit={handleRecuperacao} className="mt-6 space-y-4">
                <InputField
                  label="E-mail"
                  type="email"
                  value={emailRecuperacao}
                  onChange={setEmailRecuperacao}
                  placeholder="seuemail@exemplo.com"
                  autoComplete="email"
                />
                <SubmitButton
                  loading={carregando}
                  idleText="Enviar link de recuperação"
                />
              </form>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function EyeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

type InputFieldProps = {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  help?: string;
};

function InputField({
  label,
  type: tipoProp,
  value,
  onChange,
  placeholder,
  autoComplete,
  help,
}: InputFieldProps) {
  const [mostrar, setMostrar] = useState(false);
  const ehSenha = tipoProp === "password";
  const tipo = ehSenha && mostrar ? "text" : tipoProp;

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input
          type={tipo}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-[#90A4AE] bg-white px-4 py-3 text-[#0d1b2a] outline-none transition placeholder:text-[#9E9E9E] focus:border-[#546E7A] focus:ring-2 focus:ring-[#ECEFF1]"
          style={ehSenha ? { paddingRight: "2.75rem" } : undefined}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        {ehSenha && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
            onMouseDown={(e) => {
              e.preventDefault();
              setMostrar((v) => !v);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E9E9E] hover:text-[#546E7A] transition"
          >
            {mostrar ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {help ? (
        <p className="mt-2 text-xs leading-5 text-[#607D8B]">{help}</p>
      ) : null}
    </div>
  );
}

function SubmitButton({
  loading,
  idleText,
}: {
  loading: boolean;
  idleText: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-2xl bg-[#546E7A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#37474F] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Processando..." : idleText}
    </button>
  );
}
