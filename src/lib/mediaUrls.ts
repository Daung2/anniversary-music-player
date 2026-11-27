import { getCoverBlob } from './db'

const coverUrls = new Map<string, string>()

export async function getCoverUrl(trackId: string | null | undefined): Promise<string | null> {
  if (!trackId) return null
  const cached = coverUrls.get(trackId)
  if (cached) return cached

  const blob = await getCoverBlob(trackId)
  if (!blob) return null

  const url = URL.createObjectURL(blob)
  coverUrls.set(trackId, url)
  return url
}

export function releaseCoverUrl(trackId: string): void {
  const url = coverUrls.get(trackId)
  if (url) {
    URL.revokeObjectURL(url)
    coverUrls.delete(trackId)
  }
}
