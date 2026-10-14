/**
 * Lê uma variável de ambiente sem BOM (U+FEFF), aspas e espaços nas pontas.
 * Valor gravado via PowerShell costuma vir com BOM, e o fetch recusa em cabeçalho
 * ("Cannot convert argument to a ByteString ... value of 65279").
 */
export function envLimpo(nome: string): string | undefined {
  const v = process.env[nome]?.replace(/[﻿​]/g, "").trim().replace(/^["']|["']$/g, "");
  return v || undefined;
}
