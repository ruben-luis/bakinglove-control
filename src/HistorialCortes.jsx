import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Trash2 } from 'lucide-react'
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

const NAVY = '#1f2b5e'

function fmt(n) {
  return `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function HistorialCortes({ onBack, onGuardarCorte, saldosSemana = [] }) {
  const [cortes,    setCortes]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [borrando,  setBorrando]  = useState(null)

  const load = async () => {
    setLoading(true)
    const snap = await getDocs(collection(db, 'cortes_semana'))
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    rows.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
    setCortes(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/set-state-in-effect

  const handleGuardar = async () => {
    setGuardando(true)
    try {
      await onGuardarCorte()
      await load()
    } finally {
      setGuardando(false)
    }
  }

  const handleBorrar = async (id) => {
    if (!window.confirm('¿Borrar este corte? Esta acción no se puede deshacer.')) return
    setBorrando(id)
    try {
      await deleteDoc(doc(db, 'cortes_semana', id))
      await load()
    } finally {
      setBorrando(null)
    }
  }

  // Semilla más antigua (mismo criterio que Dashboard/ConcentradoIngresos)
  const seed = saldosSemana.reduce((earliest, s) => (
    !earliest || s.id < earliest.id ? s : earliest
  ), null) || { efectivoBkl: 0, efectivoSr: 0, bancos: 0, bancosJorge: 0 }

  // Orden cronológico (viejo → nuevo) para poder comparar cada corte
  // contra el inmediatamente anterior y sacar "cuánto entró" en ese periodo.
  const cortesAsc = [...cortes].sort((a, b) => (a.savedAt || '').localeCompare(b.savedAt || ''))
  const ingresoAcumulado = c => (c.prevBklEf || 0) + (c.prevBklBancoDay || 0) + (c.prevBklBancoJorge || 0)
    + (c.prevSrEfV || 0) + (c.prevSrBancoDayV || 0) + (c.prevSrBancoJorgeV || 0)

  // Cuánto entró (ingreso bruto) entre este corte y el anterior. El
  // corte más viejo no tiene con qué compararse → null (sin dato).
  const ganadoDesdeCorteAnterior = c => {
    const idx = cortesAsc.findIndex(x => x.id === c.id)
    if (idx <= 0) return null
    return ingresoAcumulado(c) - ingresoAcumulado(cortesAsc[idx - 1])
  }

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
            // Efectivo BKL/SR van por caja separada, pero Banco Day y
            // Banco JORGE son cuentas compartidas entre sucursales (mismo
            // criterio que ConcentradoIngresos/Dashboard) — no se dividen
            // por sucursal para no inventar un desglose que no existe.
            const efBkl   = (seed.efectivoBkl  || 0) + (c.prevBklEf         || 0) - (c.prevBklEfGast         || 0)
            const efSr    = (seed.efectivoSr   || 0) + (c.prevSrEfV         || 0) - (c.prevSrEfS             || 0)
            const bkDay   = (seed.bancos       || 0) + (c.prevBklBancoDay   || 0) - (c.prevBklBancoGast      || 0)
                            + (c.prevSrBancoDayV   || 0) - (c.prevSrBancoDayS   || 0)
            const bkJorge = (seed.bancosJorge  || 0) + (c.prevBklBancoJorge || 0) - (c.prevBklBancoJorgeGast || 0)
                            + (c.prevSrBancoJorgeV || 0) - (c.prevSrBancoJorgeS || 0)
            const total   = efBkl + efSr + bkDay + bkJorge
            const ganado  = ganadoDesdeCorteAnterior(c)

            return (
              <div key={c.id} style={{ background: '#fff', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <strong style={{ color: NAVY, fontSize: 15 }}>{c.id}</strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 10, color: '#888', textTransform: 'uppercase',
                      background: '#f0f0f4', borderRadius: 6, padding: '2px 8px', fontWeight: 700,
                    }}>
                      {c.tipo === 'manual' ? 'Manual' : 'Automático'}
                    </span>
                    <button
                      onClick={() => handleBorrar(c.id)}
                      disabled={borrando === c.id}
                      style={{
                        background: 'none', border: 'none', cursor: borrando === c.id ? 'default' : 'pointer',
                        padding: 4, opacity: borrando === c.id ? 0.4 : 1,
                      }}
                    >
                      <Trash2 size={15} color="#c0392b" />
                    </button>
                  </div>
                </div>
                {ganado !== null && (
                  <div style={{ textAlign: 'right', fontSize: 11, color: '#9a9aa5', marginTop: -4, marginBottom: 8 }}>
                    Ganó esta semana: {fmt(ganado)}
                  </div>
                )}
                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.8 }}>
                  <div>Efectivo BKL: {fmt(efBkl)}</div>
                  <div>Efectivo SR: {fmt(efSr)}</div>
                  <div>Banco Day (BKL+SR): {fmt(bkDay)}</div>
                  <div>Banco JORGE (BKL+SR): {fmt(bkJorge)}</div>
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
