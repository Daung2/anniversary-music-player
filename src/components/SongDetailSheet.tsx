import { Heart, Pencil, Play } from 'lucide-react'
import { useLibrary } from '../context/LibraryContext'
import { usePlayer } from '../context/PlayerContext'
import { formatTime } from '../lib/format'
import { CoverArt } from './CoverArt'
import { HeartField } from './HeartField'
import { Modal } from './Modal'

interface SongDetailSheetProps {
  trackId: string | null
  onClose: () => void
  onEdit: (trackId: string) => void
}

export function SongDetailSheet({ trackId, onClose, onEdit }: SongDetailSheetProps) {
  const { tracksById } = useLibrary()
  const { playTrack, currentTrackId, isPlaying } = usePlayer()
  const track = trackId ? (tracksById[trackId] ?? null) : null

  return (
    <Modal open={Boolean(track)} onClose={onClose} title="A little story" size="large" className="song-detail-modal">
      {track && (
        <div className="song-detail">
          <CoverArt track={track} className="song-detail__backdrop" />
          <HeartField count={7} className="song-detail__hearts" />
          <div className="song-detail__content">
            <CoverArt track={track} className="song-detail__art" />
            <span className="eyebrow">One of our songs</span>
            <h2>{track.title || 'Untitled song'}</h2>
            <p className="song-detail__artist">{track.artist || 'Unknown artist'}{track.album ? ` · ${track.album}` : ''}</p>
            <div className="song-detail__divider"><Heart size={14} fill="currentColor" /></div>
            <div className="why-section">
              <h3>Why this song?</h3>
              <p>{track.note || 'There is a little story waiting to be written here. Open the editor and add what this song makes you feel.'}</p>
            </div>
            <div className="song-detail__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={() => void playTrack(track.id, { autoplay: true, startAt: 0 })}
              >
                <Play size={16} fill="currentColor" />
                {currentTrackId === track.id && isPlaying ? 'Play again' : 'Play this song'}
              </button>
              <button type="button" className="button button--soft" onClick={() => onEdit(track.id)}>
                <Pencil size={15} /> Edit the story
              </button>
            </div>
            {track.duration > 0 && <span className="song-detail__duration">{formatTime(track.duration)}</span>}
          </div>
        </div>
      )}
    </Modal>
  )
}
