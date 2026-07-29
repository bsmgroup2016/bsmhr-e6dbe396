/**
 * Cloudflare R2 upload client.
 *
 * Files are NOT stored in Supabase. They are uploaded to a Cloudflare Worker
 * (deployed from the `worker/` folder) which writes them into an R2 bucket and
 * returns a public URL. Only that URL is saved in Supabase.
 */

const URL_KEY = "bsm.r2.workerUrl";
const TOKEN_KEY = "bsm.r2.uploadToken";

export interface R2Config {
  workerUrl: string;
  uploadToken: string;
}

export function getR2Config(): R2Config {
  if (typeof window === "undefined") return { workerUrl: "", uploadToken: "" };
  return {
    workerUrl:
      localStorage.getItem(URL_KEY) ||
      (import.meta.env.VITE_R2_WORKER_URL as string | undefined) ||
      "",
    uploadToken: localStorage.getItem(TOKEN_KEY) || "",
  };
}

export function setR2Config(config: R2Config) {
  localStorage.setItem(URL_KEY, config.workerUrl.replace(/\/+$/, ""));
  localStorage.setItem(TOKEN_KEY, config.uploadToken);
}

export function isR2Configured(): boolean {
  return Boolean(getR2Config().workerUrl);
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
export function uploadToR2(
  file: File,
  folder = "documents",
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const { workerUrl, uploadToken } = getR2Config();
  if (!workerUrl) {
    return Promise.reject(
      new Error("R2 storage is not configured. Set the Worker URL in Settings → Storage."),
    );
  }
  const invalid = validateFile(file);
  if (invalid) return Promise.reject(new Error(invalid));

  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${workerUrl}/upload`);
    if (uploadToken) xhr.setRequestHeader("x-upload-token", uploadToken);
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
        reject(new Error("Upload rejected: invalid upload token"));
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed - could not reach the storage Worker"));
    xhr.send(form);
  });
}

/** Delete a previously uploaded object by its key. */
export async function deleteFromR2(key: string): Promise<void> {
  const { workerUrl, uploadToken } = getR2Config();
  if (!workerUrl) throw new Error("R2 storage is not configured.");
  const res = await fetch(`${workerUrl}/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(uploadToken ? { "x-upload-token": uploadToken } : {}),
    },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) throw new Error(`Delete failed (${res.status})`);
}
