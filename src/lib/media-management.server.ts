import { r2BucketClient, registerObject, unregisterObject, uploadAllowance, uploadsToday } from "./r2.server";
import { mediaBucket, mediaDelete, mediaUploadPrefix, protectedMediaKey, mediaObjectUrl } from "./media-policy";

export async function uploadMedia(request: Request, userId: string) {
  const form = await request.formData();
  const bucket = mediaBucket.parse(form.get("bucket"));
  const prefix = mediaUploadPrefix(bucket, String(form.get("prefix") ?? ""));
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose a non-empty file" }, { status: 400 });
  const allowance = await uploadAllowance(userId);
  if (file.size > allowance.maxBytes) return Response.json({ error: `File too large (maximum ${allowance.maxBytes / 1024 / 1024} MB)` }, { status: 413 });
  if (await uploadsToday(userId) >= allowance.dailyLimit) return Response.json({ error: "Daily upload limit reached" }, { status: 429 });
  const target = r2BucketClient(bucket);
  if (!target) return Response.json({ error: "Bucket is not configured" }, { status: 503 });
  const name = file.name.replace(/[\\/\u0000-\u001f?#]/g, "_").slice(-180) || "file";
  const key = `${prefix}${crypto.randomUUID()}-${name}`;
  const objectUrl = mediaObjectUrl(target.base, key);
  const put = await target.client.fetch(objectUrl, { method: "PUT", body: await file.arrayBuffer(), headers: { "Content-Type": file.type || "application/octet-stream", "Content-Disposition": "attachment" } });
  if (!put.ok) return Response.json({ error: "File upload failed" }, { status: 502 });
  const head = await target.client.fetch(objectUrl, { method: "HEAD" });
  if (!head.ok || Number(head.headers.get("content-length")) !== file.size) return Response.json({ error: "Could not verify uploaded file" }, { status: 502 });
  await registerObject({ key, folder: prefix.split("/")[0], original_name: file.name, content_type: file.type || "application/octet-stream", size: file.size, employee_id: null, uploaded_by: userId });
  return Response.json({ key, name: file.name }, { headers: { "Cache-Control": "no-store" } });
}

export async function deleteMedia(request: Request) {
  const { bucket, key } = mediaDelete.parse(await request.json());
  if (protectedMediaKey(key)) return Response.json({ error: "Claim templates are protected. Use Blank Template to manage them." }, { status: 409 });
  const target = r2BucketClient(bucket);
  if (!target) return Response.json({ error: "Bucket is not configured" }, { status: 503 });
  const objectUrl = mediaObjectUrl(target.base, key);
  const removed = await target.client.fetch(objectUrl, { method: "DELETE" });
  if (!removed.ok) return Response.json({ error: "File could not be deleted" }, { status: 502 });
  const head = await target.client.fetch(objectUrl, { method: "HEAD" });
  if (head.status !== 404) return Response.json({ error: "Could not confirm file deletion" }, { status: 502 });
  // A legacy copy can still use this metadata; don't remove its access record.
  const other = r2BucketClient(bucket === "main" ? "scans" : "main");
  if (other) {
    const copy = await other.client.fetch(mediaObjectUrl(other.base, key), { method: "HEAD" });
    if (copy.status === 404) await unregisterObject(key);
  } else await unregisterObject(key);
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}