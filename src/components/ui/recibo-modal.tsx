"use client";

import { useEffect, useRef, useState } from "react";
import { Printer } from "lucide-react";
import { Modal } from "./modal";
import { Input } from "./input";
import { Select } from "./select";
import { Button } from "./button";
import { getCliente, getClientes } from "@/lib/store";
import { loadPerfilAdvogado, getPerfilAdvogado, type PerfilAdvogado } from "@/lib/perfil";
import { carregarTimbre, corpoRecibo, documentoRecibo, imprimirHtml, valorPorExtenso } from "@/lib/recibo";
import type { Cliente, Honorario, Processo } from "@/types";

const CIDADE_KEY = "justio_recibo_cidade";
// Largura de uma folha A4 (21cm) em px a 96 dpi — a prévia é essa folha reduzida.
const FOLHA_PX = 794;
const FOLHA_ALTURA_PX = 1123;

const formasPagamento = [
  { value: "", label: "Não informar" },
  { value: "PIX", label: "PIX" },
  { value: "transferência bancária", label: "Transferência bancária" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartão de crédito", label: "Cartão de crédito" },
  { value: "cartão de débito", label: "Cartão de débito" },
  { value: "boleto", label: "Boleto" },
  { value: "cheque", label: "Cheque" },
];

function hojeISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/** "Recebimento — Honorários contratuais — parcela 2/10" → "honorários contratuais — parcela 2/10". */
function referenteDe(descricao: string): string {
  let d = descricao.replace(/^recebimento\s*[—-]\s*/i, "").trim();
  if (!/honor/i.test(d)) d = `honorários advocatícios — ${d}`;
  return /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]/.test(d) ? d.charAt(0).toLowerCase() + d.slice(1) : d;
}

function lerCidade(): string {
  try { return localStorage.getItem(CIDADE_KEY) ?? ""; } catch { return ""; }
}

function salvarCidade(c: string) {
  try { localStorage.setItem(CIDADE_KEY, c); } catch { /* sem storage */ }
}

function nomeArquivo(cliente: string, data: string): string {
  return `Recibo - ${cliente} - ${data}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 -]/g, "")
    .trim();
}

type ProcessoRecibo = Pick<Processo, "numero" | "cliente_nome"> & { cliente_id?: string };

function cidadeDoCliente(c?: Cliente): string {
  return lerCidade() || (c?.cidade ? `${c.cidade}${c.uf ? `/${c.uf}` : ""}` : "");
}

// Emite recibo de um honorário já recebido (pagamento ou parcela quitada), no timbrado.
export function ReciboModal({
  honorario,
  cliente,
  processo,
  onClose,
}: {
  honorario: Honorario | null;
  cliente?: Cliente;
  processo?: ProcessoRecibo;
  onClose: () => void;
}) {
  if (!honorario) return null;
  // key: cada honorário abre um formulário novo, já preenchido.
  return <ReciboForm key={honorario.id} honorario={honorario} cliente={cliente} processo={processo} onClose={onClose} />;
}

function ReciboForm({
  honorario,
  cliente: clienteProp,
  processo,
  onClose,
}: {
  honorario: Honorario;
  cliente?: Cliente;
  processo?: ProcessoRecibo;
  onClose: () => void;
}) {
  const [perfil, setPerfil] = useState<PerfilAdvogado>(() => getPerfilAdvogado());
  const [timbreUrl, setTimbreUrl] = useState("");
  const [nome, setNome] = useState(clienteProp?.nome ?? processo?.cliente_nome ?? honorario.processo?.cliente_nome ?? "");
  const [doc, setDoc] = useState(clienteProp?.cpf ?? "");
  const [sexo, setSexo] = useState(clienteProp?.sexo ?? "");
  const [valor, setValor] = useState(String(honorario.valor));
  const [data, setData] = useState(honorario.data_recebimento ?? hojeISO());
  const [referente, setReferente] = useState(() => referenteDe(honorario.descricao));
  const [processoNumero, setProcessoNumero] = useState((processo?.numero ?? honorario.processo?.numero ?? "").trim());
  const [forma, setForma] = useState("");
  const [cidade, setCidade] = useState(() => cidadeDoCliente(clienteProp));
  const [dataEmissao, setDataEmissao] = useState(hojeISO());
  const [erro, setErro] = useState("");
  const previaRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.5);

  useEffect(() => {
    loadPerfilAdvogado().then(setPerfil).catch(() => { /* perfil local já carregado */ });
    carregarTimbre().then(setTimbreUrl).catch(() => { /* sem timbre */ });
  }, []);

  // Sem o cadastro em mãos (Financeiro, processo), busca o cliente para trazer CPF e cidade.
  useEffect(() => {
    if (clienteProp) return;
    let cancelado = false;
    (async () => {
      let c: Cliente | undefined;
      try {
        if (processo?.cliente_id) c = await getCliente(processo.cliente_id);
        const nomeCli = (processo?.cliente_nome ?? honorario.processo?.cliente_nome ?? "").toLowerCase().trim();
        if (!c && nomeCli) c = (await getClientes()).find((x) => x.nome.toLowerCase().trim() === nomeCli);
      } catch { /* segue só com o nome */ }
      if (cancelado || !c) return;
      setNome((v) => v || c.nome);
      setDoc((v) => v || (c.cpf ?? ""));
      setSexo((v) => v || (c.sexo ?? ""));
      setCidade((v) => v || cidadeDoCliente(c));
    })();
    return () => { cancelado = true; };
    // Busca uma vez por formulário (as props de processo chegam como objetos novos a cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ajusta a escala da prévia à largura disponível.
  useEffect(() => {
    const el = previaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setEscala(el.clientWidth / FOLHA_PX));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const valorNum = parseFloat(valor.replace(",", ".")) || 0;
  const titulo = nomeArquivo(nome || "cliente", data);
  const html = documentoRecibo(
    corpoRecibo({
      pagadorNome: nome || "[nome de quem pagou]",
      pagadorDoc: doc,
      pagadorSexo: sexo,
      valor: valorNum,
      data,
      referente,
      processoNumero,
      formaPagamento: forma,
      cidade: cidade || "[cidade]",
      dataEmissao,
    }, perfil),
    timbreUrl,
    titulo,
  );

  function gerarPdf() {
    if (!nome.trim()) { setErro("Informe quem pagou."); return; }
    if (valorNum <= 0) { setErro("Informe o valor recebido."); return; }
    if (!cidade.trim()) { setErro("Informe a cidade do recibo."); return; }
    setErro("");
    salvarCidade(cidade.trim());
    if (!imprimirHtml(html)) setErro("Não foi possível abrir a impressão.");
  }

  return (
    <Modal open onClose={onClose} title="Emitir recibo" size="xl">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <Input label="Recebi de *" value={nome} onChange={(e) => setNome(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="CPF / CNPJ" value={doc} onChange={(e) => setDoc(e.target.value)} />
            <Select
              label="Tratamento"
              value={sexo}
              onChange={(e) => setSexo(e.target.value)}
              options={[{ value: "", label: "inscrito(a)" }, { value: "F", label: "inscrita" }, { value: "M", label: "inscrito" }]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valor (R$) *" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
            <Input label="Recebido em *" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          {valorNum > 0 && <p className="-mt-1 text-xs text-gray-400">({valorPorExtenso(valorNum)})</p>}
          <Input label="Referente a" value={referente} onChange={(e) => setReferente(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Processo nº" value={processoNumero} onChange={(e) => setProcessoNumero(e.target.value)} placeholder="opcional" />
            <Select label="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value)} options={formasPagamento} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cidade *" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="ex.: Volta Redonda/RJ" />
            <Input label="Data do recibo" type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
          </div>
          {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
          <div className="flex flex-wrap justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
            <Button onClick={gerarPdf}>
              <Printer className="h-4 w-4" /> Gerar PDF
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            O PDF abre a janela de impressão — escolha “Salvar como PDF”. Sai no seu timbrado, em folha A4.
          </p>
        </div>

        <div ref={previaRef} className="w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm" style={{ height: FOLHA_ALTURA_PX * escala }}>
          <iframe
            title="Prévia do recibo"
            srcDoc={html}
            style={{ width: FOLHA_PX, height: FOLHA_ALTURA_PX, border: 0, transform: `scale(${escala})`, transformOrigin: "top left" }}
          />
        </div>
      </div>
    </Modal>
  );
}
