/**
 * Client-side image compression using Canvas API.
 * - Resizes to max 1200px on longest side
 * - Converts to JPEG at 0.75 quality
 * - Iterates down quality if still over 800KB
 * - Skips non-image files (PDFs, etc.)
 */

const MAX_DIMENSION = 1200
const INITIAL_QUALITY = 0.75
const TARGET_SIZE = 800 * 1024 // 800KB

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/")
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Canvas toBlob failed"))
      },
      "image/jpeg",
      quality
    )
  })
}

export async function compressImage(file: File): Promise<File> {
  // Skip non-image files
  if (!isImageFile(file)) return file

  // Skip very small files (already under target)
  if (file.size <= TARGET_SIZE) return file

  const img = await loadImage(file)

  // Calculate scaled dimensions
  let { width, height } = img
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      height = Math.round(height * (MAX_DIMENSION / width))
      width = MAX_DIMENSION
    } else {
      width = Math.round(width * (MAX_DIMENSION / height))
      height = MAX_DIMENSION
    }
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, width, height)

  // Clean up object URL
  URL.revokeObjectURL(img.src)

  // Try initial quality, then step down if still too large
  let quality = INITIAL_QUALITY
  let blob = await canvasToBlob(canvas, quality)

  while (blob.size > TARGET_SIZE && quality > 0.3) {
    quality -= 0.08
    blob = await canvasToBlob(canvas, quality)
  }

  // Build filename: swap extension to .jpg
  const baseName = file.name.replace(/\.[^.]+$/, "")
  const newName = `${baseName}.jpg`

  return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() })
}

/**
 * Compress an array of files (images get compressed, others pass through).
 */
export async function compressFiles(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage))
}
