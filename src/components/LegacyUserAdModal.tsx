import { useMemo } from 'react'
import { pickRandomPromoAd } from '../utils/userPromo'

interface LegacyUserAdModalProps {
  open: boolean
  onClose: () => void
}

export function LegacyUserAdModal({ open, onClose }: LegacyUserAdModalProps) {
  const ad = useMemo(() => (open ? pickRandomPromoAd() : null), [open])

  if (!open || !ad) return null

  return (
    <div className="ad-modal-backdrop" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ad-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="ad-modal-tag">Sponsored</p>
        <h2 className="ad-modal-title">{ad.title}</h2>
        <p className="ad-modal-body">{ad.body}</p>
        <button type="button" className="btn btn-primary ad-modal-cta" onClick={onClose}>
          {ad.cta}
        </button>
        <button type="button" className="ad-modal-dismiss" onClick={onClose}>
          Close and continue
        </button>
      </div>
    </div>
  )
}
