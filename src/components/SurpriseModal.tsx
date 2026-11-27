import { Heart } from 'lucide-react'
import { useLibrary } from '../context/LibraryContext'
import { HeartField } from './HeartField'
import { Modal } from './Modal'

interface SurpriseModalProps {
  open: boolean
  onClose: () => void
}

export function SurpriseModal({ open, onClose }: SurpriseModalProps) {
  const { settings } = useLibrary()

  return (
    <Modal open={open} onClose={onClose} title="A little surprise" size="small" className="surprise-modal">
      <div className="surprise">
        <HeartField count={8} />
        <div className="surprise__heart"><Heart size={42} fill="currentColor" /></div>
        <span className="eyebrow">Just for you</span>
        <p>{settings.surpriseMessage}</p>
        <div className="surprise__signature">Always yours ♥</div>
      </div>
    </Modal>
  )
}
