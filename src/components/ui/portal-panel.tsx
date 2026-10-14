"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, MessageCircle, Plus, UserX, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

// Aba "Portal" do processo: quem pode ver este processo na Área do Cliente
// (justio.com.br/cliente) e os convites de acesso. O que aparece lá dentro é só o que
// estiver marcado com o olho (👁) em Movimentações e Audiências.

interface Acesso {
  id: string;
  nome: string;
  cpf: string;
  celular?: string | null;
  vinculo: string;
  processos: string[];
  senha_hash: string | null;
  convite_token: string | null;
  convite_expira: string | null;
  ativo: boolean;
  ultimo_acesso: string | null;
}

const VINCULOS = ["cliente", "mãe", "pai", "cônjuge", "companheira(o)", "filha(o)", "irmã(o)", "outro"];
const BASE = "https://www.justio.com.br";

function soDigitos(s: string) {
  return s.replace(/\D/g, "");
}

function cpfFormatado(d: string) {
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function novoToken(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export function PortalPanel({ processoId, processoTitulo, clienteId, clienteNome }: {
  processoId: string;
  processoTitulo: string;
  clienteId?: string;
  clienteNome?: string;
}) {
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [form, setForm] = useState<{ nome: string; cpf: string; celular: string; vinculo: string } | null>(null);
  const [erro, setErro] = useState("");
  const [linkNovo, setLinkNovo] = useState<{ acesso: Acesso; link: string } | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("portal_acessos").select("*").contains("processos", [processoId]).order("created_at");
    if (error) setErro(error.message);
    else setAcessos((data ?? []) as Acesso[]);
  }, [processoId]);

  useEffect(() => {
    supabase
      .from("portal_acessos")
      .select("*")
      .contains("processos", [processoId])
      .order("created_at")
      .then(({ data, error }) => (error ? setErro(error.message) : setAcessos((data ?? []) as Acesso[])));
  }, [processoId]);

  async function gerarConvite(a: Acesso) {
    const token = novoToken();
    const expira = new Date(Date.now() + 7 * 864e5).toISOString();
    const { error } = await supabase.from("portal_acessos").update({ convite_token: token, convite_expira: expira, updated_at: new Date().toISOString() }).eq("id", a.id);
    if (error) return setErro(error.message);
    setLinkNovo({ acesso: a, link: `${BASE}/cliente/convite/${token}` });
    carregar();
  }

  async function salvarNovo(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErro("");
    const cpf = soDigitos(form.cpf);
    if (!form.nome.trim() || cpf.length !== 11) return setErro("Informe o nome e um CPF com 11 dígitos.");

    // CPF que já tem acesso (outro processo): só acrescenta este processo.
    const { data: existente } = await supabase.from("portal_acessos").select("*").eq("cpf", cpf).maybeSingle();
    let acesso: Acesso;
    if (existente) {
      acesso = existente as Acesso;
      const processos = Array.from(new Set([...acesso.processos, processoId]));
      const { error } = await supabase.from("portal_acessos").update({ processos, updated_at: new Date().toISOString() }).eq("id", acesso.id);
      if (error) return setErro(error.message);
      acesso = { ...acesso, processos };
    } else {
      acesso = {
        id: crypto.randomUUID(),
        nome: form.nome.trim(),
        cpf,
        celular: soDigitos(form.celular) || null,
        vinculo: form.vinculo,
        processos: [processoId],
        senha_hash: null,
        convite_token: null,
        convite_expira: null,
        ativo: true,
        ultimo_acesso: null,
      };
      const { error } = await supabase.from("portal_acessos").insert({ ...acesso, cliente_id: form.vinculo === "cliente" ? clienteId ?? null : null });
      if (error) return setErro(error.message);
    }
    setForm(null);
    if (!acesso.senha_hash) await gerarConvite(acesso);
    else carregar();
  }

  async function alternarAtivo(a: Acesso) {
    await supabase.from("portal_acessos").update({ ativo: !a.ativo, updated_at: new Date().toISOString() }).eq("id", a.id);
    carregar();
  }

  async function tirarDoProcesso(a: Acesso) {
    if (!window.confirm(`${a.nome} deixa de ver este processo no portal. Continuar?`)) return;
    await supabase.from("portal_acessos").update({ processos: a.processos.filter((p) => p !== processoId), updated_at: new Date().toISOString() }).eq("id", a.id);
    carregar();
  }

  const mensagem = (a: Acesso, link: string) =>
    `Olá, ${a.nome.split(" ")[0]}! Aqui é a Dra. Caroline Fraga. Liberei para você a Área do Cliente, onde dá para acompanhar o processo "${processoTitulo}". Para criar sua senha, acesse (o link vale por 7 dias): ${link}\nDepois, é só entrar em ${BASE}/cliente com seu CPF e a senha.`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4 px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Área do Cliente</p>
              <p className="mt-1 text-xs text-gray-500">
                Quem tem acesso entra em justio.com.br/cliente com CPF e senha e vê só este processo: os andamentos e audiências que você marcar com o 👁.
              </p>
            </div>
            {!form && (
              <Button size="sm" onClick={() => setForm({ nome: clienteNome ?? "", cpf: "", celular: "", vinculo: "cliente" })}>
                <Plus className="w-3.5 h-3.5" /> Liberar acesso
              </Button>
            )}
          </div>

          {form && (
            <form onSubmit={salvarNovo} className="mt-4 grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
              <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="CPF" inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              <input className="rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Celular com DDD (WhatsApp)" inputMode="tel" value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} />
              <select className="rounded-lg border border-gray-200 px-3 py-2 text-sm" value={form.vinculo} onChange={(e) => setForm({ ...form, vinculo: e.target.value })}>
                {VINCULOS.map((v) => <option key={v} value={v}>{v === "cliente" ? "O próprio cliente" : `Familiar: ${v}`}</option>)}
              </select>
              {form.vinculo !== "cliente" && (
                <p className="text-xs text-amber-700 sm:col-span-2">
                  Sigilo profissional: libere para familiar só com autorização do cliente (guarde a autorização na pasta dele).
                </p>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
                <Button type="submit">Salvar e gerar convite</Button>
              </div>
            </form>
          )}
          {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        </CardContent>
      </Card>

      {linkNovo && (
        <Card className="border-emerald-300">
          <CardContent className="py-4 px-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-emerald-800">Convite pronto para {linkNovo.acesso.nome.split(" ")[0]} (vale 7 dias)</p>
              <button onClick={() => setLinkNovo(null)} className="text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <p className="mt-2 break-all rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">{linkNovo.link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(mensagem(linkNovo.acesso, linkNovo.link))}>
                <Copy className="w-3.5 h-3.5" /> Copiar mensagem
              </Button>
              {linkNovo.acesso.celular && (
                <a
                  className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-medium text-white"
                  href={`https://wa.me/55${linkNovo.acesso.celular}?text=${encodeURIComponent(mensagem(linkNovo.acesso, linkNovo.link))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Enviar pelo WhatsApp
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {acessos.map((a) => (
        <Card key={a.id} className={a.ativo ? "" : "opacity-60"}>
          <CardContent className="py-3 px-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {a.nome} <span className="text-xs font-normal text-gray-500">· {a.vinculo === "cliente" ? "cliente" : a.vinculo}</span>
                </p>
                <p className="text-xs text-gray-500">
                  CPF {cpfFormatado(a.cpf)} ·{" "}
                  {!a.ativo
                    ? "suspenso"
                    : a.senha_hash
                      ? a.ultimo_acesso
                        ? `último acesso ${new Date(a.ultimo_acesso).toLocaleString("pt-BR")}`
                        : "senha criada, ainda não entrou"
                      : a.convite_token
                        ? "convite enviado, aguardando o primeiro acesso"
                        : "sem convite"}
                  {a.processos.length > 1 ? ` · vê ${a.processos.length} processos` : ""}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => gerarConvite(a)} title={a.senha_hash ? "Novo link (esqueceu a senha)" : "Gerar convite"}>
                <KeyRound className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => alternarAtivo(a)} title={a.ativo ? "Suspender acesso" : "Reativar acesso"}>
                {a.ativo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => tirarDoProcesso(a)} title="Tirar deste processo">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
