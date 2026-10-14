"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

// Pede, no primeiro acesso em cada aparelho, autorização para as notificações do Justio
// (resumo das 6h e lembretes de audiência). Se já autorizou, só garante a inscrição.

const DISPENSADO = "justio_notificacoes_dispensado";

function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function inscrever(): Promise<void> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = (await (await fetch("/api/notificacoes")).json()) as { publicKey: string | null };
    if (!publicKey) throw new Error("Notificações ainda não configuradas no servidor.");
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(publicKey) });
  }
  await fetch("/api/notificacoes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ acao: "inscrever", subscription: sub.toJSON() }),
  });
}

export function AtivarNotificacoes() {
  const [mostrar, setMostrar] = useState<"pedir" | "iphone" | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let dispensado = false;
    try {
      dispensado = localStorage.getItem(DISPENSADO) === "1";
    } catch {
      // sem armazenamento: pergunta de novo, sem problema
    }
    const suporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    const iphone = /iPhone|iPad/.test(navigator.userAgent);
    const instalado = window.matchMedia("(display-mode: standalone)").matches;
    let tarefa: ReturnType<typeof setTimeout> | undefined;
    if (!suporta) {
      // No iPhone, as notificações só funcionam com o Justio instalado na Tela de Início.
      if (iphone && !instalado && !dispensado) tarefa = setTimeout(() => setMostrar("iphone"), 0);
      return () => clearTimeout(tarefa);
    }
    if (Notification.permission === "granted") inscrever().catch(() => undefined);
    else if (Notification.permission === "default" && !dispensado) tarefa = setTimeout(() => setMostrar("pedir"), 0);
    return () => clearTimeout(tarefa);
  }, []);

  function dispensar() {
    try {
      localStorage.setItem(DISPENSADO, "1");
    } catch {
      // ignora
    }
    setMostrar(null);
  }

  async function ativar() {
    setErro("");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") return dispensar();
      await inscrever();
      await fetch("/api/notificacoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acao: "testar" }) });
      setMostrar(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }

  if (!mostrar) return null;
  return (
    <div className="flex items-start gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Bell className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {mostrar === "pedir" ? (
          <>
            <p className="font-medium">Receber os avisos do Justio neste aparelho?</p>
            <p className="text-xs text-amber-800">Resumo do dia às 6h (prazos, audiências, atendimentos, publicações) e lembrete de audiência 3 dias antes.</p>
            {erro && <p className="mt-1 text-xs text-red-700">{erro}</p>}
            <div className="mt-2 flex gap-2">
              <button onClick={ativar} className="rounded-lg bg-[#21181d] px-3 py-1.5 text-xs font-semibold text-white">
                Ativar notificações
              </button>
              <button onClick={dispensar} className="rounded-lg px-3 py-1.5 text-xs text-amber-900">
                Agora não
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs">
            Para receber os avisos do Justio no iPhone, toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong> e abra o
            Justio por lá.
          </p>
        )}
      </div>
      <button onClick={dispensar} className="shrink-0 text-amber-700" title="Fechar">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
