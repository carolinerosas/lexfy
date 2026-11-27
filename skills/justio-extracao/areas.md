# Fichas do JUSTIO por área

Cada área traz as fases (para processo.fase), os tipos de processo (para processo.tipos) e as chaves da ficha (para "ficha").

## Áreas e campos da ficha

### `civel`: Cível (judicial)
Fases (use o nome exato em processo.fase): "A ajuizar", "Inicial distribuída", "Citação", "Contestação e réplica", "Saneamento", "Instrução", "Sentença", "Recurso", "Cumprimento de sentença", "Encerrado"
Seção "Ação":
- `acao` (texto): Tipo de ação
- `rito` (uma das opções): Rito. Opções: "Comum" | "Juizado Especial Cível" | "Procedimento especial" | "Execução de título" | "Monitória"
- `polo` (uma das opções): Polo do cliente. Opções: "Autor" | "Réu" | "Terceiro interessado"
- `tutela` (uma das opções): Tutela de urgência. Opções: "Não pedida" | "Pedida" | "Deferida" | "Indeferida" | "Revogada"
- `gratuidade` ("Sim" ou "Não"): Justiça gratuita
- `condenacao` (valor em reais (número, ex.: 1500.5)): Valor da condenação
Seção "Prova":
- `pericia` ("Sim" ou "Não"): Perícia
- `perito` (texto): Perito nomeado
- `assistente` (texto): Assistente técnico
- `testemunhas` (lista (array de textos, um item por elemento)): Testemunhas
Seção "Cumprimento e execução":
- `executado` (valor em reais (número, ex.: 1500.5)): Valor em execução
- `sisbajud` (uma das opções): Sisbajud. Opções: "Não pedido" | "Pedido" | "Positivo" | "Negativo"
- `penhora` (lista (array de textos, um item por elemento)): Bens penhorados
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `consumidor`: Consumidor (judicial)
Fases (use o nome exato em processo.fase): "A ajuizar", "Inicial distribuída", "Citação", "Contestação e réplica", "Saneamento", "Instrução", "Sentença", "Recurso", "Cumprimento de sentença", "Encerrado"
Seção "Relação de consumo":
- `fornecedor` (texto): Fornecedor
- `produto` (texto): Produto ou serviço
- `problema` (uma das opções): Tipo de problema. Opções: "Vício do produto" | "Acidente de consumo" | "Cobrança indevida" | "Negativação indevida" | "Atraso ou cancelamento" | "Recall" | "Assinatura não contratada"
- `compra` (data AAAA-MM-DD): Data da compra
- `reclamacao` (data AAAA-MM-DD): Data da primeira reclamação
- `protocolo` (lista (array de textos, um item por elemento)): Protocolos de atendimento
Seção "Tentativa administrativa":
- `procon` ("Sim" ou "Não"): Reclamação no Procon ou consumidor.gov
- `resposta` (texto longo): Resposta do fornecedor
Seção "Pedidos":
- `negativacao` ("Sim" ou "Não"): Há negativação
- `orgao_neg` (texto): Órgão negativador
- `dano_material` (valor em reais (número, ex.: 1500.5)): Dano material
- `dano_moral` (valor em reais (número, ex.: 1500.5)): Dano moral pedido
- `inversao` (uma das opções): Inversão do ônus da prova. Opções: "Não pedida" | "Pedida" | "Deferida" | "Indeferida"
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `dano_moral_fixado` (valor em reais (número, ex.: 1500.5)): Dano moral fixado
- `dano_material_fixado` (valor em reais (número, ex.: 1500.5)): Dano material fixado
- `repeticao_indebito` (valor em reais (número, ex.: 1500.5)): Repetição do indébito
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `familia`: Família (judicial)
Fases (use o nome exato em processo.fase): "A ajuizar", "Inicial distribuída", "Citação", "Mediação ou conciliação", "Contestação", "Estudo psicossocial", "Instrução", "Sentença", "Recurso", "Cumprimento", "Encerrado"
Tipos de processo (processo.tipos, pode mais de um): "Divórcio", "Dissolução de união estável", "Guarda e convivência", "Alimentos", "Execução de alimentos", "Revisional ou exoneração de alimentos", "Investigação de paternidade", "Interdição e curatela", "Outro"
Seção "Relação" (só para os tipos: Divórcio, Dissolução de união estável):
- `acao` (texto): Ação
- `relacao` (uma das opções): Relação. Opções: "Casamento" | "União estável"
- `inicio` (data AAAA-MM-DD): Início da convivência
- `casamento` (data AAAA-MM-DD): Data do casamento
- `regime` (uma das opções): Regime de bens. Opções: "Comunhão parcial" | "Comunhão universal" | "Separação convencional" | "Separação obrigatória" | "Participação final nos aquestos"
- `separacao` (data AAAA-MM-DD): Separação de fato
- `moradia` (texto): Quem ficou no imóvel
Seção "Filhos" (só para os tipos: Divórcio, Dissolução de união estável, Guarda e convivência, Alimentos, Execução de alimentos, Revisional ou exoneração de alimentos, Investigação de paternidade):
- `filhos` (lista (array de textos, um item por elemento)): Filhos (nome, nascimento, escola)
- `guarda` (uma das opções): Guarda pretendida. Opções: "Compartilhada" | "Unilateral materna" | "Unilateral paterna" | "Não há filhos menores"
- `convivencia` (texto longo): Convivência pretendida
- `alimentos` (texto): Alimentos pedidos
- `alimentos_prov` (valor em reais (número, ex.: 1500.5)): Alimentos provisórios fixados
- `despesas` (valor em reais (número, ex.: 1500.5)): Despesas mensais dos filhos
Seção "Patrimônio" (só para os tipos: Divórcio, Dissolução de união estável):
- `bens` (lista (array de textos, um item por elemento)): Bens a partilhar
- `dividas` (lista (array de textos, um item por elemento)): Dívidas
- `partilha` (texto longo): Partilha pretendida
Seção "Execução de alimentos" (só para os tipos: Execução de alimentos):
- `debito` (valor em reais (número, ex.: 1500.5)): Débito atualizado
- `meses_aberto` (lista (array de textos, um item por elemento)): Meses em aberto
- `rito_exec` (uma das opções): Rito. Opções: "Prisão (art. 528, § 3º)" | "Penhora (art. 523)" | "Desconto em folha"
- `titulo_exec` (texto): Título (sentença ou acordo)
Seção "Revisão de alimentos" (só para os tipos: Revisional ou exoneração de alimentos):
- `valor_atual` (valor em reais (número, ex.: 1500.5)): Valor atual
- `valor_pretendido` (texto): Valor pretendido
- `mudanca` (texto longo): Mudança de situação alegada
Seção "Paternidade" (só para os tipos: Investigação de paternidade):
- `suposto_pai` (texto): Suposto pai
- `dna` (uma das opções): Exame de DNA. Opções: "Não requerido" | "Requerido" | "Agendado" | "Realizado: positivo" | "Realizado: negativo" | "Recusa do investigado"
Seção "Curatela" (só para os tipos: Interdição e curatela):
- `curatelando` (texto): Pessoa a ser curatelada
- `laudo_medico` (texto): Laudo médico e CID
- `curador` (texto): Curador pretendido
- `pericia_curatela` (uma das opções): Perícia. Opções: "Não marcada" | "Marcada" | "Realizada"
- `limites` (texto longo): Atos sujeitos à curatela
Seção "Partes":
- `renda_cliente` (texto): Renda do cliente
- `renda_outra` (texto): Renda da outra parte
- `protetiva` ("Sim" ou "Não"): Medida protetiva em vigor
- `acordo` (uma das opções): Possibilidade de acordo. Opções: "Provável" | "Possível" | "Improvável"
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `alimentos_fixados` (texto): Alimentos fixados
- `guarda_definida` (uma das opções): Guarda definida. Opções: "Compartilhada" | "Unilateral para o cliente" | "Unilateral para a outra parte"
- `convivencia_fixada` (texto longo): Convivência fixada
- `partilha_decidida` (texto longo): Partilha decidida
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `sucessoes`: Sucessões (judicial)
Fases (use o nome exato em processo.fase): "A ajuizar", "Abertura", "Nomeação do inventariante", "Primeiras declarações", "Citações", "Avaliação e cálculo do imposto", "Últimas declarações", "Partilha", "Formal expedido", "Encerrado"
Seção "Sucessão":
- `falecido` (texto): Autor da herança
- `obito` (data AAAA-MM-DD): Data do óbito
- `rito` (uma das opções): Rito. Opções: "Inventário" | "Arrolamento sumário" | "Arrolamento comum" | "Alvará judicial"
- `inventariante` (texto): Inventariante
- `testamento` ("Sim" ou "Não"): Há testamento
- `conjuge` (texto): Cônjuge ou companheiro e regime
Seção "Herdeiros e bens":
- `herdeiros` (lista (array de textos, um item por elemento)): Herdeiros
- `incapaz` ("Sim" ou "Não"): Herdeiro menor ou incapaz
- `bens` (lista (array de textos, um item por elemento)): Bens
- `dividas` (lista (array de textos, um item por elemento)): Dívidas do espólio
- `monte` (valor em reais (número, ex.: 1500.5)): Valor do monte
Seção "Imposto e encerramento":
- `itcmd` (uma das opções): ITCMD. Opções: "Não declarado" | "Declarado" | "Guia emitida" | "Pago" | "Isento"
- `itcmd_valor` (valor em reais (número, ex.: 1500.5)): Valor do ITCMD
- `formal` (uma das opções): Formal de partilha. Opções: "Não expedido" | "Expedido" | "Registrado"

### `criminal`: Criminal (judicial)
Fases (use o nome exato em processo.fase): "Flagrante e custódia", "Denúncia", "Resposta à acusação", "Instrução", "Alegações finais", "Sentença", "Recurso", "Trânsito em julgado", "Encerrado"
Tipos de processo (processo.tipos, pode mais de um): "Crime contra a pessoa", "Violência doméstica (Lei Maria da Penha)", "Crime contra o patrimônio", "Tráfico e drogas (Lei 11.343/06)", "Crime contra a dignidade sexual", "Armas (Lei 10.826/03)", "Crime de trânsito", "Crime contra a administração pública", "Organização criminosa", "Outro"
Seção "Inquérito policial":
- `numero_ip` (texto): Nº do inquérito
- `delegacia` (texto): Delegacia
- `autoridade` (texto): Autoridade policial
- `instauracao` (data AAAA-MM-DD): Instauração
- `indiciamento` (data AAAA-MM-DD): Indiciamento
- `relatorio_ip` (data AAAA-MM-DD): Relatório final
Seção "Fato":
- `tipo_penal` (lista (array de textos, um item por elemento)): Tipos penais
- `fato_data` (data AAAA-MM-DD): Data do fato
- `fato_local` (texto): Local do fato
- `ro` (texto): Nº do registro de ocorrência
- `flagrante` ("Sim" ou "Não"): Houve flagrante
- `correus` (lista (array de textos, um item por elemento)): Corréus
Seção "Vítima" (só para os tipos: Crime contra a pessoa, Violência doméstica (Lei Maria da Penha), Crime contra o patrimônio, Crime contra a dignidade sexual, Crime de trânsito, Outro):
- `vitimas` (lista (array de textos, um item por elemento)): Vítimas
- `representacao` (uma das opções): Representação da vítima. Opções: "Não se aplica" | "Oferecida" | "Não oferecida" | "Retratada"
- `reparacao` (uma das opções): Reparação do dano. Opções: "Não discutida" | "Pedida pelo MP" | "Feita" | "Acordo com a vítima"
Seção "Prisão e liberdade":
- `situacao` (uma das opções): Situação. Opções: "Solto" | "Preso em flagrante" | "Prisão preventiva" | "Prisão temporária" | "Prisão domiciliar" | "Monitoração eletrônica" | "Liberdade provisória com cautelares"
- `unidade` (texto): Unidade prisional
- `prisao_data` (data AAAA-MM-DD): Data da prisão
- `revisao` (data AAAA-MM-DD): Última revisão da preventiva
- `fianca` (valor em reais (número, ex.: 1500.5)): Fiança arbitrada
- `cautelares` (lista (array de textos, um item por elemento)): Cautelares impostas
- `hc` (uma das opções): Habeas corpus (situação). Opções: "Não impetrado" | "Impetrado no TJ" | "Impetrado no STJ" | "Impetrado no STF" | "Concedido" | "Denegado"
Seção "Processo":
- `recebimento` (data AAAA-MM-DD): Recebimento da denúncia
- `citacao` (data AAAA-MM-DD): Citação
- `anpp` (uma das opções): Acordo de não persecução penal. Opções: "Não cabe" | "Proposto" | "Aceito" | "Recusado" | "Homologado" | "Descumprido"
- `sursis` (uma das opções): Suspensão condicional do processo. Opções: "Não cabe" | "Proposta" | "Aceita" | "Em cumprimento" | "Revogada"
- `tese` (texto longo): Tese de defesa
Seção "Testemunhas":
- `testemunhas_acusacao` (lista (array de textos, um item por elemento)): Testemunhas de acusação
- `testemunhas` (lista (array de textos, um item por elemento)): Testemunhas de defesa
- `informantes` (lista (array de textos, um item por elemento)): Informantes e declarantes
Seção "Sentença e pena":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Absolvição" | "Absolvição sumária (CPP, art. 397)" | "Condenação" | "Condenação parcial" | "Desclassificação" | "Extinção da punibilidade" | "Prescrição" | "Perdão judicial"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `fundamento_absolvicao` (uma das opções): Fundamento da absolvição (CPP, art. 386). Opções: "I - inexistência do fato" | "II - não há prova da existência do fato" | "III - o fato não constitui infração penal" | "IV - o réu não concorreu para a infração" | "V - não há prova de que o réu concorreu" | "VI - excludente de ilicitude ou de culpabilidade" | "VII - prova insuficiente para a condenação"
- `pena_base` (texto): Pena-base (1ª fase, CP, art. 59)
- `circunstancias_judiciais` (texto longo): Circunstâncias judiciais desfavoráveis
- `agravantes` (lista (array de textos, um item por elemento)): Agravantes reconhecidas
- `atenuantes` (lista (array de textos, um item por elemento)): Atenuantes reconhecidas
- `reincidencia` (uma das opções): Reincidência. Opções: "Primário" | "Reincidente" | "Reincidente específico"
- `pena_intermediaria` (texto): Pena intermediária (2ª fase)
- `causas_aumento` (lista (array de textos, um item por elemento)): Causas de aumento (3ª fase)
- `causas_diminuicao` (lista (array de textos, um item por elemento)): Causas de diminuição (3ª fase)
- `concurso` (uma das opções): Concurso de crimes. Opções: "Não houve" | "Concurso material" | "Concurso formal" | "Crime continuado"
- `pena` (texto): Pena definitiva (ex.: 5 anos e 4 meses)
- `hediondo` ("Sim" ou "Não"): Crime hediondo ou equiparado
- `violencia` ("Sim" ou "Não"): Com violência ou grave ameaça à pessoa
- `pena_especie` (uma das opções): Espécie da pena. Opções: "Reclusão" | "Detenção" | "Prisão simples"
- `regime` (uma das opções): Regime inicial. Opções: "Fechado" | "Semiaberto" | "Aberto"
- `multa` (texto): Pena de multa (dias-multa e valor do dia)
- `restritivas` (lista (array de textos, um item por elemento)): Penas restritivas de direitos (CP, art. 44)
- `prestacao_pecuniaria` (valor em reais (número, ex.: 1500.5)): Prestação pecuniária
- `sursis_pena` (uma das opções): Suspensão condicional da pena (CP, art. 77). Opções: "Não cabe" | "Concedida" | "Negada"
- `detracao` (texto): Detração (CPP, art. 387, § 2º)
- `recorrer_liberdade` (uma das opções): Recorrer em liberdade. Opções: "Concedido" | "Negado" | "Mantida a prisão preventiva" | "Decretada a prisão na sentença"
- `reparacao_minima` (valor em reais (número, ex.: 1500.5)): Reparação mínima à vítima (CPP, art. 387, IV)
- `transito_acusacao` (data AAAA-MM-DD): Trânsito em julgado para a acusação
Seção "Recurso e trânsito":
- `apelacao` (uma das opções): Apelação. Opções: "Não interposta" | "Interposta pela defesa" | "Interposta pelo MP" | "Interposta pela defesa e pelo MP"
- `apelacao_resultado` (uma das opções): Resultado da apelação. Opções: "Pendente" | "Provida" | "Parcialmente provida" | "Desprovida" | "Não conhecida"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou (pena, regime, absolvição, nulidade)
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Especial e extraordinário" | "Agravo em recurso especial" | "Habeas corpus no STJ" | "Habeas corpus no STF"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido" | "Ordem concedida" | "Ordem concedida de ofício" | "Ordem denegada"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
Seção "Drogas" (só para os tipos: Tráfico e drogas (Lei 11.343/06)):
- `substancias` (lista (array de textos, um item por elemento)): Substâncias e quantidades
- `laudo_constatacao` (uma das opções): Laudo de constatação. Opções: "Não juntado" | "Juntado" | "Inconclusivo"
- `laudo_definitivo` (uma das opções): Laudo definitivo. Opções: "Pendente" | "Juntado" | "Inconclusivo"
- `busca_domiciliar` (uma das opções): Ingresso em domicílio. Opções: "Não houve" | "Com mandado" | "Sem mandado (alegado flagrante)" | "Com autorização do morador"
- `privilegiado` (uma das opções): Tráfico privilegiado (art. 33, § 4º). Opções: "Não analisado" | "Cabível" | "Afastado" | "Reconhecido"
- `defesa_previa` (data AAAA-MM-DD): Notificação para defesa prévia (art. 55)
- `associacao` ("Sim" ou "Não"): Imputação de associação (art. 35)
Seção "Arma" (só para os tipos: Armas (Lei 10.826/03)):
- `arma` (lista (array de textos, um item por elemento)): Arma e munições apreendidas
- `laudo_arma` (uma das opções): Laudo de eficiência. Opções: "Pendente" | "Apta a disparar" | "Inapta" | "Inconclusivo"
- `uso` (uma das opções): Uso. Opções: "Permitido" | "Restrito" | "Proibido"
Seção "Trânsito" (só para os tipos: Crime de trânsito):
- `etilometro` (uma das opções): Teste do etilômetro. Opções: "Não realizado" | "Recusado" | "Positivo" | "Negativo"
- `cnh` (uma das opções): Situação da CNH. Opções: "Regular" | "Suspensa" | "Cassada" | "Sem habilitação"
- `vitima_transito` ("Sim" ou "Não"): Houve vítima
Seção "Violência doméstica" (só para os tipos: Violência doméstica (Lei Maria da Penha)):
- `protetivas` (lista (array de textos, um item por elemento)): Medidas protetivas
- `fonar` (uma das opções): Risco no formulário nacional. Opções: "Não preenchido" | "Baixo" | "Médio" | "Elevado"
- `descumprimento` ("Sim" ou "Não"): Descumprimento de medida (art. 24-A)
- `relacao_vitima` (uma das opções): Relação com a vítima. Opções: "Cônjuge ou companheira" | "Ex-cônjuge ou ex-companheira" | "Namorada ou ex-namorada" | "Filha ou enteada" | "Mãe" | "Irmã" | "Outra relação doméstica"

### `juri`: Tribunal do Júri (judicial)
Fases (use o nome exato em processo.fase): "Inquérito", "Denúncia", "Sumário da culpa", "Pronúncia", "Recurso da pronúncia", "Preparação do plenário", "Plenário", "Apelação", "Encerrado"
Seção "Inquérito policial":
- `numero_ip` (texto): Nº do inquérito
- `delegacia` (texto): Delegacia
- `autoridade` (texto): Autoridade policial
- `instauracao` (data AAAA-MM-DD): Instauração
- `indiciamento` (data AAAA-MM-DD): Indiciamento
- `relatorio_ip` (data AAAA-MM-DD): Relatório final
Seção "Imputação":
- `imputacao` (texto): Imputação
- `tipo_penal` (lista (array de textos, um item por elemento)): Tipos penais
- `vitimas` (lista (array de textos, um item por elemento)): Vítimas
- `qualificadoras` (lista (array de textos, um item por elemento)): Qualificadoras
- `correus` (lista (array de textos, um item por elemento)): Corréus
Seção "Fato":
- `fato_data` (data AAAA-MM-DD): Data do fato
- `fato_local` (texto): Local do fato
- `ro` (texto): Nº do registro de ocorrência
- `flagrante` ("Sim" ou "Não"): Houve flagrante
Seção "Prisão e liberdade":
- `situacao` (uma das opções): Situação do acusado. Opções: "Solto" | "Preso em flagrante" | "Prisão preventiva" | "Prisão temporária" | "Prisão domiciliar" | "Monitoração eletrônica" | "Liberdade provisória com cautelares"
- `unidade` (texto): Unidade prisional
- `prisao_data` (data AAAA-MM-DD): Data da prisão
- `revisao` (data AAAA-MM-DD): Última revisão da preventiva
- `cautelares` (lista (array de textos, um item por elemento)): Cautelares impostas
- `hc` (uma das opções): Habeas corpus (situação). Opções: "Não impetrado" | "Impetrado no TJ" | "Impetrado no STJ" | "Impetrado no STF" | "Concedido" | "Denegado"
Seção "Primeira fase: sumário da culpa":
- `recebimento` (data AAAA-MM-DD): Recebimento da denúncia
- `citacao` (data AAAA-MM-DD): Citação
- `resposta` (data AAAA-MM-DD): Resposta à acusação (data)
- `testemunhas_acusacao` (lista (array de textos, um item por elemento)): Testemunhas de acusação
- `testemunhas` (lista (array de textos, um item por elemento)): Testemunhas de defesa
- `informantes` (lista (array de textos, um item por elemento)): Informantes e declarantes
- `instrucao` (data AAAA-MM-DD): Audiência de instrução
- `alegacoes` (data AAAA-MM-DD): Alegações finais (data)
- `tese_primeira_fase` (texto longo): Tese na primeira fase
Seção "Pronúncia":
- `pronuncia` (data AAAA-MM-DD): Data da decisão
- `decisao` (uma das opções): Decisão. Opções: "Pendente" | "Pronúncia" | "Impronúncia" | "Desclassificação" | "Absolvição sumária"
- `pronuncia_termos` (texto longo): Termos da pronúncia (qualificadoras mantidas ou afastadas)
Seção "Recurso da pronúncia":
- `rese` (uma das opções): Recurso em sentido estrito. Opções: "Não interposto" | "Interposto pela defesa" | "Interposto pelo MP"
- `rese_resultado` (uma das opções): Resultado do recurso em sentido estrito. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
Seção "Plenário":
- `plenario` (data AAAA-MM-DD): Data do plenário
- `rol_acusacao` (lista (array de textos, um item por elemento)): Rol de testemunhas da acusação (art. 422)
- `rol` (lista (array de textos, um item por elemento)): Rol de testemunhas da defesa (art. 422)
- `tese` (texto): Tese principal
- `subsidiarias` (lista (array de textos, um item por elemento)): Teses subsidiárias
- `quesitos` (texto longo): Quesitos e pontos de atenção
Seção "Sentença do plenário":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Absolvição" | "Condenação" | "Condenação parcial" | "Desclassificação (julgamento pelo juiz presidente)" | "Dissolução do conselho" | "Extinção da punibilidade"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `pena_base` (texto): Pena-base (1ª fase, CP, art. 59)
- `circunstancias_judiciais` (texto longo): Circunstâncias judiciais desfavoráveis
- `agravantes` (lista (array de textos, um item por elemento)): Agravantes reconhecidas
- `atenuantes` (lista (array de textos, um item por elemento)): Atenuantes reconhecidas
- `reincidencia` (uma das opções): Reincidência. Opções: "Primário" | "Reincidente" | "Reincidente específico"
- `pena_intermediaria` (texto): Pena intermediária (2ª fase)
- `causas_aumento` (lista (array de textos, um item por elemento)): Causas de aumento (3ª fase)
- `causas_diminuicao` (lista (array de textos, um item por elemento)): Causas de diminuição (3ª fase)
- `concurso` (uma das opções): Concurso de crimes. Opções: "Não houve" | "Concurso material" | "Concurso formal" | "Crime continuado"
- `pena` (texto): Pena definitiva (ex.: 5 anos e 4 meses)
- `hediondo` ("Sim" ou "Não"): Crime hediondo ou equiparado
- `violencia` ("Sim" ou "Não"): Com violência ou grave ameaça à pessoa
- `pena_especie` (uma das opções): Espécie da pena. Opções: "Reclusão" | "Detenção" | "Prisão simples"
- `regime` (uma das opções): Regime inicial. Opções: "Fechado" | "Semiaberto" | "Aberto"
- `multa` (texto): Pena de multa (dias-multa e valor do dia)
- `restritivas` (lista (array de textos, um item por elemento)): Penas restritivas de direitos (CP, art. 44)
- `prestacao_pecuniaria` (valor em reais (número, ex.: 1500.5)): Prestação pecuniária
- `sursis_pena` (uma das opções): Suspensão condicional da pena (CP, art. 77). Opções: "Não cabe" | "Concedida" | "Negada"
- `detracao` (texto): Detração (CPP, art. 387, § 2º)
- `recorrer_liberdade` (uma das opções): Recorrer em liberdade. Opções: "Concedido" | "Negado" | "Mantida a prisão preventiva" | "Decretada a prisão na sentença"
- `reparacao_minima` (valor em reais (número, ex.: 1500.5)): Reparação mínima à vítima (CPP, art. 387, IV)
- `transito_acusacao` (data AAAA-MM-DD): Trânsito em julgado para a acusação
Seção "Recurso e trânsito":
- `apelacao` (uma das opções): Apelação. Opções: "Não interposta" | "Interposta pela defesa" | "Interposta pelo MP" | "Interposta pela defesa e pelo MP"
- `apelacao_resultado` (uma das opções): Resultado da apelação. Opções: "Pendente" | "Provida" | "Parcialmente provida" | "Desprovida" | "Não conhecida"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou (pena, regime, absolvição, nulidade)
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Especial e extraordinário" | "Agravo em recurso especial" | "Habeas corpus no STJ" | "Habeas corpus no STF"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido" | "Ordem concedida" | "Ordem concedida de ofício" | "Ordem denegada"
- `transito` (data AAAA-MM-DD): Trânsito em julgado

### `execucao_penal`: Execução penal (judicial)
Fases (use o nome exato em processo.fase): "Guia expedida", "Cálculo homologado", "Cumprimento em regime fechado", "Semiaberto", "Aberto ou domiciliar", "Livramento condicional", "Pena extinta"
Seção "Guia de execução":
- `guia_tipo` (uma das opções): Tipo de guia. Opções: "Definitiva" | "Provisória"
- `guia_numero` (texto): Número da guia
- `guia_expedicao` (data AAAA-MM-DD): Expedição da guia
- `juizo_execucao` (texto): Juízo da execução
- `processo_origem` (texto): Processo de conhecimento
Seção "Datas da execução":
- `inicio_cumprimento` (data AAAA-MM-DD): Início do cumprimento (prisão)
- `data_base` (data AAAA-MM-DD): Data-base para progressão
- `data_base_lc` (data AAAA-MM-DD): Data-base para livramento condicional
- `detracao` (número): Detração (dias)
- `pena` (texto): Pena total (como consta no cálculo)
- `termino` (data AAAA-MM-DD): Término da pena (como consta no cálculo)
Seção "Cumprimento":
- `regime` (uma das opções): Regime atual. Opções: "Fechado" | "Semiaberto" | "Aberto" | "Prisão domiciliar" | "Livramento condicional"
- `unidade` (texto): Unidade prisional
- `trabalho` (texto): Trabalho ou estudo
Seção "Dados anteriores (um crime só)" (só para os tipos: __anterior):
- `natureza` (uma das opções): Natureza do crime. Opções: "Comum sem violência" | "Comum com violência ou grave ameaça" | "Hediondo ou equiparado" | "Hediondo com resultado morte"
- `reincidencia` (uma das opções): Condição. Opções: "Primário" | "Reincidente" | "Reincidente específico"
- `fracao` (texto): Fração para progressão
- `remicao` (número): Dias remidos
Seção "Benefícios":
- `progressao` (data AAAA-MM-DD): Previsão de progressão
- `livramento` (data AAAA-MM-DD): Previsão de livramento
- `saida` (uma das opções): Saída temporária. Opções: "Não cabe" | "Não requerida" | "Requerida" | "Deferida" | "Indeferida"
- `faltas` (lista (array de textos, um item por elemento)): Faltas graves
- `indulto` (texto): Indulto ou comutação (decreto)

### `inquerito`: Inquérito e investigação (judicial)
Fases (use o nome exato em processo.fase): "Registro de ocorrência", "Inquérito instaurado", "Oitivas e diligências", "Relatório final", "Com o Ministério Público", "Denúncia ou arquivamento"
Seção "Inquérito":
- `numero_ip` (texto): Nº do inquérito
- `delegacia` (texto): Delegacia
- `autoridade` (texto): Autoridade policial
- `instauracao` (data AAAA-MM-DD): Data de instauração
- `situacao` (uma das opções): Situação. Opções: "Em andamento" | "Relatado" | "Denunciado" | "Arquivado" | "Baixado para diligências"
- `posicao` (uma das opções): Posição do cliente. Opções: "Investigado" | "Vítima" | "Testemunha"
Seção "Diligências":
- `preso` ("Sim" ou "Não"): Investigado preso
- `oitiva` (data AAAA-MM-DD): Oitiva marcada
- `cautelares` (lista (array de textos, um item por elemento)): Medidas cautelares
- `apreendidos` (lista (array de textos, um item por elemento)): Bens apreendidos
- `restituicao` (uma das opções): Pedido de restituição. Opções: "Não se aplica" | "Não requerido" | "Requerido" | "Deferido" | "Indeferido"
Seção "Desfecho":
- `desfecho` (uma das opções): Desfecho. Opções: "Em andamento" | "Relatado sem indiciamento" | "Indiciamento" | "Arquivado" | "Denúncia oferecida" | "ANPP proposto" | "Transação penal proposta"
- `desfecho_data` (data AAAA-MM-DD): Data do desfecho
- `processo_gerado` (texto): Número do processo gerado

### `trabalhista`: Trabalhista (judicial)
Fases (use o nome exato em processo.fase): "A ajuizar", "Inicial distribuída", "Audiência inicial", "Perícia", "Instrução", "Sentença", "Recurso ordinário", "Recurso de revista", "Liquidação", "Execução", "Encerrado"
Seção "Contrato de trabalho":
- `polo` (uma das opções): Polo do cliente. Opções: "Reclamante" | "Reclamada"
- `empregador` (texto): Empregador
- `funcao` (texto): Função
- `admissao` (data AAAA-MM-DD): Admissão
- `demissao` (data AAAA-MM-DD): Desligamento
- `desligamento` (uma das opções): Tipo de desligamento. Opções: "Sem justa causa" | "Justa causa" | "Pedido de demissão" | "Rescisão indireta" | "Acordo (art. 484-A)" | "Término de contrato"
- `salario` (valor em reais (número, ex.: 1500.5)): Último salário
- `ctps` ("Sim" ou "Não"): CTPS anotada
- `jornada` (texto): Jornada cumprida
Seção "Pedidos":
- `pedidos` (lista (array de textos, um item por elemento)): Pedidos
- `valor_pedidos` (valor em reais (número, ex.: 1500.5)): Valor dos pedidos
- `rito` (uma das opções): Rito. Opções: "Sumaríssimo" | "Ordinário" | "Sumário"
- `pericia` (uma das opções): Perícia. Opções: "Não" | "Insalubridade" | "Periculosidade" | "Médica" | "Contábil"
Seção "Audiência e prova":
- `preposto` (texto): Preposto
- `testemunhas` (lista (array de textos, um item por elemento)): Testemunhas
Seção "Recurso e execução":
- `deposito` (valor em reais (número, ex.: 1500.5)): Depósito recursal
- `acordo` (valor em reais (número, ex.: 1500.5)): Acordo homologado
- `liquidacao` (valor em reais (número, ex.: 1500.5)): Valor liquidado
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `verbas_deferidas` (lista (array de textos, um item por elemento)): Verbas deferidas
- `valor_liquidado` (valor em reais (número, ex.: 1500.5)): Valor liquidado
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `previdenciario`: Previdenciário (judicial)
Fases (use o nome exato em processo.fase): "Análise de documentos", "Requerimento administrativo", "Exigência do INSS", "Indeferido", "Recurso administrativo", "Ação ajuizada", "Perícia judicial", "Sentença", "Recurso", "Implantação e atrasados", "Encerrado"
Seção "Benefício":
- `beneficio` (uma das opções): Benefício. Opções: "Aposentadoria por idade" | "Aposentadoria por tempo de contribuição" | "Aposentadoria especial" | "Aposentadoria por incapacidade permanente" | "Auxílio por incapacidade temporária" | "Auxílio-acidente" | "Pensão por morte" | "BPC/LOAS" | "Salário-maternidade" | "Revisão de benefício"
- `nb` (texto): Número do benefício (NB)
- `der` (data AAAA-MM-DD): Data de entrada do requerimento (DER)
- `dib` (data AAAA-MM-DD): Início do benefício (DIB)
- `dcb` (data AAAA-MM-DD): Cessação do benefício (DCB)
- `via` (uma das opções): Via. Opções: "Administrativa" | "Juizado Especial Federal" | "Vara Federal" | "Justiça Estadual (competência delegada)"
Seção "Tempo e carência":
- `tempo` (texto): Tempo de contribuição reconhecido
- `carencia` (número): Carência (contribuições)
- `especiais` (lista (array de textos, um item por elemento)): Períodos especiais
- `ppp` ("Sim" ou "Não"): PPP e LTCAT juntados
- `cnis` ("Sim" ou "Não"): CNIS conferido
- `segurado` (uma das opções): Qualidade de segurado. Opções: "Mantida" | "Período de graça" | "Perdida" | "A comprovar"
Seção "Incapacidade":
- `pericia` (data AAAA-MM-DD): Perícia médica
- `cid` (texto): CID
- `laudo` (texto longo): Conclusão do laudo
Seção "Valores":
- `rmi` (valor em reais (número, ex.: 1500.5)): Renda mensal inicial estimada
- `atrasados` (valor em reais (número, ex.: 1500.5)): Atrasados estimados
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `beneficio_concedido` (uma das opções): Benefício. Opções: "Concedido" | "Negado" | "Restabelecido" | "Revisado"
- `dib_fixada` (data AAAA-MM-DD): DIB fixada na sentença
- `implantacao` (data AAAA-MM-DD): Data da implantação
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `tributario`: Tributário (judicial)
Fases (use o nome exato em processo.fase): "Análise", "Defesa administrativa", "Ação ajuizada", "Garantia do juízo", "Embargos", "Sentença", "Recurso", "Cumprimento ou baixa", "Encerrado"
Seção "Crédito":
- `tributo` (texto): Tributo
- `ente` (uma das opções): Ente. Opções: "União" | "Estado" | "Município"
- `tipo` (uma das opções): Medida. Opções: "Execução fiscal" | "Ação anulatória" | "Mandado de segurança" | "Repetição de indébito" | "Defesa administrativa" | "Transação ou parcelamento" | "Exceção de pré-executividade"
- `cda` (texto): Certidão de dívida ativa
- `periodo` (texto): Período de apuração
- `constituicao` (data AAAA-MM-DD): Constituição do crédito
- `valor_atual` (valor em reais (número, ex.: 1500.5)): Valor atualizado
Seção "Garantia e exigibilidade":
- `garantia` (uma das opções): Garantia do juízo. Opções: "Não há" | "Penhora" | "Depósito integral" | "Seguro-garantia" | "Fiança bancária"
- `suspensa` ("Sim" ou "Não"): Exigibilidade suspensa
- `certidao` (uma das opções): Certidão de regularidade. Opções: "Negativa" | "Positiva com efeitos de negativa" | "Positiva"
- `parcelamento` (texto longo): Parcelamento ou transação
Seção "Tese":
- `tese` (texto longo): Tese
- `prescricao` (data AAAA-MM-DD): Prescrição prevista
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `debito_situacao` (uma das opções): Situação do débito. Opções: "Extinto" | "Reduzido" | "Mantido" | "Suspenso"
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `empresarial`: Empresarial e recuperação (judicial)
Fases (use o nome exato em processo.fase): "Análise", "Pedido ajuizado", "Processamento deferido", "Verificação de créditos", "Assembleia de credores", "Plano homologado", "Cumprimento", "Encerrado"
Seção "Procedimento":
- `tipo` (uma das opções): Tipo. Opções: "Recuperação judicial" | "Recuperação extrajudicial" | "Falência" | "Dissolução de sociedade" | "Apuração de haveres" | "Execução de título" | "Habilitação de crédito" | "Responsabilidade de administrador"
- `empresa` (texto): Empresa
- `cnpj` (texto): CNPJ
- `aj` (texto): Administrador judicial
- `stay` (data AAAA-MM-DD): Suspensão das execuções até
- `agc` (data AAAA-MM-DD): Assembleia de credores
Seção "Crédito do cliente":
- `classe` (uma das opções): Classe do crédito. Opções: "Trabalhista" | "Garantia real" | "Quirografário" | "Microempresa e pequeno porte" | "Extraconcursal"
- `credito` (valor em reais (número, ex.: 1500.5)): Valor do crédito
- `habilitacao` (uma das opções): Habilitação. Opções: "Não apresentada" | "Apresentada" | "Incluída no quadro" | "Impugnada"
- `plano` (texto longo): Condições do plano

### `imobiliario`: Imobiliário (judicial)
Fases (use o nome exato em processo.fase): "A ajuizar", "Inicial distribuída", "Citação", "Contestação e réplica", "Saneamento", "Instrução", "Sentença", "Recurso", "Cumprimento de sentença", "Encerrado"
Seção "Imóvel":
- `tipo` (uma das opções): Ação. Opções: "Despejo por falta de pagamento" | "Despejo por denúncia vazia" | "Renovatória" | "Revisional de aluguel" | "Usucapião" | "Reintegração ou manutenção de posse" | "Adjudicação compulsória" | "Rescisão de compra e venda" | "Cobrança de condomínio"
- `imovel` (texto): Imóvel
- `matricula` (texto): Matrícula
- `cartorio` (texto): Registro de imóveis
Seção "Contrato":
- `inicio` (data AAAA-MM-DD): Início do contrato
- `fim` (data AAAA-MM-DD): Fim do contrato
- `aluguel` (valor em reais (número, ex.: 1500.5)): Aluguel
- `garantia` (uma das opções): Garantia. Opções: "Sem garantia" | "Caução" | "Fiador" | "Seguro-fiança" | "Título de capitalização"
- `debito` (valor em reais (número, ex.: 1500.5)): Débito
Seção "Posse e liminar":
- `posse` (data AAAA-MM-DD): Posse desde
- `liminar` (uma das opções): Liminar. Opções: "Não pedida" | "Pedida" | "Deferida" | "Indeferida" | "Cumprida"
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `desocupacao` (texto): Prazo ou data da desocupação
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `administrativo`: Administrativo e direito público (judicial)
Fases (use o nome exato em processo.fase): "Análise", "Via administrativa", "Ação ajuizada", "Liminar", "Informações ou contestação", "Sentença", "Remessa ou recurso", "Precatório ou requisição", "Encerrado"
Seção "Ato e parte":
- `tipo` (uma das opções): Tipo. Opções: "Mandado de segurança" | "Ação contra ente público" | "Improbidade administrativa" | "Licitação e contrato" | "Concurso público" | "Servidor público" | "Processo disciplinar" | "Desapropriação" | "Responsabilidade civil do Estado"
- `ente` (texto): Ente ou órgão
- `autoridade` (texto): Autoridade coatora
- `ato` (texto longo): Ato impugnado
- `ciencia` (data AAAA-MM-DD): Ciência do ato
Seção "Andamento":
- `liminar` (uma das opções): Liminar. Opções: "Não pedida" | "Pedida" | "Deferida" | "Indeferida" | "Suspensa"
- `pagamento` (uma das opções): Forma de pagamento. Opções: "Não se aplica" | "Requisição de pequeno valor" | "Precatório"
- `valor` (valor em reais (número, ex.: 1500.5)): Valor
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `saude`: Saúde (judicial)
Fases (use o nome exato em processo.fase): "Documentação médica", "Ação ajuizada", "Liminar", "Cumprimento da liminar", "Contestação", "Perícia", "Sentença", "Recurso", "Encerrado"
Seção "Pedido":
- `reu` (uma das opções): Réu. Opções: "Operadora de plano de saúde" | "União" | "Estado" | "Município" | "Estado e Município"
- `operadora` (texto): Operadora ou ente
- `pedido` (texto): Procedimento ou medicamento
- `anvisa` ("Sim" ou "Não"): Registro na Anvisa
- `rol` ("Sim" ou "Não"): Previsto no rol da ANS
- `negativa` (data AAAA-MM-DD): Data da negativa
- `protocolo` (texto): Protocolo da negativa
Seção "Urgência":
- `laudo` (texto): Laudo médico (médico e CRM)
- `urgencia` ("Sim" ou "Não"): Urgência ou emergência
- `liminar` (uma das opções): Liminar. Opções: "Não pedida" | "Pedida" | "Deferida" | "Indeferida"
- `multa` (valor em reais (número, ex.: 1500.5)): Multa diária
- `cumprimento` (uma das opções): Cumprimento. Opções: "Não se aplica" | "Pendente" | "Cumprida" | "Descumprida" | "Bloqueio de valores"
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `bancario`: Bancário (judicial)
Fases (use o nome exato em processo.fase): "A ajuizar", "Inicial distribuída", "Citação", "Contestação e réplica", "Saneamento", "Instrução", "Sentença", "Recurso", "Cumprimento de sentença", "Encerrado"
Seção "Contrato":
- `instituicao` (texto): Instituição financeira
- `contrato` (texto): Nº do contrato
- `tipo` (uma das opções): Tipo. Opções: "Revisional" | "Superendividamento" | "Fraude ou golpe" | "Consignado não contratado" | "Busca e apreensão" | "Execução de cédula"
- `financiado` (valor em reais (número, ex.: 1500.5)): Valor financiado
- `taxa` (texto): Taxa contratada
- `taxa_media` (texto): Taxa média do Banco Central
- `parcelas` (texto): Parcelas pagas e totais
Seção "Situação":
- `negativacao` ("Sim" ou "Não"): Há negativação
- `bem` (texto): Bem dado em garantia
- `apreendido` ("Sim" ou "Não"): Bem apreendido
- `plano` (texto longo): Plano de pagamento proposto
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `taxa_fixada` (texto): Taxa de juros fixada
- `valor_restituir` (valor em reais (número, ex.: 1500.5)): Valor a restituir ao cliente
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `ambiental`: Ambiental (judicial)
Fases (use o nome exato em processo.fase): "Auto lavrado", "Defesa administrativa", "Julgamento", "Recurso administrativo", "Ação judicial", "Sentença", "Recurso", "Cumprimento ou ajuste", "Encerrado"
Seção "Autuação":
- `tipo` (uma das opções): Tipo. Opções: "Auto de infração" | "Ação civil pública" | "Crime ambiental" | "Licenciamento" | "Termo de ajustamento de conduta"
- `orgao` (uma das opções): Órgão. Opções: "Ibama" | "ICMBio" | "INEA" | "Secretaria municipal" | "Ministério Público"
- `auto` (texto): Nº do auto ou processo
- `lavratura` (data AAAA-MM-DD): Data da lavratura
- `multa` (valor em reais (número, ex.: 1500.5)): Multa
- `embargo` ("Sim" ou "Não"): Área ou atividade embargada
Seção "Regularização":
- `licenca` (texto): Licença (tipo e validade)
- `tac` (texto longo): Obrigações do termo de ajuste
- `reparacao` (uma das opções): Projeto de recuperação da área. Opções: "Não exigido" | "Exigido" | "Protocolado" | "Em execução" | "Concluído"
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `eleitoral`: Eleitoral (judicial)
Fases (use o nome exato em processo.fase): "Consulta", "Pedido ou representação", "Defesa", "Instrução", "Sentença", "Recurso ao TRE", "Recurso ao TSE", "Encerrado"
Seção "Feito":
- `tipo` (uma das opções): Tipo. Opções: "Registro de candidatura" | "Investigação judicial eleitoral" | "Impugnação de mandato eletivo" | "Representação por propaganda" | "Prestação de contas" | "Recurso contra expedição de diploma"
- `candidato` (texto): Candidato ou partido
- `cargo` (texto): Cargo
- `eleicao` (texto): Eleição (ano)
- `zona` (texto): Zona eleitoral
Seção "Contas":
- `contas` (uma das opções): Situação das contas. Opções: "Não se aplica" | "A prestar" | "Prestadas" | "Aprovadas" | "Aprovadas com ressalvas" | "Desaprovadas" | "Não prestadas"
- `diligencias` (lista (array de textos, um item por elemento)): Diligências
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `sancao` (texto longo): Sanção aplicada
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `digital`: Digital e proteção de dados (judicial)
Fases (use o nome exato em processo.fase): "Preservação de provas", "Notificação da plataforma", "Ação ajuizada", "Liminar", "Fornecimento de registros", "Sentença", "Recurso", "Encerrado"
Seção "Caso":
- `tipo` (uma das opções): Tipo. Opções: "Remoção de conteúdo" | "Vazamento de dados" | "Identificação de usuário" | "Crime contra a honra" | "Fraude ou golpe" | "Perfil falso"
- `plataforma` (texto): Plataforma ou controlador
- `url` (lista (array de textos, um item por elemento)): Endereços (URL)
- `ata` ("Sim" ou "Não"): Ata notarial ou captura certificada
- `conhecimento` (data AAAA-MM-DD): Data do conhecimento
Seção "Medidas":
- `preservacao` ("Sim" ou "Não"): Preservação de registros pedida
- `liminar` (uma das opções): Liminar. Opções: "Não pedida" | "Pedida" | "Deferida" | "Indeferida" | "Cumprida"
- `anpd` (uma das opções): Comunicação à ANPD. Opções: "Não se aplica" | "Pendente" | "Feita"
- `dano` (valor em reais (número, ex.: 1500.5)): Dano moral pedido
Seção "Sentença e resultado":
- `resultado` (uma das opções): Resultado. Opções: "Pendente" | "Procedente" | "Parcialmente procedente" | "Improcedente" | "Extinto sem resolução do mérito" | "Acordo homologado" | "Desistência homologada"
- `sentenca_data` (data AAAA-MM-DD): Data da sentença
- `remocao` (uma das opções): Remoção de conteúdo. Opções: "Determinada" | "Negada" | "Cumprida"
- `condenacao_valor` (valor em reais (número, ex.: 1500.5)): Valor da condenação
- `obrigacao` (texto longo): Obrigação de fazer ou não fazer imposta
- `honorarios_sucumbencia` (texto): Honorários de sucumbência (percentual ou valor)
- `sucumbencia` (uma das opções): Sucumbência a cargo de. Opções: "Parte contrária" | "Cliente" | "Recíproca"
- `custas` (uma das opções): Custas. Opções: "A cargo da parte contrária" | "A cargo do cliente" | "Rateadas" | "Gratuidade de justiça"
Seção "Recurso e trânsito":
- `recurso` (uma das opções): Recurso. Opções: "Não interposto" | "Interposto pelo cliente" | "Interposto pela parte contrária" | "Interposto por ambos"
- `recurso_tipo` (texto): Tipo de recurso (apelação, recurso ordinário, inominado...)
- `recurso_resultado` (uma das opções): Resultado do recurso. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `acordao_data` (data AAAA-MM-DD): Data do acórdão
- `acordao_efeito` (texto longo): O que o acórdão mudou
- `recurso_superior` (uma das opções): Recurso aos tribunais superiores. Opções: "Não interposto" | "Recurso especial" | "Recurso extraordinário" | "Recurso de revista" | "Especial e extraordinário" | "Agravo em recurso especial"
- `recurso_superior_resultado` (uma das opções): Resultado no tribunal superior. Opções: "Pendente" | "Provido" | "Parcialmente provido" | "Desprovido" | "Não conhecido"
- `transito` (data AAAA-MM-DD): Trânsito em julgado
- `cumprimento_valor` (valor em reais (número, ex.: 1500.5)): Valor em cumprimento de sentença

### `inventario_cartorio`: Inventário em cartório (extrajudicial)
Fases (use o nome exato em processo.fase): "Levantamento de documentos", "Certidões", "Declaração do ITCMD", "Imposto pago", "Minuta da escritura", "Assinatura", "Registro e transferências", "Concluído"
Seção "Sucessão":
- `falecido` (texto): Autor da herança
- `obito` (data AAAA-MM-DD): Data do óbito
- `tabelionato` (texto): Tabelionato
- `inventariante` (texto): Inventariante
- `testamento` ("Sim" ou "Não"): Há testamento
- `incapaz` ("Sim" ou "Não"): Herdeiro menor ou incapaz
- `herdeiros` (lista (array de textos, um item por elemento)): Herdeiros
Seção "Bens e imposto":
- `bens` (lista (array de textos, um item por elemento)): Bens
- `monte` (valor em reais (número, ex.: 1500.5)): Valor do monte
- `itcmd` (uma das opções): ITCMD. Opções: "Não declarado" | "Declarado" | "Guia emitida" | "Pago" | "Isento"
- `itcmd_valor` (valor em reais (número, ex.: 1500.5)): Valor do ITCMD
- `emolumentos` (valor em reais (número, ex.: 1500.5)): Emolumentos estimados
Seção "Documentos":
- `certidoes` (lista (array de textos, um item por elemento)): Certidões pendentes
- `escritura` (data AAAA-MM-DD): Data da escritura
- `registro` (uma das opções): Registro nos cartórios de imóveis. Opções: "Não iniciado" | "Protocolado" | "Com exigência" | "Concluído"

### `divorcio_cartorio`: Divórcio em cartório (extrajudicial)
Fases (use o nome exato em processo.fase): "Atendimento", "Documentos", "Minuta", "Revisão pelas partes", "Assinatura", "Averbação", "Concluído"
Seção "Acordo":
- `tipo` (uma das opções): Tipo. Opções: "Divórcio consensual" | "Dissolução de união estável" | "Conversão de separação em divórcio"
- `tabelionato` (texto): Tabelionato
- `filhos` ("Sim" ou "Não"): Filhos menores ou incapazes
- `judicial` ("Sim" ou "Não"): Guarda e alimentos já resolvidos em juízo
- `nome` ("Sim" ou "Não"): Retomada do nome de solteiro
- `alimentos` (texto): Alimentos entre os cônjuges
Seção "Partilha":
- `bens` (lista (array de textos, um item por elemento)): Bens e divisão
- `imposto` (uma das opções): Imposto sobre excesso de meação. Opções: "Não há" | "A recolher" | "Recolhido"
- `escritura` (data AAAA-MM-DD): Data da escritura
- `averbacao` (uma das opções): Averbação no registro civil. Opções: "Pendente" | "Protocolada" | "Concluída"

### `usucapiao_cartorio`: Usucapião em cartório (extrajudicial)
Fases (use o nome exato em processo.fase): "Análise da posse", "Planta e memorial", "Ata notarial", "Protocolo no registro", "Notificações", "Edital", "Nota de exigência", "Registro", "Concluído"
Seção "Posse":
- `modalidade` (uma das opções): Modalidade. Opções: "Extraordinária" | "Ordinária" | "Especial urbana" | "Especial rural" | "Familiar"
- `imovel` (texto): Imóvel
- `matricula` (texto): Matrícula ou transcrição
- `tempo` (texto): Tempo de posse
- `origem` (texto longo): Origem da posse
Seção "Documentos técnicos":
- `planta` ("Sim" ou "Não"): Planta e memorial com responsabilidade técnica
- `ata` (uma das opções): Ata notarial. Opções: "Não lavrada" | "Agendada" | "Lavrada"
- `anuencia` (uma das opções): Anuência dos confrontantes. Opções: "Pendente" | "Parcial" | "Completa"
Seção "Registro":
- `cartorio` (texto): Registro de imóveis
- `prenotacao` (texto): Prenotação (número e data)
- `notificacoes` (lista (array de textos, um item por elemento)): Notificações expedidas
- `impugnacao` ("Sim" ou "Não"): Houve impugnação

### `contratos`: Contratos (extrajudicial)
Fases (use o nome exato em processo.fase): "Pedido", "Minuta", "Em negociação", "Versão final", "Assinatura", "Vigente", "Encerrado"
Seção "Contrato":
- `tipo` (texto): Tipo de contrato
- `partes` (lista (array de textos, um item por elemento)): Partes
- `objeto` (texto longo): Objeto
- `valor` (valor em reais (número, ex.: 1500.5)): Valor
- `versao` (texto): Versão atual
- `assinatura` (uma das opções): Forma de assinatura. Opções: "Física" | "Certificado digital" | "Assinatura eletrônica"
Seção "Vigência":
- `inicio` (data AAAA-MM-DD): Início
- `fim` (data AAAA-MM-DD): Fim da vigência
- `renovacao` ("Sim" ou "Não"): Renovação automática
- `aviso` (texto): Aviso prévio para rescisão
- `reajuste` (texto): Índice e data de reajuste
Seção "Cláusulas de atenção":
- `multa` (texto): Multa por rescisão
- `foro` (texto): Foro ou arbitragem
- `exclusividade` ("Sim" ou "Não"): Exclusividade ou não concorrência
- `obs` (texto longo): Pontos negociados

### `consultivo`: Consultivo e pareceres (extrajudicial)
Fases (use o nome exato em processo.fase): "Consulta recebida", "Proposta enviada", "Em pesquisa", "Em redação", "Revisão", "Entregue", "Faturado"
Seção "Consulta":
- `tipo` (uma das opções): Tipo. Opções: "Parecer" | "Opinião legal" | "Consulta verbal" | "Auditoria jurídica" | "Treinamento"
- `solicitante` (texto): Solicitante
- `materia` (texto): Matéria
- `pergunta` (texto longo): Pergunta a responder
Seção "Entrega e horas":
- `entrega` (data AAAA-MM-DD): Prazo de entrega
- `horas_est` (número): Horas estimadas
- `horas_gastas` (número): Horas lançadas
- `cobranca` (uma das opções): Forma de cobrança. Opções: "Valor fechado" | "Por hora" | "Mensalidade de assessoria"
- `entregue` (data AAAA-MM-DD): Entregue em

### `societario`: Societário (extrajudicial)
Fases (use o nome exato em processo.fase): "Coleta de informações", "Minuta", "Assinaturas", "Protocolo no registro", "Exigência", "Registrado", "Atualização cadastral", "Concluído"
Seção "Sociedade":
- `empresa` (texto): Empresa
- `cnpj` (texto): CNPJ
- `tipo` (uma das opções): Tipo societário. Opções: "Limitada" | "Limitada unipessoal" | "Sociedade anônima" | "Sociedade simples" | "Cooperativa" | "Associação"
- `capital` (valor em reais (número, ex.: 1500.5)): Capital social
- `socios` (lista (array de textos, um item por elemento)): Sócios e participações
Seção "Ato":
- `ato` (uma das opções): Ato. Opções: "Constituição" | "Alteração contratual" | "Cessão de quotas" | "Transformação" | "Fusão, cisão ou incorporação" | "Distrato" | "Acordo de sócios" | "Ata de assembleia ou reunião"
- `orgao` (uma das opções): Órgão de registro. Opções: "Junta Comercial" | "Registro Civil de Pessoas Jurídicas"
- `assinatura` (data AAAA-MM-DD): Data da assinatura
- `protocolo` (texto): Protocolo
- `exigencia` (texto longo): Exigências
- `registro` (data AAAA-MM-DD): Registrado em

### `compliance`: Compliance e LGPD (extrajudicial)
Fases (use o nome exato em processo.fase): "Diagnóstico", "Mapeamento", "Plano de ação", "Políticas e contratos", "Treinamento", "Monitoramento"
Seção "Programa":
- `escopo` (uma das opções): Escopo. Opções: "Adequação à LGPD" | "Programa de integridade" | "Canal de denúncias" | "Investigação interna" | "Código de conduta"
- `encarregado` (texto): Encarregado de dados
- `mapeamento` (uma das opções): Mapeamento de dados. Opções: "Não iniciado" | "Em andamento" | "Concluído"
- `politicas` (texto longo): Políticas entregues
Seção "Rotina":
- `treinamentos` (lista (array de textos, um item por elemento)): Treinamentos realizados
- `incidentes` (número): Incidentes registrados
- `pedidos` (número): Pedidos de titulares em aberto
- `revisao` (data AAAA-MM-DD): Próxima revisão

### `mediacao`: Mediação e arbitragem (extrajudicial)
Fases (use o nome exato em processo.fase): "Convite à outra parte", "Termo inicial", "Sessões", "Proposta de acordo", "Termo de acordo ou sentença", "Cumprimento", "Encerrado"
Seção "Procedimento":
- `tipo` (uma das opções): Tipo. Opções: "Mediação" | "Conciliação" | "Arbitragem" | "Negociação direta"
- `camara` (texto): Câmara
- `mediador` (texto): Mediador ou árbitro
- `disputa` (valor em reais (número, ex.: 1500.5)): Valor em disputa
- `custas` (valor em reais (número, ex.: 1500.5)): Custas da câmara
Seção "Sessões":
- `sessoes` (número): Sessões realizadas
- `proxima` (data AAAA-MM-DD): Próxima sessão
- `pontos` (lista (array de textos, um item por elemento)): Pontos de impasse
- `resultado` (uma das opções): Resultado. Opções: "Em andamento" | "Acordo total" | "Acordo parcial" | "Sem acordo" | "Sentença arbitral"

### `notificacoes`: Notificações e cobranças (extrajudicial)
Fases (use o nome exato em processo.fase): "Redação", "Enviada", "Recebida", "Prazo em curso", "Respondida", "Acordo", "Protesto ou ação", "Encerrado"
Seção "Notificação":
- `destinatario` (texto): Destinatário
- `objeto` (texto longo): Objeto
- `meio` (uma das opções): Meio. Opções: "Cartório de títulos e documentos" | "Carta com aviso de recebimento" | "E-mail com confirmação" | "Aplicativo de mensagens" | "Plataforma digital"
- `envio` (data AAAA-MM-DD): Enviada em
- `recebimento` (data AAAA-MM-DD): Recebida em
- `prazo` (texto): Prazo concedido
Seção "Cobrança":
- `valor` (valor em reais (número, ex.: 1500.5)): Valor cobrado
- `resposta` (texto longo): Resposta
- `protesto` (uma das opções): Protesto. Opções: "Não se aplica" | "A enviar" | "Protestado" | "Pago em cartório" | "Sustado"
- `acordo` (texto longo): Acordo (condições)

### `regularizacao`: Regularização de imóveis (extrajudicial)
Fases (use o nome exato em processo.fase): "Análise da matrícula", "Documentos", "Protocolo", "Nota de exigência", "Cumprimento da exigência", "Registro ou averbação", "Concluído"
Seção "Imóvel":
- `imovel` (texto): Imóvel
- `matricula` (texto): Matrícula
- `cartorio` (texto): Registro de imóveis
- `pendencia` (uma das opções): Serviço. Opções: "Averbação de construção" | "Retificação de área" | "Desmembramento ou unificação" | "Adjudicação compulsória em cartório" | "Regularização fundiária" | "Georreferenciamento" | "Baixa de hipoteca ou alienação" | "Compra e venda com escritura"
Seção "Andamento":
- `prenotacao` (texto): Prenotação (número e data)
- `exigencias` (lista (array de textos, um item por elemento)): Exigências
- `imposto` (uma das opções): Imposto de transmissão. Opções: "Não se aplica" | "A recolher" | "Recolhido"
- `habite` ("Sim" ou "Não"): Habite-se ou certidão de construção
- `emolumentos` (valor em reais (número, ex.: 1500.5)): Emolumentos

### `planejamento`: Planejamento sucessório (extrajudicial)
Fases (use o nome exato em processo.fase): "Entrevista", "Levantamento patrimonial", "Proposta de estrutura", "Minutas", "Assinatura e registro", "Revisão periódica"
Seção "Família e patrimônio":
- `titular` (texto): Titular do patrimônio
- `herdeiros` (lista (array de textos, um item por elemento)): Herdeiros e legatários
- `patrimonio` (valor em reais (número, ex.: 1500.5)): Patrimônio estimado
- `regime` (texto): Regime de bens
Seção "Estrutura":
- `instrumento` (uma das opções): Instrumento. Opções: "Testamento público" | "Testamento particular" | "Doação com reserva de usufruto" | "Holding familiar" | "Pacto antenupcial" | "Contrato de convivência" | "Diretivas antecipadas de vontade"
- `clausulas` (texto longo): Cláusulas restritivas
- `imposto` (valor em reais (número, ex.: 1500.5)): Imposto estimado
- `revisao` (data AAAA-MM-DD): Próxima revisão

### `marcas`: Marcas e propriedade intelectual (extrajudicial)
Fases (use o nome exato em processo.fase): "Busca prévia", "Depósito", "Publicação", "Oposição", "Exame de mérito", "Deferimento", "Concessão", "Vigente"
Seção "Marca":
- `marca` (texto): Marca
- `processo` (texto): Nº do processo no INPI
- `classe` (texto): Classe (NCL)
- `apresentacao` (uma das opções): Apresentação. Opções: "Nominativa" | "Mista" | "Figurativa" | "Tridimensional"
- `deposito` (data AAAA-MM-DD): Data do depósito
Seção "Andamento":
- `situacao` (uma das opções): Situação. Opções: "Aguardando exame formal" | "Publicada" | "Com oposição" | "Em exame de mérito" | "Deferida" | "Indeferida" | "Registrada" | "Extinta"
- `oposicao` (texto longo): Oposição ou exigência
- `concessao` (data AAAA-MM-DD): Concessão
- `vigencia` (data AAAA-MM-DD): Vigência até
