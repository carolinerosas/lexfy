// Gera a skill justio-extracao (SKILL.md e areas.md) a partir das fichas (src/novo/lib/areas.ts).
// Rode depois de mudar qualquer ficha: npm run skill:gerar
import { writeFileSync } from "fs";
import { areasTexto, skillJustio } from "../src/novo/lib/importacao";

const pasta = new URL("../skills/justio-extracao/", import.meta.url);
writeFileSync(new URL("SKILL.md", pasta), skillJustio());
writeFileSync(new URL("areas.md", pasta), `# Fichas do JUSTIO por área\n\nCada área traz as fases (para processo.fase), os tipos de processo (para processo.tipos) e as chaves da ficha (para "ficha").\n\n${areasTexto()}`);
console.log("skills/justio-extracao atualizada (SKILL.md e areas.md).");
