"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, Key, CheckCircle2, ExternalLink, Download, Upload, HardDrive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DATA_KEYS = [
  "jur_processos",
  "jur_prazos",
  "jur_audiencias",
  "jur_movimentacoes",
  "jur_honorarios",
  "jur_publicacoes",
  "jur_atendimentos",
  "jur_clientes",
  "lexfy_datajud_apikey",
];

function exportarDados() {
  const backup: Record<string, unknown> = { _versao: 1, _exportado_em: new Date().toISOString() };
  DATA_KEYS.forEach((key) => {
    const val = localStorage.getItem(key);
    if (val) backup[key] = JSON.parse(val);
  });
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lexfy-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importarDados(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        let count = 0;
        DATA_KEYS.forEach((key) => {
          if (data[key] !== undefined) {
            localStorage.setItem(key, JSON.stringify(data[key]));
            count++;
          }
        });
        resolve(count);
      } catch {
        reject(new Error("Arquivo inválido"));
      }
    };
    reader.readAsText(file);
  });
}

const DATAJUD_KEY_STORAGE = "lexfy_datajud_apikey";

export function getDatajudApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(DATAJUD_KEY_STORAGE) ?? "";
}

export function setDatajudApiKey(key: string): void {
  localStorage.setItem(DATAJUD_KEY_STORAGE, key);
}

export default function ConfiguracoesPage() {
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "ok" | "erro">("idle");
  const [importMsg, setImportMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiKey(getDatajudApiKey());
  }, []);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const count = await importarDados(file);
      setImportMsg(`${count} categorias restauradas com sucesso! Recarregue a página.`);
      setImportStatus("ok");
    } catch {
      setImportMsg("Arquivo inválido. Use um backup gerado pelo Lexfy.");
      setImportStatus("erro");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleSave() {
    setDatajudApiKey(apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="px-8 py-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <Settings className="w-5 h-5 text-gray-400" />
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Configurações</h1>
        </div>
        <p className="text-gray-400 text-sm mt-1">Integrações e preferências do sistema</p>
      </div>

      {/* Backup & Restauração */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-gray-500" />
            <CardTitle>Backup & Restauração</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-600">
            Os dados ficam salvos no seu navegador. Use o backup para transferi-los entre dispositivos ou navegadores diferentes (ex: do computador para o site).
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-gray-500" />
                <p className="text-sm font-semibold text-gray-800">Exportar dados</p>
              </div>
              <p className="text-xs text-gray-500">Baixa um arquivo <code>.json</code> com todos os seus processos, clientes, prazos e demais registros.</p>
              <Button variant="secondary" onClick={exportarDados} className="w-full">
                <Download className="w-4 h-4" /> Baixar backup
              </Button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-gray-500" />
                <p className="text-sm font-semibold text-gray-800">Importar dados</p>
              </div>
              <p className="text-xs text-gray-500">Restaura um backup anterior. Os dados existentes neste navegador serão substituídos.</p>
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()} className="w-full">
                <Upload className="w-4 h-4" /> Carregar backup
              </Button>
            </div>
          </div>

          {importStatus !== "idle" && (
            <div className={`flex items-center gap-2 text-sm font-medium rounded-lg px-4 py-2.5 ${
              importStatus === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
            }`}>
              {importStatus === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : null}
              {importMsg}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-gray-500" />
            <CardTitle>DataJud — CNJ</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-gray-600">
            Para buscar movimentações processuais automaticamente, informe sua chave de acesso à API pública do DataJud (CNJ). O acesso é gratuito.
          </p>

          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-600">
            <p className="font-semibold text-gray-800">Como obter sua chave:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Acesse o portal do DataJud</li>
              <li>Crie uma conta gratuita (CPF + e-mail)</li>
              <li>Na área logada, vá em <strong>Credenciais → Gerar ApiKey</strong></li>
              <li>Copie a chave e cole abaixo</li>
            </ol>
            <a
              href="https://datajud-wiki.cnj.jus.br/api-publica/acesso"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-gray-900 font-medium underline underline-offset-2 mt-1"
            >
              Acessar portal DataJud <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Sua ApiKey</label>
            <Input
              type="password"
              placeholder="Cole aqui sua chave DataJud"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
            />
            <p className="text-xs text-gray-400">A chave é armazenada apenas neste navegador e nunca enviada a terceiros.</p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={!apiKey.trim()}>
              Salvar chave
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle2 className="w-4 h-4" /> Salvo com sucesso
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
