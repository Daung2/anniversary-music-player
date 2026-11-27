import { useEffect, useId, useState } from 'react'
import { Download, Heart, LockKeyhole, RotateCcw, Sparkles, Upload } from 'lucide-react'
import { useLibrary } from '../context/LibraryContext'
import { useToast } from '../context/ToastContext'
import { downloadBlob } from '../lib/download'
import { safeFileName } from '../lib/format'

interface SettingsPageProps {
  onInstall: () => void
  canInstall: boolean
  standalone: boolean
  isIos: boolean
}

export function SettingsPage({ onInstall, canInstall, standalone, isIos }: SettingsPageProps) {
  const { settings, updateSettings, exportBackup, restoreBackup } = useLibrary()
  const { notify } = useToast()
  const importId = useId()
  const [welcome, setWelcome] = useState(settings.welcomeMessage)
  const [anniversary, setAnniversary] = useState(settings.anniversaryMessage)
  const [surprise, setSurprise] = useState(settings.surpriseMessage)
  const [date, setDate] = useState(settings.anniversaryDate)
  const [busy, setBusy] = useState(false)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)

  useEffect(() => {
    setWelcome(settings.welcomeMessage)
    setAnniversary(settings.anniversaryMessage)
    setSurprise(settings.surpriseMessage)
    setDate(settings.anniversaryDate)
  }, [settings.welcomeMessage, settings.anniversaryMessage, settings.surpriseMessage, settings.anniversaryDate])

  const handleSave = async () => {
    await updateSettings({
      welcomeMessage: welcome,
      anniversaryMessage: anniversary,
      surpriseMessage: surprise,
      anniversaryDate: date,
    })
    notify('Your words were saved.', 'success')
  }

  const handleExport = async () => {
    setBusy(true)
    setBackupMessage(null)
    try {
      const blob = await exportBackup()
      downloadBlob(blob, `${safeFileName('our-little-playlist')}-${new Date().toISOString().slice(0, 10)}.zip`)
      notify('Your backup is downloading.', 'success')
    } catch (caught) {
      console.error(caught)
      notify('The backup could not be created.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setBackupMessage(null)
    try {
      const result = await restoreBackup(file)
      const message = `Restored ${result.playlists} playlists and ${result.tracks} songs.`
      setBackupMessage(result.errors.length ? `${message} ${result.errors[0]}` : message)
      notify(result.errors.length ? 'Backup restored with a few warnings.' : 'Your backup was restored.', result.errors.length ? 'info' : 'success')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The backup could not be restored.'
      setBackupMessage(message)
      notify(message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page settings-page">
      <section className="panel settings-panel">
        <div className="panel__heading">
          <div>
            <span className="eyebrow"><Sparkles size={14} /> Your words</span>
            <h2>Make it feel like us</h2>
          </div>
        </div>
        <p className="panel__subtitle">Change these any time. They live only on this device.</p>

        <label className="field">
          <span className="field-label">Welcome heading</span>
          <input value={welcome} onChange={(event) => setWelcome(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Anniversary message</span>
          <textarea value={anniversary} onChange={(event) => setAnniversary(event.target.value)} rows={4} />
        </label>
        <label className="field">
          <span className="field-label">The surprise inside the heart</span>
          <textarea value={surprise} onChange={(event) => setSurprise(event.target.value)} rows={4} />
        </label>
        <label className="field">
          <span className="field-label">Date we began</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <div className="settings-actions">
          <button type="button" className="button button--primary" onClick={() => void handleSave()}>Save our words</button>
          <button
            type="button"
            className="button button--soft"
            onClick={() => void updateSettings({ firstOpeningSeen: false })}
          >
            <RotateCcw size={16} /> Replay welcome
          </button>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel__heading">
          <div>
            <span className="eyebrow"><Heart size={14} fill="currentColor" /> Keep it safe</span>
            <h2>Backup & restore</h2>
          </div>
        </div>
        <p className="panel__subtitle">Download a private ZIP of your playlists, notes, artwork and audio. Import it on any device to bring everything back.</p>
        <div className="backup-actions">
          <button type="button" className="button button--primary" onClick={() => void handleExport()} disabled={busy}>
            <Download size={16} /> {busy ? 'Working…' : 'Download backup'}
          </button>
          <label className="button button--soft" htmlFor={importId}>
            <Upload size={16} /> Choose backup file
          </label>
          <input
            id={importId}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(event) => {
              void handleImport(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
        {backupMessage && <p className="backup-message" role="status">{backupMessage}</p>}
        <p className="privacy-note"><LockKeyhole size={15} /> Nothing is uploaded. Your music and messages never leave this device.</p>
      </section>

      <section className="panel settings-panel install-panel">
        <div className="panel__heading">
          <div>
            <span className="eyebrow">Like a real app</span>
            <h2>Install our player</h2>
          </div>
        </div>
        {standalone ? (
          <p className="panel__subtitle">It is already installed. Our little player is right at home here. ♥</p>
        ) : canInstall ? (
          <>
            <p className="panel__subtitle">Add it to your home screen so it opens in its own window, even offline.</p>
            <button type="button" className="button button--primary" onClick={onInstall}><Download size={16} /> Install app</button>
          </>
        ) : (
          <p className="panel__subtitle">
            {isIos
              ? 'On iPhone or iPad, tap Share, then “Add to Home Screen”.'
              : 'Your browser will offer an install button when this app is ready. It works best in Chrome.'}
          </p>
        )}
      </section>
    </div>
  )
}
