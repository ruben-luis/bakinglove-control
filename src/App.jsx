import { useState, useEffect } from 'react'
import './index.css'
import { db } from './firebase'
import {
  collection, onSnapshot, query, where,
  doc, setDoc, deleteDoc, getDoc, getDocs, runTransaction,
} from 'firebase/firestore'
import {
  getCurrentMonday, rolloverBalance, computeBalanceFull,
  applyNotaEditDiff, applyGastosEditDiff,
} from './balance'
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
  const [pinAction,     setPinAction]    = useState(null)
  const [loading,       setLoading]      = useState(true)
  const [editingNota,   setEditingNota]  = useState(null)
  const [balanceActual, setBalanceActual] = useState(null)

  // ── Suscripción en tiempo real a Firestore ────────────────────
  useEffect(() => {
    const loaded = { notas: false, gastos: false, sr: false }
    const check  = () => {
      if (loaded.notas && loaded.gastos && loaded.sr) setLoading(false)
    }

    const d14 = new Date(); d14.setDate(d14.getDate() - 14)
    const fourteenDaysAgo = d14.toISOString()

    const d60 = new Date(); d60.setDate(d60.getDate() - 60)
    const twoMonthsAgo = d60.toISOString().slice(0, 10)

    const unsubNotas = onSnapshot(
      query(collection(db, 'notas'), where('createdAt', '>=', fourteenDaysAgo)),
      snap => {
        setNotas(snap.docs.map(d => d.data()))
        loaded.notas = true; check()
      }
    )
    const unsubGastos = onSnapshot(
      query(collection(db, 'gastos'), where('fecha', '>=', twoMonthsAgo)),
      snap => {
        setGastos(snap.docs.map(d => d.data()))
        loaded.gastos = true; check()
      }
    )
    const unsubSR = onSnapshot(
      query(collection(db, 'sanramon_rows'), where('fecha', '>=', twoMonthsAgo)),
      snap => {
        setSrRows(snap.docs.map(d => d.data()))
        loaded.sr = true; check()
      }
    )
    const unsubSaldos = onSnapshot(collection(db, 'saldos_semana'), snap => {
      setSaldosSemana(snap.docs.map(d => d.data()))
    })

    return () => { unsubNotas(); unsubGastos(); unsubSR(); unsubSaldos() }
  }, [])

  // ── Balance pre-computado (se inicializa una vez al cargar) ──
  useEffect(() => {
    if (loading) return
    const weekStart = getCurrentMonday()
    const balRef = doc(db, 'config', 'balance_actual')

    const init = async () => {
      const snap = await getDoc(balRef)
      if (snap.exists()) {
        const saved = snap.data()
        if (saved.weekStart === weekStart) {
          setBalanceActual(saved)
          return
        }
        const daysDiff = Math.floor(
          (new Date(weekStart + 'T12:00:00') - new Date(saved.weekStart + 'T12:00:00'))
          / (1000 * 60 * 60 * 24)
        )
        if (daysDiff > 0 && daysDiff <= 14) {
          const rolled = rolloverBalance(saved, notas, gastos, srRows, weekStart)
          setBalanceActual(rolled)
          await setDoc(balRef, rolled)
          return
        }
      }
      // Sin documento o demasiado antiguo → lectura completa (única vez)
      const [notasSnap, gastosSnap, srSnap] = await Promise.all([
        getDocs(collection(db, 'notas')),
        getDocs(collection(db, 'gastos')),
        getDocs(collection(db, 'sanramon_rows')),
      ])
      const computed = computeBalanceFull(
        notasSnap.docs.map(d => d.data()),
        gastosSnap.docs.map(d => d.data()),
        srSnap.docs.map(d => d.data()),
        weekStart,
      )
      setBalanceActual(computed)
      await setDoc(balRef, computed)
    }

    init()
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Sync pagos SR de una nota → sanramon_rows ────────────────
  const syncNotaSRPayments = async (nota) => {
    const existing = srRows.filter(r => r.notaId === nota.id)
    await Promise.all(existing.map(r => deleteDoc(doc(db, 'sanramon_rows', r.id))))
    const srPagos = (nota.pagos || []).filter(p => p.sucursal === 'SR' && p.monto && p.fecha && p.metodoPago)
    await Promise.all(srPagos.map((p, idx) => {
      const id = `nota_${nota.id}_sr_${idx}`
      return setDoc(doc(db, 'sanramon_rows', id), {
        id,
        fecha: p.fecha,
        tipo: 'venta',
        producto: `Nota ${nota.folio}`,
        precio: parseFloat(p.monto) || 0,
        metodo: p.metodoPago === 'Efectivo' ? 'Efectivo' : p.metodoPago === 'Banco JORGE' ? 'Banco JORGE' : 'Banco Day',
        fromNota: true,
        notaId: nota.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }))
  }

  // ── CRUD notas ────────────────────────────────────────────────
  const handleSaveNota = async (nota) => {
    const counterRef = doc(db, 'config', 'folio_counter')
    const currentNotas = notas
    let notaFinal = nota
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef)
      const current = snap.exists()
        ? snap.data().current
        : currentNotas.reduce((max, n) => Math.max(max, parseInt(n.folio?.replace('#', '') || '0')), 0)
      const nextFolio = current + 1
      notaFinal = { ...nota, folio: `#${nextFolio}` }
      tx.set(counterRef, { current: nextFolio })
      tx.set(doc(db, 'notas', nota.id), notaFinal)
    })
    await syncNotaSRPayments(notaFinal)
    setView('historial')
  }

  const handleEditNota = async (notaEditada) => {
    let oldNota = notas.find(n => n.id === notaEditada.id)
    if (!oldNota) {
      const snap = await getDoc(doc(db, 'notas', notaEditada.id))
      if (snap.exists()) oldNota = snap.data()
    }
    await setDoc(doc(db, 'notas', notaEditada.id), notaEditada)
    await syncNotaSRPayments(notaEditada)
    if (balanceActual && oldNota) {
      const newBal = applyNotaEditDiff(balanceActual, oldNota, notaEditada)
      setBalanceActual(newBal)
      setDoc(doc(db, 'config', 'balance_actual'), newBal)
    }
  }

  const handleDeleteNota = async (notaId) => {
    let deletedNota = notas.find(n => n.id === notaId)
    if (!deletedNota) {
      const snap = await getDoc(doc(db, 'notas', notaId))
      if (snap.exists()) deletedNota = snap.data()
    }
    const srToDelete = srRows.filter(r => r.notaId === notaId)
    await Promise.all(srToDelete.map(r => deleteDoc(doc(db, 'sanramon_rows', r.id))))
    if (balanceActual && deletedNota) {
      const newBal = applyNotaEditDiff(balanceActual, deletedNota, { ...deletedNota, pagos: [] })
      setBalanceActual(newBal)
      setDoc(doc(db, 'config', 'balance_actual'), newBal)
    }
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
    if (balanceActual) {
      const newBal = applyGastosEditDiff(balanceActual, gastos, updatedGastos)
      setBalanceActual(newBal)
      setDoc(doc(db, 'config', 'balance_actual'), newBal)
    }
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
  } else if (view === 'editNota') {
    content = <NotaDeVenta
      notaInicial={editingNota}
      onBack={() => { setView('calendario'); setEditingNota(null) }}
      onUpdate={nota => { handleEditNota(nota); setView('calendario'); setEditingNota(null) }}
    />
  } else if (view === 'historial') {
    content = <HistorialNotas notas={notas} onBack={() => setView('dashboard')} onEdit={handleEditNota} onDelete={handleDeleteNota} />
  } else if (view === 'concentrado') {
    content = <ConcentradoIngresos notas={notas} gastos={gastos} srRows={srRows} saldosSemana={saldosSemana} balanceActual={balanceActual} onBack={() => setView('dashboard')} />
  } else if (view === 'gastos') {
    content = <ConcentradoGastos notas={notas} gastos={gastos} srRows={srRows} saldosSemana={saldosSemana} onSave={handleSaveGastos} onBack={() => setView('dashboard')} />
  } else if (view === 'calendario') {
    content = <CalendarioEntregas notas={notas} onBack={() => setView('dashboard')} onEditNota={nota => { setEditingNota(nota); setView('editNota') }} />
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
        balanceActual={balanceActual}
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
