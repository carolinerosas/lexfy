"use client";
import { useSyncExternalStore } from "react";

/**
 * Estado das buscas demoradas (tribunais, diários) fora dos componentes.
 * A busca continua rodando se a janela for fechada ou a página trocada,
 * e o resultado fica guardado até a pessoa gravar ou descartar.
 */
const jobs = new Map<string, unknown>();
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

/** `inicial` precisa ser uma constante (mesma referência a cada chamada). */
export function useBusca<T>(chave: string, inicial: T): T {
  return useSyncExternalStore(assinar, () => (jobs.has(chave) ? jobs.get(chave) : inicial) as T, () => inicial);
}

export function lerBusca<T>(chave: string, inicial: T): T {
  return (jobs.has(chave) ? jobs.get(chave) : inicial) as T;
}

export function gravarBusca<T>(chave: string, atual: (anterior: T) => T, inicial: T) {
  jobs.set(chave, atual(lerBusca(chave, inicial)));
  avisar();
}
