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
import { getAudioBlob } from '../lib/db'
import { clamp } from '../lib/format'
import { getCoverUrl } from '../lib/mediaUrls'
import type { RepeatMode, Track } from '../types'
import { useLibrary } from './LibraryContext'
import { useToast } from './ToastContext'

interface PlayOptions {
  playlistId?: string
  startAt?: number
  autoplay?: boolean
}

interface PlayerContextValue {
  currentTrack: Track | null
  currentTrackId: string | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  shuffle: boolean
  repeatMode: RepeatMode
  queue: Track[]
  queueIndex: number
  playableTracks: Track[]
  playbackError: string | null
  playTrack: (trackId: string, options?: PlayOptions) => Promise<void>
  togglePlay: () => Promise<void>
  pause: () => void
  next: () => Promise<void>
  previous: () => Promise<void>
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  toggleShuffle: () => Promise<void>
  cycleRepeat: () => Promise<void>
  playFromQueue: (index: number) => Promise<void>
  clearError: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const {
    ready,
    playlists,
    tracksById,
    playableTracks,
    settings,
    updateSettings,
    recordPlay,
  } = useLibrary()
  const { notify } = useToast()

  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffleOrder, setShuffleOrder] = useState<string[]>([])
  const [playbackError, setPlaybackError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const autoPlayRef = useRef(false)
  const restoredRef = useRef(false)
  const restoredPositionRef = useRef(0)
  const currentTrackIdRef = useRef<string | null>(null)
  const tracksRef = useRef(tracksById)
  const playlistsRef = useRef(playlists)
  const playableRef = useRef(playableTracks)
  const activePlaylistRef = useRef(settings.activePlaylistId)
  const repeatRef = useRef(settings.repeatMode)
  const queueRef = useRef<string[]>([])
  const lastSavedTimeRef = useRef(0)
  const volumeTimerRef = useRef<number | null>(null)
  const handleEndedRef = useRef<() => void>(() => {})

  currentTrackIdRef.current = currentTrackId
  tracksRef.current = tracksById
  playlistsRef.current = playlists
  playableRef.current = playableTracks
  activePlaylistRef.current = settings.activePlaylistId
  repeatRef.current = settings.repeatMode
  queueRef.current = []

  const volume = settings.volume
  const shuffle = settings.shuffle
  const repeatMode = settings.repeatMode

  const currentTrack = currentTrackId ? (tracksById[currentTrackId] ?? null) : null

  const baseQueueIds = useMemo(() => {
    const playlist = playlists.find((item) => item.id === settings.activePlaylistId)
    const ids = playlist
      ? playlist.trackIds.filter((id) => {
          const track = tracksById[id]
          return track && !track.placeholder && track.hasAudio
        })
      : []
    if (currentTrackId && !ids.includes(currentTrackId) && tracksById[currentTrackId]?.hasAudio) {
      return [currentTrackId, ...ids]
    }
    return ids
  }, [playlists, settings.activePlaylistId, tracksById, currentTrackId])

  const queueKey = baseQueueIds.join('|')

  useEffect(() => {
    if (shuffle) setShuffleOrder(shuffled(baseQueueIds))
    // queueKey is intentional: it avoids regenerating on unrelated metadata edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffle, queueKey])

  const effectiveQueueIds = useMemo(() => {
    if (!shuffle) return baseQueueIds
    const known = new Set(baseQueueIds)
    const remaining = shuffleOrder.filter((id) => known.has(id))
    const missing = baseQueueIds.filter((id) => !remaining.includes(id))
    return [...remaining, ...missing]
  }, [shuffle, shuffleOrder, baseQueueIds])

  queueRef.current = effectiveQueueIds

  const queue = useMemo(
    () => effectiveQueueIds.map((id) => tracksById[id]).filter((track): track is Track => Boolean(track)),
    [effectiveQueueIds, tracksById],
  )
  const queueIndex = currentTrackId ? effectiveQueueIds.indexOf(currentTrackId) : -1

  const persistPosition = useCallback(
    async (seconds: number) => {
      if (!currentTrackIdRef.current) return
      lastSavedTimeRef.current = seconds
      await updateSettings({ lastPosition: Math.max(0, Math.floor(seconds)) })
    },
    [updateSettings],
  )

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.volume = clamp(settings.volume, 0, 1)
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
      audioRef.current = null
    }
    // The audio element should only be created once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ready || restoredRef.current) return
    restoredRef.current = true
    const storedId = settings.lastTrackId
    const storedTrack = storedId ? tracksById[storedId] : null
    const fallback = playableTracks[0]
    const selected = storedTrack && !storedTrack.placeholder && storedTrack.hasAudio ? storedTrack : fallback
    if (!selected) return
    autoPlayRef.current = false
    restoredPositionRef.current = settings.lastPosition || 0
    currentTrackIdRef.current = selected.id
    setCurrentTrackId(selected.id)
    setCurrentTime(settings.lastPosition || 0)
    setDuration(storedTrack ? storedTrack.duration : selected.duration)
  }, [ready, settings.lastTrackId, settings.lastPosition, tracksById, playableTracks])

  useEffect(() => {
    if (!ready || !currentTrackId) return
    const track = tracksById[currentTrackId]
    if (!track) return
    let cancelled = false

    const load = async () => {
      if (track.placeholder || !track.hasAudio) {
        setIsPlaying(false)
        setPlaybackError('This song does not have an audio file yet. Choose a file for this slot to play it.')
        return
      }

      let blob: Blob | undefined
      try {
        blob = await getAudioBlob(currentTrackId)
      } catch {
        blob = undefined
      }
      if (cancelled) return

      const audio = audioRef.current
      if (!audio) return
      if (!blob) {
        setIsPlaying(false)
        setPlaybackError('The audio file for this song is missing. You can add a replacement from the song editor.')
        return
      }

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      audio.src = url
      audio.load()
      setPlaybackError(null)
      setDuration(track.duration || 0)

      const startAt = Math.max(0, restoredPositionRef.current || 0)
      const applyStart = () => {
        try {
          audio.currentTime = Math.min(startAt, Number.isFinite(audio.duration) ? audio.duration : startAt)
        } catch {
          // Some browsers reject seeking before metadata is ready; the metadata listener retries.
        }
        setCurrentTime(audio.currentTime)
      }

      const startPlayback = async () => {
        if (!autoPlayRef.current || cancelled) return
        try {
          await audio.play()
        } catch {
          setIsPlaying(false)
          notify('Tap play to begin this song.', 'info')
        }
      }

      if (audio.readyState >= 1) {
        applyStart()
        void startPlayback()
      } else {
        const onMetadata = () => {
          applyStart()
          void startPlayback()
        }
        audio.addEventListener('loadedmetadata', onMetadata, { once: true })
      }

      const coverUrl = await getCoverUrl(currentTrackId)
      if (cancelled || !('mediaSession' in navigator)) return
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.title || 'Untitled song',
          artist: track.artist || 'Unknown artist',
          album: track.album || 'Our Little Playlist',
          artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
        })
      } catch {
        // Media Session metadata is a progressive enhancement.
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [ready, currentTrackId, tracksById, notify])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => {
      setIsPlaying(true)
      setPlaybackError(null)
      if (currentTrackIdRef.current) void recordPlay(currentTrackIdRef.current)
    }
    const onPause = () => {
      setIsPlaying(false)
      if (audio.currentTime - lastSavedTimeRef.current >= 2) void persistPosition(audio.currentTime)
    }
    const onTime = () => {
      const time = audio.currentTime
      setCurrentTime(time)
      if (time - lastSavedTimeRef.current >= 5 || time < lastSavedTimeRef.current) void persistPosition(time)
    }
    const onMetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration)
    }
    const onError = () => {
      setIsPlaying(false)
      setPlaybackError('This audio file could not be played. It may be damaged or use a format this browser does not support.')
    }
    const onEnded = () => handleEndedRef.current()

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMetadata)
    audio.addEventListener('error', onError)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMetadata)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('ended', onEnded)
    }
  }, [persistPosition, recordPlay])

  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = clamp(volume, 0, 1)
  }, [volume])

  const getAdjacentId = useCallback((direction: 1 | -1): string | null => {
    const ids = queueRef.current
    if (!ids.length) return null
    const index = ids.indexOf(currentTrackIdRef.current ?? '')
    if (index === -1) return ids[0] ?? null

    let nextIndex = index + direction
    if (nextIndex >= ids.length) {
      if (repeatRef.current === 'all') nextIndex = 0
      else return null
    }
    if (nextIndex < 0) {
      nextIndex = repeatRef.current === 'all' ? ids.length - 1 : 0
    }
    return ids[nextIndex] ?? null
  }, [])

  const playTrack = useCallback(
    async (trackId: string, options: PlayOptions = {}) => {
      const track = tracksRef.current[trackId]
      if (!track) {
        setPlaybackError('This song is no longer in your library.')
        return
      }
      if (track.placeholder || !track.hasAudio) {
        setPlaybackError('This slot does not have an audio file yet.')
        return
      }

      const audio = audioRef.current
      if (currentTrackIdRef.current === trackId && audio?.src) {
        autoPlayRef.current = options.autoplay ?? true
        restoredPositionRef.current = options.startAt ?? 0
        try {
          audio.currentTime = options.startAt ?? 0
        } catch {
          // Ignore seek errors on freshly loaded audio.
        }
        setCurrentTime(options.startAt ?? 0)
        await updateSettings({ lastTrackId: trackId, lastPosition: options.startAt ?? 0 })
        if (autoPlayRef.current) {
          try {
            await audio.play()
          } catch {
            notify('Tap play to begin this song.', 'info')
          }
        }
        return
      }

      let playlistId = options.playlistId
      if (!playlistId) {
        playlistId = playlistsRef.current.find((playlist) => playlist.trackIds.includes(trackId))?.id
      }
      if (playlistId && playlistId !== activePlaylistRef.current) {
        await updateSettings({ activePlaylistId: playlistId })
      }

      autoPlayRef.current = options.autoplay ?? true
      restoredPositionRef.current = options.startAt ?? 0
      lastSavedTimeRef.current = 0
      currentTrackIdRef.current = trackId
      setCurrentTrackId(trackId)
      setCurrentTime(options.startAt ?? 0)
      setDuration(track.duration || 0)
      await updateSettings({ lastTrackId: trackId, lastPosition: options.startAt ?? 0 })
    },
    [notify, updateSettings],
  )

  const handleEnded = useCallback(async () => {
    if (repeatRef.current === 'one') {
      const audio = audioRef.current
      if (audio) {
        audio.currentTime = 0
        try {
          await audio.play()
        } catch {
          setIsPlaying(false)
        }
      }
      return
    }

    const nextId = getAdjacentId(1)
    if (!nextId) {
      setIsPlaying(false)
      await persistPosition(0)
      return
    }
    await playTrack(nextId, { autoplay: true, startAt: 0 })
  }, [getAdjacentId, persistPosition, playTrack])
  handleEndedRef.current = () => void handleEnded()

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current
    if (!currentTrackIdRef.current) {
      const first = playableRef.current[0]
      if (!first) {
        notify('Import a song first, then press play.', 'info')
        return
      }
      await playTrack(first.id, { autoplay: true, startAt: 0 })
      return
    }
    if (audio?.src && currentTrackIdRef.current === currentTrackId) {
      if (audio.paused) {
        autoPlayRef.current = true
        try {
          await audio.play()
        } catch {
          notify('Playback could not start. Try choosing the song again.', 'error')
        }
      } else {
        audio.pause()
      }
      return
    }
    await playTrack(currentTrackIdRef.current, { autoplay: true })
  }, [currentTrackId, notify, playTrack])

  const pause = useCallback(() => {
    audioRef.current?.pause()
  }, [])

  const next = useCallback(async () => {
    const nextId = getAdjacentId(1)
    if (nextId) await playTrack(nextId, { autoplay: true, startAt: 0 })
  }, [getAdjacentId, playTrack])

  const previous = useCallback(async () => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      setCurrentTime(0)
      await persistPosition(0)
      return
    }
    const previousId = getAdjacentId(-1)
    if (previousId) await playTrack(previousId, { autoplay: true, startAt: 0 })
  }, [getAdjacentId, persistPosition, playTrack])

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current
      const safe = Math.max(0, seconds)
      if (audio && audio.src) {
        try {
          audio.currentTime = Math.min(safe, Number.isFinite(audio.duration) ? audio.duration : safe)
        } catch {
          // Ignore seek before the file is ready.
        }
      }
      setCurrentTime(safe)
      restoredPositionRef.current = safe
      void persistPosition(safe)
    },
    [persistPosition],
  )

  const setVolume = useCallback(
    (value: number) => {
      const safe = clamp(value, 0, 1)
      const audio = audioRef.current
      if (audio) audio.volume = safe
      void updateSettings({ volume: safe })
      if (volumeTimerRef.current) window.clearTimeout(volumeTimerRef.current)
      volumeTimerRef.current = window.setTimeout(() => {
        void updateSettings({ volume: safe })
      }, 250)
    },
    [updateSettings],
  )

  const toggleShuffle = useCallback(async () => {
    await updateSettings({ shuffle: !shuffle })
  }, [shuffle, updateSettings])

  const cycleRepeat = useCallback(async () => {
    const modes: RepeatMode[] = ['off', 'all', 'one']
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length]
    await updateSettings({ repeatMode: nextMode })
  }, [repeatMode, updateSettings])

  const playFromQueue = useCallback(
    async (index: number) => {
      const id = effectiveQueueIds[index]
      if (id) await playTrack(id, { autoplay: true, startAt: 0 })
    },
    [effectiveQueueIds, playTrack],
  )

  const clearError = useCallback(() => setPlaybackError(null), [])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', () => void togglePlay()],
      ['pause', () => pause()],
      ['previoustrack', () => void previous()],
      ['nexttrack', () => void next()],
      ['seekto', (details) => {
        if (typeof details.seekTime === 'number') seek(details.seekTime)
      }],
    ]
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Action handlers are optional.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null)
        } catch {
          // Ignore unsupported cleanup.
        }
      }
    }
  }, [togglePlay, pause, previous, next, seek])

  useEffect(() => {
    return () => {
      if (volumeTimerRef.current) window.clearTimeout(volumeTimerRef.current)
    }
  }, [])

  const value = useMemo<PlayerContextValue>(
    () => ({
      currentTrack,
      currentTrackId,
      isPlaying,
      currentTime,
      duration: Number.isFinite(duration) && duration > 0 ? duration : currentTrack?.duration || 0,
      volume,
      shuffle,
      repeatMode,
      queue,
      queueIndex,
      playableTracks,
      playbackError,
      playTrack,
      togglePlay,
      pause,
      next,
      previous,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      playFromQueue,
      clearError,
    }),
    [
      currentTrack,
      currentTrackId,
      isPlaying,
      currentTime,
      duration,
      volume,
      shuffle,
      repeatMode,
      queue,
      queueIndex,
      playableTracks,
      playbackError,
      playTrack,
      togglePlay,
      pause,
      next,
      previous,
      seek,
      setVolume,
      toggleShuffle,
      cycleRepeat,
      playFromQueue,
      clearError,
    ],
  )

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext)
  if (!context) throw new Error('usePlayer must be used inside PlayerProvider')
  return context
}
