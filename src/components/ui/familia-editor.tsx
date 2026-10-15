"use client";

import { Plus, Trash2 } from "lucide-react";
import type { DadosFamilia } from "@/types";

// Dados próprios dos processos de família: relação, filhos, partilha, dívidas, despesas dos
// filhos, rendas e o que o cliente quer (guarda, convivência, alimentos, partilha).
// Usado na revisão da Triagem e na aba "Família" do processo.

type Lista<K extends keyof DadosFamilia> = NonNullable<DadosFamilia[K]>;

const campo = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm";
const rotulo = "mb-1 block text-xs font-medium text-gray-600";

function reais(v?: number) {
  return v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
}

function numero(texto: string): number | undefined {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(limpo);
  return limpo && !Number.isNaN(n) ? n : undefined;
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-400">{titulo}</p>
      {children}
    </div>
  );
}

export function FamiliaEditor({ valor, onChange }: { valor: DadosFamilia; onChange: (v: DadosFamilia) => void }) {
  const set = <K extends keyof DadosFamilia>(k: K, v: DadosFamilia[K]) => onChange({ ...valor, [k]: v });
  const setPret = (k: keyof NonNullable<DadosFamilia["pretensao"]>, v: string) => set("pretensao", { ...(valor.pretensao ?? {}), [k]: v });

  function linha<K extends "filhos" | "bens" | "dividas" | "despesas_filhos">(k: K, i: number, patch: Partial<Lista<K>[number]>) {
    const lista = [...((valor[k] ?? []) as Lista<K>)];
    lista[i] = { ...lista[i], ...patch };
    set(k, lista as DadosFamilia[K]);
  }
  function remover<K extends "filhos" | "bens" | "dividas" | "despesas_filhos">(k: K, i: number) {
    set(k, ((valor[k] ?? []) as Lista<K>).filter((_, j) => j !== i) as DadosFamilia[K]);
  }
  function adicionar<K extends "filhos" | "bens" | "dividas" | "despesas_filhos">(k: K, novo: Lista<K>[number]) {
    set(k, [...((valor[k] ?? []) as Lista<K>), novo] as DadosFamilia[K]);
  }

  const totalBens = (valor.bens ?? []).reduce((s, b) => s + (b.valor ?? 0), 0);
  const totalDividas = (valor.dividas ?? []).reduce((s, d) => s + (d.valor ?? 0), 0);
  const totalDespesas = (valor.despesas_filhos ?? []).reduce((s, d) => s + (d.valor ?? 0), 0);

  return (
    <div className="space-y-4">
      <Secao titulo="Ação e relação">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className={rotulo}>Ação</span>
            <input className={campo} value={valor.acao ?? ""} onChange={(e) => set("acao", e.target.value)} placeholder="Divórcio litigioso com partilha, guarda e alimentos" />
          </label>
          <label>
            <span className={rotulo}>Relação</span>
            <select className={campo} value={valor.relacao ?? ""} onChange={(e) => set("relacao", (e.target.value || undefined) as DadosFamilia["relacao"])}>
              <option value="">—</option>
              <option value="casamento">Casamento</option>
              <option value="uniao_estavel">União estável</option>
            </select>
          </label>
          <label>
            <span className={rotulo}>Regime de bens</span>
            <input className={campo} value={valor.regime_bens ?? ""} onChange={(e) => set("regime_bens", e.target.value)} placeholder="Comunhão parcial" />
          </label>
          <label>
            <span className={rotulo}>Início da convivência</span>
            <input className={campo} value={valor.data_inicio_relacao ?? ""} onChange={(e) => set("data_inicio_relacao", e.target.value)} placeholder="aaaa-mm-dd ou 'há 20 anos'" />
          </label>
          <label>
            <span className={rotulo}>{valor.relacao === "uniao_estavel" ? "Data da escritura (se houver)" : "Data do casamento"}</span>
            <input className={campo} value={valor.data_casamento ?? ""} onChange={(e) => set("data_casamento", e.target.value)} placeholder="aaaa-mm-dd ou 'há 16 anos'" />
          </label>
          {valor.relacao === "uniao_estavel" && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={Boolean(valor.escritura_uniao)} onChange={(e) => set("escritura_uniao", e.target.checked)} />
              União estável com escritura pública
            </label>
          )}
          <label>
            <span className={rotulo}>Separação de fato</span>
            <input className={campo} value={valor.data_separacao ?? ""} onChange={(e) => set("data_separacao", e.target.value)} placeholder="aaaa-mm-dd ou 'há 2 meses'" />
          </label>
          <label className="md:col-span-2">
            <span className={rotulo}>Moradia / situação atual</span>
            <input className={campo} value={valor.moradia ?? ""} onChange={(e) => set("moradia", e.target.value)} />
          </label>
        </div>
      </Secao>

      <Secao titulo="Filhos">
        {(valor.filhos ?? []).map((f, i) => (
          <div key={i} className="mb-2 grid gap-2 md:grid-cols-[2fr_1fr_80px_2fr_auto]">
            <input className={campo} placeholder="Nome" value={f.nome} onChange={(e) => linha("filhos", i, { nome: e.target.value })} />
            <input className={campo} type="date" title="Nascimento" value={f.nascimento ?? ""} onChange={(e) => linha("filhos", i, { nascimento: e.target.value || undefined })} />
            <input className={campo} placeholder="Idade" inputMode="numeric" value={f.idade ?? ""} onChange={(e) => linha("filhos", i, { idade: numero(e.target.value) })} />
            <input className={campo} placeholder="Escola / observações" value={f.escola ?? ""} onChange={(e) => linha("filhos", i, { escola: e.target.value })} />
            <button type="button" onClick={() => remover("filhos", i)} className="text-gray-300 hover:text-red-500" title="Remover"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => adicionar("filhos", { nome: "" })} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900">
          <Plus className="h-3.5 w-3.5" /> Filho
        </button>
      </Secao>

      {(
        [
          ["bens", "Partilha — bens", totalBens],
          ["dividas", "Dívidas", totalDividas],
        ] as const
      ).map(([k, titulo, total]) => (
        <Secao key={k} titulo={`${titulo}${total ? ` · total ${reais(total)} (metade ${reais(total / 2)})` : ""}`}>
          {(valor[k] ?? []).map((b, i) => (
            <div key={i} className="mb-2 grid gap-2 md:grid-cols-[2fr_1fr_2fr_auto]">
              <input className={campo} placeholder="Descrição" value={b.descricao} onChange={(e) => linha(k, i, { descricao: e.target.value })} />
              <input className={campo} placeholder="Valor (R$)" inputMode="decimal" defaultValue={b.valor ?? ""} onBlur={(e) => linha(k, i, { valor: numero(e.target.value) })} />
              <input className={campo} placeholder="Observações" value={b.observacoes ?? ""} onChange={(e) => linha(k, i, { observacoes: e.target.value })} />
              <button type="button" onClick={() => remover(k, i)} className="text-gray-300 hover:text-red-500" title="Remover"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => adicionar(k, { descricao: "" })} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900">
            <Plus className="h-3.5 w-3.5" /> {k === "bens" ? "Bem" : "Dívida"}
          </button>
        </Secao>
      ))}

      <Secao titulo={`Despesas dos filhos${totalDespesas ? ` · ${reais(totalDespesas)}/mês` : ""}`}>
        {(valor.despesas_filhos ?? []).map((d, i) => (
          <div key={i} className="mb-2 grid gap-2 md:grid-cols-[2fr_1fr_auto]">
            <input className={campo} placeholder="Descrição (escola, mercado, roupas...)" value={d.descricao} onChange={(e) => linha("despesas_filhos", i, { descricao: e.target.value })} />
            <input className={campo} placeholder="Valor mensal (R$)" inputMode="decimal" defaultValue={d.valor ?? ""} onBlur={(e) => linha("despesas_filhos", i, { valor: numero(e.target.value) })} />
            <button type="button" onClick={() => remover("despesas_filhos", i)} className="text-gray-300 hover:text-red-500" title="Remover"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => adicionar("despesas_filhos", { descricao: "" })} className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900">
          <Plus className="h-3.5 w-3.5" /> Despesa
        </button>
      </Secao>

      <Secao titulo="Partes: profissão e renda">
        <div className="grid gap-3 md:grid-cols-2">
          <label><span className={rotulo}>Profissão do cliente</span><input className={campo} value={valor.cliente_profissao ?? ""} onChange={(e) => set("cliente_profissao", e.target.value)} /></label>
          <label><span className={rotulo}>Renda do cliente</span><input className={campo} value={valor.cliente_renda ?? ""} onChange={(e) => set("cliente_renda", e.target.value)} /></label>
          <label><span className={rotulo}>Outra parte</span><input className={campo} value={valor.outra_parte_nome ?? ""} onChange={(e) => set("outra_parte_nome", e.target.value)} /></label>
          <label><span className={rotulo}>Profissão da outra parte</span><input className={campo} value={valor.outra_parte_profissao ?? ""} onChange={(e) => set("outra_parte_profissao", e.target.value)} /></label>
          <label className="md:col-span-2"><span className={rotulo}>Renda da outra parte</span><input className={campo} value={valor.outra_parte_renda ?? ""} onChange={(e) => set("outra_parte_renda", e.target.value)} /></label>
        </div>
      </Secao>

      <Secao titulo="O que o cliente quer">
        <div className="grid gap-3 md:grid-cols-2">
          <label><span className={rotulo}>Guarda</span><input className={campo} value={valor.pretensao?.guarda ?? ""} onChange={(e) => setPret("guarda", e.target.value)} placeholder="Compartilhada" /></label>
          <label><span className={rotulo}>Convivência</span><input className={campo} value={valor.pretensao?.convivencia ?? ""} onChange={(e) => setPret("convivencia", e.target.value)} placeholder="Fins de semana alternados" /></label>
          <label><span className={rotulo}>Alimentos</span><input className={campo} value={valor.pretensao?.alimentos ?? ""} onChange={(e) => setPret("alimentos", e.target.value)} placeholder="20% dos rendimentos" /></label>
          <label><span className={rotulo}>Partilha</span><input className={campo} value={valor.pretensao?.partilha ?? ""} onChange={(e) => setPret("partilha", e.target.value)} /></label>
          <label className="md:col-span-2"><span className={rotulo}>Outros pedidos</span><input className={campo} value={valor.pretensao?.outros ?? ""} onChange={(e) => setPret("outros", e.target.value)} /></label>
          <label className="md:col-span-2"><span className={rotulo}>Possível acordo</span><textarea className={campo} rows={2} value={valor.possivel_acordo ?? ""} onChange={(e) => set("possivel_acordo", e.target.value)} /></label>
          <label className="md:col-span-2"><span className={rotulo}>Observações</span><textarea className={campo} rows={3} value={valor.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} /></label>
        </div>
      </Secao>
    </div>
  );
}
