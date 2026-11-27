"use client";
// Configurações que vinham do JUSTIO antigo: senha, link da agenda e, abaixo,
// perfil da advogada, backup, sincronizador do certificado e DataJud (mesma tela do antigo).
import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import ConfiguracoesAntigo from "@/telas/configuracoes";
import { Rotulado } from "@/novo/components/ui";

function TrocarSenha() {
  const [f, setF] = useState({ atual: "", nova: "", repete: "" });
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (f.nova !== f.repete) { setMsg({ ok: false, texto: "A senha nova e a repetição não são iguais." }); return; }
    setEnviando(true);
    const r = await fetch("/api/auth/trocar-senha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ atual: f.atual, nova: f.nova }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (r?.ok) { setF({ atual: "", nova: "", repete: "" }); setMsg({ ok: true, texto: "Senha trocada. Os outros aparelhos vão pedir a senha nova." }); }
    else setMsg({ ok: false, texto: j.error ?? "Não consegui trocar a senha agora." });
  }

  return (
    <section className="painel">
      <div className="painel-cab"><h2>Senha de acesso</h2></div>
      <form onSubmit={salvar} className="space-y-3 p-5">
        <Rotulado rotulo="Senha atual"><input className="inp" type="password" autoComplete="current-password" value={f.atual} onChange={(e) => setF({ ...f, atual: e.target.value })} /></Rotulado>
        <Rotulado rotulo="Senha nova (mínimo de 10 caracteres)"><input className="inp" type="password" autoComplete="new-password" value={f.nova} onChange={(e) => setF({ ...f, nova: e.target.value })} /></Rotulado>
        <Rotulado rotulo="Repita a senha nova"><input className="inp" type="password" autoComplete="new-password" value={f.repete} onChange={(e) => setF({ ...f, repete: e.target.value })} /></Rotulado>
        {msg && <p role="status" className={`text-[13px] font-medium ${msg.ok ? "text-ok" : "text-perigo"}`}>{msg.texto}</p>}
        <button className="btn btn-p" disabled={enviando || !f.atual || !f.nova}>{enviando ? "Trocando..." : "Trocar senha"}</button>
      </form>
    </section>
  );
}

function LinkAgenda() {
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    let vivo = true;
    fetch("/api/calendario-link").then((r) => r.json()).then((j) => { if (vivo) setUrl(j.url ?? null); }).catch(() => { if (vivo) setUrl(null); });
    return () => { vivo = false; };
  }, []);

  return (
    <section className="painel">
      <div className="painel-cab"><h2>Agenda no Google Agenda e no celular</h2></div>
      <div className="space-y-3 p-5 text-[13.5px]">
        {url === undefined ? <p className="text-ink-3">Carregando...</p> : url === null ? (
          <p className="text-ink-2">O link da agenda ainda não está ligado. Falta criar a variável <code>CALENDAR_TOKEN</code> na Vercel (uma senha longa qualquer). Depois disso o link aparece aqui.</p>
        ) : (
          <>
            <p className="text-ink-2">Prazos e audiências entram sozinhos na sua agenda. No Google Agenda: <strong>Outras agendas &gt; + &gt; Do URL</strong>, cole o link e clique em Adicionar agenda. No iPhone: Ajustes &gt; Calendário &gt; Contas &gt; Adicionar conta &gt; Outra &gt; Calendário assinado.</p>
            <div className="flex gap-2">
              <input className="inp font-mono text-[12.5px]" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link da agenda" />
              <button type="button" className="btn btn-g" onClick={() => { navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }}>{copiado ? <Check /> : <Copy />}{copiado ? "Copiado" : "Copiar"}</button>
            </div>
            <p className="text-[12.5px] text-ink-3">O link funciona sem login. Não o compartilhe: quem tiver o link vê seus prazos e audiências. O Google atualiza a agenda assinada algumas vezes por dia.</p>
          </>
        )}
      </div>
    </section>
  );
}

export function ConfigConta() {
  return (
    <div className="mt-8 space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrocarSenha />
        <LinkAgenda />
      </div>
      <section>
        <h2 className="titulo mb-3 text-[20px]">Perfil da advogada, integrações e backup</h2>
        <div className="painel overflow-hidden"><ConfiguracoesAntigo /></div>
      </section>
    </div>
  );
}
