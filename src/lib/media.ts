import { clamp } from './format'

const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'oga', 'aac', 'flac', 'opus', 'webm'])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'])

export function extensionOf(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

export function isSupportedAudioFile(file: File): boolean {
  const type = file.type.toLowerCase()
  const extension = extensionOf(file.name)
  if (type.startsWith('audio/') || type === 'video/mp4') return true
  return AUDIO_EXTENSIONS.has(extension)
}

export function isSupportedImageFile(file: File): boolean {
  const type = file.type.toLowerCase()
  const extension = extensionOf(file.name)
  if (type.startsWith('image/') && type !== 'image/svg+xml') return true
  return IMAGE_EXTENSIONS.has(extension)
}

export function guessAudioMime(fileName: string): string {
  const extension = extensionOf(fileName)
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    aac: 'audio/aac',
    flac: 'audio/flac',
    opus: 'audio/opus',
    webm: 'audio/webm',
  }
  return map[extension] ?? 'application/octet-stream'
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export function probeAudioDuration(file: File): Promise<number> {
  return withTimeout(
    new Promise<number>((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const audio = new Audio()
      let settled = false

      const finish = (callback: () => void) => {
        if (settled) return
        settled = true
        audio.removeAttribute('src')
        audio.load()
        URL.revokeObjectURL(url)
        callback()
      }

      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        const duration = Number.isFinite(audio.duration) ? audio.duration : 0
        finish(() => resolve(duration))
      }
      audio.onerror = () => finish(() => reject(new Error('unsupported')))
      audio.src = url
    }),
    12_000,
    'timeout',
  )
}

type LoadedImage = {
  source: CanvasImageSource
  width: number
  height: number
  dispose: () => void
}

async function loadImageSource(file: File): Promise<LoadedImage> {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() }
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const url = URL.createObjectURL(file)
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('unsupported'))
    image.src = url
  })
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(url),
  }
}

function canvasSupports(type: string): boolean {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  return canvas.toDataURL(type).startsWith(`data:${type}`)
}

export async function optimizeCover(file: File, maxSize = 900): Promise<{ blob: Blob; mimeType: string }> {
  if (!isSupportedImageFile(file)) throw new Error('unsupported')

  const loaded = await withTimeout(loadImageSource(file), 15_000, 'timeout')
  try {
    if (!loaded.width || !loaded.height) throw new Error('unsupported')

    const side = Math.min(loaded.width, loaded.height)
    const sourceX = (loaded.width - side) / 2
    const sourceY = (loaded.height - side) / 2
    const target = clamp(maxSize, 256, 1400)

    const canvas = document.createElement('canvas')
    canvas.width = target
    canvas.height = target
    const context = canvas.getContext('2d')
    if (!context) throw new Error('unsupported')

    const mimeType = canvasSupports('image/webp') ? 'image/webp' : 'image/jpeg'
    if (mimeType === 'image/jpeg') {
      context.fillStyle = '#fff8f5'
      context.fillRect(0, 0, target, target)
    }
    context.drawImage(loaded.source, sourceX, sourceY, side, side, 0, 0, target, target)

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.86))
    if (!blob) throw new Error('unsupported')
    return { blob, mimeType }
  } finally {
    loaded.dispose()
  }
}
