import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { getCoverUrl } from '../lib/mediaUrls'
import type { Track } from '../types'

interface CoverArtProps {
  track?: Track | null
  className?: string
  label?: string
}

function hash(value: string): number {
  let result = 0
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) % 360
  return result
}

export function CoverArt({ track, className = '', label }: CoverArtProps) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setUrl(null)
    void getCoverUrl(track?.id).then((nextUrl) => {
      if (active) setUrl(nextUrl)
    })
    return () => {
      active = false
    }
  }, [track?.id, track?.coverMimeType])

  const hue = hash(track?.id ?? 'little-playlist')
  const style = { '--cover-hue': `${hue}deg` } as React.CSSProperties

  return (
    <div className={`cover-art ${className}`} style={style} aria-label={label ?? (track ? `Cover art for ${track.title || 'untitled song'}` : 'Playlist artwork')}>
      {url ? <img src={url} alt="" loading="lazy" /> : <Heart className="cover-art__heart" aria-hidden="true" />}
    </div>
  )
}
