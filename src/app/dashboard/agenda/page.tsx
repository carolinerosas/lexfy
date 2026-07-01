import { AgendaCalendario } from "@/components/ui/agenda-calendario";

export default function AgendaPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Agenda</h1>
        <p className="mt-1 text-sm text-gray-400">Prazos, audiências, atendimentos, tarefas e parcelas de acordo.</p>
      </div>
      <AgendaCalendario />
    </div>
  );
}
