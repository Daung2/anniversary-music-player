import type { CSSProperties } from 'react'

interface HeartFieldProps {
  count?: number
  className?: string
}

const positions = [8, 28, 47, 67, 84, 16, 73, 39]
const delays = [0, 1.7, 3.2, 0.9, 2.4, 4.1, 1.2, 3.7]
const durations = [11, 14, 12, 15, 13, 16, 12.5, 14.5]
const sizes = [14, 10, 18, 12, 15, 9, 13, 17]

export function HeartField({ count = 5, className = '' }: HeartFieldProps) {
  return (
    <div className={`heart-field ${className}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="heart-field__heart"
          style={
            {
              '--heart-x': `${positions[index % positions.length]}%`,
              '--heart-delay': `${delays[index % delays.length]}s`,
              '--heart-duration': `${durations[index % durations.length]}s`,
              '--heart-size': `${sizes[index % sizes.length]}px`,
            } as CSSProperties
          }
        >
          ♥
        </span>
      ))}
    </div>
  )
}
