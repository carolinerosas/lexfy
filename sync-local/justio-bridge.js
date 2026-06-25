// Ponte local Justio <- Cowork.
// O agente do Cowork escreve arquivos .json na "outbox" (ele não tem rede pro justio.com.br).
// Este script roda no SEU computador (com internet de verdade), lê esses arquivos e
// envia pro Justio (Triagem ou Briefing), com dedup. Depois arquiva os enviados.
//
// Uso:
//   node justio-bridge.js          -> varre uma vez e sai (usado pela tarefa do Windows)
//   node justio-bridge.js --watch  -> fica varrendo a cada 10 min (pra testar)

import { readFile, readdir, mkdir, rename } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const JUSTIO_URL = (process.env.JUSTIO_URL || "https://www.justio.com.br").replace(/\/+$/, "");
const TOKEN_PATH = process.env.JUSTIO_TOKEN_PATH || path.join(homedir(), ".justio-agent-token.txt");
const OUTBOX = process.env.JUSTIO_OUTBOX
  || path.join(homedir(), "OneDrive", "Documentos", "Claude", "justio", "outbox");
const INTERVAL_MS = 10 * 60 * 1000;

function log(...args) {
  console.log(`[ponte ${new Date().toISOString()}]`, ...args);
}

async function lerToken() {
  return (await readFile(TOKEN_PATH, "utf8")).trim();
}

// Conjunto do que o Justio já recebeu do Cowork (dedup), no formato "conversa_id::marcador".
async function jaEnviados(token) {
  try {
    const res = await fetch(`${JUSTIO_URL}/api/triagem/cowork-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    return new Set((data.enviados || []).map((e) => `${e.conversa_id}::${e.marcador}`));
  } catch {
    return new Set();
  }
}

async function enviarItem(item, token) {
  if (item.tipo === "briefing") {
    const res = await fetch(`${JUSTIO_URL}/api/briefing`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        data: item.data,
        conteudo: item.conteudo ?? item.texto,
        origem: item.origem || "cowork",
      }),
    });
    return res.ok;
  }
  // triagem (padrão)
  const cowork = item.cowork
    || (item.conversa_id ? { conversa_id: item.conversa_id, projeto: item.projeto, marcador: item.marcador } : undefined);
  const res = await fetch(`${JUSTIO_URL}/api/triagem/importar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ texto: item.texto, persistir: true, origem: item.origem || "cowork", cowork }),
  });
  return res.ok;
}

async function varrer() {
  await mkdir(OUTBOX, { recursive: true });
  const enviadosDir = path.join(OUTBOX, "enviados");
  const falhasDir = path.join(OUTBOX, "falhas");
  await mkdir(enviadosDir, { recursive: true });
  await mkdir(falhasDir, { recursive: true });

  const arquivos = (await readdir(OUTBOX)).filter((f) => f.toLowerCase().endsWith(".json"));
  if (arquivos.length === 0) return;

  let token;
  try {
    token = await lerToken();
  } catch {
    log(`ERRO: não consegui ler o token em ${TOKEN_PATH}`);
    return;
  }

  const enviados = await jaEnviados(token);
  let ok = 0;
  let pulados = 0;
  let falhou = 0;

  for (const nome of arquivos) {
    const full = path.join(OUTBOX, nome);
    let item;
    try {
      item = JSON.parse(await readFile(full, "utf8"));
    } catch {
      await rename(full, path.join(falhasDir, nome)).catch(() => {});
      falhou++;
      continue;
    }

    // dedup só pra triagem com conversa_id + marcador
    const c = item.cowork || (item.conversa_id ? { conversa_id: item.conversa_id, marcador: item.marcador } : null);
    if (item.tipo !== "briefing" && c && enviados.has(`${c.conversa_id}::${c.marcador}`)) {
      await rename(full, path.join(enviadosDir, nome)).catch(() => {});
      pulados++;
      continue;
    }

    let sucesso = false;
    try {
      sucesso = await enviarItem(item, token);
    } catch {
      sucesso = false;
    }

    if (sucesso) {
      await rename(full, path.join(enviadosDir, nome)).catch(() => {});
      ok++;
    } else {
      // deixa na outbox pra tentar de novo no próximo ciclo (pode ser erro temporário)
      falhou++;
    }
  }

  log(`enviados:${ok} pulados(já existiam):${pulados} falhas:${falhou}`);
}

const watch = process.argv.includes("--watch");
log(`iniciada. Outbox: ${OUTBOX} | Justio: ${JUSTIO_URL}`);
await varrer().catch((e) => log("ERRO", e));
if (watch) {
  setInterval(() => varrer().catch((e) => log("ERRO", e)), INTERVAL_MS);
}
