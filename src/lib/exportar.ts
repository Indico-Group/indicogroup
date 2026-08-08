import * as XLSX from "xlsx";
import type { RelatorioOpts } from "@/lib/pdf";

function nomeBase(titulo: string) {
  return `${titulo.replace(/[^\w-]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}`;
}

function descarregar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Matriz do relatório: cabeçalho, linhas e bloco de resumo. */
function matriz(opts: RelatorioOpts): (string | number)[][] {
  const rows: (string | number)[][] = [];
  rows.push([opts.titulo]);
  if (opts.subtitulo) rows.push([opts.subtitulo]);
  rows.push([]);
  rows.push(opts.colunas);
  for (const l of opts.linhas) rows.push(l);
  if (opts.resumo?.length) {
    rows.push([]);
    rows.push(["Resumo"]);
    for (const r of opts.resumo) rows.push([r.label, r.valor]);
  }
  return rows;
}

/** CSV com separador ";" e BOM, para abrir correctamente no Excel em português. */
export function exportarCsv(opts: RelatorioOpts) {
  const escapar = (v: string | number) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = matriz(opts).map((r) => r.map(escapar).join(";")).join("\r\n");
  descarregar(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `${nomeBase(opts.titulo)}.csv`);
}

/** Ficheiro XLSX com larguras de coluna automáticas. */
export function exportarXlsx(opts: RelatorioOpts) {
  const dados = matriz(opts);
  const ws = XLSX.utils.aoa_to_sheet(dados);
  const nCols = Math.max(opts.colunas.length, ...dados.map((r) => r.length));
  ws["!cols"] = Array.from({ length: nCols }, (_, i) => ({
    wch: Math.min(40, Math.max(10, ...dados.map((r) => String(r[i] ?? "").length + 2))),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Relatório");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  descarregar(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${nomeBase(opts.titulo)}.xlsx`,
  );
}
