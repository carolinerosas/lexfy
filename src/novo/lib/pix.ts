// Gera o "Pix copia e cola" (BR Code estático, padrão do Banco Central).
// Não depende de banco nem de intermediário: o pagador cola o código no aplicativo dele.

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, "0")}${valor}`;
const limpar = (s: string, max: number) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().trim().slice(0, max);

function crc16(texto: string): string {
  let crc = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    crc ^= texto.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function pixCopiaECola({ chave, nome, cidade, valor, identificador = "***" }: { chave: string; nome: string; cidade: string; valor?: number; identificador?: string }): string {
  const conta = campo("00", "br.gov.bcb.pix") + campo("01", chave.trim());
  const corpo =
    campo("00", "01") + campo("26", conta) + campo("52", "0000") + campo("53", "986") +
    (valor && valor > 0 ? campo("54", valor.toFixed(2)) : "") +
    campo("58", "BR") + campo("59", limpar(nome, 25) || "RECEBEDOR") + campo("60", limpar(cidade, 15) || "BRASIL") +
    campo("62", campo("05", identificador.replace(/[^A-Za-z0-9*]/g, "").slice(0, 25) || "***")) + "6304";
  return corpo + crc16(corpo);
}
