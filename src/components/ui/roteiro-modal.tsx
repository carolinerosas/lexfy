"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

// Roteiro de audiência preparado pela Carol: arquivo (.docx/.txt/.md) ou texto colado.
// Usado antes da audiência (lista de audiências / processo) e na tela ao vivo.

async function lerArquivo(arquivo: File): Promise<string> {
  if (!arquivo.name.toLowerCase().endsWith(".docx")) return (await arquivo.text()).trim();
  const mod = (await import("mammoth")) as unknown as {
    default?: { extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
    extractRawText?: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const mammoth = mod.default ?? mod;
  return (await mammoth.extractRawText!({ arrayBuffer: await arquivo.arrayBuffer() })).value.trim();
}

export function RoteiroModal({
  open,
  onClose,
  roteiro,
  nome,
  onSalvar,
}: {
  open: boolean;
  onClose: () => void;
  roteiro: string;
  nome: string;
  onSalvar: (roteiro: string, nome: string) => void | Promise<void>;
}) {
  const [texto, setTexto] = useState(roteiro);
  const [arquivo, setArquivo] = useState(nome);
  const [erro, setErro] = useState("");
  const [abertoAntes, setAbertoAntes] = useState(open);

  // Ao abrir, começa do roteiro atual.
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) {
      setTexto(roteiro);
      setArquivo(nome);
      setErro("");
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Roteiro de audiência" size="lg">
      <div className="space-y-3">
        <label className="block text-sm text-gray-600">
          Enviar arquivo (.docx, .txt ou .md)
          <input
            type="file"
            accept=".docx,.txt,.md"
            className="mt-1 block w-full text-sm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                setTexto(await lerArquivo(f));
                setArquivo(f.name);
              } catch (err) {
                setErro(`Não consegui ler o arquivo: ${err instanceof Error ? err.message : String(err)}`);
              }
            }}
          />
        </label>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <p className="text-xs text-gray-400">ou cole o texto abaixo</p>
        <textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            if (!arquivo) setArquivo("roteiro colado");
          }}
          rows={14}
          className="w-full rounded-lg border border-gray-200 p-3 text-sm"
          placeholder="Perguntas para cada testemunha, teses, pontos que não podem faltar nas alegações…"
        />
        <div className="flex justify-between gap-3">
          <Button variant="ghost" onClick={async () => { await onSalvar("", ""); onClose(); }} disabled={!roteiro && !texto}>
            Remover roteiro
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button onClick={async () => { await onSalvar(texto.trim(), texto.trim() ? arquivo || "roteiro colado" : ""); onClose(); }}>
              Salvar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
