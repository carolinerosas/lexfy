# Portal do Cliente — especificação (rascunho, 13/10/2026)

Cada cliente — ou familiar autorizado por ele — entra com login próprio e vê **só o que é dele**.

## Pré-requisito

Fechar o acesso público ao banco do Justio (tarefa separada). Hoje as tabelas aceitam leitura
com a chave pública do site; enquanto isso não mudar, qualquer senha de portal seria só fachada.

## Quem acessa

- **Acessos** são cadastrados pela Carol na pasta do cliente: nome, CPF, celular/e-mail, vínculo
  (o próprio cliente, mãe, esposa…) e **quais processos** cada acesso enxerga.
- Exemplo: no caso do Raphael (preso), o acesso é da família, não dele.
- Acesso pode ser suspenso/revogado a qualquer momento; tudo que for visto fica registrado (log).

## Como entra

- Primeiro acesso por **link de convite** (WhatsApp ou e-mail) → cria a senha.
- Depois: CPF + senha, com código por e-mail/WhatsApp ao entrar de um aparelho novo.
- Esqueci a senha: link por e-mail/WhatsApp.

## O que vê

**Nada aparece por padrão.** A Carol escolhe o que liberar:

- Andamentos marcados como "visível ao cliente", em linguagem simples (o bot pode sugerir a versão
  simplificada, e a Carol aprova).
- Próximas audiências (data, hora, local/link).
- Documentos que ela marcar para compartilhar.
- Contato do escritório.

Nunca aparecem: anotações internas, estratégia, honorários de outros, dados de outros processos.

## Ligação com os outros projetos

- O atendimento automático pelo **WhatsApp** usa a mesma regra de "quem pode ver o quê" (os mesmos
  acessos cadastrados).
- O bot do **Telegram** (só da Carol) pode marcar um registro como "visível ao cliente" na hora de salvar.

## Cuidados

- Termo de uso e privacidade (LGPD) aceito no primeiro acesso.
- Autorização do cliente para cada familiar que recebe acesso (sigilo profissional) — guardada na pasta.
