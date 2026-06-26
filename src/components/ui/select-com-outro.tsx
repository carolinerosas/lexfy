"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import {
  getCustomOptions,
  addCustomOption,
  removeCustomOption,
  getHiddenOptions,
  hideBaseOption,
  restoreHiddenOptions,
} from "@/lib/customOptions";

interface Opt {
  value: string;
  label: string;
}

interface SelectComOutroProps {
  label?: string;
  category: string; // chave de armazenamento das opções customizadas
  baseOptions: Opt[]; // opções fixas (sem o "Outro")
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

type LinhaOpcao = Opt & { kind: "base" | "custom" | "extra" };

export function SelectComOutro({
  label,
  category,
  baseOptions,
  value,
  onChange,
  placeholder = "Selecione...",
}: SelectComOutroProps) {
  const [customs, setCustoms] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [novo, setNovo] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustoms(getCustomOptions(category));
    setHidden(getHiddenOptions(category));
  }, [category]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onClickFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    }
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, [open]);

  const hiddenSet = new Set(hidden.map((h) => h.toLowerCase()));
  const baseVisiveis = baseOptions.filter((o) => !hiddenSet.has(o.value.toLowerCase()));
  const baseValues = new Set(baseVisiveis.map((o) => o.value.toLowerCase()));

  const customVisiveis = customs.filter(
    (c) => !hiddenSet.has(c.toLowerCase()) && !baseValues.has(c.toLowerCase())
  );

  const linhas: LinhaOpcao[] = [
    ...baseVisiveis.map((o) => ({ ...o, kind: "base" as const })),
    ...customVisiveis.map((c) => ({ value: c, label: c, kind: "custom" as const })),
  ];

  // Garante que o valor atual apareça mesmo se não estiver em nenhuma lista.
  const valorConhecido = linhas.some((l) => l.value === value);
  if (value && !valorConhecido) {
    linhas.unshift({ value, label: value, kind: "extra" });
  }

  const selecionado = linhas.find((l) => l.value === value);

  function selecionar(v: string) {
    onChange(v);
    setOpen(false);
    setAdding(false);
  }

  function confirmAdd() {
    const v = novo.trim();
    if (!v) {
      setAdding(false);
      return;
    }
    addCustomOption(category, v);
    setCustoms(getCustomOptions(category));
    onChange(v);
    setNovo("");
    setAdding(false);
    setOpen(false);
  }

  function excluirLinha(linha: LinhaOpcao, e: React.MouseEvent) {
    e.stopPropagation();
    if (linha.kind === "custom") {
      removeCustomOption(category, linha.value);
      setCustoms(getCustomOptions(category));
    } else {
      // base ou extra: esconde por valor.
      hideBaseOption(category, linha.value);
      setHidden(getHiddenOptions(category));
    }
    if (value === linha.value) onChange("");
  }

  function restaurar() {
    restoreHiddenOptions(category);
    setHidden([]);
  }

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((o) => !o);
            setAdding(false);
          }}
          className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-900 transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
        >
          <span className={selecionado ? "" : "text-gray-400"}>
            {selecionado ? selecionado.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {placeholder && (
              <button
                type="button"
                onClick={() => selecionar("")}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50"
              >
                {placeholder}
              </button>
            )}

            {linhas.map((linha) => (
              <div
                key={`${linha.kind}-${linha.value}`}
                className={`group flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${
                  linha.value === value ? "bg-gray-50 font-medium" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => selecionar(linha.value)}
                  className="flex flex-1 items-center gap-2 text-left text-gray-900"
                >
                  {linha.value === value && <Check className="h-3.5 w-3.5 text-[#21181d]" />}
                  <span className={linha.value === value ? "" : "pl-[1.375rem]"}>{linha.label}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => excluirLinha(linha, e)}
                  className="shrink-0 rounded p-0.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 group-hover:text-gray-400"
                  title="Excluir esta opção da lista"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {linhas.length === 0 && !adding && (
              <p className="px-3 py-2 text-xs text-gray-400">Nenhuma opção. Cadastre uma abaixo.</p>
            )}

            <div className="my-1 border-t border-gray-100" />

            {adding ? (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <input
                  autoFocus
                  value={novo}
                  onChange={(e) => setNovo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmAdd();
                    }
                    if (e.key === "Escape") setAdding(false);
                  }}
                  placeholder="Nova opção…"
                  className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                />
                <button
                  type="button"
                  onClick={confirmAdd}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#21181d] text-white hover:bg-[#2b2027]"
                  title="Salvar opção"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setNovo("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[#21181d] hover:bg-gray-50"
              >
                <Plus className="h-4 w-4" /> Cadastrar nova opção
              </button>
            )}

            {hidden.length > 0 && (
              <button
                type="button"
                onClick={restaurar}
                className="flex w-full items-center px-3 py-2 text-left text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              >
                Restaurar opções padrão ({hidden.length} oculta{hidden.length !== 1 ? "s" : ""})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
