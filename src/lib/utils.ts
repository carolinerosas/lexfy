import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function toValidDate(date: string | Date | null | undefined): Date | null {
  if (date === null || date === undefined || date === "") return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return d instanceof Date && !isNaN(d.getTime()) ? d : null;
}

export function formatDate(date: string | Date | null | undefined): string {
  const d = toValidDate(date);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

export function formatDateTime(date: string | Date | null | undefined): string {
  const d = toValidDate(date);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function daysUntil(date: string | Date | null | undefined): number {
  const d = toValidDate(date);
  if (!d) return NaN;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function prazoColor(days: number): string {
  if (days < 0) return "text-red-600 bg-red-50";
  if (days <= 3) return "text-red-600 bg-red-50";
  if (days <= 7) return "text-amber-600 bg-amber-50";
  return "text-green-700 bg-green-50";
}
