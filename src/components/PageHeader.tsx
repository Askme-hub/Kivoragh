import { ArrowLeft } from "lucide-react";
import { useRouter } from "@tanstack/react-router";

export function PageHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div className="relative overflow-hidden border-b border-border bg-gradient-to-r from-primary-soft via-background to-background">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-flash" aria-hidden />
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          onClick={() => router.history.back()}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-primary shadow-soft ring-1 ring-border transition active:scale-95"
        >
          <ArrowLeft size={19} strokeWidth={2.5} />
        </button>
        <h1 className="text-lg font-extrabold tracking-tight text-foreground">{title}</h1>
      </div>
    </div>
  );
}
