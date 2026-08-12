import { useState, useEffect } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from './firebase'

const NAVY = '#1f2b5e'

function fmt(n) {
  return `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function HistorialCortes({ onBack, onGuardarCorte, saldosSemana = [] }) {
  const [cortes,    setCortes]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [guardando, setGuardando] = useState(false)

  const load = async () => {
    setLoading(true)
    const snap = await getDocs(collection(db, 'cortes_semana'))
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    rows.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
    setCortes(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGuardar = async () => {
    setGuardando(true)
    try {
      await onGuardarCorte()
      await load()
    } finally {
      setGuardando(false)
    }
  }

  // Semilla más antigua (mismo criterio que Dashboard/ConcentradoIngresos)
  const seed = saldosSemana.reduce((earliest, s) => (
    !earliest || s.id < earliest.id ? s : earliest
  ), null) || { efectivoBkl: 0, efectivoSr: 0, bancos: 0, bancosJorge: 0 }

  return (
    <div style={{
      minHeight: '100vh', background: '#eceaee',
      fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      padding: '24px 16px 60px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ArrowLeft size={22} color={NAVY} />
        </button>
        <h2 style={{ margin: 0, color: NAVY, fontSize: 20, fontWeight: 800 }}>Historial de Cortes</h2>
      </div>

      <p style={{ color: '#777', fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        Guarda un corte cuando ya hayas verificado que la semana está
        completa y cuadrada (por ejemplo, después de reconciliar contra
        el banco). Un corte guardado queda congelado para siempre — así,
        si algo se descuadra más adelante, solo hay que recalcular desde
        el último corte, no desde el inicio.
      </p>

      <button
        onClick={handleGuardar}
        disabled={guardando}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, background: NAVY, color: '#fff',
          border: 'none', borderRadius: 12, padding: '12px 18px', fontSize: 14, fontWeight: 700,
          cursor: guardando ? 'default' : 'pointer', marginBottom: 24, opacity: guardando ? 0.6 : 1,
        }}
      >
        <Save size={16} />
        {guardando ? 'Guardando…' : 'Guardar corte de la semana'}
      </button>

      {loading ? (
        <div style={{ color: '#888', fontSize: 14 }}>Cargando…</div>
      ) : cortes.length === 0 ? (
        <div style={{ color: '#888', fontSize: 14 }}>Aún no hay cortes guardados.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cortes.map(c => {
            const efBkl   = (seed.efectivoBkl   || 0) + (c.prevBklEf         || 0) - (c.prevBklEfGast         || 0)
            const bkDay   = (seed.bancos        || 0) + (c.prevBklBancoDay   || 0) - (c.prevBklBancoGast      || 0)
            const bkJorge = (seed.bancosJorge   || 0) + (c.prevBklBancoJorge || 0) - (c.prevBklBancoJorgeGast || 0)
            const efSr    = (seed.efectivoSr    || 0) + (c.prevSrEfV         || 0) - (c.prevSrEfS             || 0)
            const srDay   = (c.prevSrBancoDayV   || 0) - (c.prevSrBancoDayS   || 0)
            const srJorge = (c.prevSrBancoJorgeV || 0) - (c.prevSrBancoJorgeS || 0)
            const total   = efBkl + bkDay + bkJorge + efSr + srDay + srJorge

            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <strong style={{ color: NAVY, fontSize: 15 }}>{c.id}</strong>
                  <span style={{
                    fontSize: 10, color: '#888', textTransform: 'uppercase',
                    background: '#f0f0f4', borderRadius: 6, padding: '2px 8px', fontWeight: 700,
                  }}>
                    {c.tipo === 'manual' ? 'Manual' : 'Automático'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.8 }}>
                  <div>Efectivo BKL: {fmt(efBkl)}</div>
                  <div>Banco Day BKL: {fmt(bkDay)}</div>
                  <div>Banco JORGE BKL: {fmt(bkJorge)}</div>
                  <div>Efectivo SR: {fmt(efSr)}</div>
                  <div>Banco Day SR: {fmt(srDay)}</div>
                  <div>Banco JORGE SR: {fmt(srJorge)}</div>
                </div>
                <div style={{ marginTop: 8, fontWeight: 800, color: NAVY, fontSize: 15 }}>
                  Total: {fmt(total)}
                </div>
                {c.savedAt && (
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
                    Guardado: {new Date(c.savedAt).toLocaleString('es-MX')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
