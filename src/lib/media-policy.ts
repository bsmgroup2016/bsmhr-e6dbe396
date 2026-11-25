import { z } from "zod";

export const mediaBucket = z.enum(["main", "scans"]);
export const mediaKey = z.string().min(1).max(1024).refine(
  (key) => !key.startsWith("/") && !key.split("/").some((part) => part === "." || part === "..") && !/[\\\u0000-\u001f?#]/.test(key),
  "Invalid file path",
);
export const mediaDelete = z.object({ bucket: mediaBucket, key: mediaKey });

export function protectedMediaKey(key: string) {
  return key.split("/")[0] === "claim-templates";
}

export function mediaUploadPrefix(bucket: "main" | "scans", prefix: string) {
  if (prefix) mediaKey.parse(prefix);
  const folder = prefix.split("/")[0];
  if (protectedMediaKey(prefix)) throw new Error("Use Blank Template to update claim templates.");
  if (bucket === "scans" && prefix && !["time-cards", "attendance"].includes(folder)) {
    throw new Error("The scans bucket is reserved for time cards and attendance selfies.");
  }
  if (bucket === "main" && ["time-cards", "attendance"].includes(folder)) {
    throw new Error("Upload time cards and attendance selfies to the scans bucket.");
  }
  return prefix ? `${prefix.replace(/\/+$/, "")}/` : bucket === "scans" ? "time-cards/" : "media/";
}

export function mediaObjectUrl(base: string, key: string) {
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}