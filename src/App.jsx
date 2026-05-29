import { useState } from 'react'
import './index.css'
import Dashboard from './Dashboard'
import NotaDeVenta from './NotaDeVenta'
import HistorialNotas from './HistorialNotas'
import ConcentradoIngresos from './ConcentradoIngresos'
import ConcentradoGastos from './ConcentradoGastos'
import CalendarioEntregas from './CalendarioEntregas'

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

export default function App() {
  const [view,   setView]   = useState('dashboard')
  const [notas,  setNotas]  = useState(loadNotas)
  const [gastos, setGastos] = useState(loadGastos)

  const handleSaveNota = (nota) => {
    const updated = [nota, ...notas]
    setNotas(updated)
    saveNotas(updated)
    setView('concentrado')
  }

  const handleEditNota = (notaEditada) => {
    const updated = notas.map(n => n.id === notaEditada.id ? notaEditada : n)
    setNotas(updated)
    saveNotas(updated)
  }

  const handleSaveGastos = (updatedGastos) => {
    setGastos(updatedGastos)
    saveGastos(updatedGastos)
  }

  if (view === 'nota') {
    return <NotaDeVenta onBack={() => setView('dashboard')} onSave={handleSaveNota} />
  }
  if (view === 'historial') {
    return <HistorialNotas notas={notas} onBack={() => setView('dashboard')} onEdit={handleEditNota} />
  }
  if (view === 'concentrado') {
    return <ConcentradoIngresos notas={notas} gastos={gastos} onBack={() => setView('dashboard')} />
  }
  if (view === 'gastos') {
    return <ConcentradoGastos gastos={gastos} onSave={handleSaveGastos} onBack={() => setView('dashboard')} />
  }
  if (view === 'calendario') {
    return <CalendarioEntregas notas={notas} onBack={() => setView('dashboard')} />
  }
  return <Dashboard onNavigate={setView} notas={notas} />
}
