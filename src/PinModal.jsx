import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'

const DEFAULT_PIN = '1234'

export function getStoredPin() {
  return localStorage.getItem('bkl_pin') || DEFAULT_PIN
}

export function savePin(pin) {
  localStorage.setItem('bkl_pin', pin)
}

// mode: 'verify' | 'enter-new'
// onSuccess(): called on correct PIN (verify) or onSuccess(pin) with new pin (enter-new)
export default function PinModal({ title, mode = 'verify', onSuccess, onCancel }) {
  const [digits, setDigits] = useState([])
  const [shaking, setShaking] = useState(false)
  const [error, setError] = useState('')

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

  function press(k) {
    if (k === '⌫') {
      setDigits(d => d.slice(0, -1))
      setError('')
      return
    }
    if (digits.length >= 4 || shaking) return
    const next = [...digits, k]
    setDigits(next)
    setError('')
    if (next.length === 4) {
      setTimeout(() => handleComplete(next), 110)
    }
  }

  function handleComplete(d) {
    const entered = d.join('')
    if (mode === 'verify') {
      if (entered === getStoredPin()) {
        onSuccess()
      } else {
        setShaking(true)
        setError('NIP incorrecto')
        setTimeout(() => {
          setShaking(false)
          setDigits([])
          setError('')
        }, 700)
      }
    } else {
      onSuccess(entered)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(43,39,49,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      >
        <motion.div
          animate={shaking ? { x: [0, -12, 12, -8, 8, -4, 4, 0] } : { x: 0 }}
          transition={shaking ? { duration: 0.55 } : { duration: 0 }}
          style={{
            background: '#fff',
            borderRadius: 28,
            border: '2px solid #2b2731',
            boxShadow: '6px 6px 0 #2b2731',
            padding: '28px 24px 24px',
            width: '100%',
            maxWidth: 300,
            position: 'relative',
          }}
        >
          <button
            onClick={onCancel}
            style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 1 }}
          >
            <X size={20} color="#2b2731" strokeWidth={2.5} />
          </button>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#2b2731', marginBottom: 6 }}>
              {title || (mode === 'verify' ? 'Ingresa tu NIP' : 'Nuevo NIP')}
            </div>
            <div style={{ fontSize: 12, color: '#e53e5e', fontWeight: 700, minHeight: 16, visibility: error ? 'visible' : 'hidden' }}>
              {error}
            </div>
          </div>

          {/* 4 dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 26 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '2.5px solid #d9748f',
                background: i < digits.length ? '#d9748f' : 'transparent',
                transition: 'background 0.12s',
              }} />
            ))}
          </div>

          {/* Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {KEYS.map((k, idx) => {
              if (k === '') return <div key={idx} />
              const isBack = k === '⌫'
              return (
                <button
                  key={idx}
                  onClick={() => press(k)}
                  style={{
                    height: 54,
                    borderRadius: 14,
                    border: '2px solid #2b2731',
                    background: isBack ? '#fce7ef' : '#fff',
                    color: '#2b2731',
                    fontSize: 20,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '3px 3px 0 #2b2731',
                    transition: 'transform 0.08s, box-shadow 0.08s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPointerDown={e => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #2b2731' }}
                  onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0 #2b2731' }}
                  onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0 #2b2731' }}
                >
                  {k}
                </button>
              )
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
