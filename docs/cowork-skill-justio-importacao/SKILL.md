---
name: justio-agente-importacao
description: >
  Use SEMPRE que Carol apresentar um caso, cliente, documento, PDF, texto de processo,
  andamento ou peça nova para o JUSTIO, ou disser "importa isso", "joga no JUSTIO", "manda pra
  triagem", "cadastra esse processo", "tem andamento novo". No Cowork não há rede para o
  justio.com.br: esta skill grava um arquivo .json na outbox e os arquivos do cliente na pasta
  "arquivos"; a ponte que roda no computador da Carol confere duplicidade, envia para a Triagem
  e move os arquivos para a pasta do cliente no OneDrive profissional.
---

# Importação para o JUSTIO (versão Cowork)

**Nunca tente acessar o justio.com.br pela rede** (é bloqueado aqui). Você só escreve arquivos; a ponte do computador da Carol faz o resto. Tudo entra na Triagem para ela revisar; nada é cadastrado automaticamente.

Pasta base (a mesma da pasta Claude do Cowork): `C:\Users\carol\OneDrive\Documentos\Claude\justio\`

## 1. Montar o texto no formato padrão

Texto corrido em seções com estes rótulos (sem JSON, sem markdown). Omitir o que não houver; nunca inventar; dado duvidoso leva `(dado incerto)`.

```
CLIENTE
Nome: ...
CPF: ...  RG: ...  E-mail: ...  Celular: ...
CEP: ...  Logradouro: ...  Número: ...  Complemento: ...  Bairro: ...  Cidade: ...  UF: ...
Observações do cliente: ...

PARTE CONTRÁRIA
Nome: ...  CPF/CNPJ: ...

PROCESSO (um bloco por processo, só com CNJ)
Número: 0000000-00.0000.0.00.0000
Tribunal: ...  UF: ...  Comarca: ...  Vara: ...
Tipo: civel | familia | criminal | juri | execucao_penal | inquerito_policial | bo_pm | trabalhista | outro
Tipo penal: ... (só criminal/júri/execução)   Unidade prisional: ... (se preso)
Data de distribuição: AAAA-MM-DD
Resumo do caso: ... (vira a descrição do processo; objetivo, sem opinião)

CASO NOVO (só se ainda não ajuizado, sem CNJ)
Título: ...  Tipo: ...  Comarca: ...  UF: ...
Resumo: ...

HONORÁRIOS (só se foram tratados)
Valor total: ...  Entrada: ...  Parcelas: ...  Contratado: sim/não (só "sim" se ela disse que fechou)
```

**Não ponha os andamentos neste texto.** Eles vão numa lista à parte (passo 2), para a ponte tirar os que o Justio já tem.
O Justio não tem campo de prazo, estratégia ou tese: tudo que estiver no texto fica salvo como anotação do processo. Prazo vai dentro da descrição do andamento ("Prazo: 5 dias, vence 10/11/2026").

## 2. Gravar o arquivo na outbox

Arquivo: `...\justio\outbox\triagem-<cliente-sem-acento>-<AAAAMMDD-HHMM>.json`, UTF-8, escrito com a ferramenta de arquivo (nunca por `Set-Content`, que corrompe acentos).

```json
{
  "tipo": "triagem",
  "origem": "cowork",
  "texto": "<texto padronizado do passo 1>",
  "verificar": { "nome": "<nome completo do cliente>", "numero": "<CNJ, se houver>" },
  "andamentos": [
    { "data": "AAAA-MM-DD", "numero": "<CNJ>", "descricao": "andamento" }
  ],
  "somente_andamentos": false,
  "conversa_id": "<id da conversa>",
  "projeto": "<nome do projeto>",
  "marcador": "<muda quando surge peça/documento novo, ex.: data do último documento>"
}
```

- `texto` precisa ser uma string (não objeto).
- `somente_andamentos: true` quando a única novidade são andamentos de processo já cadastrado: se o Justio já tiver todos, a ponte não envia nada.
- Sem andamentos, omitir `andamentos` e `somente_andamentos`.
- Se for só um andamento novo de cliente/processo já existente, o `texto` pode ser curto (cliente, número do processo, resumo da novidade).

## 3. Arquivos do cliente (petições, PDFs, transcrições, resumos)

Salvar em `...\justio\arquivos\<Nome Completo do Cliente>\` (subpastas permitidas). A ponte move para `C:\Users\carol\OneDrive - Caroline Fraga\Documentos\01. Escritório\Clientes\<cliente>\`: usa a pasta existente do cliente, cria se não houver, e não sobrescreve arquivo com o mesmo nome (acrescenta " (2)"). Se achar mais de uma pasta parecida, deixa em `arquivos` e registra no log.
Use o nome completo do cliente como a Carol o escreve; nome incompleto pode criar uma pasta nova.

Se você conseguir acessar `C:\Users\carol\OneDrive - Caroline Fraga\Documentos\01. Escritório\Clientes\` diretamente, salve lá. Nunca no OneDrive pessoal (`C:\Users\carol\OneDrive\Documentos\01. Escritório`).

## 4. Responder à Carol

Dizer o que gravou: nome do arquivo na outbox, quantos andamentos, onde ficaram os arquivos, e que a ponte envia em até 15 minutos (aba Triagem > Importar dados). Não dizer "enviado ao Justio": você só deixou na fila.

## Regras

- Nunca inventar dados. Nunca tentar rede. Nunca gravar fora da outbox ou de `arquivos` (nem em `falhas`).
- Autos para análise: ler o PDF original, não o texto extraído do JUSTIO, para não perder imagens.
