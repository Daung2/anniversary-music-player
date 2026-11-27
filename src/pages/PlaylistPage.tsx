import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Heart, ListPlus, Pause, Pencil, Play, Plus, Shuffle, Sparkles } from 'lucide-react'
import { CoverArt } from '../components/CoverArt'
import { HeartField } from '../components/HeartField'
import { useLibrary } from '../context/LibraryContext'
import { usePlayer } from '../context/PlayerContext'
import { formatTime } from '../lib/format'
import type { ImportRequest } from '../components/ImportDialog'

interface PlaylistPageProps {
  onImport: (request?: ImportRequest) => void
  onEditTrack: (trackId: string) => void
  onOpenDetail: (trackId: string) => void
}

export function PlaylistPage({ onImport, onEditTrack, onOpenDetail }: PlaylistPageProps) {
  const { playlists, activePlaylistId, tracksById, setActivePlaylist, addEmptyTrack, reorderTracks, updatePlaylist } = useLibrary()
  const { currentTrackId, isPlaying, playTrack, shuffle, toggleShuffle } = usePlayer()

  const playlist = playlists.find((item) => item.id === activePlaylistId) ?? playlists[0]
  const tracks = playlist?.trackIds.map((id) => tracksById[id]).filter((track) => Boolean(track)) ?? []
  const playableCount = tracks.filter((track) => track.hasAudio).length
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [editingMeta, setEditingMeta] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    setName(playlist?.name ?? '')
    setDescription(playlist?.description ?? '')
    setEditingMeta(false)
  }, [playlist?.id])

  if (!playlist) {
    return <div className="empty-state"><Heart size={34} /><h2>No playlist yet</h2><p>Create one from the Playlists tab.</p></div>
  }

  const playFirst = () => {
    const first = tracks.find((track) => track.hasAudio)
    if (first) void playTrack(first.id, { autoplay: true, startAt: 0 })
    else onImport({ playlistId: playlist.id })
  }

  const saveMeta = async () => {
    await updatePlaylist(playlist.id, { name, description })
    setEditingMeta(false)
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= tracks.length) return
    void reorderTracks(playlist.id, index, target)
  }

  return (
    <div className="page playlist-page">
      <section className="playlist-hero">
        <HeartField count={6} />
        <div className="playlist-hero__art">
          <CoverArt track={tracks.find((track) => track.coverMimeType) ?? tracks[0]} />
          <span><Heart size={16} fill="currentColor" /></span>
        </div>
        <div className="playlist-hero__text">
          <span className="eyebrow"><Sparkles size={14} /> Featured playlist</span>
          {editingMeta ? (
            <div className="playlist-meta-edit">
              <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Playlist name" />
              <input value={description} onChange={(event) => setDescription(event.target.value)} aria-label="Playlist description" />
              <div>
                <button type="button" className="button button--primary" onClick={() => void saveMeta()}>Save</button>
                <button type="button" className="button button--ghost" onClick={() => setEditingMeta(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h2>{playlist.name}</h2>
              <p>{playlist.description || 'A little collection of songs that feel like us.'}</p>
            </>
          )}
          <div className="playlist-hero__stats">
            <span>{tracks.length} {tracks.length === 1 ? 'slot' : 'slots'}</span>
            <span>{playableCount} {playableCount === 1 ? 'song' : 'songs'} ready</span>
          </div>
        </div>
        <div className="playlist-hero__actions">
          <button type="button" className="button button--primary" onClick={playFirst}>
            {currentTrackId && isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
            {playableCount ? 'Play playlist' : 'Add first song'}
          </button>
          <button
            type="button"
            className={shuffle ? 'button button--soft button--active' : 'button button--soft'}
            onClick={() => void toggleShuffle()}
            aria-pressed={shuffle}
          >
            <Shuffle size={16} /> Shuffle
          </button>
          <button type="button" className="icon-button" onClick={() => setEditingMeta(true)} aria-label="Edit playlist details">
            <Pencil size={17} />
          </button>
        </div>
      </section>

      <div className="playlist-toolbar">
        <label>
          <span>Playlist</span>
          <select value={playlist.id} onChange={(event) => setActivePlaylist(event.target.value)}>
            {playlists.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div>
          <button type="button" className="button button--soft" onClick={() => onImport({ playlistId: playlist.id })}>
            <Plus size={16} /> Import songs
          </button>
          <button type="button" className="button button--soft" onClick={() => void addEmptyTrack(playlist.id)}>
            <ListPlus size={16} /> Add empty slot
          </button>
        </div>
      </div>

      <ul className="track-list" aria-label={playlist.name}>
        {tracks.map((track, index) => {
          const active = currentTrackId === track.id
          const playable = track.hasAudio && !track.placeholder
          return (
            <li
              key={track.id}
              className={`track-row ${active ? 'track-row--active' : ''} ${draggedIndex === index ? 'track-row--dragging' : ''} ${playable ? '' : 'track-row--empty'}`}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                if (draggedIndex !== null) void reorderTracks(playlist.id, draggedIndex, index)
                setDraggedIndex(null)
              }}
              onDragEnd={() => setDraggedIndex(null)}
            >
              <span className="track-row__grip" aria-hidden="true"><GripVertical size={18} /></span>
              <span className="track-row__index">{String(index + 1).padStart(2, '0')}</span>
              <button
                type="button"
                className="track-row__play"
                onClick={() => playable ? void playTrack(track.id, { autoplay: true, startAt: 0 }) : onImport({ playlistId: playlist.id, targetTrackId: track.id })}
                aria-label={playable ? `Play ${track.title || 'song'}` : `Add audio to slot ${index + 1}`}
              >
                {active && isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
              <CoverArt track={track} className="track-row__cover" />
              <button type="button" className="track-row__main" onClick={() => onOpenDetail(track.id)}>
                <strong>{track.title || `Song ${index + 1}`}</strong>
                <span>{track.artist || (playable ? 'Unknown artist' : 'An empty slot, waiting for our song')}</span>
                {track.note && <small><Heart size={11} fill="currentColor" /> {track.note}</small>}
              </button>
              <span className="track-row__duration">{track.duration ? formatTime(track.duration) : '—'}</span>
              <div className="track-row__reorder">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${track.title || 'song'} up`}><ChevronUp size={16} /></button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === tracks.length - 1} aria-label={`Move ${track.title || 'song'} down`}><ChevronDown size={16} /></button>
              </div>
              <button type="button" className="icon-button" onClick={() => onEditTrack(track.id)} aria-label={`Edit ${track.title || `song ${index + 1}`}`}>
                <Pencil size={16} />
              </button>
            </li>
          )
        })}
      </ul>

      <button type="button" className="add-slot-button" onClick={() => void addEmptyTrack(playlist.id)}>
        <Plus size={18} /> Add another song slot
      </button>
    </div>
  )
}
