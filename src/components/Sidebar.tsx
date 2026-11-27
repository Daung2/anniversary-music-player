import { Heart, Home, ListMusic, Music2, Settings2, Sparkles } from 'lucide-react'
import type { Page } from '../types'

interface SidebarProps {
  page: Page
  onNavigate: (page: Page) => void
  onSurprise: () => void
  onInstall: () => void
  canInstall: boolean
  standalone: boolean
}

const items: Array<{ id: Page; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'playlist', label: 'Our songs', icon: Music2 },
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'settings', label: 'Personalise', icon: Settings2 },
]

export function Sidebar({ page, onNavigate, onSurprise, onInstall, canInstall, standalone }: SidebarProps) {
  return (
    <aside className="sidebar">
      <button type="button" className="brand" onClick={() => onNavigate('home')}>
        <span className="brand__heart"><Heart size={21} fill="currentColor" /></span>
        <span>
          <strong>Our Little Playlist</strong>
          <small>made with all my heart</small>
        </span>
      </button>

      <nav className="sidebar__nav" aria-label="Main navigation">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <button
              type="button"
              key={item.id}
              className={page === item.id ? 'nav-link nav-link--active' : 'nav-link'}
              onClick={() => onNavigate(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
            >
              <Icon size={19} /> {item.label}
            </button>
          )
        })}
      </nav>

      <div className="sidebar__bottom">
        <button type="button" className="surprise-link" onClick={onSurprise}>
          <Sparkles size={17} /> A surprise for you
        </button>
        {canInstall && !standalone && (
          <button type="button" className="install-link" onClick={onInstall}>Install our player</button>
        )}
        <p>Every song stays on this device. ♥</p>
      </div>
    </aside>
  )
}
