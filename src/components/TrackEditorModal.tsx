import { useEffect, useId, useState } from 'react'
import { ImagePlus, Music2, Trash2 } from 'lucide-react'
import { useLibrary } from '../context/LibraryContext'
import { useToast } from '../context/ToastContext'
import { formatBytes, formatTime } from '../lib/format'
import type { Track } from '../types'
import { CoverArt } from './CoverArt'
import { Modal } from './Modal'

interface TrackEditorModalProps {
  trackId: string | null
  onClose: () => void
}

export function TrackEditorModal({ trackId, onClose }: TrackEditorModalProps) {
  const { tracksById, playlists, updateTrack, importFiles, setCover, removeCover, deleteTrack } = useLibrary()
  const { notify } = useToast()
  const track: Track | null = trackId ? (tracksById[trackId] ?? null) : null
  const playlist = track ? playlists.find((item) => item.trackIds.includes(track.id)) : undefined
  const audioInputId = useId()
  const coverInputId = useId()

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [album, setAlbum] = useState('')
  const [note, setNote] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [removeArt, setRemoveArt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!track) return
    setTitle(track.title)
    setArtist(track.artist)
    setAlbum(track.album)
    setNote(track.note)
    setAudioFile(null)
    setCoverFile(null)
    setRemoveArt(false)
    setErrors([])
  }, [trackId, track?.id])

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null)
      return
    }
    const url = URL.createObjectURL(coverFile)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  const handleSave = async () => {
    if (!track || busy) return
    setBusy(true)
    setErrors([])

    try {
      if (audioFile) {
        const result = await importFiles([audioFile], {
          playlistId: playlist?.id,
          targetTrackId: track.id,
          note,
        })
        if (result.errors.length) {
          setErrors(result.errors)
          setBusy(false)
          return
        }
      } else {
        await updateTrack(track.id, { title, artist, album, note })
      }

      if (removeArt) {
        await removeCover(track.id)
      } else if (coverFile) {
        try {
          await setCover(track.id, coverFile)
        } catch {
          setErrors(['That image could not be used. Please try a JPG, PNG or WebP image.'])
          setBusy(false)
          return
        }
      }

      notify(audioFile ? 'Your song and details were saved.' : 'Song details saved.', 'success')
      setBusy(false)
      onClose()
    } catch (caught) {
      console.error(caught)
      setErrors(['Something went wrong while saving. Please try again.'])
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!track) return
    const label = track.title || 'this song'
    if (!window.confirm(`Remove ${label} from your playlist? Its audio file will be deleted from this device.`)) return
    setBusy(true)
    await deleteTrack(track.id)
    notify(`${label} was removed.`, 'success')
    setBusy(false)
    onClose()
  }

  return (
    <Modal
      open={Boolean(track)}
      onClose={busy ? () => {} : onClose}
      title={track?.placeholder ? 'Fill this song slot' : 'Edit this song'}
      subtitle="Make it yours — every detail can change whenever you like."
      size="medium"
    >
      {!track ? (
        <p>This song is no longer in your library.</p>
      ) : (
        <div className="track-editor">
          <div className="track-editor__cover-row">
            <div className="track-editor__preview">
              {coverPreview ? <img src={coverPreview} alt="New cover preview" /> : <CoverArt track={track} />}
            </div>
            <div className="track-editor__cover-actions">
              <label className="button button--soft" htmlFor={coverInputId}>
                <ImagePlus size={16} /> {track.coverMimeType ? 'Replace artwork' : 'Add artwork'}
              </label>
              <input
                id={coverInputId}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                hidden
                onChange={(event) => {
                  setCoverFile(event.target.files?.[0] ?? null)
                  setRemoveArt(false)
                }}
              />
              {track.coverMimeType && !removeArt && (
                <button type="button" className="text-button" onClick={() => { setRemoveArt(true); setCoverFile(null) }}>
                  Remove artwork
                </button>
              )}
              {removeArt && (
                <button type="button" className="text-button" onClick={() => setRemoveArt(false)}>
                  Keep current artwork
                </button>
              )}
              <span className="field-hint">Square images look loveliest. We resize them for you.</span>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span className="field-label">Song title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A title that means something" />
            </label>
            <label className="field">
              <span className="field-label">Artist</span>
              <input value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Who sings it?" />
            </label>
            <label className="field field--wide">
              <span className="field-label">Album <span className="field-optional">optional</span></span>
              <input value={album} onChange={(event) => setAlbum(event.target.value)} placeholder="Album name" />
            </label>
          </div>

          <label className="field">
            <span className="field-label">Why does this song remind you of her?</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="The memory, the moment, the feeling…"
            />
          </label>

          <div className="audio-swap">
            <div>
              <strong>{track.hasAudio ? track.fileName || 'Audio file' : 'No audio file yet'}</strong>
              <span>
                {track.hasAudio
                  ? `${formatTime(track.duration)} · ${formatBytes(track.size)}`
                  : 'Choose a file to make this slot playable.'}
              </span>
            </div>
            <label className="button button--soft" htmlFor={audioInputId}>
              <Music2 size={16} /> {track.hasAudio ? 'Replace audio' : 'Add audio file'}
            </label>
            <input
              id={audioInputId}
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.oga,.aac,.flac,.opus"
              hidden
              onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)}
            />
          </div>
          {audioFile && <p className="selected-audio"><Music2 size={14} /> Ready to add: {audioFile.name}</p>}

          {errors.length > 0 && (
            <div className="error-panel" role="alert">
              <ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul>
            </div>
          )}

          <div className="modal__footer modal__footer--split">
            {track.hasAudio || track.placeholder ? (
              <button type="button" className="button button--danger-ghost" onClick={() => void handleDelete()} disabled={busy}>
                <Trash2 size={16} /> Delete song
              </button>
            ) : <span />}
            <div className="modal__footer-actions">
              <button type="button" className="button button--ghost" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="button button--primary" onClick={() => void handleSave()} disabled={busy}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
