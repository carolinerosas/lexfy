# Justio Sync Local

Agente local para rodar no Windows da advogada, usando o Chrome e o certificado A3
fisico instalado na maquina. Ele existe porque Vercel/Railway nao conseguem usar
um token Certisign conectado no seu computador.

## Rodar

```powershell
cd C:\Users\carol\Documents\lexfy
npm install --prefix sync-local
npm run sync:local
```

Por padrao o agente sobe em:

```text
http://127.0.0.1:4477
```

Depois, no Justio, va em **Configuracoes > Sincronizador local** e clique em
**Testar conexao**.

## Como o certificado entra

O agente abre uma janela real do Chrome, com um perfil proprio em:

```text
%USERPROFILE%\.justio-sync\chrome-profile
```

Na primeira vez em cada tribunal, o login por certificado pode exigir sua acao
na janela do Chrome/PJeOffice. Depois que a sessao estiver ativa, o agente passa
a reaproveitar os cookies desse perfil para extrair movimentacoes.

## Sobre a senha do token

Esta primeira versao nao grava a senha do certificado em arquivo nem no site.
O endpoint `/session/pin` guarda a senha apenas em memoria por tempo limitado,
para conectores futuros que consigam preencher uma tela de senha comum. Prompts
nativos do Windows/Certisign geralmente nao permitem preenchimento confiavel por
automacao web.

## Endpoints principais

- `GET /health`: verifica se o agente esta rodando.
- `POST /djen/processos`: descobre processos publicados no DJEN por OAB/nome.
- `POST /djen/publicacoes`: busca publicacoes do DJEN por OAB/nome.
- `POST /sync/processo`: tenta sincronizar movimentacoes de um processo.

## Estado atual dos conectores

- DJEN/CNJ: funcional para publicacoes e descoberta de processos.
- DCP/TJRJ publico: tentativa automatica para processos nao PJe.
- PJe, eproc, SEEU e eSAJ: abre o portal certo para login assistido e retorna
  `needs_interaction` quando precisa da sua acao/certificado. A extracao
  autenticada sera implementada sistema a sistema depois que a primeira sessao
  real estiver validada.
