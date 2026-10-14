// Tudo que o bot pode PROPOR gravar no Justio. O modelo só propõe (ferramentas propor_*);
// a proposta fica guardada em telegram_propostas e só é gravada quando a Carol toca em
// "Salvar" no Telegram.
import type Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import {
  createAcordo,
  createAnotacao,
  createAtendimento,
  createAudiencia,
  createCliente,
  createContaEscritorio,
  createHonorario,
  createMovimentacao,
  createPrazo,
  createProcesso,
  createTarefa,
  registrarRecebimento,
  updateAcordoParcela,
  updateContaEscritorio,
  updateProcesso,
} from "@/lib/store";
import type { Honorario, AtendimentoTipo, AudienciaTipo, ContaEscritorioCategoria, PrazoTipo, Prioridade, ProcessoResultadoTipo } from "@/types";

type Dados = Record<string, unknown>;

interface TipoProposta {
  ferramenta: Anthropic.Beta.BetaTool;
  titulo: string;
  resumo: (d: Dados) => string[];
  gravar: (d: Dados) => Promise<void>;
}

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

function dataBR(iso: unknown): string {
  const t = s(iso);
  const [data, hora] = t.split("T");
  const [a, m, d] = data.split("-");
  return d ? `${d}/${m}/${a}${hora ? ` às ${hora.slice(0, 5)}` : ""}` : t;
}

function reais(v: unknown): string {
  return n(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ROTULO = {
  type: "string",
  description: "Como mostrar à Carol: cliente e processo, ex.: 'Raphael Souza — Execução Penal 0001234-56.2024.8.19.0001'",
};
const PROCESSO_ID = { type: "string", description: "id do processo, vindo do 'buscar'" };
const PRIORIDADE = { type: "string", enum: ["alta", "media", "baixa"] };

function ferramenta(name: string, description: string, properties: Dados, required: string[]): Anthropic.Beta.BetaTool {
  return {
    name,
    description: `${description} NÃO grava: a Carol confirma num botão.`,
    input_schema: { type: "object", properties, required, additionalProperties: false },
  };
}

function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

export const TIPOS: Record<string, TipoProposta> = {
  registro: {
    titulo: "📌 Registrar no Justio?",
    ferramenta: ferramenta(
      "propor_registro",
      "Propõe gravar um andamento (fato do processo: decisão, despacho, audiência realizada) ou uma anotação interna, no processo ou na pasta do cliente.",
      {
        destino: { type: "string", enum: ["processo", "cliente"] },
        id: { type: "string", description: "id do processo ou do cliente, vindo do 'buscar'" },
        rotulo: ROTULO,
        tipo: { type: "string", enum: ["andamento", "anotacao"] },
        titulo: { type: "string", description: "Título curto (só para anotação)" },
        texto: { type: "string", description: "Texto a gravar, objetivo e em linguagem jurídica correta" },
        data: { type: "string", description: "Data do fato, AAAA-MM-DD" },
      },
      ["destino", "id", "rotulo", "tipo", "texto", "data"]
    ),
    resumo: (d) => [
      `Onde: ${s(d.rotulo)}`,
      `Tipo: ${d.tipo === "andamento" && d.destino === "processo" ? "Andamento" : "Anotação"}`,
      `Data: ${dataBR(d.data)}`,
      ...(d.titulo && d.tipo === "anotacao" ? [`Título: ${s(d.titulo)}`] : []),
      "",
      s(d.texto),
    ],
    gravar: async (d) => {
      if (d.destino === "processo" && d.tipo === "andamento") {
        const mov = await createMovimentacao({
          processo_id: s(d.id),
          descricao: s(d.texto),
          data_movimentacao: s(d.data),
          fonte: "Telegram",
          lida: true,
        });
        if (!mov) throw new Error("O Justio não aceitou o andamento");
        return;
      }
      await createAnotacao({
        processo_id: d.destino === "processo" ? s(d.id) : undefined,
        cliente_id: d.destino === "cliente" ? s(d.id) : undefined,
        titulo: s(d.titulo) || "Registro via Telegram",
        conteudo: s(d.texto),
      });
    },
  },

  honorarios: {
    titulo: "💰 Lançar honorários no Justio?",
    ferramenta: ferramenta(
      "propor_honorarios",
      "Propõe lançar honorários NOVOS (cobrança que ainda não existe) no financeiro do processo: a cobrança e, se ela disser, o pagamento recebido (o saldo fica em aberto automaticamente). Use sempre que ela falar de honorários, valor cobrado/combinado ou pagamento do cliente; nunca como anotação.",
      {
        processo_id: PROCESSO_ID,
        rotulo: ROTULO,
        descricao: { type: "string", description: "Ex.: 'Honorários contratuais — defesa criminal'" },
        tipo: { type: "string", enum: ["contratual", "sucumbencial", "exito", "outro"] },
        valor_cobrado: { type: "number", description: "Valor total cobrado, em reais" },
        data_lancamento: { type: "string", description: "Data da cobrança, AAAA-MM-DD" },
        vencimento: { type: "string", description: "Vencimento do saldo, AAAA-MM-DD, se ela disser" },
        valor_pago: { type: "number", description: "Valor já pago, em reais, se ela disser" },
        data_pagamento: { type: "string", description: "Data do pagamento, AAAA-MM-DD" },
      },
      ["processo_id", "rotulo", "descricao", "tipo", "valor_cobrado", "data_lancamento"]
    ),
    resumo: (d) => {
      const pago = n(d.valor_pago);
      return [
        `Onde: ${s(d.rotulo)}`,
        `Descrição: ${s(d.descricao)} (${s(d.tipo)})`,
        `Cobrado: ${reais(d.valor_cobrado)} em ${dataBR(d.data_lancamento)}`,
        ...(pago > 0 ? [`Pago: ${reais(pago)} em ${dataBR(d.data_pagamento || d.data_lancamento)}`] : []),
        `Saldo em aberto: ${reais(Math.max(0, n(d.valor_cobrado) - pago))}${d.vencimento ? ` — vence ${dataBR(d.vencimento)}` : ""}`,
      ];
    },
    gravar: async (d) => {
      const cobranca = await createHonorario({
        processo_id: s(d.processo_id),
        descricao: s(d.descricao),
        valor: n(d.valor_cobrado),
        tipo: s(d.tipo) as "contratual",
        categoria: "cobranca",
        status: "pendente",
        data_lancamento: s(d.data_lancamento),
        data_vencimento: s(d.vencimento) || undefined,
      });
      if (!cobranca) throw new Error("O Justio não aceitou a cobrança");
      if (n(d.valor_pago) > 0) {
        await registrarRecebimento(cobranca, {
          data: s(d.data_pagamento) || s(d.data_lancamento),
          valorRecebido: n(d.valor_pago),
          vencimentoDiferenca: s(d.vencimento) || undefined,
        });
      }
    },
  },

  prazo: {
    titulo: "⏰ Criar prazo?",
    ferramenta: ferramenta(
      "propor_prazo",
      "Propõe criar um prazo processual no processo.",
      {
        processo_id: PROCESSO_ID,
        rotulo: ROTULO,
        titulo: { type: "string", description: "Ex.: 'Resposta à acusação', 'Apelação'" },
        data_prazo: { type: "string", description: "Data final do prazo, AAAA-MM-DD" },
        tipo: { type: "string", enum: ["recurso", "contestacao", "peticao", "contrarrazoes", "outro"] },
        prioridade: PRIORIDADE,
        descricao: { type: "string" },
      },
      ["processo_id", "rotulo", "titulo", "data_prazo", "prioridade"]
    ),
    resumo: (d) => [
      `Onde: ${s(d.rotulo)}`,
      `Prazo: ${s(d.titulo)}`,
      `Vence: ${dataBR(d.data_prazo)} · prioridade ${s(d.prioridade)}`,
      ...(d.descricao ? ["", s(d.descricao)] : []),
    ],
    gravar: async (d) => {
      const p = await createPrazo({
        processo_id: s(d.processo_id),
        titulo: s(d.titulo),
        descricao: s(d.descricao) || undefined,
        data_prazo: s(d.data_prazo),
        concluido: false,
        tipo: (s(d.tipo) || undefined) as PrazoTipo | undefined,
        prioridade: (s(d.prioridade) || "media") as Prioridade,
      });
      if (!p) throw new Error("O Justio não aceitou o prazo");
    },
  },

  tarefa: {
    titulo: "✅ Criar tarefa?",
    ferramenta: ferramenta(
      "propor_tarefa",
      "Propõe criar uma tarefa (algo a fazer) no processo.",
      {
        processo_id: PROCESSO_ID,
        rotulo: ROTULO,
        titulo: { type: "string" },
        data_limite: { type: "string", description: "AAAA-MM-DD, se houver" },
        prioridade: PRIORIDADE,
        descricao: { type: "string" },
      },
      ["processo_id", "rotulo", "titulo", "prioridade"]
    ),
    resumo: (d) => [
      `Onde: ${s(d.rotulo)}`,
      `Tarefa: ${s(d.titulo)}`,
      `${d.data_limite ? `Até ${dataBR(d.data_limite)} · ` : ""}prioridade ${s(d.prioridade)}`,
      ...(d.descricao ? ["", s(d.descricao)] : []),
    ],
    gravar: async (d) => {
      await createTarefa({
        processo_id: s(d.processo_id),
        titulo: s(d.titulo),
        descricao: s(d.descricao) || undefined,
        data_limite: s(d.data_limite) || undefined,
        concluida: false,
        prioridade: (s(d.prioridade) || "media") as Prioridade,
      });
    },
  },

  audiencia: {
    titulo: "⚖️ Marcar audiência?",
    ferramenta: ferramenta(
      "propor_audiencia",
      "Propõe cadastrar uma audiência designada no processo.",
      {
        processo_id: PROCESSO_ID,
        rotulo: ROTULO,
        titulo: { type: "string", description: "Ex.: 'Audiência de instrução e julgamento', 'Audiência de custódia'" },
        data_hora: { type: "string", description: "AAAA-MM-DDTHH:MM (horário de Brasília)" },
        tipo: { type: "string", enum: ["instrucao", "conciliacao", "julgamento", "una", "outro"] },
        local: { type: "string", description: "Fórum/sala, ou 'Teams/videoconferência' com link se houver" },
      },
      ["processo_id", "rotulo", "titulo", "data_hora"]
    ),
    resumo: (d) => [
      `Onde: ${s(d.rotulo)}`,
      `Audiência: ${s(d.titulo)}`,
      `Quando: ${dataBR(d.data_hora)}`,
      ...(d.local ? [`Local: ${s(d.local)}`] : []),
    ],
    gravar: async (d) => {
      const a = await createAudiencia({
        processo_id: s(d.processo_id),
        titulo: s(d.titulo),
        data_hora: s(d.data_hora),
        local: s(d.local) || undefined,
        tipo: (s(d.tipo) || undefined) as AudienciaTipo | undefined,
        realizada: false,
      });
      if (!a) throw new Error("O Justio não aceitou a audiência");
    },
  },

  atendimento: {
    titulo: "🗓️ Marcar atendimento?",
    ferramenta: ferramenta(
      "propor_atendimento",
      "Propõe agendar um atendimento (reunião/consulta) com cliente, com ou sem processo vinculado.",
      {
        cliente_nome: { type: "string" },
        cliente_id: { type: "string", description: "id do cliente, se já cadastrado" },
        processo_id: { type: "string", description: "id do processo, se for sobre um processo" },
        rotulo: ROTULO,
        data_hora: { type: "string", description: "AAAA-MM-DDTHH:MM (horário de Brasília)" },
        duracao_min: { type: "number" },
        tipo: { type: "string", enum: ["consulta_inicial", "retorno", "orientacao", "audiencia_prep", "outro"] },
        notas: { type: "string" },
        valor_cobrado: { type: "number", description: "Valor da consulta, se houver" },
      },
      ["cliente_nome", "rotulo", "data_hora"]
    ),
    resumo: (d) => [
      `Com: ${s(d.rotulo)}`,
      `Quando: ${dataBR(d.data_hora)}${d.duracao_min ? ` (${n(d.duracao_min)} min)` : ""}`,
      ...(d.tipo ? [`Tipo: ${s(d.tipo).replace("_", " ")}`] : []),
      ...(d.valor_cobrado ? [`Valor: ${reais(d.valor_cobrado)}`] : []),
      ...(d.notas ? ["", s(d.notas)] : []),
    ],
    gravar: async (d) => {
      const a = await createAtendimento({
        cliente_nome: s(d.cliente_nome),
        cliente_id: s(d.cliente_id) || undefined,
        processo_id: s(d.processo_id) || undefined,
        data_hora: s(d.data_hora),
        duracao_min: d.duracao_min ? n(d.duracao_min) : undefined,
        tipo: (s(d.tipo) || undefined) as AtendimentoTipo | undefined,
        status: "agendado",
        notas: s(d.notas) || undefined,
        valor_cobrado: d.valor_cobrado ? n(d.valor_cobrado) : undefined,
      });
      if (!a) throw new Error("O Justio não aceitou o atendimento");
    },
  },

  acordo: {
    titulo: "🤝 Registrar acordo?",
    ferramenta: ferramenta(
      "propor_acordo",
      "Propõe registrar um acordo com parcelas mensais (a receber pelo cliente/escritório ou a pagar). As parcelas são divididas igualmente a partir do primeiro vencimento.",
      {
        processo_id: { type: "string", description: "id do processo, se houver" },
        cliente_nome: { type: "string" },
        rotulo: ROTULO,
        direcao: { type: "string", enum: ["receber", "pagar"] },
        titulo: { type: "string", description: "Ex.: 'Acordo de alimentos', 'Acordo trabalhista'" },
        valor_total: { type: "number" },
        numero_parcelas: { type: "number" },
        primeiro_vencimento: { type: "string", description: "AAAA-MM-DD" },
        forma_pagamento: { type: "string" },
        pix: { type: "string" },
        observacoes: { type: "string" },
      },
      ["rotulo", "direcao", "titulo", "valor_total", "numero_parcelas", "primeiro_vencimento"]
    ),
    resumo: (d) => {
      const qtd = Math.max(1, Math.round(n(d.numero_parcelas)));
      return [
        `Onde: ${s(d.rotulo)}`,
        `Acordo: ${s(d.titulo)} (${d.direcao === "pagar" ? "a pagar" : "a receber"})`,
        `Total: ${reais(d.valor_total)} em ${qtd}x de ${reais(n(d.valor_total) / qtd)}`,
        `1º vencimento: ${dataBR(d.primeiro_vencimento)}, depois todo mês`,
        ...(d.forma_pagamento || d.pix ? [`Pagamento: ${[s(d.forma_pagamento), d.pix ? `PIX ${s(d.pix)}` : ""].filter(Boolean).join(" · ")}`] : []),
        ...(d.observacoes ? ["", s(d.observacoes)] : []),
      ];
    },
    gravar: async (d) => {
      const qtd = Math.max(1, Math.round(n(d.numero_parcelas)));
      const total = Math.round(n(d.valor_total) * 100);
      const base = Math.floor(total / qtd);
      const parcelas = Array.from({ length: qtd }, (_, i) => ({
        valor: (i === qtd - 1 ? total - base * (qtd - 1) : base) / 100,
        data_vencimento: somarMeses(s(d.primeiro_vencimento), i),
      }));
      await createAcordo({
        processo_id: s(d.processo_id) || undefined,
        cliente_nome: s(d.cliente_nome) || undefined,
        direcao: d.direcao === "pagar" ? "pagar" : "receber",
        titulo: s(d.titulo),
        parcelas,
        forma_pagamento: s(d.forma_pagamento) || undefined,
        pix: s(d.pix) || undefined,
        observacoes: s(d.observacoes) || undefined,
      });
    },
  },

  receber_honorario: {
    titulo: "💰 Dar baixa em honorários?",
    ferramenta: ferramenta(
      "propor_receber_honorario",
      "Propõe registrar o recebimento de honorários JÁ LANÇADOS (cobrança em aberto achada com 'buscar_honorarios'). Pagamento parcial deixa o saldo em aberto; a mais, abate as próximas cobranças do processo.",
      {
        honorario_id: { type: "string" },
        rotulo: { type: "string", description: "Ex.: 'Almir Souza — Honorários contratuais, R$ 3.000,00 em aberto'" },
        valor_recebido: { type: "number" },
        data_pagamento: { type: "string", description: "AAAA-MM-DD" },
      },
      ["honorario_id", "rotulo", "valor_recebido", "data_pagamento"]
    ),
    resumo: (d) => [`Cobrança: ${s(d.rotulo)}`, `Recebido: ${reais(d.valor_recebido)} em ${dataBR(d.data_pagamento)}`],
    gravar: async (d) => {
      const { data, error } = await supabase.from("honorarios").select("*").eq("id", s(d.honorario_id)).maybeSingle();
      if (error || !data) throw new Error("Cobrança não encontrada");
      await registrarRecebimento(data as Honorario, { data: s(d.data_pagamento), valorRecebido: n(d.valor_recebido) });
    },
  },

  pagar_parcela: {
    titulo: "🤝 Dar baixa em parcela de acordo?",
    ferramenta: ferramenta(
      "propor_pagar_parcela",
      "Propõe marcar como paga/recebida uma parcela de acordo já lançado (ache a parcela com 'buscar_parcelas'). Sem número de parcela informado, use a parcela em aberto de vencimento mais antigo.",
      {
        parcela_id: { type: "string" },
        rotulo: { type: "string", description: "Ex.: 'Acordo do Almir — parcela 3/10, R$ 500,00, vence 10/10/2026 (a receber)'" },
        data_pagamento: { type: "string", description: "AAAA-MM-DD" },
      },
      ["parcela_id", "rotulo", "data_pagamento"]
    ),
    resumo: (d) => [`Parcela: ${s(d.rotulo)}`, `Paga em ${dataBR(d.data_pagamento)}`],
    gravar: async (d) => {
      await updateAcordoParcela(s(d.parcela_id), { pago: true, data_pagamento: s(d.data_pagamento) });
    },
  },

  resultado: {
    titulo: "🏁 Registrar resultado do processo?",
    ferramenta: ferramenta(
      "propor_resultado",
      "Propõe registrar o resultado do processo (sentença, pronúncia, pena, acordo) e, se ela disser, encerrar o processo.",
      {
        processo_id: PROCESSO_ID,
        rotulo: ROTULO,
        resultado_tipo: {
          type: "string",
          enum: ["sentenca_favoravel", "exito", "sentenca_desfavoravel", "pronuncia", "impronuncia", "pena", "acordo", "outro"],
        },
        resultado_descricao: { type: "string" },
        pena: { type: "string", description: "Pena aplicada, se houver (ex.: '5 anos e 4 meses, regime semiaberto')" },
        encerrar: { type: "boolean", description: "true se ela disser que o processo terminou" },
      },
      ["processo_id", "rotulo", "resultado_tipo", "resultado_descricao"]
    ),
    resumo: (d) => [
      `Onde: ${s(d.rotulo)}`,
      `Resultado: ${s(d.resultado_tipo).replace(/_/g, " ")}`,
      ...(d.pena ? [`Pena: ${s(d.pena)}`] : []),
      ...(d.encerrar ? ["E marcar o processo como encerrado"] : []),
      "",
      s(d.resultado_descricao),
    ],
    gravar: async (d) => {
      await updateProcesso(s(d.processo_id), {
        resultado_tipo: s(d.resultado_tipo) as ProcessoResultadoTipo,
        resultado_descricao: s(d.resultado_descricao),
        ...(d.pena ? { pena: s(d.pena) } : {}),
        ...(d.encerrar ? { status: "encerrado" as const } : {}),
      });
    },
  },

  cliente: {
    titulo: "👤 Cadastrar cliente?",
    ferramenta: ferramenta(
      "propor_cliente",
      "Propõe cadastrar um cliente novo (confira antes com 'buscar' se ele já existe).",
      {
        nome: { type: "string" },
        cpf: { type: "string" },
        rg: { type: "string" },
        celular: { type: "string" },
        email: { type: "string" },
        profissao: { type: "string" },
        estado_civil: { type: "string" },
        cidade: { type: "string" },
        uf: { type: "string" },
        unidade_prisional: { type: "string", description: "Se estiver preso" },
        observacoes: { type: "string" },
      },
      ["nome"]
    ),
    resumo: (d) =>
      [
        `Nome: ${s(d.nome)}`,
        d.cpf && `CPF: ${s(d.cpf)}`,
        d.rg && `RG: ${s(d.rg)}`,
        d.celular && `Celular: ${s(d.celular)}`,
        d.email && `E-mail: ${s(d.email)}`,
        d.profissao && `Profissão: ${s(d.profissao)}`,
        d.estado_civil && `Estado civil: ${s(d.estado_civil)}`,
        (d.cidade || d.uf) && `Cidade: ${[s(d.cidade), s(d.uf)].filter(Boolean).join("/")}`,
        d.unidade_prisional && `Unidade prisional: ${s(d.unidade_prisional)}`,
        d.observacoes && `\n${s(d.observacoes)}`,
      ].filter(Boolean) as string[],
    gravar: async (d) => {
      const campos = ["cpf", "rg", "celular", "email", "profissao", "estado_civil", "cidade", "uf", "unidade_prisional", "observacoes"];
      await createCliente({
        nome: s(d.nome),
        ...Object.fromEntries(campos.filter((c) => d[c]).map((c) => [c, s(d[c])])),
      });
    },
  },

  processo: {
    titulo: "📁 Cadastrar processo?",
    ferramenta: ferramenta(
      "propor_processo",
      "Propõe cadastrar um processo novo. Se o cliente ainda não existir no Justio, use criar_cliente=true para cadastrá-lo junto (só com o nome).",
      {
        numero: { type: "string", description: "Número CNJ, se houver" },
        titulo: { type: "string", description: "Ex.: 'Ação penal — tráfico', 'Divórcio litigioso'" },
        tipo: {
          type: "string",
          enum: ["civel", "familia", "criminal", "juri", "execucao_penal", "inquerito_policial", "trabalhista", "previdenciario", "tributario", "federal", "outro"],
        },
        cliente_id: { type: "string", description: "id do cliente, se já cadastrado" },
        cliente_nome: { type: "string" },
        criar_cliente: { type: "boolean" },
        parte_contraria: { type: "string" },
        tribunal: { type: "string" },
        vara: { type: "string" },
        comarca: { type: "string" },
        uf: { type: "string" },
        tipo_penal: { type: "string", description: "Crime imputado, se criminal" },
        unidade_prisional: { type: "string" },
        descricao: { type: "string" },
      },
      ["titulo", "tipo", "cliente_nome"]
    ),
    resumo: (d) =>
      [
        `Cliente: ${s(d.cliente_nome)}${d.criar_cliente && !d.cliente_id ? " (cadastrar também)" : ""}`,
        `Processo: ${s(d.titulo)}${d.numero ? ` · ${s(d.numero)}` : ""}`,
        `Tipo: ${s(d.tipo).replace(/_/g, " ")}`,
        d.parte_contraria && `Parte contrária: ${s(d.parte_contraria)}`,
        (d.vara || d.comarca) && `Juízo: ${[s(d.vara), s(d.comarca), s(d.uf)].filter(Boolean).join(" · ")}`,
        d.tipo_penal && `Imputação: ${s(d.tipo_penal)}`,
        d.unidade_prisional && `Unidade prisional: ${s(d.unidade_prisional)}`,
        d.descricao && `\n${s(d.descricao)}`,
      ].filter(Boolean) as string[],
    gravar: async (d) => {
      let clienteId = s(d.cliente_id) || undefined;
      if (!clienteId && d.criar_cliente) {
        clienteId = (await createCliente({ nome: s(d.cliente_nome) })).id;
      }
      const campos = ["parte_contraria", "tribunal", "vara", "comarca", "uf", "tipo_penal", "unidade_prisional", "descricao"];
      await createProcesso({
        numero: s(d.numero),
        titulo: s(d.titulo),
        tipo: s(d.tipo),
        status: "ativo",
        cliente_id: clienteId,
        cliente_nome: s(d.cliente_nome),
        ...Object.fromEntries(campos.filter((c) => d[c]).map((c) => [c, s(d[c])])),
      });
    },
  },

  conta: {
    titulo: "🧾 Lançar conta do escritório?",
    ferramenta: ferramenta(
      "propor_conta",
      "Propõe lançar uma conta/despesa do escritório no Financeiro (aluguel, internet, contador, tributos…). Se ela disser que já pagou, use paga=true com a data.",
      {
        descricao: { type: "string" },
        valor: { type: "number" },
        categoria: {
          type: "string",
          enum: ["aluguel", "condominio", "internet", "telefone", "energia", "agua", "software", "contador", "tributos", "marketing", "material", "servicos", "outro"],
        },
        data_vencimento: { type: "string", description: "AAAA-MM-DD" },
        recorrente: { type: "boolean", description: "true se é conta mensal fixa" },
        paga: { type: "boolean" },
        data_pagamento: { type: "string", description: "AAAA-MM-DD, se paga" },
        forma_pagamento: { type: "string" },
        observacoes: { type: "string" },
      },
      ["descricao", "valor", "categoria", "data_vencimento"]
    ),
    resumo: (d) => [
      `Conta: ${s(d.descricao)} (${s(d.categoria)})`,
      `Valor: ${reais(d.valor)} · vence ${dataBR(d.data_vencimento)}${d.recorrente ? " · mensal" : ""}`,
      ...(d.paga ? [`Já paga em ${dataBR(d.data_pagamento || d.data_vencimento)}${d.forma_pagamento ? ` (${s(d.forma_pagamento)})` : ""}`] : []),
      ...(d.observacoes ? ["", s(d.observacoes)] : []),
    ],
    gravar: async (d) => {
      await createContaEscritorio({
        descricao: s(d.descricao),
        valor: n(d.valor),
        categoria: (s(d.categoria) || "outro") as ContaEscritorioCategoria,
        status: d.paga ? "paga" : "pendente",
        data_vencimento: s(d.data_vencimento),
        data_pagamento: d.paga ? s(d.data_pagamento) || s(d.data_vencimento) : undefined,
        forma_pagamento: s(d.forma_pagamento) || undefined,
        recorrente: d.recorrente === true,
        observacoes: s(d.observacoes) || undefined,
      });
    },
  },

  pagar_conta: {
    titulo: "💸 Marcar conta como paga?",
    ferramenta: ferramenta(
      "propor_pagar_conta",
      "Propõe marcar como paga uma conta do escritório já lançada (ache o id com 'buscar_contas').",
      {
        conta_id: { type: "string" },
        rotulo: { type: "string", description: "Ex.: 'Aluguel de outubro — R$ 1.200,00, vence 10/10/2026'" },
        data_pagamento: { type: "string", description: "AAAA-MM-DD" },
        forma_pagamento: { type: "string" },
      },
      ["conta_id", "rotulo", "data_pagamento"]
    ),
    resumo: (d) => [
      `Conta: ${s(d.rotulo)}`,
      `Paga em ${dataBR(d.data_pagamento)}${d.forma_pagamento ? ` (${s(d.forma_pagamento)})` : ""}`,
    ],
    gravar: async (d) => {
      await updateContaEscritorio(s(d.conta_id), {
        status: "paga",
        data_pagamento: s(d.data_pagamento),
        ...(d.forma_pagamento ? { forma_pagamento: s(d.forma_pagamento) } : {}),
      });
    },
  },

  triagem: {
    titulo: "📥 Não achei no Justio. Mandar para a Triagem?",
    ferramenta: ferramenta(
      "propor_triagem",
      "Propõe mandar a informação para a Triagem do Justio (onde a Carol revisa e cadastra cliente, processo e andamento de uma vez). Use quando o 'buscar' não achar o cliente ou o processo e ela não tiver pedido para cadastrar direto.",
      {
        texto: {
          type: "string",
          description: "Tudo que a Carol informou, organizado: nome do cliente, número do processo se houver, o fato/andamento e a data. Não invente nada.",
        },
      },
      ["texto"]
    ),
    resumo: (d) => [s(d.texto)],
    gravar: async (d) => {
      const base = process.env.JUSTIO_URL || "https://www.justio.com.br";
      const res = await fetch(`${base}/api/triagem/importar`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.JUSTIO_AGENT_TOKEN ?? ""}` },
        body: JSON.stringify({ texto: s(d.texto), persistir: true, origem: "telegram" }),
      });
      if (!res.ok) throw new Error(`Triagem respondeu ${res.status}`);
    },
  },
};

/** Nome da ferramenta (propor_x) → tipo da proposta (x). */
export const TIPO_POR_FERRAMENTA: Record<string, string> = Object.fromEntries(
  Object.entries(TIPOS).map(([tipo, t]) => [t.ferramenta.name, tipo])
);

export function textoProposta(tipo: string, dados: Dados): string {
  const t = TIPOS[tipo];
  return [t.titulo, ...t.resumo(dados)].join("\n");
}

export async function guardarProposta(tipo: string, dados: Dados): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("telegram_propostas").insert({ id, tipo, dados });
  if (error) throw new Error(error.message);
  return id;
}

/** Grava a proposta confirmada. Retorna false se ela já tinha sido decidida antes. */
export async function decidirProposta(id: string, salvar: boolean): Promise<{ tipo: string; jaDecidida: boolean }> {
  const { data, error } = await supabase.from("telegram_propostas").select("tipo,dados,status").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("Proposta não encontrada (é de uma versão antiga do bot? Manda de novo).");
  if (data.status !== "pendente") return { tipo: data.tipo, jaDecidida: true };
  if (salvar) await TIPOS[data.tipo].gravar(data.dados as Dados);
  await supabase
    .from("telegram_propostas")
    .update({ status: salvar ? "salva" : "cancelada", decidido_em: new Date().toISOString() })
    .eq("id", id);
  return { tipo: data.tipo, jaDecidida: false };
}
