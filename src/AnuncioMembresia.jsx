import { motion } from 'framer-motion'

export default function AnuncioMembresia({ onClose }) {
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
          background: '#FBE3C8', border: '3px solid #2b2731',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '-46px auto 12px', fontSize: 30,
        }}>
          ⚠️
        </div>

        <div style={{
          fontFamily: '"Quicksand", "Plus Jakarta Sans", sans-serif',
          fontWeight: 800, fontSize: 18.5, color: '#1f2b5e',
          margin: '0 0 8px', lineHeight: 1.25,
        }}>
          Fecha límite de pago: hoy
        </div>
        <p style={{ fontSize: 13.5, lineHeight: 1.5, color: '#55505c', margin: '0 0 18px' }}>
          Aún no se ha registrado tu pago de membresía. Por favor realiza tu pago para evitar interrupciones en el servicio.
        </p>

        <button
          onClick={onClose}
          style={{
            width: '100%', background: '#1f2b5e', color: '#fff',
            border: '3px solid #2b2731', borderRadius: 14, padding: 12,
            fontSize: 14, fontWeight: 800, boxShadow: '4px 4px 0 #2b2731',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Entendido
        </button>
      </motion.div>
    </div>
  )
}
