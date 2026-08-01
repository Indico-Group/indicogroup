import { UtensilsCrossed } from "lucide-react";

import { useEmpresa } from "@/hooks/use-empresa";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  variant?: "light" | "dark";
  /** Ignora o logotipo carregado nas configurações (usado em ecrãs públicos). */
  staticOnly?: boolean;
}

/**
 * Logotipo Aldeia Mesa — usa o logotipo carregado nas Configurações quando existe,
 * caso contrário mostra o losango dourado com talheres cruzados.
 */
export function Logo({ size = "md", showText = true, variant = "light", staticOnly = false }: LogoProps) {
  const { config, logoUrl } = useEmpresa();

  const dims = {
    sm: { box: "h-8 w-8", icon: "h-4 w-4", title: "text-sm", sub: "text-[10px]" },
    md: { box: "h-10 w-10", icon: "h-5 w-5", title: "text-base", sub: "text-[11px]" },
    lg: { box: "h-14 w-14", icon: "h-7 w-7", title: "text-xl", sub: "text-xs" },
  }[size];

  const titleColor = variant === "light" ? "text-sidebar-foreground" : "text-foreground";
  const subColor = variant === "light" ? "text-sidebar-foreground/60" : "text-muted-foreground";
  const nome = (!staticOnly && config?.nome_empresa) || "Aldeia Mesa";
  const showImage = !staticOnly && !!logoUrl;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${dims.box} relative flex items-center justify-center overflow-hidden rounded-lg ${
          showImage ? "bg-background ring-1 ring-border" : "bg-gradient-gold shadow-gold ring-1 ring-gold/40"
        }`}
      >
        {showImage ? (
          <img src={logoUrl!} alt={`Logotipo ${nome}`} className="h-full w-full object-contain" />
        ) : (
          <UtensilsCrossed className={`${dims.icon} text-gold-foreground`} strokeWidth={2.5} />
        )}
      </div>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`${dims.title} font-bold tracking-tight ${titleColor}`}>{nome}</span>
          <span className={`${dims.sub} uppercase tracking-widest ${subColor}`}>Gestão Comercial</span>
        </div>
      )}
    </div>
  );
}
