// Links do WhatsApp. Com celular: abre a conversa do cliente. Sem celular: abre o WhatsApp
// para escolher o contato. O número pode vir com ou sem 55, com ou sem máscara.
export function foneWhatsApp(celular?: string | null): string {
  let d = String(celular ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 ? d : "";
}

export function linkWhatsApp(texto: string, celular?: string | null): string {
  const fone = foneWhatsApp(celular);
  const t = encodeURIComponent(texto);
  return fone ? `https://wa.me/${fone}?text=${t}` : `https://api.whatsapp.com/send?text=${t}`;
}

/** Copia texto; se o navegador bloquear a área de transferência, usa o método antigo. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch { /* segue para o método antigo */ }
  try {
    const el = document.createElement("textarea");
    el.value = texto;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    el.setSelectionRange(0, texto.length);
    const ok = document.execCommand("copy");
    el.remove();
    return ok;
  } catch {
    return false;
  }
}
