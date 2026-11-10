"use client";
import Link from "next/link";
import { Download } from "lucide-react";
import { alterarConfig, exportarBanco, useDB, useSituacao } from "@/novo/lib/store";
import { AREAS } from "@/novo/lib/areas";
import { Azulejo } from "@/novo/components/azulejo";
import { Cabecalho, Rotulado } from "@/novo/components/ui";

export default function Configuracoes() {
  const db = useDB();
  const situacao = useSituacao();
  const cfg = db.config;
  const alternar = (id: string) => alterarConfig({ areasAtivas: cfg.areasAtivas.includes(id) ? cfg.areasAtivas.filter((x) => x !== id) : [...cfg.areasAtivas, id] });

  function baixar() {
    const url = URL.createObjectURL(new Blob([exportarBanco()], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: "justio-dados.json" }).click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Cabecalho titulo="Configurações" sub="Dados do escritório e áreas em que ele atua." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <section className="painel">
            <div className="painel-cab"><h2>Escritório</h2></div>
            <div className="space-y-3 p-5">
              <Rotulado rotulo="Nome do escritório"><input className="inp" value={cfg.escritorio} onChange={(e) => alterarConfig({ escritorio: e.target.value })} /></Rotulado>
              <Rotulado rotulo="Responsável"><input className="inp" value={cfg.responsavel} onChange={(e) => alterarConfig({ responsavel: e.target.value })} /></Rotulado>
              <div className="grid grid-cols-2 gap-3"><Rotulado rotulo="OAB"><input className="inp" value={cfg.oab} onChange={(e) => alterarConfig({ oab: e.target.value })} /></Rotulado><Rotulado rotulo="Cidade"><input className="inp" value={cfg.cidade} onChange={(e) => alterarConfig({ cidade: e.target.value })} /></Rotulado></div>
              <Rotulado rotulo="Chave Pix do escritório (para cobrar honorários)"><input className="inp" value={cfg.pix_chave ?? ""} placeholder="CNPJ, CPF, e-mail, celular com +55 ou chave aleatória" onChange={(e) => alterarConfig({ pix_chave: e.target.value })} /></Rotulado>
            </div>
          </section>
          <section className="painel">
            <div className="painel-cab"><h2>Dados</h2><span className={`tag ${situacao.semExtras ? "tag-alerta" : "tag-ok"}`}>{situacao.semExtras ? "Falta a tabela nova" : "Gravando no banco"}</span></div>
            <div className="space-y-3 p-5 text-[13.5px] text-ink-2">
              <p>O novo Justio usa o mesmo banco do antigo: processos, prazos, audiências, clientes, andamentos, publicações, honorários, contas, atendimentos e tarefas são os mesmos nas duas versões.</p>
              <p>Senha de acesso, perfil da advogada, integrações (DataJud, sincronizador local), modelos, acordos, orçamentos e portal do cliente continuam nas telas do <Link href="/antigo/configuracoes" className="font-semibold text-ink underline">Justio antigo</Link>.</p>
              <button className="btn btn-g" onClick={baixar}><Download />Baixar cópia dos dados</button>
              <p className="text-[12.5px] text-ink-3">O arquivo baixado contém dados de clientes. Guarde em local seguro.</p>
            </div>
          </section>
        </div>
        <section className="painel h-fit">
          <div className="painel-cab"><h2>Áreas em que o escritório atua</h2><span className="text-[12.5px] text-ink-3">{cfg.areasAtivas.length} de {AREAS.length}</span></div>
          <p className="px-5 pt-3 text-[13px] text-ink-2">As áreas desmarcadas saem das listas e do cadastro de caso novo. Os casos já cadastrados continuam acessíveis.</p>
          {(["judicial", "extrajudicial"] as const).map((g) => (
            <fieldset key={g} className="px-5 py-3">
              <legend className="pb-2 text-[12.5px] font-semibold text-ink-3">{g === "judicial" ? "Judicial" : "Extrajudicial"}</legend>
              <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                {AREAS.filter((a) => a.grupo === g).map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 hover:bg-porcelana">
                    <input type="checkbox" className="size-4" checked={cfg.areasAtivas.includes(a.id)} onChange={() => alternar(a.id)} />
                    <Azulejo area={a} tamanho={22} /><span className="truncate">{a.nome}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </section>
      </div>
    </>
  );
}
