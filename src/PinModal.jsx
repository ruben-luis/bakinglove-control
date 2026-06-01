import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Delete } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from './firebase'

const DEFAULT_PIN = '1234'
const PIN_REF = () => doc(db, 'config', 'pin')

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function savePin(pin) {
  const hash = await sha256(pin)
  await setDoc(PIN_REF(), { hash })
  localStorage.setItem('bkl_pin', hash)
}

async function getStoredHash() {
  // 1. Intentar caché local (rápido, funciona offline)
  const cached = localStorage.getItem('bkl_pin')
  if (cached && cached.length === 64) return cached

  // 2. Leer de Firestore (fuente de verdad compartida entre dispositivos)
  try {
    const snap = await getDoc(PIN_REF())
    if (snap.exists()) {
      const hash = snap.data().hash
      if (hash) {
        localStorage.setItem('bkl_pin', hash)
        return hash
      }
    }
  } catch {
    // Sin conexión: usar caché aunque sea texto plano
    if (cached) return cached
  }
  return null
}

export async function verifyPin(entered) {
  const stored = await getStoredHash()
  if (!stored) {
    const match = entered === DEFAULT_PIN
    if (match) await savePin(entered)
    return match
  }
  if (stored.length < 64) {
    // Texto plano (migración desde versión anterior)
    const match = entered === stored
    if (match) await savePin(entered)
    return match
  }
  return (await sha256(entered)) === stored
}

export default function PinModal({ title, mode = 'verify', onSuccess, onCancel }) {
  const [digits, setDigits] = useState([])
  const [shaking, setShaking] = useState(false)
  const [error, setError] = useState('')

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'DEL']

  function press(k) {
    if (k === 'DEL') {
      setDigits(d => d.slice(0, -1))
      setError('')
      return
    }
    if (digits.length >= 4 || shaking) return
    const next = [...digits, k]
    setDigits(next)
    setError('')
    if (next.length === 4) {
      setTimeout(() => handleComplete(next), 120)
    }
  }

  async function handleComplete(d) {
    const entered = d.join('')
    if (mode === 'verify') {
      const ok = await verifyPin(entered)
      if (ok) {
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
      background: 'rgba(43,39,49,0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <motion.div
        initial={{ scale: 0.82, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 24 }}
        style={{ width: '100%', maxWidth: 380 }}
      >
        <motion.div
          animate={shaking ? { x: [0, -14, 14, -10, 10, -5, 5, 0] } : { x: 0 }}
          transition={shaking ? { duration: 0.55 } : { duration: 0 }}
          style={{
            background: '#fdfaf8',
            borderRadius: 32,
            border: '2.5px solid #2b2731',
            boxShadow: '7px 7px 0 #2b2731',
            padding: '30px 28px 28px',
            position: 'relative',
          }}
        >
          {/* Close */}
          <button
            onClick={onCancel}
            style={{
              position: 'absolute', top: 16, right: 16,
              background: '#f0ebe5', border: '2px solid #2b2731',
              borderRadius: 12, cursor: 'pointer',
              width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '2px 2px 0 #2b2731',
            }}
          >
            <X size={16} color="#2b2731" strokeWidth={2.5} />
          </button>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 24, paddingRight: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#2b2731', letterSpacing: -0.3 }}>
              {title || (mode === 'verify' ? 'Ingresa tu NIP' : 'Nuevo NIP')}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 700, marginTop: 6,
              color: '#e53e5e',
              minHeight: 18,
              visibility: error ? 'visible' : 'hidden',
            }}>
              {error}
            </div>
          </div>

          {/* Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 30 }}>
            {[0, 1, 2, 3].map(i => (
              <motion.div
                key={i}
                animate={{ scale: i < digits.length ? [1, 1.35, 1] : 1 }}
                transition={{ duration: 0.18 }}
                style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: '2.5px solid #d9748f',
                  background: i < digits.length ? '#d9748f' : 'transparent',
                  boxShadow: i < digits.length ? '0 0 0 4px rgba(217,116,143,0.18)' : 'none',
                  transition: 'background 0.12s, box-shadow 0.12s',
                }}
              />
            ))}
          </div>

          {/* Keypad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {KEYS.map((k, idx) => {
              if (k === '') return <div key={idx} />
              const isDel = k === 'DEL'
              return (
                <button
                  key={idx}
                  onClick={() => press(k)}
                  style={{
                    height: 72,
                    borderRadius: 18,
                    border: '2px solid #2b2731',
                    background: isDel ? '#fce7ef' : '#fff',
                    color: '#2b2731',
                    fontSize: isDel ? 14 : 28,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '4px 4px 0 #2b2731',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onPointerDown={e => {
                    e.currentTarget.style.transform = 'translate(3px,3px)'
                    e.currentTarget.style.boxShadow = '1px 1px 0 #2b2731'
                  }}
                  onPointerUp={e => {
                    e.currentTarget.style.transform = ''
                    e.currentTarget.style.boxShadow = '4px 4px 0 #2b2731'
                  }}
                  onPointerLeave={e => {
                    e.currentTarget.style.transform = ''
                    e.currentTarget.style.boxShadow = '4px 4px 0 #2b2731'
                  }}
                >
                  {isDel
                    ? <Delete size={22} strokeWidth={2} color="#d9748f" />
                    : k}
                </button>
              )
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
