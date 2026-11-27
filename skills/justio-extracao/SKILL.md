---
name: justio-extracao
description: Extrai de um PDF de processo (autos, denúncia, sentença, petição) ou das informações da conversa todos os dados das fichas do JUSTIO (cliente, processo e ficha da área: criminal, júri, cível, família, trabalhista, previdenciário e as demais) e devolve um bloco JSON para colar em JUSTIO > Importar > Do Cowork, onde a advogada revisa e confirma. Use sempre que a advogada pedir para cadastrar, importar, alimentar ou atualizar no JUSTIO um processo ou cliente, ou para extrair dados de autos para o sistema.
---

## Como usar esta skill

1. Leia a fonte inteira: o PDF dos autos (veja como imagem as páginas com fotos, laudos e prints) ou o que a advogada escreveu na conversa. Com vários documentos do mesmo processo, junte tudo num único resultado.
2. Identifique a área pela classe, pelo assunto e pelo juízo, e use só os campos da ficha dessa área.
3. Abra o arquivo `areas.md` desta skill e leia só a seção da área escolhida: ali estão as chaves, os tipos e as opções exatas da ficha.
4. Devolva só o bloco JSON no formato abaixo. Com mais de um processo, entregue um processo por resposta e diga que há outro. Não grave arquivos e não tente acessar o JUSTIO: a advogada cola o bloco em Importar > Do Cowork, revisa campo a campo e confirma.
5. Se a advogada pedir para atualizar um processo que já existe, extraia tudo do mesmo jeito: o JUSTIO reconhece o caso pelo número e só preenche o que está vazio; valor diferente só é substituído se ela marcar.

# Extração de processo para o JUSTIO (versão 1)

Você vai ler o PDF dos autos de um processo, ou as informações dadas na conversa, e devolver UM ÚNICO bloco ```json, sem texto antes ou depois, no formato descrito abaixo. A advogada cola esse bloco no JUSTIO (Importar > Do Cowork), revisa campo a campo e só então o sistema grava.

## Regras
1. Extraia só o que está escrito nos autos. Não deduza, não complete e não invente. Se não achou, omita a chave (não escreva "não informado", null ou "").
   Se a fonte for a conversa, use só o que a advogada disse ou mostrou; o que faltar para a ficha vai em "pendencias".
2. Datas: sempre AAAA-MM-DD. Data e hora: AAAA-MM-DDTHH:MM (horário de Brasília).
3. Valores em dinheiro: número com ponto decimal, sem "R$" (ex.: 12500.75).
4. Campos de lista: array de textos, um item por elemento.
5. Campos de opção: copie exatamente uma das opções listadas. Se nenhuma servir, omita o campo e explique em "pendencias".
6. Nomes de pessoas: como estão nos autos, com acentos (LUÍS, não LUíS).
7. O cliente é a pessoa que a advogada defende ou representa. No penal, é o réu, acusado, investigado, paciente ou apenado, nunca o Ministério Público nem a vítima.
8. Escolha UMA área em processo.area (use o identificador entre crases da lista de áreas) e preencha "ficha" só com as chaves dessa área.
9. Em "fonte" de cada prazo e andamento, diga onde está no PDF (página, folha ou evento), para a advogada conferir.
10. Em "pendencias", liste o que precisa ser conferido ou providenciado: dúvidas de leitura, prazos em curso, documentos faltando, contradições nos autos.

## Formato
```json
{
  "justio": 1,
  "cliente": {
    "nome": "", "tipo": "pf ou pj", "cpf_cnpj": "", "rg": "", "nascimento": "AAAA-MM-DD",
    "nacionalidade": "", "estado_civil": "", "profissao": "", "filiacao": "",
    "celular": "", "email": "", "endereco": "", "cidade": "", "uf": "RJ"
  },
  "processo": {
    "area": "identificador da área", "titulo": "classe ou assunto principal", "numero": "0000000-00.0000.0.00.0000",
    "classe": "", "orgao": "vara, juízo ou câmara", "comarca": "", "uf": "RJ",
    "parte_contraria": "", "valor_causa": 0, "distribuido_em": "AAAA-MM-DD",
    "fase": "nome exato de uma fase da área", "tipos": ["tipo de processo da área"]
  },
  "ficha": { "chave_do_campo": "valor" },
  "partes": [{ "nome": "", "papel": "réu, vítima, testemunha, autor...", "polo": "ativo ou passivo" }],
  "vinculados": [{ "tipo": "Habeas corpus, Recurso, Apenso...", "numero": "", "situacao": "" }],
  "prazos": [{ "titulo": "", "data": "AAAA-MM-DD", "fatal": true, "fonte": "fls. 120" }],
  "audiencias": [{ "titulo": "", "data_hora": "AAAA-MM-DDTHH:MM", "local": "", "modalidade": "presencial, virtual ou híbrida" }],
  "andamentos": [{ "data": "AAAA-MM-DD", "descricao": "", "fonte": "evento 35" }],
  "pedidos_execucao": [{
    "tipo": "progressao_regime | livramento_condicional | remicao | saida_temporaria | trabalho_extramuros | regressao | unificacao_penas | detracao | indulto | comutacao | extincao_pena | outro",
    "titulo": "", "data_pedido": "AAAA-MM-DD",
    "status": "protocolado | em_andamento | deferido | parcialmente_deferido | indeferido | cumprido | arquivado",
    "data_decisao": "AAAA-MM-DD", "resultado": "o que a decisão concedeu ou negou, e por quê",
    "recurso": { "interposto": "Agravo em execução da defesa | Agravo em execução do MP | Habeas corpus", "resultado": "Provido | Parcialmente provido | Desprovido | Não conhecido | Ordem concedida | Ordem denegada", "data": "AAAA-MM-DD", "efeito": "o que o acórdão mudou" }
  }],
  "pendencias": ["o que a advogada precisa conferir ou fazer"]
}
```

Pedidos da execução (só na área execucao_penal): um item por pedido feito ao juízo da execução (progressão, livramento, remição, saída temporária, indulto, comutação etc.), com a decisão de cada um e, se houve, o recurso contra ela e o resultado. Recursos de sentença e acórdão nas demais áreas vão nos campos da ficha (apelação, resultado da apelação, recurso aos tribunais superiores).

Prazos: só os que ainda estão correndo ou por vir, com a data final já contada. Andamentos: os atos relevantes (recebimento da denúncia, citação, decisões, sentença, recursos, prisões e solturas), do mais antigo para o mais recente.


## Áreas e campos da ficha

Estão em `areas.md`, nesta mesma pasta. Use só as chaves da área do processo, com as opções escritas exatamente como lá.
