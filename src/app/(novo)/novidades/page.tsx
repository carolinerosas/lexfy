import Link from "next/link";
import { Cabecalho } from "@/novo/components/ui";

const NOVO: [string, string, string][] = [
  ["31 áreas de atuação", "19 judiciais e 12 extrajudiciais, cada uma com ficha própria, fases e tabela de prazos.", "/areas"],
  ["Pessoas (RH)", "Equipe por vínculo, vencimentos, férias e ausências, ponto e banco de horas, remuneração, recrutamento, avaliações e capacitação.", "/pessoas"],
  ["Lançar e cobrar honorários", "Entrada e parcelas em um lançamento; cobrança com Pix copia e cola e mensagem pronta para o WhatsApp.", "/financeiro"],
  ["Captação que vira caso", "O contato que fecha contrato vira cliente, caso e honorário com um clique.", "/captacao"],
  ["Triagem com IA", "A mesma triagem do JUSTIO antigo, agora no menu novo.", "/importar"],
  ["Peças com IA e autos", "Dentro de cada caso, nas abas Peças com IA e Autos.", "/processos"],
  ["Audiência ao vivo", "Botão Ao vivo em cada audiência a realizar.", "/audiencias"],
  ["Documentos por modelo", "Procuração, contrato de honorários, declarações, substabelecimento, recibo e notificação preenchidos com os dados do caso.", "/documentos"],
  ["Relatório para o cliente", "Casos, fase, andamentos, próximos passos e chance de êxito, pronto para imprimir. Abra pela página de um cliente.", "/clientes"],
  ["Clientes presos na tela inicial", "Contagem dos 90 dias da revisão da prisão preventiva.", "/"],
  ["Prazo lançado a partir da publicação", "O sistema lê o prazo no texto da intimação, conta os dias e lança no caso.", "/publicacoes"],
  ["Conflito de interesses, procurações e correspondentes", "Checagem de nomes antes de aceitar a causa; validade de procurações; cadastro de correspondentes.", "/gestao"],
  ["Calculadoras", "Prazo processual, progressão de regime, prescrição penal e verbas rescisórias.", "/ferramentas"],
  ["Acordo em cada caso", "Aba Acordo com os termos próprios de cada área (alimentos e convivência, ANPP, verbas trabalhistas, transação tributária...) e as parcelas, as mesmas do JUSTIO antigo.", "/processos"],
  ["Execução penal completa", "Abas Incidentes e Comutação e indulto no caso de execução penal.", "/processos"],
  ["Orçamentos pelo cliente ou pelo caso", "Na tela do cliente aparecem os orçamentos dos casos e da captação, e dá para fazer um ali mesmo; o caso mostra os feitos pela tela do cliente.", "/clientes"],
  ["Arquivos do processo", "Aba Arquivos no caso: enviar, baixar e marcar o que o cliente pode ver.", "/processos"],
  ["Meus modelos", "Recibo, procuração e seus modelos em Word, preenchidos pelo formulário, no caso e na tela do cliente.", "/modelos"],
  ["Briefing do dia", "No menu, logo abaixo de Hoje.", "/briefing"],
  ["Roteiro de audiência", "Botão Roteiro em cada audiência.", "/audiencias"],
  ["Ditado por voz", "Microfone nos campos de texto (Chrome e Edge).", "/"],
  ["Senha, agenda no Google e integrações", "Em Configurações: trocar senha, link da agenda, perfil da advogada, DataJud, sincronizador e backup.", "/configuracoes"],
  ["Clientes de A a Z", "Índice por letra inicial na lista de clientes.", "/clientes"],
];

const ANTIGO: [string, string][] = [
  ["Portal do cliente (convites e acessos)", "Página do cliente no JUSTIO antigo. A tela nova é só pré-visualização."],
];

export default function Novidades() {
  return (
    <>
      <Cabecalho titulo="O que mudou" sub="O novo JUSTIO usa o mesmo banco do antigo. O que está aqui grava nos mesmos processos, prazos e honorários; o que ainda não foi refeito continua disponível no JUSTIO antigo." />
      <section className="mb-10">
        <h2 className="titulo mb-3 text-[20px]">No novo</h2>
        <ul className="grid gap-px overflow-hidden rounded-[16px] border border-line bg-line md:grid-cols-2">
          {NOVO.map(([t, d, href]) => (
            <li key={t} className="bg-surface"><Link href={href} className="group block h-full p-5 transition-colors hover:bg-porcelana"><span className="titulo block text-[16px] group-hover:underline">{t}</span><span className="mt-1 block text-[13.5px] text-ink-2">{d}</span></Link></li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="titulo mb-1 text-[20px]">Ainda só no JUSTIO antigo</h2>
        <p className="mb-3 text-ink-2">Acesse pelo item <Link href="/antigo" className="font-semibold text-ink underline">JUSTIO antigo</Link>, no fim do menu.</p>
        <ul className="painel">
          {ANTIGO.map(([t, d]) => <li key={t} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-line-2 px-5 py-3 last:border-0"><span className="font-semibold">{t}</span><span className="text-[13.5px] text-ink-2">{d}</span></li>)}
        </ul>
      </section>
    </>
  );
}
