import { UtensilsCrossed } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  variant?: "light" | "dark";
}

/**
 * Logotipo Aldeia Mesa — losango dourado com talheres cruzados sobre azul escuro.
 */
export function Logo({ size = "md", showText = true, variant = "light" }: LogoProps) {
  const dims = {
    sm: { box: "h-8 w-8", icon: "h-4 w-4", title: "text-sm", sub: "text-[10px]" },
    md: { box: "h-10 w-10", icon: "h-5 w-5", title: "text-base", sub: "text-[11px]" },
    lg: { box: "h-14 w-14", icon: "h-7 w-7", title: "text-xl", sub: "text-xs" },
  }[size];

  const titleColor = variant === "light" ? "text-sidebar-foreground" : "text-foreground";
  const subColor = variant === "light" ? "text-sidebar-foreground/60" : "text-muted-foreground";

  return (
    <div className="flex items-center gap-3">
      <div
        className={`${dims.box} relative flex items-center justify-center rounded-lg bg-gradient-gold shadow-gold ring-1 ring-gold/40`}
      >
        <UtensilsCrossed className={`${dims.icon} text-gold-foreground`} strokeWidth={2.5} />
      </div>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={`${dims.title} font-bold tracking-tight ${titleColor}`}>
            Aldeia Mesa
          </span>
          <span className={`${dims.sub} uppercase tracking-widest ${subColor}`}>
            Gestão Comercial
          </span>
        </div>
      )}
    </div>
  );
}
