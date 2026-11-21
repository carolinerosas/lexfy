import { Shell } from "@/novo/components/shell";

// Telas do novo JUSTIO. O login é conferido no middleware; os dados vêm do mesmo banco do antigo.
export default function LayoutNovo({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
