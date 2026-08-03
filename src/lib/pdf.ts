import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/integrations/supabase/client";
import { resolveLogoUrl, type EmpresaConfig } from "@/hooks/use-empresa";

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

/** Recibo térmico 80 mm com logotipo e dados da empresa. */
export function criarReciboPdf(empresa: EmpresaDoc, venda: ReciboVenda, itens: ReciboItem[]) {
  const { config, logo } = empresa;
  const cur = config?.moeda ?? "MZN";
  const W = 80;
  const M = 5;

  /** Desenha o recibo e devolve a altura ocupada (mm). */
  const render = (doc: jsPDF) => {
    let y = 6;

    if (logo) {
      const maxW = 30;
      const h = Math.min(20, (logo.height / logo.width) * maxW);
      const w = (logo.width / logo.height) * h;
      doc.addImage(logo.dataUrl, logo.format, (W - w) / 2, y, w, h);
      y += h + 3;
    }

    const center = (text: string, size = 8, style: "normal" | "bold" = "normal", gap = 4) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      const lines = doc.splitTextToSize(text, W - M * 2);
      doc.text(lines, W / 2, y, { align: "center" });
      y += gap * lines.length;
    };
    const line = () => {
      doc.setDrawColor(180);
      doc.line(M, y, W - M, y);
      y += 3;
    };
    const row = (l: string, r: string, style: "normal" | "bold" = "normal", size = 8) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.text(l, M, y);
      doc.text(r, W - M, y, { align: "right" });
      y += 4;
    };

    center(config?.nome_empresa ?? "Aldeia Mesa", 11, "bold", 5);
    if (config?.nif) center(`NUIT: ${config.nif}`, 7);
    if (config?.morada) center(config.morada, 7);
    if (config?.telefone) center(config.telefone, 7);
    if (config?.email) center(config.email, 7);
    y += 1;
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
      doc.setFontSize(8);
      const nameLines = doc.splitTextToSize(it.nome, W - M * 2);
      doc.text(nameLines, M, y);
      y += 4 * nameLines.length;
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

  // 1.ª passagem: medir a altura necessária; 2.ª: desenhar na página do tamanho exacto.
  const altura = Math.max(60, render(new jsPDF({ unit: "mm", format: [W, 1000] })) + 6);
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
