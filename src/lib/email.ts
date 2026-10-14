import { envLimpo } from "@/lib/env";

// E-mails do Justio pelo Resend (mesma conta e domínio verificado do carolinefraga.com.br).

export const EMAIL_ACESSO = "caroline@carolinefraga.com.br";

export async function enviarEmail(para: string, assunto: string, texto: string, link: string): Promise<boolean> {
  const chave = envLimpo("RESEND_API_KEY");
  if (!chave) throw new Error("RESEND_API_KEY não configurada");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#27272a;line-height:1.5">
    ${texto.split("\n").map((l) => `<p style="margin:0 0 12px">${l.replace(/[<>&]/g, "")}</p>`).join("")}
    <p style="margin:24px 0"><a href="${link}" style="background:#21181d;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">Criar senha nova</a></p>
    <p style="font-size:12px;color:#a1a1aa">Se o botão não funcionar, copie este endereço: ${link}</p>
  </div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: envLimpo("RESEND_FROM") ?? "Justio <noreply@carolinefraga.com.br>",
      to: para,
      subject: assunto,
      text: `${texto}\n\n${link}`,
      html,
    }),
  }).catch(() => null);
  return !!r?.ok;
}
