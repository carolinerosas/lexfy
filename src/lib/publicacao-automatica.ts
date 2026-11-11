// O que acontece quando entra publicação nova (rotina diária ou busca manual):
// - processo cadastrado: lança o prazo (e a audiência, se o texto marcar uma) e avisa no celular;
//   como prazos e audiências estão no feed do calendário, aparecem lá também;
// - processo não cadastrado: avisa perguntando se quer incluir o caso.
import { supabase } from "@/lib/supabase";
import { enviarPush, primeiraVez } from "@/lib/push";
import { detectarAudiencia, detectarPrazo, extrairCNJ, vencimentoDaPublicacao } from "@/lib/prazo-publicacao";

const USER_ID = "lexfy_shared";

export interface PublicacaoSalva { id: string; processo_id?: string; titulo?: string; conteudo?: string; data_publicacao: string; diario: string }
interface ProcessoResumo { id: string; numero?: string | null; tipo?: string | null; titulo?: string | null; cliente_nome?: string | null }

const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

export async function aposSalvarPublicacoes(novas: PublicacaoSalva[], processos: ProcessoResumo[]): Promise<{ prazos: number; audiencias: number; avisos: number }> {
  const porId = new Map(processos.map((p) => [p.id, p]));
  let prazos = 0, audiencias = 0, avisos = 0;
  const semCaso: { pub: PublicacaoSalva; numero: string | null }[] = [];

  for (const pub of novas) {
    const proc = pub.processo_id ? porId.get(pub.processo_id) : undefined;
    if (!proc) { semCaso.push({ pub, numero: extrairCNJ(pub.titulo, pub.conteudo) }); continue; }
    const texto = `${pub.titulo}\n${pub.conteudo ?? ""}`;
    const nome = [proc.cliente_nome, proc.titulo].filter(Boolean).join(" · ") || proc.numero || "Processo";
    const linhas: string[] = [];

    const lido = detectarPrazo(texto);
    const conta = lido ? vencimentoDaPublicacao(pub.data_publicacao, lido, proc.tipo) : null;
    const titulo = lido ? `${lido.ato} (${lido.dias} dias${conta?.uteis ? " úteis" : ""})` : "Conferir publicação: prazo não identificado";
    const vence = conta?.vencimento ?? vencimentoDaPublicacao(pub.data_publicacao, { dias: 1, uteis: true, ato: "", trecho: "" }).vencimento;
    const { error: ePrazo } = await supabase.from("prazos").insert({
      id: crypto.randomUUID(), processo_id: proc.id, titulo, data_prazo: vence, concluido: false, prioridade: "alta", user_id: USER_ID, created_at: new Date().toISOString(),
      descricao: lido
        ? `Lançado automaticamente da publicação de ${br(pub.data_publicacao)} (${pub.diario}): “${lido.trecho}”. Contagem a partir de ${br(conta!.inicio)}. Confira feriados locais e a contagem no caso concreto.`
        : `Publicação de ${br(pub.data_publicacao)} (${pub.diario}) sem prazo em dias no texto. Leia e ajuste o prazo.`,
    });
    if (!ePrazo) { prazos++; linhas.push(lido ? `Prazo: ${titulo}, vence ${br(vence)}` : `Sem prazo no texto: leia até ${br(vence)}`); }

    const aud = detectarAudiencia(texto);
    if (aud) {
      const quando = new Date(aud.data_hora).toISOString();
      const { data: ja } = await supabase.from("audiencias").select("id").eq("processo_id", proc.id).eq("data_hora", quando).limit(1);
      if (!ja?.length) {
        const { error: eAud } = await supabase.from("audiencias").insert({
          id: crypto.randomUUID(), processo_id: proc.id, titulo: "Audiência (da publicação)", data_hora: quando, realizada: false, user_id: USER_ID, created_at: new Date().toISOString(),
          observacoes: `Marcada pela publicação de ${br(pub.data_publicacao)}: “${aud.trecho}”. Confira local e modalidade.`,
        });
        if (!eAud) { audiencias++; linhas.push(`Audiência em ${br(aud.data_hora)} às ${aud.data_hora.slice(11, 16)}`); }
      }
    }

    if (linhas.length && (await primeiraVez(`pub-prazo-${pub.id}`))) {
      avisos += await enviarPush({ title: `Publicação nova: ${nome}`.slice(0, 90), body: linhas.join("\n"), url: `/casos/${proc.id}`, tag: `pub-${pub.id}` });
    }
  }

  // processo fora do Justio: um aviso por número, perguntando se quer cadastrar
  const vistos = new Set<string>();
  for (const { pub, numero } of semCaso) {
    const chave = numero ?? pub.id;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    if (!(await primeiraVez(`pub-semcaso-${chave}`))) continue;
    avisos += await enviarPush({
      title: "Publicação de processo não cadastrado",
      body: `${numero ? `Processo ${numero}` : pub.titulo ?? "Sem número"}. Quer incluir o caso no Justio? Toque para ver.`,
      url: `/publicacoes?ver=sem`, tag: `pub-semcaso-${chave}`,
    });
  }
  return { prazos, audiencias, avisos };
}
