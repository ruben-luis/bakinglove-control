import { useEffect } from 'react'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'

function fireConfetti() {
  const colors = ['#C3B0E6', '#F4A9BE', '#AFCBA0', '#A6CDEC']
  const duration = 1600
  const end = Date.now() + duration
  ;(function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 60, origin: { x: 0.1, y: 0.25 }, colors })
    confetti({ particleCount: 3, angle: 120, spread: 60, origin: { x: 0.9, y: 0.25 }, colors })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()
  confetti({ particleCount: 70, spread: 90, origin: { y: 0.35 }, colors })
}

export default function CdjWelcomeModal({ onGoToCdj, onClose }) {
  useEffect(() => {
    const t = setTimeout(fireConfetti, 150)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(43,39,49,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 18,
    }}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 24 }}
        style={{
          width: '100%', maxWidth: 340, background: '#fff',
          borderRadius: 22, border: '3px solid #2b2731',
          boxShadow: '7px 7px 0 #2b2731',
          padding: '26px 20px 20px', textAlign: 'center',
        }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: '#E9E0F6', border: '3px solid #2b2731',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '-46px auto 12px', fontSize: 30,
        }}>
          🎉
        </div>

        <div style={{
          fontFamily: '"Quicksand", "Plus Jakarta Sans", sans-serif',
          fontWeight: 800, fontSize: 18.5, color: '#1f2b5e',
          margin: '0 0 8px', lineHeight: 1.25,
        }}>
          ¡Felicidades por tu nueva sucursal!
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: '#55505c', margin: '0 0 18px' }}>
          CD Judicial ya está lista para trabajar. Mucho éxito en esta nueva etapa.
        </p>

        <button
          onClick={onGoToCdj}
          style={{
            width: '100%', background: '#1f2b5e', color: '#fff',
            border: '3px solid #2b2731', borderRadius: 14, padding: 12,
            fontSize: 14, fontWeight: 800, boxShadow: '4px 4px 0 #2b2731',
            cursor: 'pointer', marginBottom: 8, fontFamily: 'inherit',
          }}
        >
          Ir a CD Judicial
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', background: 'transparent', color: '#9a94a3',
            border: 'none', padding: 6, fontSize: 12.5, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline',
          }}
        >
          Cerrar
        </button>
      </motion.div>
    </div>
  )
}
