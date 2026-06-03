"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Select } from "./select";
import { getCustomOptions, addCustomOption, removeCustomOption } from "@/lib/customOptions";

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

const ADD_SENTINEL = "__adicionar_opcao__";

export function SelectComOutro({
  label,
  category,
  baseOptions,
  value,
  onChange,
  placeholder,
}: SelectComOutroProps) {
  const [customs, setCustoms] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [novo, setNovo] = useState("");

  useEffect(() => {
    setCustoms(getCustomOptions(category));
  }, [category]);

  const baseValues = new Set(baseOptions.map((o) => o.value));
  const customOpts = customs.map((c) => ({ value: c, label: c }));
  // Se o valor atual for customizado e ainda não estiver na lista, garante que apareça
  const valueIsKnown = baseValues.has(value) || customs.includes(value);
  const extra = value && !valueIsKnown ? [{ value, label: value }] : [];

  const options: Opt[] = [
    ...baseOptions,
    ...customOpts,
    ...extra,
    { value: ADD_SENTINEL, label: "➕ Cadastrar nova opção…" },
  ];

  function handleSelect(v: string) {
    if (v === ADD_SENTINEL) {
      setAdding(true);
      setNovo("");
      return;
    }
    onChange(v);
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
  }

  function handleRemoveCustom(label: string) {
    removeCustomOption(category, label);
    const updated = getCustomOptions(category);
    setCustoms(updated);
    if (value === label) onChange("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        label={label}
        placeholder={placeholder}
        value={value}
        options={options}
        onChange={(e) => handleSelect(e.target.value)}
      />

      {adding && (
        <div className="flex items-center gap-2">
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
            placeholder="Digite a nova opção e confirme"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
          />
          <button
            type="button"
            onClick={confirmAdd}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#21181d] text-white hover:bg-[#2b2027]"
            title="Salvar opção"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {customs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customs.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600"
            >
              {c}
              <button
                type="button"
                onClick={() => handleRemoveCustom(c)}
                className="text-gray-400 hover:text-red-600"
                title="Remover opção da lista"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
