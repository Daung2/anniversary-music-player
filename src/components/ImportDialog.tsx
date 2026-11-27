import { useEffect, useId, useRef, useState } from 'react'
import { Check, FileAudio, Heart, UploadCloud } from 'lucide-react'
import { useLibrary } from '../context/LibraryContext'
import { useToast } from '../context/ToastContext'
import { formatBytes } from '../lib/format'
import { Modal } from './Modal'

export interface ImportRequest {
  playlistId?: string
  targetTrackId?: string
  note?: string
}

interface ImportDialogProps {
  open: boolean
  onClose: () => void
  request: ImportRequest | null
}

export function ImportDialog({ open, onClose, request }: ImportDialogProps) {
  const { playlists, activePlaylistId, importFiles } = useLibrary()
  const { notify } = useToast()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [note, setNote] = useState('')
  const [playlistId, setPlaylistId] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setFiles([])
    setErrors([])
    setNote(request?.note ?? '')
    setPlaylistId(request?.playlistId ?? activePlaylistId ?? playlists[0]?.id ?? '')
  }, [open, request, activePlaylistId, playlists])

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  const handleSubmit = async () => {
    if (!files.length || !playlistId || busy) return
    setBusy(true)
    setErrors([])
    const result = await importFiles(files, {
      playlistId,
      targetTrackId: request?.targetTrackId,
      note,
    })
    setBusy(false)

    if (result.imported.length) {
      notify(
        `${result.imported.length} ${result.imported.length === 1 ? 'song' : 'songs'} added to your playlist.`,
        'success',
      )
    }
    if (result.errors.length) {
      setErrors(result.errors)
      setFiles([])
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setFiles([])
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Add your music"
      subtitle={request?.targetTrackId ? 'This file will be added to the selected song slot.' : 'Your files stay on this device, right here with us.'}
      size="medium"
    >
      <div className="import-dialog">
        <label className="field-label" htmlFor={inputId}>Choose audio files</label>
        <label
          className={`drop-zone ${dragging ? 'drop-zone--active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            setFiles((current) => [...current, ...Array.from(event.dataTransfer.files)])
          }}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.oga,.aac,.flac,.opus"
            multiple
            onChange={(event) => setFiles((current) => [...current, ...Array.from(event.target.files ?? [])])}
          />
          <UploadCloud size={28} aria-hidden="true" />
          <strong>Tap to choose songs, or drop them here</strong>
          <span>MP3, WAV, M4A, OGG and other formats your browser can play</span>
        </label>

        {files.length > 0 && (
          <div className="selected-files">
            <div className="selected-files__summary">
              <Check size={16} /> {files.length} selected · {formatBytes(totalSize)}
            </div>
            <ul>
              {files.slice(0, 8).map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <FileAudio size={15} /> <span>{file.name}</span>
                </li>
              ))}
              {files.length > 8 && <li className="selected-files__more">+{files.length - 8} more</li>}
            </ul>
          </div>
        )}

        <div className="form-grid">
          <label className="field">
            <span className="field-label">Add to playlist</span>
            <select value={playlistId} onChange={(event) => setPlaylistId(event.target.value)}>
              {playlists.map((playlist) => (
                <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="field-label">Why these songs? <Heart size={13} aria-hidden="true" /></span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            placeholder="A little note you will smile at later…"
          />
          <span className="field-hint">Optional. You can always change this from the song editor.</span>
        </label>

        {errors.length > 0 && (
          <div className="error-panel" role="alert">
            <strong>Some files could not be added:</strong>
            <ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul>
          </div>
        )}

        <div className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="button button--primary" onClick={() => void handleSubmit()} disabled={!files.length || !playlistId || busy}>
            {busy ? 'Adding…' : 'Add to playlist'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
