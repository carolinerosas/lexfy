import { envLimpo } from "@/lib/env";

// E-mail do Portal do Cliente (recuperar senha), pelo Resend — mesma conta e domínio
// verificado (carolinefraga.com.br) da Ciranda.

export async function enviarEmailCliente(para: string, nome: string, link: string): Promise<boolean> {
  const chave = envLimpo("RESEND_API_KEY");
  if (!chave) return false;
  const primeiro = nome.split(" ")[0].replace(/[<>&]/g, "");
  const texto = `Olá, ${primeiro}!\n\nRecebemos um pedido para criar uma senha nova na Área do Cliente do escritório Caroline Fraga Advocacia. O link abaixo vale por 1 hora.\n\nSe não foi você, ignore este e-mail: sua senha atual continua valendo.`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;color:#27272a;line-height:1.5">
    ${texto.split("\n").filter(Boolean).map((l) => `<p style="margin:0 0 12px">${l}</p>`).join("")}
    <p style="margin:24px 0"><a href="${link}" style="background:#21181d;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">Criar senha nova</a></p>
    <p style="font-size:12px;color:#a1a1aa">Se o botão não funcionar, copie este endereço: ${link}</p>
    <p style="font-size:12px;color:#a1a1aa">Caroline Fraga Advocacia · OAB/RJ 165.955 · WhatsApp (24) 99279-1034</p>
  </div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: envLimpo("RESEND_FROM_CLIENTE") ?? "Caroline Fraga Advocacia <noreply@carolinefraga.com.br>",
      to: para,
      subject: "Área do Cliente: criar senha nova",
      text: `${texto}\n\n${link}`,
      html,
    }),
  }).catch(() => null);
  return !!r?.ok;
}
