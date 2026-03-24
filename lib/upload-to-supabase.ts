import { supabaseBrowser } from "./supabase-browser"

const BUCKET = "documents"

/**
 * Upload a single file directly to Supabase Storage from the browser.
 * Returns the storage path (e.g. "submissions/<uuid>/<category>/<filename>").
 */
export async function uploadFileToSupabase(
  file: File,
  category: string
): Promise<string> {
  const id = crypto.randomUUID()
  const ext = file.name.split(".").pop() || "bin"
  const path = `submissions/${id}/${category}/${Date.now()}.${ext}`

  const { error } = await supabaseBrowser.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  return path
}

/**
 * Upload multiple files to Supabase Storage.
 * Returns an array of storage paths.
 */
export async function uploadFilesToSupabase(
  files: File[],
  category: string
): Promise<string[]> {
  const results: string[] = []
  for (const file of files) {
    if (file && file.size > 0) {
      const path = await uploadFileToSupabase(file, category)
      results.push(path)
    }
  }
  return results
}
