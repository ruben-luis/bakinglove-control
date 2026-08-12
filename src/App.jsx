import { useState, useEffect } from 'react'
import './index.css'
import { db } from './firebase'
import {
  collection, onSnapshot, query, where, getDocs,
  doc, setDoc, updateDoc, deleteDoc, getDoc, runTransaction,
} from 'firebase/firestore'
import {
  getCurrentMonday, rolloverBalance, computeBalanceFull,
  notaBalanceDelta, gastosBalanceDelta, isZeroDelta, addDelta,
} from './balance'
import { toIncrements } from './balanceSync'
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

    const unsubNotas = onSnapshot(
      collection(db, 'notas'),
      snap => {
        setNotas(snap.docs.map(d => d.data()))
        loaded.notas = true; check()
      }
    )
    const unsubGastos = onSnapshot(
      collection(db, 'gastos'),
      snap => {
        setGastos(snap.docs.map(d => d.data()))
        loaded.gastos = true; check()
      }
    )
    const unsubSR = onSnapshot(
      collection(db, 'sanramon_rows'),
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

  // ── Balance pre-computado: sincronizado en tiempo real ────────
  // (antes se leía una sola vez con getDoc; así, si otro dispositivo
  // actualiza el balance, este se entera sin necesidad de recargar)
  useEffect(() => {
    const balRef = doc(db, 'config', 'balance_actual')
    return onSnapshot(balRef, snap => {
      if (snap.exists()) setBalanceActual(snap.data())
    })
  }, [])

  // ── Avance de semana (rollover), protegido con transacción ───
  // Se dispara una vez por carga de app. runTransaction garantiza que
  // si dos dispositivos lo disparan casi al mismo tiempo, solo uno
  // hace el avance real — Firestore reintenta al otro con los datos
  // frescos, ve que ya quedó al día y no hace nada. Así nunca se
  // puede sumar la misma semana dos veces, ni retroceder weekStart.
  useEffect(() => {
    if (loading) return
    const weekStart = getCurrentMonday()
    const balRef = doc(db, 'config', 'balance_actual')

    runTransaction(db, async (tx) => {
      const snap = await tx.get(balRef)
      if (!snap.exists()) {
        tx.set(balRef, computeBalanceFull(notas, gastos, srRows, weekStart))
        return
      }
      const saved = snap.data()
      if (saved.weekStart >= weekStart) return // ya está al día
      tx.set(balRef, rolloverBalance(saved, notas, gastos, srRows, weekStart))
    }).catch(console.error)
  }, [loading]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Aplica un delta de balance de forma atómica (increment) ──
  // Actualiza el estado local de inmediato (optimista) y manda el
  // incremento a Firestore — sin leer el documento antes, así nunca
  // pisa lo que otro dispositivo acaba de sumar.
  const applyBalanceDelta = (delta) => {
    if (isZeroDelta(delta)) return
    setBalanceActual(b => b ? addDelta(b, delta) : b)
    updateDoc(doc(db, 'config', 'balance_actual'), toIncrements(delta)).catch(console.error)
  }

  // ── Sync pagos SR de una nota → sanramon_rows ────────────────
  const syncNotaSRPayments = async (nota) => {
    const existingSnap = await getDocs(query(collection(db, 'sanramon_rows'), where('notaId', '==', nota.id)))
    await Promise.all(existingSnap.docs.map(d => deleteDoc(d.ref)))
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
    if (balanceActual) {
      applyBalanceDelta(notaBalanceDelta(null, notaFinal, balanceActual.weekStart))
    }
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
      applyBalanceDelta(notaBalanceDelta(oldNota, notaEditada, balanceActual.weekStart))
    }
  }

  const handleDeleteNota = async (notaId) => {
    let deletedNota = notas.find(n => n.id === notaId)
    if (!deletedNota) {
      const snap = await getDoc(doc(db, 'notas', notaId))
      if (snap.exists()) deletedNota = snap.data()
    }
    const srToDeleteSnap = await getDocs(query(collection(db, 'sanramon_rows'), where('notaId', '==', notaId)))
    await Promise.all(srToDeleteSnap.docs.map(d => deleteDoc(d.ref)))
    if (balanceActual && deletedNota) {
      applyBalanceDelta(notaBalanceDelta(deletedNota, null, balanceActual.weekStart))
    }
    await deleteDoc(doc(db, 'notas', notaId))
  }

  // ── CRUD gastos ───────────────────────────────────────────────
  const handleSaveGastos = (updatedGastos) => {
    const oldIds = new Set(gastos.map(g => g.id))
    const newIds = new Set(updatedGastos.map(g => g.id))
    const deletes = [...oldIds].filter(id => !newIds.has(id))
    deletes.forEach(id => deleteDoc(doc(db, 'gastos', id)))
    updatedGastos.forEach(g => setDoc(doc(db, 'gastos', g.id), g))
    if (balanceActual) {
      applyBalanceDelta(gastosBalanceDelta(gastos, updatedGastos, balanceActual.weekStart))
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
    content = <CalendarioEntregas notas={notas} onBack={() => setView('dashboard')} onEditNota={nota => { setEditingNota(nota); setView('editNota') }} onDeleteNota={handleDeleteNota} />
  } else if (view === 'sanramon') {
    content = <SanRamonView onBack={() => setView('dashboard')} srRows={srRows} weekStart={balanceActual?.weekStart} />
  } else {
    content = (
      <Dashboard
        onNavigate={navigate}
        notas={notas}
        gastos={gastos}
        srRows={srRows}
        saldosSemana={saldosSemana}
        balanceActual={balanceActual}
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
