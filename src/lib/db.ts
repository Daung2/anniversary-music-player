import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { AppSettings, HistoryEntry, Playlist, Track } from '../types'
import { createId } from './id'

interface SettingRecord<T = unknown> {
  key: string
  value: T
}

interface AppDB extends DBSchema {
  playlists: { key: string; value: Playlist }
  tracks: { key: string; value: Track }
  audio: { key: string; value: Blob }
  covers: { key: string; value: Blob }
  settings: { key: string; value: SettingRecord }
  history: { key: string; value: HistoryEntry }
}

const DB_NAME = 'our-little-playlist'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null

export function getDb(): Promise<IDBPDatabase<AppDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' })
        if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio')
        if (!db.objectStoreNames.contains('covers')) db.createObjectStore('covers')
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
        if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'trackId' })
      },
      blocked() {
        console.warn('Database upgrade is blocked by another tab. Please close other tabs and reload.')
      },
    })
  }
  return dbPromise
}

export function oneYearAgo(): string {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 1)
  return date.toISOString().slice(0, 10)
}

export const defaultSettings: AppSettings = {
  welcomeMessage: 'A little music, just for you',
  anniversaryMessage: 'One year of us, and I would choose you again in every lifetime. Happy first anniversary, my love.',
  surpriseMessage: 'If this song could speak, it would say what I still find hard to put into words: you are my favourite place to be. Thank you for a year of laughter, quiet evenings, and every little ordinary moment you made extraordinary. I love you.',
  anniversaryDate: oneYearAgo(),
  volume: 0.8,
  shuffle: false,
  repeatMode: 'off',
  activePlaylistId: null,
  lastTrackId: null,
  lastPosition: 0,
  firstOpeningSeen: false,
}

export function createTrack(index: number): Track {
  const now = Date.now()
  return {
    id: createId('track'),
    title: '',
    artist: '',
    album: '',
    note: '',
    duration: 0,
    fileName: '',
    mimeType: '',
    size: 0,
    coverMimeType: '',
    createdAt: now + index,
    updatedAt: now + index,
    placeholder: true,
    hasAudio: false,
  }
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDb()
  const playlistCount = await db.count('playlists')

  if (playlistCount === 0) {
    const tracks = Array.from({ length: 10 }, (_, index) => createTrack(index))
    const playlist: Playlist = {
      id: createId('playlist'),
      name: 'Our 10 Songs',
      description: 'Ten little pieces of my heart, chosen for you.',
      trackIds: tracks.map((track) => track.id),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    const tx = db.transaction(['playlists', 'tracks', 'settings'], 'readwrite')
    await Promise.all([
      ...tracks.map((track) => tx.objectStore('tracks').put(track)),
      tx.objectStore('playlists').put(playlist),
    ])
    await tx.done
  }

  const storedSettings = await getSetting<AppSettings>('app')
  if (!storedSettings) {
    await setSetting('app', defaultSettings)
  } else {
    await setSetting('app', { ...defaultSettings, ...storedSettings })
  }
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDb()
  const record = await db.get('settings', key)
  return record?.value as T | undefined
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDb()
  await db.put('settings', { key, value: value as unknown })
}

export async function getPlaylists(): Promise<Playlist[]> {
  const db = await getDb()
  const playlists = await db.getAll('playlists')
  return playlists.sort((a, b) => a.createdAt - b.createdAt)
}

export async function getTracks(): Promise<Track[]> {
  const db = await getDb()
  return db.getAll('tracks')
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const db = await getDb()
  const history = await db.getAll('history')
  return history.sort((a, b) => b.playedAt - a.playedAt)
}

export async function putPlaylist(playlist: Playlist): Promise<void> {
  const db = await getDb()
  await db.put('playlists', playlist)
}

export async function deletePlaylistRecord(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('playlists', id)
}

export async function putTrack(track: Track): Promise<void> {
  const db = await getDb()
  await db.put('tracks', track)
}

export async function deleteTrackRecord(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['tracks', 'audio', 'covers', 'history'], 'readwrite')
  await Promise.all([
    tx.objectStore('tracks').delete(id),
    tx.objectStore('audio').delete(id),
    tx.objectStore('covers').delete(id),
    tx.objectStore('history').delete(id),
  ])
  await tx.done
}

export async function getAudioBlob(id: string): Promise<Blob | undefined> {
  const db = await getDb()
  return db.get('audio', id)
}

export async function putAudioBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDb()
  await db.put('audio', blob, id)
}

export async function getCoverBlob(id: string): Promise<Blob | undefined> {
  const db = await getDb()
  return db.get('covers', id)
}

export async function putCoverBlob(id: string, blob: Blob): Promise<void> {
  const db = await getDb()
  await db.put('covers', blob, id)
}

export async function deleteCoverBlob(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('covers', id)
}

export async function recordHistory(trackId: string): Promise<void> {
  const db = await getDb()
  const entry = await db.get('history', trackId)
  await db.put('history', {
    trackId,
    playedAt: Date.now(),
    playCount: (entry?.playCount ?? 0) + 1,
  })
}

export async function countAudioBlobs(): Promise<number> {
  const db = await getDb()
  return db.count('audio')
}
