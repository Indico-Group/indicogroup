import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  features: string[];
}

export function ModulePlaceholder({ title, description, features }: ModulePlaceholderProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-gold shadow-gold">
            <Construction className="h-8 w-8 text-gold-foreground" />
          </div>
          <div className="max-w-lg">
            <h2 className="text-xl font-semibold">Módulo em construção</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Este módulo faz parte do plano de entregas do sistema Aldeia Mesa. Será implementado na próxima fase.
            </p>
          </div>
          <div className="grid w-full max-w-2xl grid-cols-1 gap-2 text-left sm:grid-cols-2">
            {features.map((f) => (
              <div key={f} className="flex items-start gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
