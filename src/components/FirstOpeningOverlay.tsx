import { Heart } from 'lucide-react'
import { useLibrary } from '../context/LibraryContext'
import { HeartField } from './HeartField'
import { Modal } from './Modal'

interface FirstOpeningOverlayProps {
  open: boolean
  onFinish: () => void
}

export function FirstOpeningOverlay({ open, onFinish }: FirstOpeningOverlayProps) {
  const { settings } = useLibrary()

  return (
    <Modal open={open} onClose={onFinish} title="Welcome, my love" size="small" className="first-opening-modal">
      <div className="first-opening">
        <HeartField count={8} />
        <div className="first-opening__heart"><Heart size={46} fill="currentColor" /></div>
        <h2>I made this for us.</h2>
        <p>{settings.anniversaryMessage}</p>
        <button type="button" className="button button--primary" onClick={onFinish}>Open our little world</button>
      </div>
    </Modal>
  )
}
