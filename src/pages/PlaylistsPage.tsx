import { useEffect, useState } from 'react'
import { Check, Heart, ListMusic, Music2, Pencil, Plus, Trash2 } from 'lucide-react'
import { CoverArt } from '../components/CoverArt'
import { HeartField } from '../components/HeartField'
import { useLibrary } from '../context/LibraryContext'
import { useToast } from '../context/ToastContext'

export function PlaylistsPage() {
  const { playlists, tracksById, activePlaylistId, createPlaylist, updatePlaylist, deletePlaylist, setActivePlaylist } = useLibrary()
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (!editingId) return
    const playlist = playlists.find((item) => item.id === editingId)
    if (playlist) setEditName(playlist.name)
  }, [editingId, playlists])

  const handleCreate = async () => {
    if (!name.trim()) return
    await createPlaylist(name, description)
    notify(`${name.trim()} was created.`, 'success')
    setName('')
    setDescription('')
  }

  const handleDelete = async (id: string) => {
    const playlist = playlists.find((item) => item.id === id)
    if (!playlist) return
    if (!window.confirm(`Delete ${playlist.name}? Songs that are not in another playlist will be removed too.`)) return
    const removed = await deletePlaylist(id)
    if (removed) notify(`${playlist.name} was deleted.`, 'success')
  }

  return (
    <div className="page playlists-page">
      <section className="panel create-playlist">
        <span className="eyebrow"><Plus size={14} /> A new collection</span>
        <h2>Make another playlist</h2>
        <p>Maybe one for rainy days, one for dancing in the kitchen, one for just us.</p>
        <div className="create-playlist__fields">
          <label className="field">
            <span className="field-label">Playlist name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Songs for slow evenings" />
          </label>
          <label className="field">
            <span className="field-label">A little description</span>
            <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional" />
          </label>
          <button type="button" className="button button--primary" onClick={() => void handleCreate()} disabled={!name.trim()}>
            <Plus size={16} /> Create playlist
          </button>
        </div>
      </section>

      <div className="playlists-grid">
        {playlists.map((playlist) => {
          const tracks = playlist.trackIds.map((id) => tracksById[id]).filter((track) => Boolean(track))
          const ready = tracks.filter((track) => track.hasAudio)
          const active = playlist.id === activePlaylistId
          return (
            <article key={playlist.id} className={active ? 'playlist-card playlist-card--active' : 'playlist-card'}>
              <HeartField count={3} />
              <div className="playlist-card__art">
                <CoverArt track={ready[0] ?? tracks[0]} />
                <span><ListMusic size={18} /></span>
              </div>
              {editingId === playlist.id ? (
                <div className="playlist-card__edit">
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} aria-label="Playlist name" />
                  <button type="button" className="button button--primary" onClick={() => { void updatePlaylist(playlist.id, { name: editName }); setEditingId(null) }}>Save</button>
                  <button type="button" className="text-button" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <h3>{playlist.name}</h3>
                  <p>{playlist.description || 'A little collection of ours.'}</p>
                </>
              )}
              <span className="playlist-card__count"><Music2 size={14} /> {ready.length} of {tracks.length} songs ready</span>
              <div className="playlist-card__actions">
                <button type="button" className="button button--soft" onClick={() => void setActivePlaylist(playlist.id)}>
                  {active ? <><Check size={15} /> Current</> : 'Open playlist'}
                </button>
                <button type="button" className="icon-button" onClick={() => setEditingId(playlist.id)} aria-label={`Rename ${playlist.name}`}><Pencil size={16} /></button>
                <button type="button" className="icon-button icon-button--danger" onClick={() => void handleDelete(playlist.id)} aria-label={`Delete ${playlist.name}`}><Trash2 size={16} /></button>
              </div>
            </article>
          )
        })}
      </div>
      <div className="quiet-note"><Heart size={14} fill="currentColor" /> You can never have too many playlists.</div>
    </div>
  )
}
