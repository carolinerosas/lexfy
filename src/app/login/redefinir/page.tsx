import { FormularioRedefinir } from "./formulario";

export default async function RedefinirPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <FormularioRedefinir token={token ?? ""} />;
}
