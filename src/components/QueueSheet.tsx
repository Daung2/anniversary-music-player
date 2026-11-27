import { ListMusic, Music2, Play } from 'lucide-react'
import { usePlayer } from '../context/PlayerContext'
import { formatTime } from '../lib/format'
import { CoverArt } from './CoverArt'
import { Modal } from './Modal'

interface QueueSheetProps {
  open: boolean
  onClose: () => void
}

export function QueueSheet({ open, onClose }: QueueSheetProps) {
  const { queue, queueIndex, currentTrackId, isPlaying, playFromQueue } = usePlayer()

  return (
    <Modal open={open} onClose={onClose} title="Our queue" subtitle="Tap any song to play it right away." size="medium">
      {queue.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <ListMusic size={30} aria-hidden="true" />
          <h3>The queue is waiting</h3>
          <p>Import a few songs and they will line up here.</p>
        </div>
      ) : (
        <ul className="queue-list">
          {queue.map((track, index) => {
            const active = track.id === currentTrackId
            return (
              <li key={track.id} className={active ? 'queue-list__item queue-list__item--active' : 'queue-list__item'}>
                <button type="button" onClick={() => { void playFromQueue(index); onClose() }} aria-label={`Play ${track.title}`}>
                  <span className="queue-list__number">
                    {active && isPlaying ? <Music2 size={15} /> : <Play size={13} fill="currentColor" />}
                  </span>
                  <CoverArt track={track} className="queue-list__cover" />
                  <span className="queue-list__text">
                    <strong>{track.title || 'Untitled song'}</strong>
                    <small>{track.artist || 'Unknown artist'}</small>
                  </span>
                  <span className="queue-list__duration">{formatTime(track.duration)}</span>
                </button>
                {index === queueIndex - 1 && <span className="queue-list__marker">up next</span>}
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
