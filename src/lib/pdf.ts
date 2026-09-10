import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/integrations/supabase/client";
import { resolveLogoUrl, type EmpresaConfig, type ReciboModelo, type ReciboDensidade } from "@/hooks/use-empresa";

export type EmpresaDoc = {
  config: EmpresaConfig | null;
  logo: { dataUrl: string; format: string; width: number; height: number } | null;
};

async function toDataUrl(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao carregar o logotipo");
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Erro a ler o logotipo"));
    fr.readAsDataURL(blob);
  });
  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
  const format = blob.type.includes("png") ? "PNG" : blob.type.includes("webp") ? "WEBP" : "JPEG";
  return { dataUrl, format, ...dims };
}

/** Dados da empresa (aba Empresa das Configurações) + logotipo em base64 para PDFs. */
export async function getEmpresaDoc(): Promise<EmpresaDoc> {
  const { data } = await supabase.from("configuracoes").select("*").eq("id", 1).maybeSingle();
  const config = (data as EmpresaConfig | null) ?? null;
  let logo: EmpresaDoc["logo"] = null;
  try {
    const url = await resolveLogoUrl(config?.logo_url);
    // SVG não é suportado pelo jsPDF — ignorado silenciosamente.
    if (url && !/\.svg($|\?)/i.test(config?.logo_url ?? "")) logo = await toDataUrl(url);
  } catch {
    logo = null;
  }
  return { config, logo };
}

export function moeda(v: number, cur = "MZN") {
  return `${cur} ${Number(v || 0).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dataHora(d: Date = new Date()) {
  return d.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

/** Abre a caixa de diálogo de impressão do navegador com o PDF gerado. */
export function imprimirPdf(doc: jsPDF) {
  doc.autoPrint();
  const url = doc.output("bloburl");
  const w = window.open(url as unknown as string, "_blank");
  if (!w) {
    // Bloqueado por pop-ups: descarrega em alternativa.
    doc.save("documento.pdf");
  }
}

/* ============================ RECIBO ============================ */

export type ReciboVenda = {
  numero: number | string;
  created_at: string;
  tipo: string;
  mesa?: string | null;
  status?: string;
  metodo_pagamento?: string | null;
  subtotal: number;
  desconto: number;
  acrescimo: number;
  total: number;
  observacoes?: string | null;
  cliente_nome?: string | null;
};

export type ReciboItem = {
  nome: string;
  quantidade: number;
  preco: number;
  subtotal: number;
};

export type ReciboOpcoes = {
  /** Formato do papel: talão térmico de 80 mm ou folha A4. */
  modelo?: ReciboModelo;
  /** Densidade de impressão; "auto" adapta-se ao número de linhas. */
  densidade?: ReciboDensidade;
  /** Margem em mm; vazio = calculada automaticamente a partir do modelo/densidade. */
  margem?: number | null;
};

type Metrica = { escala: number; margem: number };

/** Resolve densidade e margens (automáticas quando não definidas). */
function metricas(
  modelo: ReciboModelo,
  densidade: ReciboDensidade,
  margem: number | null | undefined,
  nLinhas: number,
): Metrica {
  const dens: Exclude<ReciboDensidade, "auto"> =
    densidade !== "auto" ? densidade : nLinhas > 18 ? "compacta" : nLinhas > 8 ? "normal" : "ampla";
  const escala = dens === "compacta" ? 0.82 : dens === "ampla" ? 1.18 : 1;
  const base = modelo === "a4" ? 18 : 5;
  const auto = Math.round(base * (dens === "compacta" ? 0.7 : dens === "ampla" ? 1.25 : 1) * 10) / 10;
  const m = margem == null || Number.isNaN(margem) ? auto : margem;
  const max = modelo === "a4" ? 40 : 15;
  return { escala, margem: Math.min(Math.max(m, 2), max) };
}

/** Recibo em PDF (térmico 80 mm ou A4) com logotipo e dados da empresa. */
export function criarReciboPdf(
  empresa: EmpresaDoc,
  venda: ReciboVenda,
  itens: ReciboItem[],
  opcoes: ReciboOpcoes = {},
) {
  const { config, logo } = empresa;
  const cur = config?.moeda ?? "MZN";
  const modelo: ReciboModelo = opcoes.modelo ?? config?.recibo_modelo ?? "termico";
  const densidade: ReciboDensidade = opcoes.densidade ?? config?.recibo_densidade ?? "auto";
  const margemCfg = opcoes.margem !== undefined ? opcoes.margem : config?.recibo_margem_mm ?? null;
  const { escala, margem: M } = metricas(modelo, densidade, margemCfg, itens.length * 2 + 12);

  const W = modelo === "a4" ? 210 : 80;
  const f = (n: number) => n * (modelo === "a4" ? 1.25 : 1) * escala; // tamanho de letra
  const g = (n: number) => n * escala; // espaçamento vertical

  /** Desenha o recibo e devolve a altura ocupada (mm). */
  const render = (doc: jsPDF) => {
    let y = M + g(2);

    if (logo) {
      const maxW = modelo === "a4" ? 45 : 30;
      const h = Math.min(modelo === "a4" ? 28 : 20, (logo.height / logo.width) * maxW);
      const w = (logo.width / logo.height) * h;
      doc.addImage(logo.dataUrl, logo.format, (W - w) / 2, y, w, h);
      y += h + g(3);
    }

    const center = (text: string, size = 8, style: "normal" | "bold" = "normal", gap = 4) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(f(size));
      const lines = doc.splitTextToSize(text, W - M * 2);
      doc.text(lines, W / 2, y, { align: "center" });
      y += g(gap) * lines.length;
    };
    const line = () => {
      doc.setDrawColor(180);
      doc.line(M, y, W - M, y);
      y += g(3);
    };
    const row = (l: string, r: string, style: "normal" | "bold" = "normal", size = 8) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(f(size));
      doc.text(l, M, y);
      doc.text(r, W - M, y, { align: "right" });
      y += g(size >= 10 ? 5 : 4);
    };

    center(config?.nome_empresa ?? "Aldeia Mesa", 11, "bold", 5);
    if (config?.nif) center(`NUIT: ${config.nif}`, 7);
    if (config?.morada) center(config.morada, 7);
    if (config?.telefone) center(config.telefone, 7);
    if (config?.email) center(config.email, 7);
    y += g(1);
    line();
    center("COMPROVANTE DE VENDA", 9, "bold", 5);
    if (config?.mensagem_recibo) center(config.mensagem_recibo, 7);
    line();

    row("Nº", `${config?.prefixo_recibo ?? "AM"}-${venda.numero}`, "bold");
    row("Data", dataHora(new Date(venda.created_at)));
    row("Tipo", venda.tipo);
    if (venda.mesa) row("Mesa", venda.mesa);
    row("Cliente", venda.cliente_nome?.trim() || "Consumidor final");
    line();

    for (const it of itens) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(f(8));
      const nameLines = doc.splitTextToSize(it.nome, W - M * 2);
      doc.text(nameLines, M, y);
      y += g(4) * nameLines.length;
      row(`${it.quantidade} x ${moeda(it.preco, cur)}`, moeda(it.subtotal, cur));
    }
    line();
    row("Subtotal", moeda(venda.subtotal, cur));
    if (venda.desconto) row("Desconto", `-${moeda(venda.desconto, cur)}`);
    if (venda.acrescimo) row("Acréscimo", `+${moeda(venda.acrescimo, cur)}`);
    row("TOTAL", moeda(venda.total, cur), "bold", 10);
    if (venda.metodo_pagamento) row("Pagamento", venda.metodo_pagamento);
    if (venda.status) row("Estado", venda.status);
    line();
    if (venda.observacoes) center(`Obs.: ${venda.observacoes}`, 7);
    center(config?.rodape_recibo || "Obrigado pela preferência!", 8, "bold", 5);
    center(`Emitido em ${dataHora()}`, 6);

    return y;
  };

  if (modelo === "a4") {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    render(doc);
    return doc;
  }

  // Térmico — 1.ª passagem: medir a altura; 2.ª: desenhar na página do tamanho exacto.
  const altura = Math.max(60, render(new jsPDF({ unit: "mm", format: [W, 1000] })) + M);
  const doc = new jsPDF({ unit: "mm", format: [W, altura] });
  render(doc);
  return doc;
}


/* =========================== RELATÓRIO =========================== */

export type RelatorioOpts = {
  titulo: string;
  subtitulo?: string;
  colunas: string[];
  linhas: (string | number)[][];
  resumo?: { label: string; valor: string }[];
  orientacao?: "portrait" | "landscape";
};

/** Relatório A4 com cabeçalho da empresa, tabela e rodapé paginado. */
export function criarRelatorioPdf(empresa: EmpresaDoc, opts: RelatorioOpts) {
  const { config, logo } = empresa;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: opts.orientacao ?? "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 14;
  let y = 14;

  if (logo) {
    const h = 16;
    const w = Math.min(40, (logo.width / logo.height) * h);
    doc.addImage(logo.dataUrl, logo.format, M, y - 4, w, h);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(config?.nome_empresa ?? "Aldeia Mesa", pageW - M, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  y += 5;
  for (const l of [config?.nif ? `NUIT: ${config.nif}` : null, config?.morada, config?.telefone, config?.email].filter(Boolean) as string[]) {
    doc.text(l, pageW - M, y, { align: "right" });
    y += 4;
  }
  y += 4;
  doc.setDrawColor(200);
  doc.line(M, y, pageW - M, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(opts.titulo, M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(opts.subtitulo ? `${opts.subtitulo} · Emitido em ${dataHora()}` : `Emitido em ${dataHora()}`, M, y);
  doc.setTextColor(0);
  y += 6;

  autoTable(doc, {
    startY: y,
    head: [opts.colunas],
    body: opts.linhas.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 42, 74], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: M, right: M, bottom: 18 },
  });

  // @ts-expect-error — propriedade adicionada pelo autoTable
  let afterY = (doc.lastAutoTable?.finalY ?? y) + 8;
  if (opts.resumo?.length) {
    doc.setFontSize(10);
    for (const r of opts.resumo) {
      doc.setFont("helvetica", "normal");
      doc.text(r.label, M, afterY);
      doc.setFont("helvetica", "bold");
      doc.text(r.valor, pageW - M, afterY, { align: "right" });
      afterY += 5;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(130);
    doc.text(
      config?.rodape_recibo || config?.nome_empresa || "Aldeia Mesa",
      M,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(`Página ${i}/${pages}`, pageW - M, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }
  doc.setTextColor(0);
  return doc;
}

export function nomeFicheiro(base: string) {
  return `${base.replace(/[^\w-]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

/* ======================= RECIBO SALARIAL ======================= */

export type ReciboSalarial = {
  mes: string;
  nome: string;
  codigo?: string | null;
  cargo?: string | null;
  departamento?: string | null;
  estabelecimento?: string | null;
  salario_base: number;
  valor_dia: number;
  dias_presentes: number;
  atrasos: number;
  faltas_justificadas: number;
  faltas_injustificadas: number;
  horas_extra: number;
  valor_horas_extra: number;
  subsidios: number;
  bonus: number;
  desconto_faltas: number;
  adiantamentos: number;
  outros_descontos: number;
  liquido: number;
  status_pagamento: string;
  pago_em?: string | null;
  metodo_pagamento?: string | null;
  referencia_pagamento?: string | null;
};

/** Recibo de vencimento A5 com cabeçalho da empresa, vencimentos e descontos. */
export function criarReciboSalarialPdf(empresa: EmpresaDoc, r: ReciboSalarial) {
  const { config, logo } = empresa;
  const cur = config?.moeda ?? "MZN";
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 12;
  let y = 14;

  if (logo) {
    const h = 14;
    const w = Math.min(36, (logo.width / logo.height) * h);
    doc.addImage(logo.dataUrl, logo.format, M, y - 4, w, h);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(config?.nome_empresa ?? "Empresa", pageW - M, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  y += 4.5;
  for (const l of [config?.nif ? `NUIT: ${config.nif}` : null, config?.morada, config?.telefone].filter(Boolean) as string[]) {
    doc.text(l, pageW - M, y, { align: "right" });
    y += 3.5;
  }
  y += 4;
  doc.setDrawColor(200);
  doc.line(M, y, pageW - M, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Recibo de Vencimento", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Mês: ${r.mes.split("-").reverse().join("/")}`, pageW - M, y, { align: "right" });
  y += 7;

  doc.setFontSize(8.5);
  const info: [string, string][] = [
    ["Funcionário", r.nome + (r.codigo ? ` (#${r.codigo})` : "")],
    ["Cargo", r.cargo ?? "—"],
    ["Departamento", [r.departamento, r.estabelecimento].filter(Boolean).join(" · ") || "—"],
    ["Assiduidade", `${r.dias_presentes} dias presentes · ${r.atrasos} atrasos · ${r.faltas_justificadas} F.J. · ${r.faltas_injustificadas} F.I.`],
  ];
  for (const [k, v] of info) {
    doc.setTextColor(110);
    doc.text(k, M, y);
    doc.setTextColor(0);
    doc.text(v, M + 28, y);
    y += 4.5;
  }
  y += 2;

  const vencimentos: [string, number][] = [
    ["Salário base (30 dias)", r.salario_base],
    [`Horas extra (${Number(r.horas_extra).toFixed(1)} h)`, r.valor_horas_extra],
    ["Subsídios", r.subsidios],
    ["Bónus", r.bonus],
  ].filter(([, v]) => Number(v) !== 0 || true) as [string, number][];
  const descontos: [string, number][] = [
    [`Faltas injustificadas (${r.faltas_injustificadas} × ${moeda(r.valor_dia, cur)})`, r.desconto_faltas],
    ["Adiantamentos", r.adiantamentos],
    ["Outros descontos", r.outros_descontos],
  ];
  const totalV = vencimentos.reduce((s, [, v]) => s + Number(v), 0);
  const totalD = descontos.reduce((s, [, v]) => s + Number(v), 0);

  autoTable(doc, {
    startY: y,
    head: [["Vencimentos", "Valor"]],
    body: [...vencimentos.map(([k, v]) => [k, moeda(v, cur)]), [{ content: "Total de vencimentos", styles: { fontStyle: "bold" } }, { content: moeda(totalV, cur), styles: { fontStyle: "bold" } }]],
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [15, 42, 74], textColor: 255 },
    columnStyles: { 1: { halign: "right", cellWidth: 36 } },
    margin: { left: M, right: M },
  });
  // @ts-expect-error — propriedade adicionada pelo autoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 4;
  autoTable(doc, {
    startY: y,
    head: [["Descontos", "Valor"]],
    body: [...descontos.map(([k, v]) => [k, moeda(v, cur)]), [{ content: "Total de descontos", styles: { fontStyle: "bold" } }, { content: moeda(totalD, cur), styles: { fontStyle: "bold" } }]],
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [160, 40, 40], textColor: 255 },
    columnStyles: { 1: { halign: "right", cellWidth: 36 } },
    margin: { left: M, right: M },
  });
  // @ts-expect-error — propriedade adicionada pelo autoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  doc.setFillColor(240, 244, 248);
  doc.roundedRect(M, y - 5, pageW - 2 * M, 11, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Líquido a receber", M + 3, y + 2);
  doc.text(moeda(r.liquido, cur), pageW - M - 3, y + 2, { align: "right" });
  y += 14;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90);
  const estado =
    r.status_pagamento === "pago"
      ? `PAGO em ${r.pago_em ? dataHora(new Date(r.pago_em)) : "—"}${r.metodo_pagamento ? ` · ${r.metodo_pagamento}` : ""}${r.referencia_pagamento ? ` · Ref. ${r.referencia_pagamento}` : ""}`
      : "Pagamento pendente";
  doc.text(estado, M, y);
  y += 16;
  doc.setDrawColor(150);
  doc.line(M, y, M + 50, y);
  doc.line(pageW - M - 50, y, pageW - M, y);
  doc.setFontSize(7);
  doc.text("A entidade empregadora", M, y + 4);
  doc.text("O funcionário", pageW - M - 50, y + 4);
  doc.text(`Emitido em ${dataHora()}`, M, doc.internal.pageSize.getHeight() - 8);
  doc.setTextColor(0);
  return doc;
}
