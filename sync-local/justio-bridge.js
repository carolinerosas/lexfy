// Ponte local Justio <- Cowork.
// O agente do Cowork escreve arquivos .json na "outbox" (ele não tem rede pro justio.com.br).
// Este script roda no SEU computador (com internet de verdade), lê esses arquivos e
// envia pro Justio (Triagem ou Briefing), com dedup. Depois arquiva os enviados.
//
// Uso:
//   node justio-bridge.js          -> varre uma vez e sai (usado pela tarefa do Windows)
//   node justio-bridge.js --watch  -> fica varrendo a cada 10 min (pra testar)

import { readFile, readdir, mkdir, rename, copyFile, unlink, rm, access } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

const JUSTIO_URL = (process.env.JUSTIO_URL || "https://www.justio.com.br").replace(/\/+$/, "");
const TOKEN_PATH = process.env.JUSTIO_TOKEN_PATH || path.join(homedir(), ".justio-agent-token.txt");
const OUTBOX = process.env.JUSTIO_OUTBOX
  || path.join(homedir(), "OneDrive", "Documentos", "Claude", "justio", "outbox");
const INTERVAL_MS = 10 * 60 * 1000;
// Arquivos de cliente: o agente do Cowork deixa em <Claude>\justio\arquivos\<Nome do Cliente>\...
// e a ponte move para a pasta do cliente no OneDrive PROFISSIONAL.
const CLIENTES_RAIZ = process.env.JUSTIO_CLIENTES_DIR
  || path.join(homedir(), "OneDrive - Caroline Fraga", "Documentos", "01. Escritório", "Clientes");
const ARQUIVOS = process.env.JUSTIO_ARQUIVOS || path.join(OUTBOX, "..", "arquivos");

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

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// Pergunta ao Justio se o cliente/processo já existem e o que já foi lançado nos andamentos.
async function verificar(v, token) {
  const q = new URLSearchParams();
  if (v?.nome) q.set("nome", v.nome);
  if (v?.numero) q.set("numero", v.numero);
  if (![...q.keys()].length) return null;
  try {
    const res = await fetch(`${JUSTIO_URL}/api/triagem/verificar?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Monta o texto final da triagem. Se o item traz `andamentos` (lista {data, numero, descricao}),
// tira os que o Justio já tem e põe os novos numa seção ANDAMENTOS no fim do texto.
// Com `somente_andamentos` e nada novo, o item é pulado.
async function prepararTriagem(item, token) {
  let texto = item.texto || "";
  if (!Array.isArray(item.andamentos) || item.andamentos.length === 0) return { texto, pular: false };

  const verif = await verificar(item.verificar, token);
  let novos = item.andamentos;
  if (verif) {
    const chave = (d, desc) => `${String(d || "").slice(0, 10)}|${norm(desc).slice(0, 60)}`;
    const existentes = new Set(
      (verif.processos || []).flatMap((p) => p.ultimas_movimentacoes || []).map((m) => chave(m.data, m.descricao)),
    );
    novos = item.andamentos.filter((a) => !existentes.has(chave(a.data, a.descricao)));
  } else {
    log("aviso: não consegui conferir duplicidade; enviando todos os andamentos");
  }
  if (novos.length === 0 && item.somente_andamentos) return { texto, pular: true };
  if (novos.length) {
    texto += `\n\nANDAMENTOS\n${novos.map((a) => `${a.data || ""} | ${a.numero || ""} | ${a.descricao}`).join("\n")}`;
  }
  return { texto, pular: false };
}

async function enviarItem(item, token, textoTriagem) {
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
    body: JSON.stringify({ texto: textoTriagem ?? item.texto, persistir: true, origem: item.origem || "cowork", cowork }),
  });
  return res.ok;
}

const existe = (p) => access(p).then(() => true, () => false);

async function listarArquivos(dir, base = dir) {
  const itens = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const it of itens) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) out.push(...(await listarArquivos(full, base)));
    else out.push(path.relative(base, full));
  }
  return out;
}

// Acha a pasta existente do cliente (nome igual, ou todos os termos do nome numa única pasta).
// Retorna o nome da pasta, um nome novo (a criar) ou null se houver mais de uma candidata.
async function pastaDoCliente(nome) {
  const alvo = norm(nome);
  const termos = alvo.split(" ").filter((t) => t.length > 1);
  const pastas = (await readdir(CLIENTES_RAIZ, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory()).map((d) => d.name);
  const exata = pastas.find((p) => norm(p) === alvo);
  if (exata) return exata;
  const parecidas = pastas.filter((p) => termos.length >= 2 && termos.every((t) => norm(p).includes(t)));
  if (parecidas.length === 1) return parecidas[0];
  if (parecidas.length > 1) return null;
  return nome.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

async function moverArquivos() {
  const clientes = (await readdir(ARQUIVOS, { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory());
  for (const c of clientes) {
    const origem = path.join(ARQUIVOS, c.name);
    const arquivos = await listarArquivos(origem);
    if (arquivos.length === 0) continue;
    const pasta = await pastaDoCliente(c.name);
    if (!pasta) {
      log(`arquivos de "${c.name}": mais de uma pasta parecida em Clientes; deixei em ${origem} para você escolher`);
      continue;
    }
    let movidos = 0;
    let falhou = false;
    for (const rel of arquivos) {
      let destino = path.join(CLIENTES_RAIZ, pasta, rel);
      await mkdir(path.dirname(destino), { recursive: true });
      for (let n = 2; await existe(destino); n++) {
        const { dir, name, ext } = path.parse(path.join(CLIENTES_RAIZ, pasta, rel));
        destino = path.join(dir, `${name} (${n})${ext}`);
      }
      const de = path.join(origem, rel);
      try {
        await rename(de, destino);
      } catch {
        const copiou = await copyFile(de, destino).then(() => unlink(de)).then(() => true, (e) => {
          log(`ERRO movendo ${rel}:`, e.message);
          return false;
        });
        if (!copiou) {
          falhou = true;
          continue;
        }
      }
      movidos++;
    }
    if (!falhou) await rm(origem, { recursive: true, force: true }).catch(() => {});
    log(`arquivos de "${c.name}": ${movidos} movido(s) para ${path.join(CLIENTES_RAIZ, pasta)}`);
  }
}

async function varrer() {
  await moverArquivos().catch((e) => log("ERRO arquivos", e));
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

    let textoTriagem;
    if (item.tipo !== "briefing") {
      const prep = await prepararTriagem(item, token);
      if (prep.pular) {
        log(`${nome}: nenhum andamento novo; nada enviado`);
        await rename(full, path.join(enviadosDir, nome)).catch(() => {});
        pulados++;
        continue;
      }
      textoTriagem = prep.texto;
    }

    let sucesso = false;
    try {
      sucesso = await enviarItem(item, token, textoTriagem);
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
