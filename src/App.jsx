import { useState, useEffect } from 'react'
import './index.css'
import { db } from './firebase'
import {
  collection, onSnapshot,
  doc, setDoc, deleteDoc,
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
  const [view,      setView]      = useState('dashboard')
  const [notas,     setNotas]     = useState([])
  const [gastos,    setGastos]    = useState([])
  const [srRows,    setSrRows]    = useState([])
  const [pinAction, setPinAction] = useState(null)
  const [loading,   setLoading]   = useState(true)

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

    return () => { unsubNotas(); unsubGastos(); unsubSR() }
  }, [])

  // ── CRUD notas ────────────────────────────────────────────────
  const handleSaveNota = async (nota) => {
    await setDoc(doc(db, 'notas', nota.id), nota)
    setView('historial')
  }

  const handleEditNota = async (notaEditada) => {
    await setDoc(doc(db, 'notas', notaEditada.id), notaEditada)
  }

  const handleDeleteNota = async (notaId) => {
    await deleteDoc(doc(db, 'notas', notaId))
  }

  // ── CRUD gastos ───────────────────────────────────────────────
  const handleSaveGastos = async (updatedGastos) => {
    const oldIds = new Set(gastos.map(g => g.id))
    const newIds = new Set(updatedGastos.map(g => g.id))
    const deletes = [...oldIds].filter(id => !newIds.has(id))
    await Promise.all([
      ...deletes.map(id => deleteDoc(doc(db, 'gastos', id))),
      ...updatedGastos.map(g => setDoc(doc(db, 'gastos', g.id), g)),
    ])
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
    content = <ConcentradoIngresos notas={notas} gastos={gastos} srRows={srRows} onBack={() => setView('dashboard')} />
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
