import { Download, Plus } from 'lucide-react'
import type { Page } from '../types'

interface TopBarProps {
  page: Page
  title: string
  onImport: () => void
  onInstall: () => void
  canInstall: boolean
}

const titles: Record<Page, { title: string; subtitle: string }> = {
  home: { title: 'Home', subtitle: 'Your little corner of our world' },
  playlist: { title: 'Our songs', subtitle: 'The soundtrack of us' },
  playlists: { title: 'Playlists', subtitle: 'Little collections of feelings' },
  settings: { title: 'Personalise', subtitle: 'Make this feel even more like us' },
}

export function TopBar({ page, title, onImport, onInstall, canInstall }: TopBarProps) {
  const current = titles[page]
  return (
    <header className="top-bar">
      <div className="top-bar__brand">
        <span className="top-bar__heart">♥</span>
        <span><strong>Our Little Playlist</strong><small>{current.subtitle}</small></span>
      </div>
      <div className="top-bar__actions">
        <h1>{title || current.title}</h1>
        {canInstall && (
          <button type="button" className="button button--soft top-bar__install" onClick={onInstall}>
            <Download size={16} /> Install
          </button>
        )}
        <button type="button" className="button button--primary top-bar__add" onClick={onImport}>
          <Plus size={17} /> Add songs
        </button>
      </div>
    </header>
  )
}
