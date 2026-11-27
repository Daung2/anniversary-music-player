import { useState } from 'react'
import { Heart, RotateCw } from 'lucide-react'
import { BottomNav } from './components/BottomNav'
import { FirstOpeningOverlay } from './components/FirstOpeningOverlay'
import { ImportDialog, type ImportRequest } from './components/ImportDialog'
import { MiniPlayer } from './components/MiniPlayer'
import { NowPlayingSheet } from './components/NowPlayingSheet'
import { QueueSheet } from './components/QueueSheet'
import { Sidebar } from './components/Sidebar'
import { SongDetailSheet } from './components/SongDetailSheet'
import { SurpriseModal } from './components/SurpriseModal'
import { TopBar } from './components/TopBar'
import { TrackEditorModal } from './components/TrackEditorModal'
import { LibraryProvider, useLibrary } from './context/LibraryContext'
import { PlayerProvider } from './context/PlayerContext'
import { ToastProvider, useToast } from './context/ToastContext'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import { HomePage } from './pages/HomePage'
import { PlaylistPage } from './pages/PlaylistPage'
import { PlaylistsPage } from './pages/PlaylistsPage'
import { SettingsPage } from './pages/SettingsPage'
import type { Page } from './types'

function AppContent() {
  const { ready, error, settings, updateSettings } = useLibrary()
  const { notify } = useToast()
  const install = useInstallPrompt()

  const [page, setPage] = useState<Page>('home')
  const [importRequest, setImportRequest] = useState<ImportRequest | null>(null)
  const [editorTrackId, setEditorTrackId] = useState<string | null>(null)
  const [detailTrackId, setDetailTrackId] = useState<string | null>(null)
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [surpriseOpen, setSurpriseOpen] = useState(false)

  const handleInstall = async () => {
    const result = await install.promptInstall()
    if (result === 'prompted') notify('Thank you for keeping us close.', 'success')
    else if (result === 'unavailable' && install.isIos) notify('Tap Share, then “Add to Home Screen”.', 'info')
  }

  const openImport = (request: ImportRequest = {}) => setImportRequest(request)

  if (!ready) {
    return (
      <div className="boot-screen">
        <div className="boot-heart">♥</div>
        <h1>Our Little Playlist</h1>
        <p>Opening your little world…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="boot-screen boot-screen--error">
        <Heart size={40} aria-hidden="true" />
        <h1>We could not open your songs</h1>
        <p>{error}</p>
        <button type="button" className="button button--primary" onClick={() => window.location.reload()}>
          <RotateCw size={16} /> Try again
        </button>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNavigate={setPage}
        onSurprise={() => setSurpriseOpen(true)}
        onInstall={() => void handleInstall()}
        canInstall={install.canInstall}
        standalone={install.standalone}
      />

      <div className="app-content">
        <TopBar
          page={page}
          title=""
          onImport={() => openImport()}
          onInstall={() => void handleInstall()}
          canInstall={install.canInstall}
        />
        <main className="app-main" id="main-content">
          {page === 'home' && (
            <HomePage
              onNavigate={setPage}
              onOpenDetail={setDetailTrackId}
              onOpenNowPlaying={() => setNowPlayingOpen(true)}
              onOpenSurprise={() => setSurpriseOpen(true)}
              onImport={openImport}
              onInstall={() => void handleInstall()}
              canInstall={install.canInstall}
            />
          )}
          {page === 'playlist' && (
            <PlaylistPage
              onImport={openImport}
              onEditTrack={setEditorTrackId}
              onOpenDetail={setDetailTrackId}
            />
          )}
          {page === 'playlists' && <PlaylistsPage />}
          {page === 'settings' && (
            <SettingsPage
              onInstall={() => void handleInstall()}
              canInstall={install.canInstall}
              standalone={install.standalone}
              isIos={install.isIos}
            />
          )}
        </main>
      </div>

      <MiniPlayer onOpenNowPlaying={() => setNowPlayingOpen(true)} onImport={() => openImport()} />
      <BottomNav page={page} onNavigate={setPage} onSurprise={() => setSurpriseOpen(true)} />

      <ImportDialog open={Boolean(importRequest)} onClose={() => setImportRequest(null)} request={importRequest} />
      <TrackEditorModal trackId={editorTrackId} onClose={() => setEditorTrackId(null)} />
      <SongDetailSheet
        trackId={detailTrackId}
        onClose={() => setDetailTrackId(null)}
        onEdit={(id) => {
          setDetailTrackId(null)
          setEditorTrackId(id)
        }}
      />
      <NowPlayingSheet
        open={nowPlayingOpen}
        onClose={() => setNowPlayingOpen(false)}
        onOpenDetail={(id) => {
          setNowPlayingOpen(false)
          setDetailTrackId(id)
        }}
        onOpenQueue={() => setQueueOpen(true)}
        onImport={() => openImport()}
      />
      <QueueSheet open={queueOpen} onClose={() => setQueueOpen(false)} />
      <SurpriseModal open={surpriseOpen} onClose={() => setSurpriseOpen(false)} />
      <FirstOpeningOverlay
        open={!settings.firstOpeningSeen}
        onFinish={() => void updateSettings({ firstOpeningSeen: true })}
      />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <LibraryProvider>
        <PlayerProvider>
          <AppContent />
        </PlayerProvider>
      </LibraryProvider>
    </ToastProvider>
  )
}
