import { supabase } from "./supabase";

export type VendorBucket = "vendor-logos" | "product-images" | "vendor-documents" | "invoices-receipts" | "entry-passes";

// All five buckets are private (RLS on storage.objects, see Phase 2). A vendor may only
// read/write objects under a folder named after their own auth uid; everything is fetched
// through short-lived signed URLs, never a public URL.

function extOf(filename: string): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(filename);
  return m ? m[1].toLowerCase() : "bin";
}

/** Uploads a file to `{vendorId}/{name}` in the given bucket, overwriting any existing file at that path. */
export async function uploadVendorFile(
  bucket: VendorBucket,
  vendorId: string,
  file: File,
  name: string
): Promise<{ path: string | null; error: string | null }> {
  const path = `${vendorId}/${name}.${extOf(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) return { path: null, error: error.message };
  return { path, error: null };
}

/** Lists every file a vendor has stored in a bucket (their own folder only, per RLS). */
export async function listVendorFiles(bucket: VendorBucket, vendorId: string) {
  const { data, error } = await supabase.storage.from(bucket).list(vendorId, { sortBy: { column: "created_at", order: "desc" } });
  if (error || !data) return [];
  return data.filter((f) => f.id).map((f) => ({ name: f.name, path: `${vendorId}/${f.name}`, updatedAt: f.updated_at }));
}

/** Creates a short-lived signed URL for a private-bucket object (default 5 minutes). */
export async function signedUrl(bucket: VendorBucket, path: string, expiresInSeconds = 300): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function removeVendorFile(bucket: VendorBucket, path: string): Promise<string | null> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return error?.message ?? null;
}
