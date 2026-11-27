import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  countAudioBlobs,
  createTrack,
  defaultSettings,
  deleteCoverBlob,
  deletePlaylistRecord,
  deleteTrackRecord,
  getDb,
  getHistory,
  getPlaylists,
  getSetting,
  getTracks,
  initializeDatabase,
  putAudioBlob,
  putCoverBlob,
  putPlaylist,
  putTrack,
  recordHistory,
  setSetting,
} from '../lib/db'
import { buildBackup, readBackup } from '../lib/backup'
import { createId } from '../lib/id'
import { guessAudioMime, isSupportedAudioFile, optimizeCover, probeAudioDuration } from '../lib/media'
import { releaseCoverUrl } from '../lib/mediaUrls'
import { stripExtension } from '../lib/format'
import type {
  AppSettings,
  BackupRestoreResult,
  HistoryEntry,
  ImportResult,
  Playlist,
  Track,
} from '../types'
import { useToast } from './ToastContext'

interface ImportOptions {
  playlistId?: string
  targetTrackId?: string
  note?: string
}

interface LibraryContextValue {
  ready: boolean
  error: string | null
  playlists: Playlist[]
  tracks: Track[]
  tracksById: Record<string, Track>
  playableTracks: Track[]
  history: HistoryEntry[]
  recentTracks: Track[]
  activePlaylistId: string | null
  settings: AppSettings
  audioCount: number
  createPlaylist: (name: string, description?: string) => Promise<Playlist>
  updatePlaylist: (id: string, patch: Partial<Pick<Playlist, 'name' | 'description'>>) => Promise<void>
  deletePlaylist: (id: string) => Promise<boolean>
  setActivePlaylist: (id: string) => Promise<void>
  addEmptyTrack: (playlistId?: string) => Promise<Track>
  updateTrack: (id: string, patch: Partial<Track>) => Promise<void>
  deleteTrack: (id: string) => Promise<void>
  reorderTracks: (playlistId: string, fromIndex: number, toIndex: number) => Promise<void>
  importFiles: (files: FileList | File[], options?: ImportOptions) => Promise<ImportResult>
  setCover: (trackId: string, file: File) => Promise<void>
  removeCover: (trackId: string) => Promise<void>
  exportBackup: () => Promise<Blob>
  restoreBackup: (file: File) => Promise<BackupRestoreResult>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  recordPlay: (trackId: string) => Promise<void>
  refresh: () => Promise<void>
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

function readableImportError(error: unknown, fileName: string): string {
  const message = error instanceof Error ? error.message : ''
  if (message === 'unsupported') return `${fileName}: this browser cannot play this file.`
  if (message === 'timeout') return `${fileName}: reading this file took too long. Please try a smaller file.`
  return `${fileName}: the file could not be imported.`
}

async function allBlobs(store: 'audio' | 'covers'): Promise<Map<string, Blob>> {
  const db = await getDb()
  const keys = await db.getAllKeys(store)
  const result = new Map<string, Blob>()
  for (const key of keys) {
    const blob = await db.get(store, key)
    if (blob) result.set(String(key), blob)
  }
  return result
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { notify } = useToast()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [audioCount, setAudioCount] = useState(0)
  const settingsRef = useRef<AppSettings>(defaultSettings)
  const settingsWriteRef = useRef<Promise<unknown>>(Promise.resolve())
  const initializedRef = useRef(false)

  const refresh = useCallback(async () => {
    const [nextPlaylists, nextTracks, nextHistory, storedSettings, nextAudioCount] = await Promise.all([
      getPlaylists(),
      getTracks(),
      getHistory(),
      getSetting<AppSettings>('app'),
      countAudioBlobs(),
    ])
    const nextSettings = { ...defaultSettings, ...(storedSettings ?? {}) }
    settingsRef.current = nextSettings
    setPlaylists(nextPlaylists)
    setTracks(nextTracks)
    setHistory(nextHistory)
    setSettings(nextSettings)
    setAudioCount(nextAudioCount)
  }, [])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    void (async () => {
      try {
        await initializeDatabase()
        await refresh()
        setReady(true)
      } catch (caught) {
        console.error(caught)
        setError('Your music library could not be opened. Please reload the page and try again.')
        setReady(true)
      }
    })()
  }, [refresh])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch }
    settingsRef.current = next
    setSettings(next)
    const write = setSetting('app', next).catch((caught) => {
      console.error(caught)
      notify('Your preferences could not be saved.', 'error')
    })
    settingsWriteRef.current = settingsWriteRef.current.then(() => write)
    await settingsWriteRef.current
  }, [notify])

  useEffect(() => {
    if (!ready || !playlists.length) return
    const active = settings.activePlaylistId
    if (!active || !playlists.some((playlist) => playlist.id === active)) {
      void updateSettings({ activePlaylistId: playlists[0].id })
    }
  }, [ready, playlists, settings.activePlaylistId, updateSettings])

  const tracksById = useMemo(() => Object.fromEntries(tracks.map((track) => [track.id, track])), [tracks])
  const playableTracks = useMemo(() => tracks.filter((track) => !track.placeholder && track.hasAudio), [tracks])
  const recentTracks = useMemo(
    () => history.map((entry) => tracksById[entry.trackId]).filter((track): track is Track => Boolean(track)).slice(0, 6),
    [history, tracksById],
  )

  const createPlaylist = useCallback(
    async (name: string, description = '') => {
      const playlist: Playlist = {
        id: createId('playlist'),
        name: name.trim() || 'New playlist',
        description: description.trim(),
        trackIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await putPlaylist(playlist)
      await updateSettings({ activePlaylistId: playlist.id })
      await refresh()
      return playlist
    },
    [refresh, updateSettings],
  )

  const updatePlaylist = useCallback(
    async (id: string, patch: Partial<Pick<Playlist, 'name' | 'description'>>) => {
      const db = await getDb()
      const playlist = await db.get('playlists', id)
      if (!playlist) return
      await putPlaylist({ ...playlist, ...patch, updatedAt: Date.now() })
      await refresh()
    },
    [refresh],
  )

  const deletePlaylist = useCallback(
    async (id: string) => {
      const allPlaylists = await getPlaylists()
      if (allPlaylists.length <= 1) {
        notify('Keep at least one playlist for your songs.', 'info')
        return false
      }
      const playlist = allPlaylists.find((item) => item.id === id)
      if (!playlist) return false

      const remaining = allPlaylists.filter((item) => item.id !== id)
      const stillUsed = new Set(remaining.flatMap((item) => item.trackIds))
      const orphans = playlist.trackIds.filter((trackId) => !stillUsed.has(trackId))

      await deletePlaylistRecord(id)
      await Promise.all(
        orphans.map(async (trackId) => {
          releaseCoverUrl(trackId)
          await deleteTrackRecord(trackId)
        }),
      )
      if (settingsRef.current.activePlaylistId === id) {
        await updateSettings({ activePlaylistId: remaining[0].id, lastTrackId: null, lastPosition: 0 })
      }
      await refresh()
      return true
    },
    [refresh, notify, updateSettings],
  )

  const setActivePlaylist = useCallback(
    async (id: string) => {
      await updateSettings({ activePlaylistId: id })
    },
    [updateSettings],
  )

  const addEmptyTrack = useCallback(
    async (playlistId?: string) => {
      const allPlaylists = await getPlaylists()
      const id = playlistId ?? settingsRef.current.activePlaylistId ?? allPlaylists[0]?.id
      const playlist = allPlaylists.find((item) => item.id === id)
      if (!playlist) throw new Error('No playlist is available.')
      const track = createTrack(playlist.trackIds.length)
      await putTrack(track)
      await putPlaylist({ ...playlist, trackIds: [...playlist.trackIds, track.id], updatedAt: Date.now() })
      await refresh()
      return track
    },
    [refresh],
  )

  const updateTrack = useCallback(
    async (id: string, patch: Partial<Track>) => {
      const db = await getDb()
      const track = await db.get('tracks', id)
      if (!track) return
      await putTrack({ ...track, ...patch, updatedAt: Date.now() })
      await refresh()
    },
    [refresh],
  )

  const deleteTrack = useCallback(
    async (id: string) => {
      const affected = (await getPlaylists()).filter((playlist) => playlist.trackIds.includes(id))
      await Promise.all(
        affected.map((playlist) =>
          putPlaylist({
            ...playlist,
            trackIds: playlist.trackIds.filter((trackId) => trackId !== id),
            updatedAt: Date.now(),
          }),
        ),
      )
      releaseCoverUrl(id)
      await deleteTrackRecord(id)
      if (settingsRef.current.lastTrackId === id) {
        await updateSettings({ lastTrackId: null, lastPosition: 0 })
      }
      await refresh()
    },
    [refresh, updateSettings],
  )

  const reorderTracks = useCallback(
    async (playlistId: string, fromIndex: number, toIndex: number) => {
      const db = await getDb()
      const playlist = await db.get('playlists', playlistId)
      if (!playlist) return
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= playlist.trackIds.length || toIndex >= playlist.trackIds.length) return
      const trackIds = [...playlist.trackIds]
      const [moved] = trackIds.splice(fromIndex, 1)
      trackIds.splice(toIndex, 0, moved)
      await putPlaylist({ ...playlist, trackIds, updatedAt: Date.now() })
      await refresh()
    },
    [refresh],
  )

  const importFiles = useCallback(
    async (files: FileList | File[], options: ImportOptions = {}): Promise<ImportResult> => {
      const fileArray = Array.from(files)
      if (!fileArray.length) return { imported: [], errors: [] }

      const [allPlaylists, allTracks] = await Promise.all([getPlaylists(), getTracks()])
      const currentTracksById = Object.fromEntries(allTracks.map((track) => [track.id, track]))
      const playlistId = options.playlistId ?? settingsRef.current.activePlaylistId ?? allPlaylists[0]?.id
      const playlist = allPlaylists.find((item) => item.id === playlistId)
      if (!playlist) return { imported: [], errors: ['Please create a playlist before importing songs.'] }

      const imported: Track[] = []
      const errors: string[] = []
      const trackIds = [...playlist.trackIds]
      const targetIndex = options.targetTrackId ? trackIds.indexOf(options.targetTrackId) : -1
      let insertAt = targetIndex >= 0 ? targetIndex : trackIds.length
      let replacedTarget = false
      const now = Date.now()

      for (const [index, file] of fileArray.entries()) {
        if (!isSupportedAudioFile(file)) {
          errors.push(`${file.name}: unsupported audio format.`)
          continue
        }

        try {
          const duration = await probeAudioDuration(file)
          const existing = options.targetTrackId ? currentTracksById[options.targetTrackId] : undefined
          const id = existing?.id ?? createId('track')
          const derivedTitle = stripExtension(file.name) || `Song ${index + 1}`
          const track: Track = {
            id,
            title: existing?.title?.trim() || derivedTitle,
            artist: existing?.artist?.trim() || 'Unknown artist',
            album: existing?.album ?? '',
            note: options.note !== undefined ? options.note : (existing?.note ?? ''),
            duration,
            fileName: file.name,
            mimeType: file.type || guessAudioMime(file.name),
            size: file.size,
            coverMimeType: existing?.coverMimeType ?? '',
            createdAt: existing?.createdAt ?? now + index,
            updatedAt: now + index,
            placeholder: false,
            hasAudio: true,
          }

          await putAudioBlob(id, file)
          await putTrack(track)

          if (targetIndex >= 0 && !replacedTarget) {
            trackIds[targetIndex] = id
            insertAt = targetIndex + 1
            replacedTarget = true
          } else {
            trackIds.splice(insertAt, 0, id)
            insertAt += 1
          }
          imported.push(track)
        } catch (caught) {
          errors.push(readableImportError(caught, file.name))
        }
      }

      if (imported.length) {
        await putPlaylist({ ...playlist, trackIds, updatedAt: Date.now() })
        if (!settingsRef.current.activePlaylistId) await updateSettings({ activePlaylistId: playlist.id })
        await refresh()
      }
      return { imported, errors }
    },
    [refresh, updateSettings],
  )

  const setCover = useCallback(
    async (trackId: string, file: File) => {
      const optimized = await optimizeCover(file)
      releaseCoverUrl(trackId)
      await putCoverBlob(trackId, optimized.blob)
      await updateTrack(trackId, { coverMimeType: optimized.mimeType })
    },
    [updateTrack],
  )

  const removeCover = useCallback(
    async (trackId: string) => {
      releaseCoverUrl(trackId)
      await deleteCoverBlob(trackId)
      await updateTrack(trackId, { coverMimeType: '' })
    },
    [updateTrack],
  )

  const exportBackup = useCallback(async () => {
    const [audio, covers] = await Promise.all([allBlobs('audio'), allBlobs('covers')])
    return buildBackup({
      playlists,
      tracks,
      settings: settingsRef.current,
      audio,
      covers,
    })
  }, [playlists, tracks])

  const restoreBackup = useCallback(
    async (file: File): Promise<BackupRestoreResult> => {
      const payload = await readBackup(file)
      const [currentTracks, currentPlaylists] = await Promise.all([getTracks(), getPlaylists()])
      const existingTrackIds = new Set(currentTracks.map((track) => track.id))
      const existingPlaylistIds = new Set(currentPlaylists.map((playlist) => playlist.id))
      const existingNames = new Set(currentPlaylists.map((playlist) => playlist.name.toLowerCase()))
      const idMap = new Map<string, string>()
      const errors: string[] = []
      const now = Date.now()

      for (const track of payload.tracks) {
        let nextId = track.id
        if (existingTrackIds.has(nextId) || idMap.has(nextId)) nextId = createId('track')
        idMap.set(track.id, nextId)
        existingTrackIds.add(nextId)

        const audioBlob = payload.audio.get(track.id)
        if (audioBlob) await putAudioBlob(nextId, audioBlob)
        const coverBlob = payload.covers.get(track.id)
        if (coverBlob) await putCoverBlob(nextId, coverBlob)

        await putTrack({
          ...track,
          id: nextId,
          hasAudio: Boolean(audioBlob),
          createdAt: now + payload.tracks.indexOf(track),
          updatedAt: now + payload.tracks.indexOf(track),
        })
        if (!track.placeholder && !audioBlob) errors.push(`${track.title || 'Untitled song'} had no audio file in the backup.`)
      }

      let restoredPlaylists = 0
      for (const playlist of payload.playlists) {
        let nextId = playlist.id
        if (existingPlaylistIds.has(nextId)) nextId = createId('playlist')
        existingPlaylistIds.add(nextId)

        let name = playlist.name
        if (existingNames.has(name.toLowerCase())) name = `${name} (restored)`
        existingNames.add(name.toLowerCase())

        await putPlaylist({
          ...playlist,
          id: nextId,
          name,
          trackIds: playlist.trackIds.map((trackId) => idMap.get(trackId)).filter((trackId): trackId is string => Boolean(trackId)),
          createdAt: now + restoredPlaylists,
          updatedAt: now + restoredPlaylists,
        })
        restoredPlaylists += 1
      }

      if (restoredPlaylists) await updateSettings({ activePlaylistId: idMap.get(payload.playlists[0].id) ?? settingsRef.current.activePlaylistId })
      await refresh()
      return { playlists: restoredPlaylists, tracks: payload.tracks.length, errors }
    },
    [refresh, updateSettings],
  )

  const recordPlay = useCallback(async (trackId: string) => {
    try {
      await recordHistory(trackId)
      setHistory(await getHistory())
    } catch (caught) {
      console.error(caught)
    }
  }, [])

  const value = useMemo<LibraryContextValue>(
    () => ({
      ready,
      error,
      playlists,
      tracks,
      tracksById,
      playableTracks,
      history,
      recentTracks,
      activePlaylistId: settings.activePlaylistId,
      settings,
      audioCount,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      setActivePlaylist,
      addEmptyTrack,
      updateTrack,
      deleteTrack,
      reorderTracks,
      importFiles,
      setCover,
      removeCover,
      exportBackup,
      restoreBackup,
      updateSettings,
      recordPlay,
      refresh,
    }),
    [
      ready,
      error,
      playlists,
      tracks,
      tracksById,
      playableTracks,
      history,
      recentTracks,
      settings,
      audioCount,
      createPlaylist,
      updatePlaylist,
      deletePlaylist,
      setActivePlaylist,
      addEmptyTrack,
      updateTrack,
      deleteTrack,
      reorderTracks,
      importFiles,
      setCover,
      removeCover,
      exportBackup,
      restoreBackup,
      updateSettings,
      recordPlay,
      refresh,
    ],
  )

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext)
  if (!context) throw new Error('useLibrary must be used inside LibraryProvider')
  return context
}
