import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

export function getUploadDir(): string {
  const dir = path.resolve(UPLOAD_DIR)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function getVehicleUploadPath(vehicleId: string, category: string): string {
  const dir = path.join(getUploadDir(), 'vehicles', vehicleId, category)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function saveFile(
  buffer: Buffer,
  vehicleId: string,
  category: string,
  originalName: string,
  mimeType: string
): { storagePath: string; fileName: string } {
  const ext = getExtension(mimeType)
  const fileName = `${uuidv4()}${ext}`
  // Ensure directory exists (side effect)
  getVehicleUploadPath(vehicleId, category)
  const storagePath = path.join('vehicles', vehicleId, category, fileName)
  const fullPath = path.join(getUploadDir(), storagePath)

  fs.writeFileSync(fullPath, buffer)

  return { storagePath, fileName }
}

export function getFilePath(storagePath: string): string {
  return path.join(getUploadDir(), storagePath)
}

export function deleteFile(storagePath: string): void {
  const fullPath = path.join(getUploadDir(), storagePath)
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath)
  }
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  }
  return map[mimeType] || '.bin'
}

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]

export const MAX_FILE_SIZE = (parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10') || 10) * 1024 * 1024
