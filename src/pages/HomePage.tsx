import { ArrowRight, Download, Gift, Heart, Pause, Play, Sparkles } from 'lucide-react'
import { CoverArt } from '../components/CoverArt'
import { HeartField } from '../components/HeartField'
import { useLibrary } from '../context/LibraryContext'
import { usePlayer } from '../context/PlayerContext'
import { anniversaryCount, daysTogether, formatTime, formatLongDate } from '../lib/format'
import type { ImportRequest } from '../components/ImportDialog'
import type { Page } from '../types'

interface HomePageProps {
  onNavigate: (page: Page) => void
  onOpenDetail: (trackId: string) => void
  onOpenNowPlaying: () => void
  onOpenSurprise: () => void
  onImport: (request?: ImportRequest) => void
  onInstall: () => void
  canInstall: boolean
}

export function HomePage({ onNavigate, onOpenDetail, onOpenNowPlaying, onOpenSurprise, onImport, onInstall, canInstall }: HomePageProps) {
  const { playlists, activePlaylistId, tracksById, recentTracks, settings } = useLibrary()
  const { currentTrack, isPlaying, togglePlay, playTrack, playableTracks } = usePlayer()

  const playlist = playlists.find((item) => item.id === activePlaylistId) ?? playlists[0]
  const featured = playlist?.trackIds.slice(0, 4).map((id) => tracksById[id]).filter(Boolean) ?? []
  const years = anniversaryCount(settings.anniversaryDate)
  const days = daysTogether(settings.anniversaryDate)
  const currentNote = currentTrack?.note || 'Add a note to this song and it becomes a little love letter.'

  return (
    <div className="page home-page">
      <section className="hero-card">
        <HeartField count={8} />
        <div className="hero-card__content">
          <span className="eyebrow"><Sparkles size={14} /> Our first anniversary</span>
          <h2>{settings.welcomeMessage || 'A little music, just for you'}</h2>
          <p>A playlist made of memories, little notes, and songs that sound like us.</p>
          <div className="hero-card__actions">
            <button type="button" className="button button--primary" onClick={() => onNavigate('playlist')}>
              Start our songs <ArrowRight size={16} />
            </button>
            <button type="button" className="button button--glass" onClick={onOpenSurprise}>
              <Gift size={16} /> Open a surprise
            </button>
          </div>
          {canInstall && (
            <button type="button" className="hero-card__install" onClick={onInstall}>
              <Download size={14} /> Add this to your phone
            </button>
          )}
        </div>
        <div className="hero-card__counter" aria-label="Anniversary counter">
          <Heart size={18} fill="currentColor" />
          <div>
            <strong>{years === 1 ? 'One beautiful year' : years ? `${years} years` : 'Our first year'}</strong>
            <span>{days !== null ? `${days.toLocaleString()} days of us` : 'Every day with you'}</span>
          </div>
        </div>
      </section>

      <div className="home-grid">
        <section className="panel featured-panel">
          <div className="panel__heading">
            <div>
              <span className="eyebrow">Featured playlist</span>
              <h2>{playlist?.name || 'Our 10 Songs'}</h2>
            </div>
            <button type="button" className="text-button" onClick={() => onNavigate('playlist')}>See all songs <ArrowRight size={14} /></button>
          </div>
          <p className="panel__subtitle">{playlist?.description || 'A collection made just for you.'}</p>

          {featured.length ? (
            <div className="featured-list">
              {featured.map((track, index) => (
                <button
                  type="button"
                  key={track.id}
                  className="featured-row"
                  onClick={() => track.hasAudio ? void playTrack(track.id, { autoplay: true }) : onImport({ playlistId: playlist?.id, targetTrackId: track.id })}
                >
                  <span className="featured-row__number">{String(index + 1).padStart(2, '0')}</span>
                  <CoverArt track={track} className="featured-row__cover" />
                  <span className="featured-row__text">
                    <strong>{track.title || `Song ${index + 1}`}</strong>
                    <small>{track.artist || (track.hasAudio ? 'Unknown artist' : 'Tap to add a song')}</small>
                  </span>
                  <span className="featured-row__duration">{track.duration ? formatTime(track.duration) : '—'}</span>
                  <Play size={15} fill="currentColor" />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state empty-state--compact">
              <Heart size={28} />
              <p>This playlist is ready for its first song.</p>
            </div>
          )}
          <button type="button" className="panel__footer-button" onClick={() => onImport({ playlistId: playlist?.id })}>
            Add another song
          </button>
        </section>

        <div className="home-side">
          <section className="panel now-preview">
            <span className="eyebrow">Currently playing</span>
            <div className="now-preview__body">
              <CoverArt track={currentTrack} className="now-preview__cover" />
              <div>
                <h3>{currentTrack?.title || (playableTracks.length ? 'Choose a song' : 'Your music goes here')}</h3>
                <p>{currentTrack?.artist || 'A song will appear here once you press play.'}</p>
              </div>
              <button type="button" className="player-button player-button--primary" onClick={() => void togglePlay()} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
              </button>
            </div>
            {currentTrack && (
              <button type="button" className="why-preview" onClick={() => onOpenDetail(currentTrack.id)}>
                <Heart size={14} fill="currentColor" /> <span>{currentNote}</span>
              </button>
            )}
            <button type="button" className="text-button" onClick={onOpenNowPlaying}>Open full player <ArrowRight size={14} /></button>
          </section>

          <section className="panel anniversary-panel">
            <HeartField count={4} />
            <span className="eyebrow">A note from me</span>
            <p>{settings.anniversaryMessage}</p>
            <span className="anniversary-panel__date">{formatLongDate(settings.anniversaryDate)}</span>
          </section>
        </div>
      </div>

      <section className="panel recent-panel">
        <div className="panel__heading">
          <div>
            <span className="eyebrow">Lately in our ears</span>
            <h2>Recently played</h2>
          </div>
        </div>
        {recentTracks.length ? (
          <div className="recent-grid">
            {recentTracks.map((track) => (
              <button type="button" key={track.id} className="recent-card" onClick={() => void playTrack(track.id, { autoplay: true })}>
                <CoverArt track={track} className="recent-card__cover" />
                <span><strong>{track.title || 'Untitled song'}</strong><small>{track.artist || 'Unknown artist'}</small></span>
                <Play size={14} fill="currentColor" />
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state--compact">
            <Heart size={26} />
            <p>Once you listen to a song, it will wait for you here.</p>
          </div>
        )}
      </section>
    </div>
  )
}
