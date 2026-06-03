"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

interface Opt {
  value: string;
  label: string;
}

interface ComboBoxProps {
  label?: string;
  options: Opt[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ComboBox({ label, options, value, onChange, placeholder }: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const q = normalize(query);
  const filtered = q ? options.filter((o) => normalize(o.label).includes(q)) : options;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900"
        >
          <span className={`truncate ${selected ? "text-gray-900" : "text-gray-400"}`}>
            {selected ? selected.label : (placeholder ?? "Selecione...")}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        </button>

        {open && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite para filtrar…"
                className="w-full text-sm outline-none placeholder:text-gray-400"
              />
            </div>
            <ul className="max-h-60 overflow-y-auto py-1">
              {placeholder && (
                <li>
                  <button
                    type="button"
                    onClick={() => pick("")}
                    className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50"
                  >
                    {placeholder}
                  </button>
                </li>
              )}
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-400">Nada encontrado</li>
              ) : (
                filtered.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => pick(o.value)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${o.value === value ? "bg-blue-50 font-medium text-blue-700" : "text-gray-700"}`}
                    >
                      {o.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
