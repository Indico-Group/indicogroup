import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { moeda, type EmpresaDoc } from "@/lib/pdf";

export type DocComercial = {
  tipo: "FATURA" | "COTAÇÃO";
  numero: string;
  data: string;
  vencimento?: string | null;
  estado: string;
  cliente_nome?: string | null;
  cliente_nuit?: string | null;
  cliente_telefone?: string | null;
  cliente_email?: string | null;
  cliente_endereco?: string | null;
  vendedor_nome?: string | null;
  observacoes?: string | null;
  condicoes?: string | null;
  subtotal: number;
  total_desconto: number;
  total_imposto: number;
  total: number;
  valor_pago?: number;
  itens: {
    descricao: string;
    quantidade: number;
    unidade?: string | null;
    preco_unitario: number;
    desconto: number;
    imposto_percent: number;
    total: number;
  }[];
};

/** Fatura / Cotação em A4 com o branding da empresa. */
export function criarDocumentoPdf(empresa: EmpresaDoc, d: DocComercial) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const cur = empresa.config?.moeda ?? "MZN";
  const W = 210;
  let y = 15;
  if (empresa.logo) {
    const h = 20;
    const w = Math.min(50, (empresa.logo.width / empresa.logo.height) * h);
    doc.addImage(empresa.logo.dataUrl, empresa.logo.format, 15, y, w, h);
  }
  const c = empresa.config;
  doc.setFontSize(11).setFont("helvetica", "bold");
  doc.text(c?.nome_empresa ?? "", W - 15, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(8);
  [c?.nif ? `NUIT: ${c.nif}` : "", c?.morada ?? "", c?.telefone ?? "", c?.email ?? ""]
    .filter(Boolean)
    .forEach((l, i) => doc.text(l, W - 15, y + 9 + i * 4, { align: "right" }));
  y = 45;
  doc.setFontSize(16).setFont("helvetica", "bold").text(`${d.tipo} ${d.numero}`, 15, y);
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text(`Data: ${d.data}`, 15, y + 6);
  if (d.vencimento) doc.text(`${d.tipo === "FATURA" ? "Vencimento" : "Validade"}: ${d.vencimento}`, 15, y + 11);
  doc.text(`Estado: ${d.estado}`, 15, y + 16);
  if (d.vendedor_nome) doc.text(`Vendedor: ${d.vendedor_nome}`, 15, y + 21);
  doc.setFont("helvetica", "bold").text("Cliente", 120, y + 6);
  doc.setFont("helvetica", "normal");
  [d.cliente_nome, d.cliente_nuit && `NUIT: ${d.cliente_nuit}`, d.cliente_telefone, d.cliente_email, d.cliente_endereco]
    .filter(Boolean)
    .forEach((l, i) => doc.text(String(l), 120, y + 11 + i * 5));

  autoTable(doc, {
    startY: y + 32,
    head: [["Descrição", "Qtd", "Un.", "Preço", "Desc.", "Imp. %", "Total"]],
    body: d.itens.map((i) => [
      i.descricao,
      String(i.quantidade),
      i.unidade ?? "",
      moeda(i.preco_unitario, cur),
      moeda(i.desconto, cur),
      String(i.imposto_percent),
      moeda(i.total, cur),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 40, 70] },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fy = (doc as any).lastAutoTable.finalY + 8;
  const linhas: [string, number][] = [
    ["Subtotal", d.subtotal],
    ["Descontos", d.total_desconto],
    ["Imposto", d.total_imposto],
    ["Total", d.total],
  ];
  if (d.valor_pago != null) linhas.push(["Pago", d.valor_pago], ["Em dívida", d.total - d.valor_pago]);
  linhas.forEach(([k, v]) => {
    doc.setFont("helvetica", k === "Total" ? "bold" : "normal");
    doc.text(k, 140, fy);
    doc.text(moeda(v, cur), W - 15, fy, { align: "right" });
    fy += 5;
  });
  fy += 5;
  doc.setFont("helvetica", "normal").setFontSize(8);
  for (const t of [d.condicoes, d.observacoes].filter(Boolean)) {
    const l = doc.splitTextToSize(String(t), W - 30);
    doc.text(l, 15, fy);
    fy += l.length * 4 + 3;
  }
  if (c?.rodape_recibo) doc.text(c.rodape_recibo, W / 2, 287, { align: "center" });
  return doc;
}
