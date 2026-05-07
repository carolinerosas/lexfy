"use client";

import { useState, useEffect } from "react";
import { Settings, Key, CheckCircle2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  useEffect(() => {
    setApiKey(getDatajudApiKey());
  }, []);

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
