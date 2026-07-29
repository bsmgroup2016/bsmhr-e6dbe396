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
  const res = await fetch(R2_STATUS_URL);
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
): Promise<UploadResult> {
  const invalid = validateFile(file);
  if (invalid) throw new Error(invalid);
  const token = await accessToken();

  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

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
