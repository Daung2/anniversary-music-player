import { ChevronUp, Heart, Pause, Play, SkipForward } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext'
import { formatTime } from '../lib/format'
import { CoverArt } from './CoverArt'

interface MiniPlayerProps {
  onOpenNowPlaying: () => void
  onImport: () => void
}

export function MiniPlayer({ onOpenNowPlaying, onImport }: MiniPlayerProps) {
  const { currentTrack, isPlaying, currentTime, duration, togglePlay, next, playableTracks } = usePlayer()
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <div className="mini-player" aria-label="Music player">
      <div className="mini-player__progress" style={{ width: `${progress}%` }} />
      <div
        className="mini-player__main"
        role="button"
        tabIndex={0}
        onClick={onOpenNowPlaying}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpenNowPlaying()
          }
        }}
      >
        <CoverArt track={currentTrack} className="mini-player__cover" />
        <div className="mini-player__text">
          <strong>{currentTrack?.title || (playableTracks.length ? 'Choose a song' : 'Your music goes here')}</strong>
          <span>
            {currentTrack?.artist || (playableTracks.length ? 'Tap to open the player' : 'Import your first song to begin')}
            {currentTrack && duration > 0 && ` · ${formatTime(currentTime)} / ${formatTime(duration)}`}
          </span>
        </div>
        <ChevronUp size={18} className="mini-player__expand" aria-hidden="true" />
      </div>
      <div className="mini-player__controls">
        {currentTrack ? (
          <>
            <button
              type="button"
              className="player-button player-button--primary"
              onClick={(event) => {
                event.stopPropagation()
                void togglePlay()
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
            </button>
            <button
              type="button"
              className="player-button"
              onClick={(event) => {
                event.stopPropagation()
                void next()
              }}
              aria-label="Next song"
            >
              <SkipForward size={19} fill="currentColor" />
            </button>
          </>
        ) : (
          <button type="button" className="mini-player__import" onClick={onImport}>
            <Heart size={14} /> Add a song
          </button>
        )}
      </div>
    </div>
  )
}
