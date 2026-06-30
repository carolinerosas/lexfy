"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Modal } from "./modal";
import { Input } from "./input";
import { Button } from "./button";
import { registrarRecebimento } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
import type { Honorario } from "@/types";

function hojeISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// Modal único de recebimento de honorário: permite editar o valor recebido,
// gera a diferença (se recebeu menos) ou abate das últimas parcelas (se recebeu mais).
export function RecebimentoModal({
  honorario,
  onClose,
  onDone,
}: {
  honorario: Honorario | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState("");
  const [vencDif, setVencDif] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (honorario) {
      setData(hojeISO());
      setValor(String(honorario.valor));
      setVencDif(honorario.data_vencimento ?? hojeISO());
    }
  }, [honorario]);

  if (!honorario) return null;

  const total = honorario.valor;
  const recNum = parseFloat(valor.replace(",", ".")) || 0;
  const diferenca = Math.round((total - recNum) * 100) / 100;
  const parcial = diferenca > 0.005;
  const excedente = Math.round((recNum - total) * 100) / 100;
  const sobra = excedente > 0.005;

  async function confirmar() {
    if (saving || !honorario) return;
    setSaving(true);
    try {
      await registrarRecebimento(honorario, { data, valorRecebido: recNum, vencimentoDiferenca: vencDif });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Registrar recebimento" size="sm">
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 px-3 py-2.5">
          <p className="text-sm font-medium text-gray-900">{honorario.descricao}</p>
          <p className="text-sm font-bold text-green-700">Parcela: {formatCurrency(total)}</p>
        </div>
        <Input label="Valor recebido *" type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Input label="Quando você recebeu? *" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        {parcial && (
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-900">
              Recebimento parcial: vou abater <strong>{formatCurrency(recNum)}</strong> e gerar uma nova cobrança de <strong>{formatCurrency(diferenca)}</strong> (a diferença).
            </p>
            <Input label="Vencimento da diferença" type="date" value={vencDif} onChange={(e) => setVencDif(e.target.value)} />
          </div>
        )}
        {sobra && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Recebeu <strong>{formatCurrency(excedente)}</strong> a mais — vou quitar esta parcela e abater o excedente das últimas parcelas em aberto (da última para cima).
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!data || recNum <= 0 || saving}>
            <CheckCircle2 className="w-4 h-4" /> {saving ? "Salvando..." : "Confirmar recebimento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
