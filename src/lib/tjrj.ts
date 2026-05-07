export interface TJRJMovimento {
  data: string;
  descricao: string;
}

export class TJRJError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function buscarNoTJRJ(numero: string): Promise<TJRJMovimento[]> {
  const res = await fetch("/api/tjrj", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ numero }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new TJRJError(data.error ?? `Erro ${res.status}`);
  }

  return data.movimentos ?? [];
}
