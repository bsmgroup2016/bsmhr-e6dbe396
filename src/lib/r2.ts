/**
 * Cloudflare R2 storage client.
 *
 * Files are NOT stored in Supabase. The browser posts them to this app's own
 * backend endpoints (`/api/public/r2-*`), which sign the request with the R2
 * keys saved in project secrets and write into the R2 bucket. Only the file
 * link is saved in Supabase.
 */
import { supabase } from "@/integrations/supabase/client";

export const R2_UPLOAD_URL = "/api/public/r2-upload";
export const R2_DELETE_URL = "/api/public/r2-delete";
export const R2_STATUS_URL = "/api/public/r2-status";
export const R2_SIGNED_URL = "/api/public/r2-signed";

async function accessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

/** R2 credentials live in project secrets, so the app is always configured. */
export function isR2Configured(): boolean {
  return true;
}

export async function checkR2Status(): Promise<{
  configured: boolean;
  reachable: boolean;
  message?: string;
  status?: number;
}> {
  const token = await accessToken();
  const res = await fetch(R2_STATUS_URL, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    return { configured: true, reachable: false, message: "Admin access required" };
  }
  return res.json();
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXT = [
  "pdf", "jpg", "jpeg", "png", "webp", "heic",
  "doc", "docx", "xls", "xlsx", "csv", "txt",
];

export function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext)) return `File type .${ext} is not allowed`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is larger than ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB`;
  }
  if (file.size === 0) return "File is empty";
  return null;
}

/** Upload a file to R2 through the Worker. `folder` groups files, e.g. "documents". */
export async function uploadToR2(
  file: File,
  folder = "documents",
  onProgress?: (percent: number) => void,
  employeeId?: string,
): Promise<UploadResult> {
  const invalid = validateFile(file);
  if (invalid) throw new Error(invalid);
  const token = await accessToken();

  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  if (employeeId) form.append("employeeId", employeeId);

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", R2_UPLOAD_URL);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResult);
        } catch {
          reject(new Error("Upload succeeded but response was invalid"));
        }
      } else if (xhr.status === 401) {
        reject(new Error("Upload rejected: please sign in again"));
      } else {
        reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed - could not reach the server"));
    xhr.send(form);
  });
}

/** Delete a previously uploaded object by its key. */
export async function deleteFromR2(key: string): Promise<void> {
  const token = await accessToken();
  const res = await fetch(R2_DELETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}

/**
 * Exchange a stored file reference for a short-lived (5 min) signed download
 * URL. Requires a signed-in session — stored links are not publicly readable.
 */
export async function getSignedUrl(ref: string): Promise<string> {
  const token = await accessToken();
  const res = await fetch(`${R2_SIGNED_URL}?key=${encodeURIComponent(ref)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not open file (${res.status})`);
  const data = (await res.json()) as { url: string };
  return data.url;
}

/** Open a stored file in a new tab using a temporary signed link. */
export async function openR2File(ref: string): Promise<void> {
  const url = await getSignedUrl(ref);
  window.open(url, "_blank", "noopener");
}

/**
 * Read a stored object as a Blob through this app's own same-origin proxy.
 * Signed R2 URLs are fine for <img> tags but cross-origin `fetch` on them is
 * blocked, so anything that needs the bytes (PDF letterheads, ZIPs) must go
 * through `/api/public/r2-file`.
 */
export async function fetchR2Blob(ref: string): Promise<Blob> {
  const token = await accessToken();
  const key = ref.includes("r2-file?key=")
    ? decodeURIComponent(ref.split("key=")[1].split("&")[0])
    : ref;
  const res = await fetch(`/api/public/r2-file?key=${encodeURIComponent(key)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Could not read file (${res.status})`);
  return res.blob();
}

/** Best-effort file name from a stored reference or signed URL. */
export function r2FileName(ref: string): string {
  const raw = ref.split("?")[0].split("/").pop() ?? "download";
  try {
    return decodeURIComponent(raw) || "download";
  } catch {
    return raw || "download";
  }
}

/**
 * Download a stored file through a short-lived signed link. The blob is
 * fetched first so the browser saves it instead of navigating; if the object
 * store blocks cross-origin reads we fall back to a direct signed download.
 */
export async function downloadR2File(ref: string, fileName?: string): Promise<void> {
  const url = await getSignedUrl(ref);
  const name = fileName || r2FileName(ref);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

/**
 * Download several stored files as a single ZIP. Each file is fetched through
 * a short-lived signed link; anything that cannot be read is reported back so
 * the caller can fall back to individual downloads.
 */
export async function downloadR2FilesAsZip(
  refs: string[],
  zipName = "files.zip",
  /** Optional per-ref file names inside the ZIP. */
  names?: Record<string, string>,
): Promise<{ added: number; failed: string[] }> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const failed: string[] = [];
  const used = new Set<string>();
  let added = 0;

  for (const ref of refs) {
    try {
      const url = await getSignedUrl(ref);
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      let name = names?.[ref] ?? r2FileName(ref);
      if (used.has(name)) {
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        const ext = dot > 0 ? name.slice(dot) : "";
        let i = 2;
        while (used.has(`${base}-${i}${ext}`)) i += 1;
        name = `${base}-${i}${ext}`;
      }
      used.add(name);
      zip.file(name, blob);
      added += 1;
    } catch {
      failed.push(ref);
    }
  }

  if (added > 0) {
    const blob = await zip.generateAsync({ type: "blob" });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = zipName.endsWith(".zip") ? zipName : `${zipName}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }

  return { added, failed };
}
