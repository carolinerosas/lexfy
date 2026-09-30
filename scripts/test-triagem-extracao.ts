// Regressão da leitura básica da Triagem > Importar dados.
// Rodar: node scripts/test-triagem-extracao.ts
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { aplicarCep, cpfValido, extrairEntidades, parseEndereco, sanearCliente } from "../src/lib/triagem-extracao.ts";

let falhas = 0;
function caso(nome: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${nome}`);
  } catch (err) {
    falhas += 1;
    console.log(`FAIL ${nome}\n     ${(err as Error).message.split("\n").join("\n     ")}`);
  }
}

// Texto real anonimizado: cliente, parte contrária, concessionária, três terceiros, sem CNJ.
const texto = readFileSync(new URL("./fixtures/triagem-importacao-caso-sem-cnj.txt", import.meta.url), "utf8");
const ent = extrairEntidades(texto);

caso("nome com rótulo 'Nome completo'", () => assert.equal(ent.cliente.nome, "Fulano de Tal Silva"));
caso("CPF validado e formatado", () => assert.equal(ent.cliente.cpf, "529.982.247-25"));
caso("RG vazio (inscrição estadual da concessionária não vaza)", () => assert.equal(ent.cliente.rg, undefined));
caso("e-mail 'não informado' respeitado", () => assert.equal(ent.cliente.email, undefined));
caso("telefone 'não informado' respeitado", () => assert.equal(ent.cliente.celular, undefined));
caso("CEP", () => assert.equal(ent.cliente.cep, "01001-000"));
caso("endereço decomposto", () => {
  assert.equal(ent.cliente.logradouro, "Rua Exemplo da Silva");
  assert.equal(ent.cliente.numero_end, "588");
  assert.equal(ent.cliente.bairro, "Centro");
  assert.equal(ent.cliente.cidade, "São Paulo");
  assert.equal(ent.cliente.uf, "SP");
});
caso("parte contrária identificada", () => assert.equal(ent.parte_contraria, "Montadora Exemplo do Brasil Ltda."));

caso("IA devolvendo dados da contrária no cliente é saneada", () => {
  const { cliente, avisos } = sanearCliente(
    { ...ent.cliente, email: "nfe@concessionariamodelo.com.br", celular: "(24) 3000-0000", rg: "78600007" },
    ent,
  );
  assert.equal(cliente.email, undefined);
  assert.equal(cliente.celular, undefined);
  assert.equal(cliente.rg, undefined);
  assert.ok(avisos.length >= 3);
});

caso("CEP sobrescreve rua/bairro e sinaliza divergência", () => {
  const { cliente, avisos } = aplicarCep(ent.cliente, { logradouro: "Praça da Sé", bairro: "Sé", cidade: "São Paulo", uf: "SP" });
  assert.equal(cliente.logradouro, "Praça da Sé");
  assert.equal(cliente.numero_end, "588");
  assert.equal(avisos.length, 2);
});

// Texto sem blocos, só rótulos: comportamento antigo precisa continuar funcionando.
caso("texto simples sem blocos", () => {
  const e = extrairEntidades("Nome: Maria das Dores\nCPF: 529.982.247-25\nE-mail: maria@exemplo.com\nCelular: (21) 99999-8888\nEndereço: Av. Brasil, 1000, apto 201, Bonsucesso, Rio de Janeiro/RJ, CEP 21040-360");
  assert.equal(e.cliente.nome, "Maria das Dores");
  assert.equal(e.cliente.email, "maria@exemplo.com");
  assert.equal(e.cliente.celular, "(21) 99999-8888");
  assert.equal(e.cliente.logradouro, "Av. Brasil");
  assert.equal(e.cliente.numero_end, "1000");
  assert.equal(e.cliente.complemento, "apto 201");
  assert.equal(e.cliente.bairro, "Bonsucesso");
  assert.equal(e.cliente.cidade, "Rio de Janeiro");
  assert.equal(e.cliente.uf, "RJ");
});

caso("texto sem blocos com réu: contato do réu não vaza", () => {
  const e = extrairEntidades("Cliente: João Souza\nCPF 529.982.247-25\n\nRÉU\nBanco X S/A, CNPJ 00.000.000/0001-91, sac@bancox.com.br, (11) 4000-0000");
  assert.equal(e.cliente.nome, "João Souza");
  assert.equal(e.cliente.email, undefined);
  assert.equal(e.cliente.celular, undefined);
});

caso("CPF inválido rejeitado", () => {
  assert.equal(cpfValido("111.220.437-70"), false);
  assert.equal(extrairEntidades("CLIENTE\nNome: A B\nCPF: 111.111.111-11").cliente.cpf, undefined);
});

caso("RG rotulado como inscrição estadual é rejeitado", () => {
  assert.equal(extrairEntidades("CLIENTE\nNome: A B\nRG: inscrição estadual 78600007").cliente.rg, undefined);
  assert.equal(extrairEntidades("CLIENTE\nNome: A B\nRG: 12.345.678-9").cliente.rg, "12.345.678-9");
});

caso("endereço com 'nº' e s/n", () => {
  assert.deepEqual(parseEndereco("Rua das Flores, nº 12, Centro, Niterói — RJ"), { logradouro: "Rua das Flores", numero_end: "12", bairro: "Centro", cidade: "Niterói", uf: "RJ" });
  assert.equal(parseEndereco("Estrada Velha, s/n, Zona Rural, Aiuruoca/MG").numero_end, "s/n");
});

if (falhas) {
  console.log(`\n${falhas} falha(s)`);
  process.exit(1);
}
console.log("\ntodos os casos passaram");
