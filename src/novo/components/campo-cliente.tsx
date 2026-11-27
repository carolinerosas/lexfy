"use client";
import { useState } from "react";
import { semAcento } from "@/novo/lib/format";
import { useDB } from "@/novo/lib/store";

/**
 * Caixa de nome de cliente: ao digitar, aparecem os clientes já cadastrados para escolher.
 * Se o nome digitado não existir, o cliente é novo (quem usa a caixa cadastra ao salvar).
 */
export function CampoCliente({ valor, aoMudar, placeholder = "Nome do cliente", readOnly, autoFocus }: {
  valor: string; aoMudar: (nome: string, clienteId?: string) => void; placeholder?: string; readOnly?: boolean; autoFocus?: boolean;
}) {
  const db = useDB();
  const [aberta, setAberta] = useState(false);
  const termo = semAcento(valor.trim());
  const achados = termo ? db.clientes.filter((c) => semAcento(c.nome).includes(termo)).sort((a, b) => a.nome.localeCompare(b.nome)).slice(0, 6) : [];
  const exato = db.clientes.some((c) => semAcento(c.nome) === termo);
  const mostrar = aberta && !readOnly && achados.length > 0 && !(achados.length === 1 && exato);

  return (
    <div className="min-w-0">
      <input className="inp" value={valor} readOnly={readOnly} autoFocus={autoFocus} placeholder={placeholder} autoComplete="off"
        onChange={(e) => { aoMudar(e.target.value); setAberta(true); }} onFocus={() => setAberta(true)} onBlur={() => setTimeout(() => setAberta(false), 150)} />
      {mostrar && (
        <ul className="mt-1 overflow-hidden rounded-[10px] border border-line bg-white" role="listbox" aria-label="Clientes já cadastrados">
          {achados.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button type="button" className="block w-full truncate px-3 py-2 text-left hover:bg-porcelana" onMouseDown={(e) => e.preventDefault()} onClick={() => { aoMudar(c.nome, c.id); setAberta(false); }}>{c.nome}</button>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && !mostrar && valor.trim() !== "" && !exato && <p className="mt-1 text-[12.5px] text-ink-3">Cliente novo: será cadastrado ao salvar.</p>}
    </div>
  );
}
