import webpush, { type PushSubscription } from "web-push";
import { supabase } from "@/lib/supabase";
import { envLimpo } from "@/lib/env";

// Notificações no celular/computador da Carol (Web Push). Cada aparelho autorizado vira
// uma linha em push_inscricoes; inscrições que o navegador cancelou (404/410) são apagadas.

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configurado = false;
function configurar(): boolean {
  if (configurado) return true;
  const pub = envLimpo("VAPID_PUBLIC_KEY");
  const priv = envLimpo("VAPID_PRIVATE_KEY");
  if (!pub || !priv) return false;
  webpush.setVapidDetails("mailto:caroline@carolinefraga.com.br", pub, priv);
  configurado = true;
  return true;
}

export function vapidPublicKey(): string | null {
  return envLimpo("VAPID_PUBLIC_KEY") ?? null;
}

export async function salvarInscricao(sub: PushSubscription, aparelho?: string): Promise<void> {
  const { error } = await supabase
    .from("push_inscricoes")
    .upsert({ endpoint: sub.endpoint, keys: sub.keys, aparelho: aparelho?.slice(0, 200) ?? null }, { onConflict: "endpoint" });
  if (error) throw new Error(error.message);
}

export async function removerInscricao(endpoint: string): Promise<void> {
  await supabase.from("push_inscricoes").delete().eq("endpoint", endpoint);
}

/** Envia para todos os aparelhos autorizados. Retorna quantos receberam. */
export async function enviarPush(payload: PushPayload): Promise<number> {
  if (!configurar()) return 0;
  const { data } = await supabase.from("push_inscricoes").select("endpoint,keys");
  let enviados = 0;
  await Promise.all(
    ((data ?? []) as PushSubscription[]).map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
        enviados++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await removerInscricao(sub.endpoint);
      }
    })
  );
  return enviados;
}

/** Marca uma notificação como enviada; false se já tinha sido (evita repetir quando o cron roda de novo). */
export async function primeiraVez(chave: string): Promise<boolean> {
  const { error } = await supabase.from("notificacoes_enviadas").insert({ chave });
  return !error;
}
