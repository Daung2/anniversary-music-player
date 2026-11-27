import JSZip from 'jszip'
import type { AppSettings, Playlist, Track } from '../types'
import { guessAudioMime } from './media'

const BACKUP_VERSION = 1

export interface BackupPayload {
  version: number
  exportedAt: string
  playlists: Playlist[]
  tracks: Track[]
  settings?: Partial<AppSettings>
  audio: Map<string, Blob>
  covers: Map<string, Blob>
}

export interface BackupSource {
  playlists: Playlist[]
  tracks: Track[]
  settings: AppSettings
  audio: Map<string, Blob>
  covers: Map<string, Blob>
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeTrack(value: unknown): Track | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || !raw.id) return null
  const now = Date.now()
  const fileName = asString(raw.fileName)
  return {
    id: raw.id,
    title: asString(raw.title),
    artist: asString(raw.artist),
    album: asString(raw.album),
    note: asString(raw.note),
    duration: asNumber(raw.duration),
    fileName,
    mimeType: asString(raw.mimeType) || guessAudioMime(fileName),
    size: asNumber(raw.size),
    coverMimeType: asString(raw.coverMimeType) || 'image/jpeg',
    createdAt: asNumber(raw.createdAt, now),
    updatedAt: asNumber(raw.updatedAt, now),
    placeholder: asBoolean(raw.placeholder),
    hasAudio: asBoolean(raw.hasAudio, !asBoolean(raw.placeholder)),
  }
}

function normalizePlaylist(value: unknown): Playlist | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || !raw.id) return null
  const now = Date.now()
  return {
    id: raw.id,
    name: asString(raw.name, 'Restored playlist'),
    description: asString(raw.description),
    trackIds: Array.isArray(raw.trackIds) ? raw.trackIds.filter((id): id is string => typeof id === 'string') : [],
    createdAt: asNumber(raw.createdAt, now),
    updatedAt: asNumber(raw.updatedAt, now),
  }
}

export async function buildBackup(source: BackupSource): Promise<Blob> {
  const zip = new JSZip()
  const audioPaths: Record<string, string> = {}
  const coverPaths: Record<string, string> = {}

  for (const track of source.tracks) {
    const audioBlob = source.audio.get(track.id)
    if (audioBlob) {
      const path = `audio/${safeId(track.id)}.bin`
      zip.file(path, audioBlob)
      audioPaths[track.id] = path
    }

    const coverBlob = source.covers.get(track.id)
    if (coverBlob) {
      const extension = track.coverMimeType === 'image/png' ? 'png' : 'jpg'
      const path = `covers/${safeId(track.id)}.${extension}`
      zip.file(path, coverBlob)
      coverPaths[track.id] = path
    }
  }

  zip.file(
    'backup.json',
    JSON.stringify(
      {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        settings: source.settings,
        playlists: source.playlists,
        tracks: source.tracks,
        files: { audio: audioPaths, cover: coverPaths },
      },
      null,
      2,
    ),
  )

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } })
}

export async function readBackup(file: File): Promise<BackupPayload> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error('That file is not a valid backup. Please choose the .zip file you exported from the player.')
  }

  const jsonEntry = zip.file('backup.json')
  if (!jsonEntry) throw new Error('This backup is missing its playlist information.')

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(await jsonEntry.async('string')) as Record<string, unknown>
  } catch {
    throw new Error('The backup information could not be read.')
  }

  if (parsed.version !== BACKUP_VERSION) {
    throw new Error('This backup was made by a different version of the player.')
  }
  if (!Array.isArray(parsed.playlists) || !Array.isArray(parsed.tracks)) {
    throw new Error('This backup does not contain any playlists or songs.')
  }

  const tracks = parsed.tracks.map(normalizeTrack).filter((track): track is Track => track !== null)
  const playlists = parsed.playlists.map(normalizePlaylist).filter((playlist): playlist is Playlist => playlist !== null)
  const files = (parsed.files ?? {}) as Record<string, unknown>
  const audioPaths = (files.audio ?? {}) as Record<string, unknown>
  const coverPaths = (files.cover ?? {}) as Record<string, unknown>

  const audio = new Map<string, Blob>()
  const covers = new Map<string, Blob>()

  for (const track of tracks) {
    const audioPath = typeof audioPaths[track.id] === 'string' ? (audioPaths[track.id] as string) : ''
    if (audioPath) {
      const entry = zip.file(audioPath)
      if (entry) {
        const blob = await entry.async('blob')
        audio.set(track.id, new Blob([blob], { type: track.mimeType || guessAudioMime(track.fileName) }))
      }
    }

    const coverPath = typeof coverPaths[track.id] === 'string' ? (coverPaths[track.id] as string) : ''
    if (coverPath) {
      const entry = zip.file(coverPath)
      if (entry) {
        const blob = await entry.async('blob')
        covers.set(track.id, new Blob([blob], { type: track.coverMimeType || 'image/jpeg' }))
      }
    }
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: asString(parsed.exportedAt),
    playlists,
    tracks,
    settings: parsed.settings as Partial<AppSettings> | undefined,
    audio,
    covers,
  }
}
