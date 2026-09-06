import { jsPDF } from "jspdf";
import type { ValidationBundle } from "../services/api";
import type { VariableKey } from "../types";
import { regionByKey, variableByKey } from "../data/ocean";

interface ValidationReportOptions {
  bundle: ValidationBundle;
  regionKey: string;
  variable: VariableKey;
  depth: number;
  fromDay: number;
  toDay: number;
}

const PAGE_WIDTH = 210;
const MARGIN = 18;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "selected";
}

function dateLabel(day: number): string {
  return `2026-01-${String(day).padStart(2, "0")}`;
}

function formatMetric(value: number, decimals = 2): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : "—";
}

function drawAgreementSummary(doc: jsPDF, y: number, counts: { good: number; moderate: number; high: number }, total: number): number {
  const entries = [
    { label: "Good Agreement", value: counts.good, color: [22, 163, 74] as const },
    { label: "Moderate Agreement", value: counts.moderate, color: [245, 158, 11] as const },
    { label: "High Deviation", value: counts.high, color: [220, 38, 38] as const },
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 45, 75);
  doc.text("Agreement summary", MARGIN, y);
  y += 8;
  const barX = MARGIN;
  const barWidth = CONTENT_WIDTH;
  const barHeight = 8;
  let x = barX;
  entries.forEach((entry) => {
    const width = total > 0 ? (entry.value / total) * barWidth : 0;
    if (width > 0) {
      doc.setFillColor(entry.color[0], entry.color[1], entry.color[2]);
      doc.roundedRect(x, y, width, barHeight, 1.5, 1.5, "F");
      x += width;
    }
  });
  y += 15;
  entries.forEach((entry) => {
    doc.setFillColor(entry.color[0], entry.color[1], entry.color[2]);
    doc.roundedRect(MARGIN, y - 3.5, 4, 4, 0.8, 0.8, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105);
    const percent = total > 0 ? ` (${((entry.value / total) * 100).toFixed(0)}%)` : "";
    doc.text(`${entry.label}: ${entry.value}${percent}`, MARGIN + 7, y);
    y += 6;
  });
  return y + 3;
}

export function generateValidationReport(options: ValidationReportOptions): string {
  const { bundle, regionKey, variable, depth, fromDay, toDay } = options;
  const region = regionByKey(regionKey as Parameters<typeof regionByKey>[0]);
  const definition = variableByKey(variable);
  const metrics = bundle.metrics;
  const counts = {
    good: bundle.records.filter((record) => record.status === "good").length,
    moderate: bundle.records.filter((record) => record.status === "moderate").length,
    high: bundle.records.filter((record) => record.status === "high").length,
  };
  const generatedAt = new Date();
  const generatedDate = generatedAt.toISOString().slice(0, 10);
  const generatedTime = generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const interpretation = bundle.insights.length
    ? bundle.insights.map((insight) => insight.message).join(" ")
    : "No rule-based interpretation is available for the selected filters.";

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({
    title: "OceanScope 3D — Model Validation Summary",
    subject: "Curated sample-data validation report",
    author: "OceanScope 3D",
    creator: "OceanScope 3D client-side report generator",
  });

  doc.setFillColor(12, 44, 78);
  doc.rect(0, 0, PAGE_WIDTH, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("OceanScope 3D — Model Validation Summary", MARGIN, 17);
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text("Curated sample / synthetic prototype data — not live operational data", MARGIN, 31);

  let y = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 45, 75);
  doc.text("Selected filters", MARGIN, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  const filterRows = [
    ["Project", "OceanScope 3D"],
    ["Problem Statement", "SIH26067"],
    ["Region", region.label],
    ["Variable", `${definition.label} (${definition.unit})`],
    ["Depth", depth === 0 ? "Surface (0 m)" : `${depth} m`],
    ["Date range", `${dateLabel(fromDay)} to ${dateLabel(toDay)}`],
  ];
  filterRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, MARGIN + 35, y);
    y += 5.5;
  });

  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 45, 75);
  doc.text("Validation metrics", MARGIN, y);
  y += 7;
  const metricRows = [
    ["MAE", `${formatMetric(metrics.mae)} ${metrics.unit}`],
    ["RMSE", `${formatMetric(metrics.rmse)} ${metrics.unit}`],
    ["Bias", `${metrics.bias >= 0 ? "+" : "-"}${formatMetric(Math.abs(metrics.bias))} ${metrics.unit}`],
    ["Observation Coverage", `${formatMetric(metrics.coverage, 1)}%`],
    ["Total records analysed", `${metrics.n} matched records`],
  ];
  doc.setFontSize(10);
  metricRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, MARGIN + 42, y);
    y += 5.5;
  });

  y += 4;
  y = drawAgreementSummary(doc, y, counts, metrics.n);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 45, 75);
  doc.text("Rule-based interpretation", MARGIN, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  const interpretationLines = doc.splitTextToSize(interpretation, CONTENT_WIDTH) as string[];
  doc.text(interpretationLines, MARGIN, y, { lineHeightFactor: 1.35 });
  y += interpretationLines.length * 4.5 + 7;

  doc.setFillColor(241, 245, 249);
  const disclaimer = "Disclaimer: This OceanScope 3D prototype uses curated sample and synthetic demonstration data. It is not intended for navigation, marine safety, fisheries operations, emergency response, or any safety-critical decision. It does not represent live, official agency integration or operational forecasting.";
  const disclaimerLines = doc.splitTextToSize(disclaimer, CONTENT_WIDTH - 10) as string[];
  const disclaimerHeight = disclaimerLines.length * 4.2 + 10;
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, disclaimerHeight, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text("Data status and limitations", MARGIN + 5, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(disclaimerLines, MARGIN + 5, y + 12, { lineHeightFactor: 1.25 });

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${generatedDate} ${generatedTime}`, MARGIN, 286);
  doc.text("OceanScope 3D · Curated sample validation report", PAGE_WIDTH - MARGIN, 286, { align: "right" });

  const filename = `oceanscope3d_validation_${slug(region.label)}_${slug(variable)}_${generatedDate}.pdf`;
  doc.save(filename);
  return filename;
}
