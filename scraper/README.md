# Lexfy Scraper

Serviço Node.js + Playwright que faz scraping de tribunais usando navegador real (Chromium headless).
Pensado pra rodar separado do app Lexfy (Vercel), num provedor que suporte containers/processos longos.

## Deploy no Railway (recomendado — mais simples)

1. Acesse https://railway.app e crie conta (login com GitHub)
2. Clique em **New Project** → **Deploy from GitHub repo**
3. Selecione o repo `carolinerosas/lexfy`
4. Quando aparecer a tela de configuração:
   - Em **Root Directory**, digite: `scraper`
   - Railway detecta o `Dockerfile` automaticamente
5. Vá em **Variables** e adicione:
   - `API_KEY` = uma senha aleatória forte (anote essa senha)
6. Vá em **Settings → Networking → Generate Domain**
   - Vai gerar uma URL tipo `lexfy-scraper-production.up.railway.app`
7. Anote a URL gerada

## Configurar no Lexfy (Vercel)

No projeto `lexfy` no Vercel → Settings → Environment Variables:

- `NEXT_PUBLIC_SCRAPER_URL` = `https://sua-url.up.railway.app`
- `NEXT_PUBLIC_SCRAPER_KEY` = a mesma senha que você usou no Railway

Faça **Redeploy**.

## Custo

- Railway tem plano gratuito de $5/mês de crédito (suficiente pra dezenas de consultas/dia)
- Acima disso, ~$20/mês com uso moderado

## Testar localmente

```bash
cd scraper
npm install
npm start
```

Em outro terminal:
```bash
curl -X POST http://localhost:3000/pje-rj \
  -H "Content-Type: application/json" \
  -d '{"numero":"0805324-38.2025.8.19.0007"}'
```
