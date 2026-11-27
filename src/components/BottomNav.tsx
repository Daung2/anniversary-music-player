import { Heart, Home, ListMusic, Music2, Settings2 } from 'lucide-react'
import type { Page } from '../types'

interface BottomNavProps {
  page: Page
  onNavigate: (page: Page) => void
  onSurprise: () => void
}

const items: Array<{ id: Page; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'playlist', label: 'Songs', icon: Music2 },
  { id: 'playlists', label: 'Lists', icon: ListMusic },
  { id: 'settings', label: 'You', icon: Settings2 },
]

export function BottomNav({ page, onNavigate, onSurprise }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            type="button"
            key={item.id}
            className={page === item.id ? 'bottom-nav__item bottom-nav__item--active' : 'bottom-nav__item'}
            onClick={() => onNavigate(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        )
      })}
      <button type="button" className="bottom-nav__item bottom-nav__item--heart" onClick={onSurprise} aria-label="Open surprise">
        <Heart size={20} />
        <span>Surprise</span>
      </button>
    </nav>
  )
}
