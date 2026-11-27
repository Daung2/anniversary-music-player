export type RepeatMode = 'off' | 'all' | 'one'
export type Page = 'home' | 'playlist' | 'playlists' | 'settings'

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  note: string
  duration: number
  fileName: string
  mimeType: string
  size: number
  coverMimeType: string
  createdAt: number
  updatedAt: number
  placeholder: boolean
  hasAudio: boolean
}

export interface Playlist {
  id: string
  name: string
  description: string
  trackIds: string[]
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  welcomeMessage: string
  anniversaryMessage: string
  surpriseMessage: string
  anniversaryDate: string
  volume: number
  shuffle: boolean
  repeatMode: RepeatMode
  activePlaylistId: string | null
  lastTrackId: string | null
  lastPosition: number
  firstOpeningSeen: boolean
}

export interface HistoryEntry {
  trackId: string
  playedAt: number
  playCount: number
}

export interface ImportResult {
  imported: Track[]
  errors: string[]
}

export interface BackupRestoreResult {
  playlists: number
  tracks: number
  errors: string[]
}
