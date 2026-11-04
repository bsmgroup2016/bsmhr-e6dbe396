import defaultTemplate from "@/assets/project-claim-template.xlsx.asset.json";
import { apiData } from "@/lib/api-client";
import { fetchR2Blob, uploadToR2, validateFile } from "@/lib/r2";
import { selectClaimTemplate } from "@/core/claim-template";

export interface SavedClaimTemplate { key: string; original_name: string; created_at: string }

export async function activeClaimTemplate(): Promise<SavedClaimTemplate | null> {
  return apiData<SavedClaimTemplate | null>("/claim-template");
}

export async function loadClaimTemplate() {
  const active = await activeClaimTemplate();
  if (active) return (await fetchR2Blob(active.key)).arrayBuffer();
  const response = await fetch(defaultTemplate.url);
  if (!response.ok) throw new Error("Could not load the blank claim template.");
  return response.arrayBuffer();
}

export async function saveClaimTemplate(file: File) {
  const invalid = validateFile(file);
  if (invalid) throw new Error(invalid);
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Choose an .xlsx blank template.");
  const ExcelJS = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  selectClaimTemplate(book);
  const uploaded = await uploadToR2(file, "claim-templates");
  // Read back the saved bytes; never report a local preview as a saved template.
  const saved = await fetchR2Blob(uploaded.key);
  const check = new ExcelJS.Workbook();
  await check.xlsx.load(await saved.arrayBuffer());
  selectClaimTemplate(check);
  const active = await activeClaimTemplate();
  if (active?.key !== uploaded.key) throw new Error("Template uploaded, but could not confirm it as the active template. Please reopen Blank Template.");
  return active;
}