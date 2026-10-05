import { useState, useEffect } from 'react'
import './index.css'
import { db, authReady } from './firebase'
import {
  collection, onSnapshot, query, where, getDocs, getDocsFromServer,
  doc, setDoc, updateDoc, deleteDoc, getDoc, runTransaction,
} from 'firebase/firestore'
import {
  getCurrentMonday, rolloverBalance, computeBalanceFull,
  notaBalanceDelta, isZeroDelta, addDelta, getNotasCutoffISO,
} from './balance'
import { toIncrements } from './balanceSync'
import Dashboard from './Dashboard'
import NotaDeVenta from './NotaDeVenta'
import HistorialNotas from './HistorialNotas'
import ConcentradoIngresos from './ConcentradoIngresos'
import ConcentradoGastos from './ConcentradoGastos'
import CalendarioEntregas from './CalendarioEntregas'
import SanRamonView from './SanRamonView'
import CdJudicialView from './CdJudicialView'
import HistorialCortes from './HistorialCortes'
import PinModal, { savePin } from './PinModal'
import AnuncioMembresia from './AnuncioMembresia'

// Ventana de retención para los listeners "siempre activos" de gastos y
// sanramon_rows: Dashboard (la pantalla abierta todo el día) solo necesita
// "esta semana" + el balance pre-computado, no el historial completo. Las
// pantallas que sí necesitan historial completo (ConcentradoGastos,
// ConcentradoIngresos, SanRamonView) tienen sus propios listeners/lecturas
// de historial completo, independientes de este acotamiento.
const RETENCION_SEMANAS = 10
function getCutoffISO() {
  const d = new Date()
  d.setDate(d.getDate() - RETENCION_SEMANAS * 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function App() {
  const [view,         setView]         = useState('dashboard')
  const [notas,        setNotas]        = useState([])
  const [gastos,       setGastos]       = useState([])
  const [srRows,       setSrRows]       = useState([])
  const [cdjRows,      setCdjRows]      = useState([])
  const [saldosSemana, setSaldosSemana] = useState([])
  const [pinAction,     setPinAction]    = useState(null)
  const [loading,       setLoading]      = useState(true)
  const [serverSynced,  setServerSynced] = useState(false)
  const [editingNota,   setEditingNota]  = useState(null)
  const [balanceActual, setBalanceActual] = useState(null)
  const [membresia, setMembresia] = useState(null)
  const [anuncioMembresiaCerrado, setAnuncioMembresiaCerrado] = useState(false)

  // ── Suscripción en tiempo real a Firestore ────────────────────
  // Espera a que exista sesión (authReady) antes de suscribirse: las
  // reglas de Firestore exigen auth != null, así que suscribirse antes
  // provocaría errores de permission-denied.
  //
  // `loading` se apaga con el primer dato disponible (aunque venga de
  // caché offline) para que la app abra rápido. `serverSynced` es
  // distinto: solo se activa cuando Firestore CONFIRMA con el servidor
  // que notas/gastos/sanramon_rows están al día (snap.metadata.fromCache
  // === false). Es lo que debe usar cualquier cálculo que escriba datos
  // (como el avance de semana), para no operar con un snapshot de
  // caché parcial o desactualizado.
  useEffect(() => {
    let unsubNotas = () => {}, unsubGastos = () => {}, unsubSR = () => {}, unsubCDJ = () => {}, unsubSaldos = () => {}
    let cancelled = false
    const loaded = { notas: false, gastos: false, sr: false, cdj: false }
    const synced = { notas: false, gastos: false, sr: false, cdj: false }
    const check  = () => {
      if (loaded.notas && loaded.gastos && loaded.sr && loaded.cdj) setLoading(false)
      if (synced.notas && synced.gastos && synced.sr && synced.cdj) setServerSynced(true)
    }

    authReady.then(() => {
      if (cancelled) return
      unsubNotas = onSnapshot(
        query(collection(db, 'notas'), where('updatedAt', '>=', getNotasCutoffISO())),
        { includeMetadataChanges: true },
        snap => {
          setNotas(snap.docs.map(d => d.data()))
          loaded.notas = true
          if (!snap.metadata.fromCache) synced.notas = true
          check()
        }
      )
      const cutoffISO = getCutoffISO()
      unsubGastos = onSnapshot(
        query(collection(db, 'gastos'), where('fecha', '>=', cutoffISO)),
        { includeMetadataChanges: true },
        snap => {
          setGastos(snap.docs.map(d => d.data()))
          loaded.gastos = true
          if (!snap.metadata.fromCache) synced.gastos = true
          check()
        }
      )
      unsubSR = onSnapshot(
        query(collection(db, 'sanramon_rows'), where('fecha', '>=', cutoffISO)),
        { includeMetadataChanges: true },
        snap => {
          setSrRows(snap.docs.map(d => d.data()))
          loaded.sr = true
          if (!snap.metadata.fromCache) synced.sr = true
          check()
        }
      )
      unsubCDJ = onSnapshot(
        query(collection(db, 'cdjudicial_rows'), where('fecha', '>=', cutoffISO)),
        { includeMetadataChanges: true },
        snap => {
          setCdjRows(snap.docs.map(d => d.data()))
          loaded.cdj = true
          if (!snap.metadata.fromCache) synced.cdj = true
          check()
        }
      )
      unsubSaldos = onSnapshot(collection(db, 'saldos_semana'), snap => {
        setSaldosSemana(snap.docs.map(d => d.data()))
      })
    }).catch(console.error)

    return () => { cancelled = true; unsubNotas(); unsubGastos(); unsubSR(); unsubCDJ(); unsubSaldos() }
  }, [])

  // ── Balance pre-computado: sincronizado en tiempo real ────────
  // (antes se leía una sola vez con getDoc; así, si otro dispositivo
  // actualiza el balance, este se entera sin necesidad de recargar)
  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    authReady.then(() => {
      if (cancelled) return
      const balRef = doc(db, 'config', 'balance_actual')
      unsub = onSnapshot(balRef, snap => {
        if (snap.exists()) setBalanceActual(snap.data())
      })
    }).catch(console.error)
    return () => { cancelled = true; unsub() }
  }, [])

  // ── Anuncio temporal de pago de membresía (ver config/membresia) ─
  // Se muestra mientras pagado !== true y hoy == fechaLimite. No hay
  // botón en la app para marcarlo pagado (el NIP del negocio ya lo
  // conoce la propietaria, así que no sirve como control de acceso
  // aquí): se marca pagado:true a mano desde la consola de Firebase.
  // El listener apaga el anuncio en tiempo real en cualquier
  // dispositivo que lo tenga abierto en cuanto eso ocurre.
  useEffect(() => {
    let unsub = () => {}
    let cancelled = false
    authReady.then(() => {
      if (cancelled) return
      const membresiaRef = doc(db, 'config', 'membresia')
      unsub = onSnapshot(membresiaRef, snap => {
        if (snap.exists()) {
          setMembresia(snap.data())
        } else {
          const inicial = { fechaLimite: '2026-10-05', pagado: false }
          setDoc(membresiaRef, inicial).catch(console.error)
          setMembresia(inicial)
        }
      })
    }).catch(console.error)
    return () => { cancelled = true; unsub() }
  }, [])

  const hoyISO = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const mostrarAnuncioMembresia = !!membresia
    && membresia.pagado !== true
    && membresia.fechaLimite === hoyISO
    && !anuncioMembresiaCerrado

  // ── Avance de semana (rollover), protegido con transacción ───
  // Se dispara una vez por carga de app. runTransaction garantiza que
  // si dos dispositivos lo disparan casi al mismo tiempo, solo uno
  // hace el avance real — Firestore reintenta al otro con los datos
  // frescos, ve que ya quedó al día y no hace nada. Así nunca se
  // puede sumar la misma semana dos veces, ni retroceder weekStart.
  useEffect(() => {
    if (!serverSynced) return
    const weekStart = getCurrentMonday()
    // Si el balance que ya tenemos en memoria (vía el listener de arriba)
    // confirma que no hace falta avanzar de semana, nos ahorramos las 3
    // lecturas completas de abajo (~2000 docs) en cada carga de app. Si
    // balanceActual todavía no llegó (null) seguimos por el camino de
    // siempre: la transacción de más abajo vuelve a comprobarlo contra el
    // servidor de todos modos, así que esto es solo una optimización de
    // costo, nunca un riesgo de saltarse un avance real.
    if (balanceActual && balanceActual.weekStart >= weekStart) return
    const balRef = doc(db, 'config', 'balance_actual')

    // gastos/sanramon_rows en memoria están acotados a las últimas
    // RETENCION_SEMANAS semanas (ver listeners arriba). El bootstrap y el
    // rollover necesitan el historial COMPLETO, así que se leen aparte
    // directo del servidor — corre una sola vez por carga de app, así que
    // no reintroduce el costo de un listener siempre activo.
    Promise.all([
      getDocsFromServer(collection(db, 'gastos')),
      getDocsFromServer(collection(db, 'sanramon_rows')),
      getDocsFromServer(collection(db, 'cdjudicial_rows')),
    ]).then(([gastosSnap, srSnap, cdjSnap]) => {
      const gastosFull = gastosSnap.docs.map(d => d.data())
      const srRowsFull = srSnap.docs.map(d => d.data())
      const cdjRowsFull = cdjSnap.docs.map(d => d.data())

      return runTransaction(db, async (tx) => {
        const snap = await tx.get(balRef)
        if (!snap.exists()) {
          tx.set(balRef, computeBalanceFull(notas, gastosFull, srRowsFull, cdjRowsFull, weekStart))
          return
        }
        const saved = snap.data()
        if (saved.weekStart >= weekStart) return // ya está al día
        const rolled = rolloverBalance(saved, notas, gastosFull, srRowsFull, cdjRowsFull, weekStart)
        tx.set(balRef, rolled)
        // El corte de la semana NO se archiva aquí: este avance puede
        // dispararse a cualquier hora (ej. la madrugada del lunes) antes
        // de que se haya capturado toda la información de la semana que
        // cierra. El corte se guarda a mano desde Historial de Cortes,
        // cuando alguien ya verificó que la semana está completa y
        // cuadrada.
      })
    }).catch(console.error)
  }, [serverSynced, balanceActual]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Aplica un delta de balance de forma atómica (increment) ──
  // Actualiza el estado local de inmediato (optimista) y manda el
  // incremento a Firestore — sin leer el documento antes, así nunca
  // pisa lo que otro dispositivo acaba de sumar.
  const applyBalanceDelta = (delta) => {
    if (isZeroDelta(delta)) return
    setBalanceActual(b => b ? addDelta(b, delta) : b)
    updateDoc(doc(db, 'config', 'balance_actual'), toIncrements(delta)).catch(console.error)
  }

  // ── Guarda un corte manual (congelado) con los datos de hoy ──
  // Lee notas/gastos/sanramon_rows directo del servidor (no del estado
  // en memoria, que puede venir de caché offline) para que un corte
  // guardado siempre refleje lo que Firestore tiene confirmado en ese
  // instante. Si no hay conexión, getDocsFromServer falla y el corte
  // no se guarda — mejor eso que congelar datos incompletos.
  const saveManualCorte = async () => {
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const [notasSnap, gastosSnap, srSnap, cdjSnap] = await Promise.all([
      getDocsFromServer(collection(db, 'notas')),
      getDocsFromServer(collection(db, 'gastos')),
      getDocsFromServer(collection(db, 'sanramon_rows')),
      getDocsFromServer(collection(db, 'cdjudicial_rows')),
    ])
    const freshNotas  = notasSnap.docs.map(d => d.data())
    const freshGastos = gastosSnap.docs.map(d => d.data())
    const freshSrRows = srSnap.docs.map(d => d.data())
    const freshCdjRows = cdjSnap.docs.map(d => d.data())
    const snapshot = computeBalanceFull(freshNotas, freshGastos, freshSrRows, freshCdjRows, todayISO)
    await setDoc(doc(db, 'cortes_semana', `manual_${todayISO}_${Date.now()}`), {
      ...snapshot, tipo: 'manual', savedAt: new Date().toISOString(),
    })
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

  // ── Sync pagos CDJ de una nota → cdjudicial_rows ─────────────
  const syncNotaCDJPayments = async (nota) => {
    const existingSnap = await getDocs(query(collection(db, 'cdjudicial_rows'), where('notaId', '==', nota.id)))
    await Promise.all(existingSnap.docs.map(d => deleteDoc(d.ref)))
    const cdjPagos = (nota.pagos || []).filter(p => p.sucursal === 'CDJ' && p.monto && p.fecha && p.metodoPago)
    await Promise.all(cdjPagos.map((p, idx) => {
      const id = `nota_${nota.id}_cdj_${idx}`
      return setDoc(doc(db, 'cdjudicial_rows', id), {
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
    await syncNotaCDJPayments(notaFinal)
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
    await syncNotaCDJPayments(notaEditada)
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
    const cdjToDeleteSnap = await getDocs(query(collection(db, 'cdjudicial_rows'), where('notaId', '==', notaId)))
    await Promise.all(cdjToDeleteSnap.docs.map(d => deleteDoc(d.ref)))
    if (balanceActual && deletedNota) {
      applyBalanceDelta(notaBalanceDelta(deletedNota, null, balanceActual.weekStart))
    }
    await deleteDoc(doc(db, 'notas', notaId))
  }

  // ── Navegación / PIN ──────────────────────────────────────────
  function navigate(dest) {
    if (dest === 'concentrado' || dest === 'gastos' || dest === 'cortes') {
      setPinAction('nav-' + dest)
    } else {
      setView(dest)
    }
  }

  function handlePinSuccess(pin) {
    if (pinAction === 'nav-concentrado') { setView('concentrado'); setPinAction(null) }
    else if (pinAction === 'nav-gastos') { setView('gastos'); setPinAction(null) }
    else if (pinAction === 'nav-cortes') { setView('cortes'); setPinAction(null) }
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
    content = <HistorialNotas onBack={() => setView('dashboard')} onEdit={handleEditNota} onDelete={handleDeleteNota} />
  } else if (view === 'concentrado') {
    content = <ConcentradoIngresos saldosSemana={saldosSemana} balanceActual={balanceActual} onBack={() => setView('dashboard')} />
  } else if (view === 'gastos') {
    content = <ConcentradoGastos weekStart={balanceActual?.weekStart} onBack={() => setView('dashboard')} />
  } else if (view === 'calendario') {
    content = <CalendarioEntregas onBack={() => setView('dashboard')} onEditNota={nota => { setEditingNota(nota); setView('editNota') }} onDeleteNota={handleDeleteNota} />
  } else if (view === 'sanramon') {
    content = <SanRamonView onBack={() => setView('dashboard')} weekStart={balanceActual?.weekStart} />
  } else if (view === 'cdjudicial') {
    content = <CdJudicialView onBack={() => setView('dashboard')} weekStart={balanceActual?.weekStart} />
  } else if (view === 'cortes') {
    content = <HistorialCortes onBack={() => setView('dashboard')} onGuardarCorte={saveManualCorte} saldosSemana={saldosSemana} />
  } else {
    content = (
      <Dashboard
        onNavigate={navigate}
        notas={notas}
        gastos={gastos}
        srRows={srRows}
        cdjRows={cdjRows}
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
      {mostrarAnuncioMembresia && !pinAction && (
        <AnuncioMembresia onClose={() => setAnuncioMembresiaCerrado(true)} />
      )}
    </>
  )
}
