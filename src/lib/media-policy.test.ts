import { expect, test } from "bun:test";
import { mediaDelete, mediaUploadPrefix, protectedMediaKey, mediaObjectUrl } from "./media-policy";

test("claim templates remain protected from media removal", () => {
  expect(protectedMediaKey("claim-templates/current.xlsx")).toBe(true);
  expect(protectedMediaKey("documents/file.xlsx")).toBe(false);
  expect(() => mediaUploadPrefix("main", "claim-templates/")).toThrow();
});
test("scans bucket accepts only time cards and attendance selfies", () => {
  expect(mediaUploadPrefix("scans", "")).toBe("time-cards/");
  expect(mediaUploadPrefix("scans", "attendance/")).toBe("attendance/");
  expect(() => mediaUploadPrefix("scans", "documents/")).toThrow();
  expect(() => mediaUploadPrefix("main", "time-cards/")).toThrow();
  expect(mediaUploadPrefix("main", "documents/")).toBe("documents/");
});
test("deletion requires a specific valid bucket and exact safe key", () => {
  expect(mediaDelete.safeParse({ bucket: "main", key: "docs/test.pdf" }).success).toBe(true);
  for (const key of ["", "../test.pdf", "docs/../test.pdf", "docs/test.pdf?other=1"]) {
    expect(mediaDelete.safeParse({ bucket: "main", key }).success).toBe(false);
  }
  expect(mediaDelete.safeParse({ bucket: "all", key: "test.pdf" }).success).toBe(false);
});
test("object URLs preserve literal spaces, hashes and Unicode", () => {
  expect(mediaObjectUrl("https://bucket", "docs/A #1.pdf")).toBe("https://bucket/docs/A%20%231.pdf");
});