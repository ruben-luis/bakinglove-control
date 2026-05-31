import { useState } from 'react'
import './index.css'
import Dashboard from './Dashboard'
import NotaDeVenta from './NotaDeVenta'
import HistorialNotas from './HistorialNotas'
import ConcentradoIngresos from './ConcentradoIngresos'
import ConcentradoGastos from './ConcentradoGastos'
import CalendarioEntregas from './CalendarioEntregas'
import PinModal, { savePin } from './PinModal'

function loadNotas() {
  try {
    const notas = JSON.parse(localStorage.getItem('bkl_notas') || '[]')
    localStorage.setItem('bkl_folio_count', String(notas.length))
    return notas
  } catch {
    localStorage.setItem('bkl_folio_count', '0')
    return []
  }
}

function saveNotas(notas) {
  localStorage.setItem('bkl_notas', JSON.stringify(notas))
  localStorage.setItem('bkl_folio_count', String(notas.length))
}

function loadGastos() {
  try { return JSON.parse(localStorage.getItem('bkl_gastos') || '[]') } catch { return [] }
}

function saveGastos(gastos) {
  localStorage.setItem('bkl_gastos', JSON.stringify(gastos))
}

function loadSrRows() {
  try { return JSON.parse(localStorage.getItem('bkl_sanramon') || '[]') } catch { return [] }
}

export default function App() {
  const [view,      setView]      = useState('dashboard')
  const [notas,     setNotas]     = useState(loadNotas)
  const [gastos,    setGastos]    = useState(loadGastos)
  const [srRows,    setSrRows]    = useState(loadSrRows)
  const [pinAction, setPinAction] = useState(null)

  const handleSaveNota = (nota) => {
    const updated = [nota, ...notas]
    setNotas(updated)
    saveNotas(updated)
    setView('historial')
  }

  const handleEditNota = (notaEditada) => {
    const updated = notas.map(n => n.id === notaEditada.id ? notaEditada : n)
    setNotas(updated)
    saveNotas(updated)
  }

  const handleDeleteNota = (notaId) => {
    const updated = notas.filter(n => n.id !== notaId)
    setNotas(updated)
    saveNotas(updated)
  }

  const handleSaveGastos = (updatedGastos) => {
    setGastos(updatedGastos)
    saveGastos(updatedGastos)
  }

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
    else if (pinAction === 'change-new') { savePin(pin); setPinAction(null) }
  }

  const pinTitle = pinAction === 'change-new' ? 'Ingresa tu nuevo NIP' : 'Ingresa tu NIP'
  const pinMode  = pinAction === 'change-new' ? 'enter-new' : 'verify'

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
