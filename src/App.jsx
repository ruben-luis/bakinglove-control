import { useState, useEffect } from 'react'
import './index.css'
import { db } from './firebase'
import {
  collection, onSnapshot,
  doc, setDoc, deleteDoc, getDoc, runTransaction,
} from 'firebase/firestore'
import Dashboard from './Dashboard'
import NotaDeVenta from './NotaDeVenta'
import HistorialNotas from './HistorialNotas'
import ConcentradoIngresos from './ConcentradoIngresos'
import ConcentradoGastos from './ConcentradoGastos'
import CalendarioEntregas from './CalendarioEntregas'
import SanRamonView from './SanRamonView'
import PinModal, { savePin } from './PinModal'

export default function App() {
  const [view,         setView]         = useState('dashboard')
  const [notas,        setNotas]        = useState([])
  const [gastos,       setGastos]       = useState([])
  const [srRows,       setSrRows]       = useState([])
  const [saldosSemana, setSaldosSemana] = useState([])
  const [pinAction,    setPinAction]    = useState(null)
  const [loading,      setLoading]      = useState(true)

  // ── Suscripción en tiempo real a Firestore ────────────────────
  useEffect(() => {
    const loaded = { notas: false, gastos: false, sr: false }
    const check  = () => {
      if (loaded.notas && loaded.gastos && loaded.sr) setLoading(false)
    }

    const unsubNotas = onSnapshot(collection(db, 'notas'), snap => {
      const data = snap.docs.map(d => d.data())
      setNotas(data)
      // Sincronizar contador de folio con Firestore
      localStorage.setItem('bkl_folio_count', String(data.length))
      loaded.notas = true; check()
    })
    const unsubGastos = onSnapshot(collection(db, 'gastos'), snap => {
      setGastos(snap.docs.map(d => d.data()))
      loaded.gastos = true; check()
    })
    const unsubSR = onSnapshot(collection(db, 'sanramon_rows'), snap => {
      setSrRows(snap.docs.map(d => d.data()))
      loaded.sr = true; check()
    })
    onSnapshot(collection(db, 'saldos_semana'), snap => {
      setSaldosSemana(snap.docs.map(d => d.data()))
    })

    return () => { unsubNotas(); unsubGastos(); unsubSR() }
  }, [])

  // ── Auto-cálculo de saldo inicial cada lunes ──────────────────
  useEffect(() => {
    if (loading) return

    const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

    const today = new Date()
    const mon   = new Date(today)
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7))
    const currentKey = toISO(mon)

    if (saldosSemana.find(s => s.id === currentKey)) return

    const prevMon = new Date(mon)
    prevMon.setDate(mon.getDate() - 7)
    const prevKey   = toISO(prevMon)
    const prevSaldo = saldosSemana.find(s => s.id === prevKey)
    if (!prevSaldo) return

    const prevSun = new Date(prevMon)
    prevSun.setDate(prevMon.getDate() + 6)
    prevSun.setHours(23, 59, 59, 999)
    prevMon.setHours(0, 0, 0, 0)

    const inPrev = f => {
      const d = new Date(f.length === 10 ? f + 'T12:00:00' : f)
      return d >= prevMon && d <= prevSun
    }

    let bklIngEf = 0, bklIngBanco = 0
    notas.filter(n => inPrev(n.createdAt)).forEach(n =>
      (n.pagos || []).forEach(p => {
        const m = parseFloat(p.monto) || 0
        if (p.metodoPago === 'Efectivo') bklIngEf    += m
        if (p.metodoPago === 'Terminal' || p.metodoPago === 'Transferencia') bklIngBanco += m
      })
    )

    let bklGastoEf = 0, bklGastoBanco = 0
    gastos.filter(g => inPrev(g.fecha || g.createdAt)).forEach(g => {
      const m = parseFloat(g.monto) || 0
      if (g.formaPago === 'Efectivo')                                      bklGastoEf    += m
      if (g.formaPago === 'Tarjeta' || g.formaPago === 'Transferencia')    bklGastoBanco += m
    })

    let srVentasEf = 0, srSalidasEf = 0, srVentasBanco = 0, srSalidasBanco = 0
    srRows.filter(r => r.fecha && inPrev(r.fecha)).forEach(r => {
      const m = parseFloat(r.precio) || 0
      if (r.tipo === 'venta'  && r.metodo === 'Efectivo') srVentasEf    += m
      if (r.tipo === 'salida' && r.metodo === 'Efectivo') srSalidasEf   += m
      if (r.tipo === 'venta'  && r.metodo === 'Banco')    srVentasBanco  += m
      if (r.tipo === 'salida' && r.metodo === 'Banco')    srSalidasBanco += m
    })

    setDoc(doc(db, 'saldos_semana', currentKey), {
      id:          currentKey,
      efectivoBkl: (prevSaldo.efectivoBkl || 0) + bklIngEf    - bklGastoEf,
      efectivoSr:  (prevSaldo.efectivoSr  || 0) + srVentasEf  - srSalidasEf,
      bancos:      (prevSaldo.bancos      || 0) + bklIngBanco + srVentasBanco - bklGastoBanco - srSalidasBanco,
      updatedAt:   new Date().toISOString(),
    })
  }, [loading, saldosSemana, notas, gastos, srRows])

  // ── CRUD notas ────────────────────────────────────────────────
  const handleSaveNota = async (nota) => {
    const counterRef = doc(db, 'config', 'folio_counter')
    const currentNotas = notas
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef)
      const current = snap.exists()
        ? snap.data().current
        : currentNotas.reduce((max, n) => Math.max(max, parseInt(n.folio?.replace('#', '') || '0')), 0)
      const nextFolio = current + 1
      tx.set(counterRef, { current: nextFolio })
      tx.set(doc(db, 'notas', nota.id), { ...nota, folio: `#${nextFolio}` })
    })
    setView('historial')
  }

  const handleEditNota = (notaEditada) => {
    setDoc(doc(db, 'notas', notaEditada.id), notaEditada)
  }

  const handleDeleteNota = async (notaId) => {
    await deleteDoc(doc(db, 'notas', notaId))
    const remaining = notas.filter(n => n.id !== notaId)
    const maxFolio  = remaining.reduce((max, n) => Math.max(max, parseInt(n.folio?.replace('#', '') || '0')), 0)
    await setDoc(doc(db, 'config', 'folio_counter'), { current: maxFolio })
  }

  // ── CRUD gastos ───────────────────────────────────────────────
  const handleSaveGastos = (updatedGastos) => {
    const oldIds = new Set(gastos.map(g => g.id))
    const newIds = new Set(updatedGastos.map(g => g.id))
    const deletes = [...oldIds].filter(id => !newIds.has(id))
    deletes.forEach(id => deleteDoc(doc(db, 'gastos', id)))
    updatedGastos.forEach(g => setDoc(doc(db, 'gastos', g.id), g))
  }

  // ── Navegación / PIN ──────────────────────────────────────────
  function navigate(dest) {
    if (dest === 'concentrado' || dest === 'gastos') {
      setPinAction('nav-' + dest)
    } else {
      setView(dest)
    }
  }

  function handlePinSuccess(pin) {
    if (pinAction === 'nav-concentrado') { setView('concentrado'); setPinAction(null) }
    else if (pinAction === 'nav-gastos') { setView('gastos'); setPinAction(null) }
    else if (pinAction === 'change-verify') { setPinAction('change-new') }
    else if (pinAction === 'change-new') { savePin(pin).then(() => setPinAction(null)) }
  }

  const pinTitle = pinAction === 'change-new' ? 'Ingresa tu nuevo NIP' : 'Ingresa tu NIP'
  const pinMode  = pinAction === 'change-new' ? 'enter-new' : 'verify'

  // ── Pantalla de carga inicial ─────────────────────────────────
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#eceaee', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
        gap: 16,
      }}>
        <img src="/bakinglove-logo.png" alt="Bakinglove"
          style={{ width: 90, opacity: 0.85 }} />
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>
          Cargando datos…
        </div>
      </div>
    )
  }

  // ── Vistas ────────────────────────────────────────────────────
  let content
  if (view === 'nota') {
    content = <NotaDeVenta onBack={() => setView('dashboard')} onSave={handleSaveNota} />
  } else if (view === 'historial') {
    content = <HistorialNotas notas={notas} onBack={() => setView('dashboard')} onEdit={handleEditNota} onDelete={handleDeleteNota} />
  } else if (view === 'concentrado') {
    content = <ConcentradoIngresos notas={notas} gastos={gastos} srRows={srRows} saldosSemana={saldosSemana} onBack={() => setView('dashboard')} />
  } else if (view === 'gastos') {
    content = <ConcentradoGastos gastos={gastos} srRows={srRows} onSave={handleSaveGastos} onBack={() => setView('dashboard')} />
  } else if (view === 'calendario') {
    content = <CalendarioEntregas notas={notas} onBack={() => setView('dashboard')} />
  } else if (view === 'sanramon') {
    content = <SanRamonView onBack={() => setView('dashboard')} onSrChange={setSrRows} />
  } else {
    content = (
      <Dashboard
        onNavigate={navigate}
        notas={notas}
        gastos={gastos}
        srRows={srRows}
        saldosSemana={saldosSemana}
        onSrChange={setSrRows}
        onChangePinRequest={() => setPinAction('change-verify')}
      />
    )
  }

  return (
    <>
      {content}
      {pinAction && (
        <PinModal
          key={pinAction}
          title={pinTitle}
          mode={pinMode}
          onSuccess={handlePinSuccess}
          onCancel={() => setPinAction(null)}
        />
      )}
    </>
  )
}
