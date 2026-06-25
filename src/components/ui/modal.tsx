"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center p-2 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-[#171216]/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative flex min-h-0 w-full flex-col bg-white shadow-2xl rounded-2xl",
          "h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[88dvh]",
          sizes[size]
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
          <h2 className="text-base font-bold text-gray-900 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  );
}
