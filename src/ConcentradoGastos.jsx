import { useState, useMemo } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'

const MESES   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS    = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const DIAS_ES = DIAS
const MESES_ES = MESES

function labelDia(isoStr) {
  const d = new Date(isoStr)
  return `${DIAS_ES[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]}`
}

const FORMAS_PAGO = ['Tarjeta', 'Transferencia', 'Efectivo']
const CATEGORIAS  = ['Pasteleria', 'Personal']

const todayISO = () => new Date().toISOString().split('T')[0]

function fmt(n) {
  const v = Number(n) || 0
  return v !== 0 ? `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '$ -'
}

function emptyGasto(fecha) {
  return {
    id:        `g_${Date.now()}_${Math.random()}`,
    fecha:     fecha || todayISO(),
    concepto:  '',
    monto:     '',
    formaPago: null,
    categoria: null,
    createdAt: new Date().toISOString(),
  }
}

function getWeekRange(date) {
  const d   = new Date(date)
  const day = d.getDay()
  const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return {
    label: `Del ${DIAS[mon.getDay()]} ${String(mon.getDate()).padStart(2,'0')} al ${DIAS[sun.getDay()]} ${String(sun.getDate()).padStart(2,'0')}`,
  }
}

// ── Celda input inline ────────────────────────────────────────
function Cell({ value, onChange, onBlur, type = 'text', placeholder = '', style = {} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      style={{
        width: '100%', height: '100%', minHeight: 32,
        padding: '0 8px', border: 'none', outline: 'none',
        background: 'transparent', fontFamily: 'inherit',
        fontSize: 11, color: '#1a1a22', ...style,
      }}
    />
  )
}

// ── Selector de forma de pago inline ─────────────────────────
function FormaPagoPicker({ value, onChange }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      style={{
        width: '100%', height: '100%', minHeight: 32,
        padding: '0 6px', border: 'none', outline: 'none',
        background: 'transparent', fontFamily: 'inherit',
        fontSize: 11, color: value ? '#1a1a22' : '#aaa', cursor: 'pointer',
      }}
    >
      <option value="">—</option>
      {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
    </select>
  )
}

// ── Selector de categoría inline ──────────────────────────────
function CategoriaPicker({ value, onChange }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      style={{
        width: '100%', height: '100%', minHeight: 32,
        padding: '0 6px', border: 'none', outline: 'none',
        background: 'transparent', fontFamily: 'inherit',
        fontSize: 11, color: value ? '#1a1a22' : '#aaa', cursor: 'pointer',
      }}
    >
      <option value="">—</option>
      {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  )
}

// ── Sección de cabecera ───────────────────────────────────────
function TableHead({ label }) {
  return (
    <div className="bg-sky-soft text-ink text-center py-2 text-[10px] font-bold tracking-widest">
      {label}
    </div>
  )
}

function SaldoRow({ label, value, last = false }) {
  return (
    <div className={`grid grid-cols-2 bg-ink text-cream ${!last ? 'border-b border-cream/10' : ''}`}>
      <div className="px-2.5 py-2 text-[10px] font-bold border-r border-cream/20">{label}</div>
      <div className="px-2.5 py-2 text-[10px] text-right">{value}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
export default function ConcentradoGastos({ gastos, onSave, onBack }) {
  const now = new Date()
  const [refDate,    setRefDate]    = useState(now)
  const [saved,      setSaved]      = useState(false)
  const [filterDate, setFilterDate] = useState(todayISO)

  const week = getWeekRange(refDate)

  const prevWeek = () => { const d = new Date(refDate); d.setDate(d.getDate() - 7); setRefDate(d) }
  const nextWeek = () => { const d = new Date(refDate); d.setDate(d.getDate() + 7); setRefDate(d) }

  const prevDay = () => { const d = new Date(filterDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setFilterDate(d.toISOString().split('T')[0]) }
  const nextDay = () => { const d = new Date(filterDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setFilterDate(d.toISOString().split('T')[0]) }
  const isDiaHoy = filterDate === todayISO()
  const labelDiaFiltro = (iso) => {
    if (iso === todayISO()) return 'Hoy'
    const d = new Date(iso + 'T12:00:00')
    return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`
  }

  // Gastos del mes visible
  const gastosMes = useMemo(() =>
    (gastos || []).filter(g => {
      const d = new Date(g.createdAt)
      return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear()
    }),
  [gastos, refDate])

  // Filas locales editables (solo del mes, sin padding vacío)
  const [rows, setRows] = useState(() => gastosMes.length > 0 ? [...gastosMes] : [])

  // Cuando cambia el mes, recarga las filas
  const mesKey = `${refDate.getFullYear()}-${refDate.getMonth()}`
  const [lastMesKey, setLastMesKey] = useState(mesKey)
  if (mesKey !== lastMesKey) {
    setLastMesKey(mesKey)
    setRows(gastosMes.length > 0 ? [...gastosMes] : [])
  }

  // Filas visibles para el día seleccionado (con índice original para edición)
  const displayRows = rows
    .map((r, i) => ({ ...r, _idx: i }))
    .filter(r => r.fecha === filterDate)

  const updRow = (i, field, val) => {
    setRows(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      return next
    })
  }

  const addRow = () => setRows(prev => [...prev, emptyGasto(filterDate)])

  const deleteRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const guardar = () => {
    const filled = rows.filter(r => r.concepto || r.monto)
    const otrosMeses = (gastos || []).filter(g => {
      const d = new Date(g.createdAt)
      return !(d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear())
    })
    onSave([...otrosMeses, ...filled])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Acumulados
  const acumPago = { Tarjeta: 0, Transferencia: 0, Efectivo: 0 }
  const acumCat  = { Pasteleria: 0, Personal: 0 }

  rows.forEach(r => {
    const m = parseFloat(r.monto) || 0
    if (r.formaPago && acumPago[r.formaPago] !== undefined) acumPago[r.formaPago] += m
    if (r.categoria && acumCat[r.categoria]  !== undefined) acumCat[r.categoria]  += m
  })

  const totalBancos   = acumPago.Tarjeta + acumPago.Transferencia
  const totalEfectivo = acumPago.Efectivo
  const totalGeneral  = totalBancos + totalEfectivo

  // Estilos de celda
  const tdBase = { border: '1px solid #e2e2e6', verticalAlign: 'middle', padding: 0, height: 32 }
  const thBase = { background: '#DEECF8', color: '#2b2731', fontWeight: 700, fontSize: 10, padding: '7px 8px', border: '1px solid rgba(98,152,203,.3)', textAlign: 'left', whiteSpace: 'nowrap' }

  return (
    <div className="min-h-screen bg-cream">
      <div className="bkl-texture pointer-events-none fixed inset-0 opacity-[0.06]" />

      {/* Nav */}
      <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur-sm border-b-2 border-ink flex items-center justify-between px-4 py-3 shadow-hard-sm gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-2 text-ink font-bold text-sm">
            <ArrowLeft size={18} strokeWidth={2.5} /> Volver
          </button>
          <span className="font-display font-bold text-ink text-base">Concentrado de Gastos</span>
        </div>
        <button onClick={guardar} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${saved ? 'bg-green-600 text-white' : 'bg-[#1f2b5e] text-white'}`}>
          {saved ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Encabezado de mes */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <div className="bg-gray-100 text-center py-4 px-4">
            <h1 className="font-display font-black text-ink text-4xl tracking-tight">
              {MESES[refDate.getMonth()].toUpperCase()}
            </h1>
            <div className="flex items-center justify-center gap-3 mt-2">
              <button onClick={prevWeek} className="border-2 border-ink rounded-full p-1 bg-white shadow-hard-sm active:scale-95 transition-transform">
                <ChevronLeft size={14} strokeWidth={2.5} />
              </button>
              <p className="text-ink/60 text-xs font-semibold capitalize">{week.label}</p>
              <button onClick={nextWeek} className="border-2 border-ink rounded-full p-1 bg-white shadow-hard-sm active:scale-95 transition-transform">
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Navegación por día */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '2px 0' }}>
          <button onClick={prevDay} style={{ border: '2px solid #1a1a22', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', background: '#fff', cursor: 'pointer' }}>
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>
          <label style={{ position: 'relative', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#1a1a22', padding: '4px 14px', border: '2px solid #1a1a22', borderRadius: 20, background: '#fff', display: 'inline-block', userSelect: 'none' }}>
            {labelDiaFiltro(filterDate)}
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
          </label>
          <button onClick={nextDay} style={{ border: '2px solid #1a1a22', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', background: '#fff', cursor: 'pointer' }}>
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
          {!isDiaHoy && (
            <button onClick={() => setFilterDate(todayISO())} style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', border: '2px solid #1f2b5e', borderRadius: 14, background: '#1f2b5e', color: '#fff', cursor: 'pointer' }}>
              Hoy
            </button>
          )}
        </div>

        {/* CONTROL DE GASTOS */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <TableHead label="CONTROL DE GASTOS" />
          <div className="overflow-x-auto">
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 460 }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, width: 36, textAlign: 'center' }}>#</th>
                  <th style={{ ...thBase, width: 88 }}>Fecha</th>
                  <th style={{ ...thBase }}>Descripción del gasto</th>
                  <th style={{ ...thBase, width: 80 }}>Monto $</th>
                  <th style={{ ...thBase, width: 100 }}>Forma de pago</th>
                  <th style={{ ...thBase, width: 90 }}>Categoría</th>
                  <th style={{ ...thBase, width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: '#bbb', fontSize: 11, padding: 20 }}>
                      Sin gastos para este día
                    </td>
                  </tr>
                ) : displayRows.map((row, visIdx) => (
                  <tr key={row.id}
                    style={{ background: '#fff' }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => { if (!c.dataset.colored) c.style.background = '#fafaff' })}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => { if (!c.dataset.colored) c.style.background = '' })}
                  >
                    <td style={{ ...tdBase, textAlign: 'center', fontSize: 10, color: '#aaa', fontWeight: 600 }}>{visIdx + 1}</td>
                    <td style={tdBase}>
                      <input type="date" value={row.fecha} onChange={e => updRow(row._idx, 'fecha', e.target.value)}
                        style={{ width: '100%', height: 32, padding: '0 4px', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 10, color: '#1a1a22' }} />
                    </td>
                    <td style={tdBase}>
                      <Cell value={row.concepto} onChange={v => updRow(row._idx, 'concepto', v)} placeholder="Descripción del gasto…" />
                    </td>
                    <td style={tdBase}>
                      <Cell type="text" value={row.monto} onChange={v => updRow(row._idx, 'monto', v)} placeholder="0.00" style={{ textAlign: 'right' }}
                        onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n) && n > 0) updRow(row._idx, 'monto', n.toFixed(2)) }} />
                    </td>
                    <td style={{ ...tdBase, background: '#fef9c3' }} data-colored="1">
                      <FormaPagoPicker value={row.formaPago} onChange={v => updRow(row._idx, 'formaPago', v)} />
                    </td>
                    <td style={tdBase}>
                      <CategoriaPicker value={row.categoria} onChange={v => updRow(row._idx, 'categoria', v)} />
                    </td>
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <button onClick={() => deleteRow(row._idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, display: 'grid', placeItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
                        onMouseLeave={e => e.currentTarget.style.color = '#ccc'}>
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Agregar fila */}
          <button onClick={addRow}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold text-ink/40 hover:text-ink/70 hover:bg-gray-50 transition-colors border-t border-ink/10">
            <Plus size={11} strokeWidth={2.5} /> Agregar fila
          </button>
        </div>

        {/* ACUMULADO DE SALIDAS — por método */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <TableHead label="ACUMULADO DE SALIDAS" />
          <div className="grid grid-cols-3 bg-sky-soft text-ink">
            {['Tarjeta', 'Transferencia', 'Efectivo'].map(m => (
              <div key={m} className="px-2 py-2 text-[10px] font-bold text-center border-r border-sky-deep/20 last:border-r-0">{m}</div>
            ))}
          </div>
          <div className="grid grid-cols-3">
            {['Tarjeta', 'Transferencia', 'Efectivo'].map(m => (
              <div key={m} className="px-2 py-3 text-[10px] font-bold text-ink text-center border-r border-ink/10 last:border-r-0 bg-red-50/60">
                {acumPago[m] > 0 ? fmt(acumPago[m]) : '$ -'}
              </div>
            ))}
          </div>
        </div>

        {/* TOTAL SALIDAS */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <TableHead label="TOTAL SALIDAS" />
          <SaldoRow label="Bancos"   value={fmt(totalBancos)}   />
          <SaldoRow label="Efectivo" value={fmt(totalEfectivo)} last />
          <div className="grid grid-cols-[auto_1fr_auto] border-t border-ink/20 bg-gray-50 py-2.5 px-3 items-center">
            <span className="text-[10px] font-bold text-ink mr-2">$</span>
            <span className="text-[10px] font-black text-ink">{totalGeneral > 0 ? fmt(totalGeneral) : '-'}</span>
            <span className="text-[10px] text-ink/45 font-medium">Total General</span>
          </div>
          <div className="flex justify-end border-t border-ink/10 bg-gray-50 py-2 px-3">
            <span className="text-[10px] text-ink/40 font-medium">Diferencias</span>
          </div>
        </div>

        {/* ACUMULADO DE SALIDAS — por categoría */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <TableHead label="ACUMULADO DE SALIDAS POR CATEGORÍA" />
          <div className="grid grid-cols-2 bg-sky-soft text-ink">
            {['Pasteleria', 'Personal'].map(c => (
              <div key={c} className="px-2 py-2 text-[10px] font-bold text-center border-r border-sky-deep/20 last:border-r-0">{c}</div>
            ))}
          </div>
          <div className="grid grid-cols-2">
            {['Pasteleria', 'Personal'].map(c => (
              <div key={c} className="px-2 py-3 text-[10px] font-bold text-ink text-center border-r border-ink/10 last:border-r-0 bg-red-50/60">
                {acumCat[c] > 0 ? fmt(acumCat[c]) : '$ -'}
              </div>
            ))}
          </div>
        </div>

        {/* Volver */}
        <button onClick={onBack}
          className="w-full py-4 bg-ink border-2 border-ink rounded-2xl text-cream font-bold text-sm shadow-hard active:scale-95 transition-transform mb-4">
          Volver al panel
        </button>

      </div>
    </div>
  )
}
