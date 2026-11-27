import { Heart, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext'
import { formatTime } from '../lib/format'
import { CoverArt } from './CoverArt'
import { Modal } from './Modal'

interface NowPlayingSheetProps {
  open: boolean
  onClose: () => void
  onOpenDetail: (trackId: string) => void
  onOpenQueue: () => void
  onImport: () => void
}

export function NowPlayingSheet({ open, onClose, onOpenDetail, onOpenQueue, onImport }: NowPlayingSheetProps) {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    shuffle,
    repeatMode,
    togglePlay,
    next,
    previous,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeat,
    playTrack,
    playbackError,
    clearError,
  } = usePlayer()

  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Now playing"
      size="full"
      className="now-playing-modal"
      headerExtra={
        <button type="button" className="icon-button" onClick={onOpenQueue} aria-label="Open playlist queue">
          <ListMusic size={20} />
        </button>
      }
    >
      {!currentTrack ? (
        <div className="now-playing__empty">
          <Heart size={34} aria-hidden="true" />
          <h3>No song selected yet</h3>
          <p>Add one of your own songs and it will feel right at home here.</p>
          <button type="button" className="button button--primary" onClick={onImport}>Add a song</button>
        </div>
      ) : (
        <div className="now-playing">
          <CoverArt track={currentTrack} className="now-playing__background" />
          <div className="now-playing__content">
            <CoverArt track={currentTrack} className="now-playing__art" label={`Artwork for ${currentTrack.title}`} />

            <div className="now-playing__meta">
              <span className="eyebrow">Playing for you</span>
              <h3>{currentTrack.title || 'Untitled song'}</h3>
              <p>{currentTrack.artist || 'Unknown artist'}{currentTrack.album ? ` · ${currentTrack.album}` : ''}</p>
            </div>

            {playbackError && (
              <div className="player-error" role="alert">
                <span>{playbackError}</span>
                <div>
                  <button type="button" className="button button--soft" onClick={() => { clearError(); void playTrack(currentTrack.id, { autoplay: true }) }}>
                    Try again
                  </button>
                  <button type="button" className="button button--ghost" onClick={clearError}>Dismiss</button>
                </div>
              </div>
            )}

            <div className="player-progress">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => seek(Number(event.target.value))}
                disabled={!duration}
                aria-label="Song position"
                style={{ '--range-progress': `${progress}%` } as React.CSSProperties}
              />
              <div className="player-progress__times">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="player-controls">
              <button
                type="button"
                className={`player-button ${shuffle ? 'player-button--active' : ''}`}
                onClick={() => void toggleShuffle()}
                aria-label={shuffle ? 'Turn shuffle off' : 'Turn shuffle on'}
                aria-pressed={shuffle}
              >
                <Shuffle size={19} />
              </button>
              <button type="button" className="player-button player-button--large" onClick={() => void previous()} aria-label="Previous song">
                <SkipBack size={25} fill="currentColor" />
              </button>
              <button
                type="button"
                className="player-button player-button--primary player-button--play"
                onClick={() => void togglePlay()}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" />}
              </button>
              <button type="button" className="player-button player-button--large" onClick={() => void next()} aria-label="Next song">
                <SkipForward size={25} fill="currentColor" />
              </button>
              <button
                type="button"
                className={`player-button ${repeatMode !== 'off' ? 'player-button--active' : ''}`}
                onClick={() => void cycleRepeat()}
                aria-label={`Repeat: ${repeatMode}`}
              >
                {repeatMode === 'one' ? <Repeat1 size={19} /> : <Repeat size={19} />}
              </button>
            </div>

            <div className="player-volume">
              <button type="button" className="player-button" onClick={() => setVolume(volume > 0 ? 0 : 0.8)} aria-label={volume > 0 ? 'Mute' : 'Unmute'}>
                {volume > 0 ? <Volume2 size={19} /> : <VolumeX size={19} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                aria-label="Volume"
                style={{ '--range-progress': `${volume * 100}%` } as React.CSSProperties}
              />
              <span>{Math.round(volume * 100)}%</span>
            </div>

            <button type="button" className="why-song-card" onClick={() => onOpenDetail(currentTrack.id)}>
              <Heart size={16} aria-hidden="true" />
              <span>
                <strong>Why this song?</strong>
                <small>{currentTrack.note || 'Add the little story behind this one.'}</small>
              </span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
