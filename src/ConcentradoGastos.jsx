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

function emptyGasto() {
  return {
    id:        `g_${Date.now()}_${Math.random()}`,
    fecha:     todayISO(),
    gasto:     '',
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
function Cell({ value, onChange, type = 'text', placeholder = '', style = {} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
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
    <div className="bg-gray-200 text-ink text-center py-2 text-[10px] font-bold tracking-widest">
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
  const [refDate, setRefDate] = useState(now)

  const week = getWeekRange(refDate)

  const prevWeek = () => { const d = new Date(refDate); d.setDate(d.getDate() - 7); setRefDate(d) }
  const nextWeek = () => { const d = new Date(refDate); d.setDate(d.getDate() + 7); setRefDate(d) }

  // Gastos del mes visible
  const gastosMes = useMemo(() =>
    gastos.filter(g => {
      const d = new Date(g.createdAt)
      return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear()
    }),
  [gastos, refDate])

  // Filas locales editables (solo del mes)
  const [rows, setRows] = useState(() => {
    const base = gastosMes.length > 0 ? [...gastosMes] : []
    while (base.length < 16) base.push(emptyGasto())
    return base
  })

  // Cuando cambia el mes, recarga las filas
  const mesKey = `${refDate.getFullYear()}-${refDate.getMonth()}`
  const [lastMesKey, setLastMesKey] = useState(mesKey)
  if (mesKey !== lastMesKey) {
    setLastMesKey(mesKey)
    const base = gastosMes.length > 0 ? [...gastosMes] : []
    while (base.length < 16) base.push(emptyGasto())
    setRows(base)
  }

  const updRow = (i, field, val) => {
    setRows(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      return next
    })
  }

  const addRow = () => setRows(prev => [...prev, emptyGasto()])

  const deleteRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i))

  const guardar = () => {
    const filled = rows.filter(r => r.gasto || r.concepto || r.monto)
    const otrosMeses = gastos.filter(g => {
      const d = new Date(g.createdAt)
      return !(d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear())
    })
    onSave([...otrosMeses, ...filled])
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
  const thBase = { background: '#1f2b5e', color: '#fff', fontWeight: 700, fontSize: 10, padding: '7px 8px', border: '1px solid rgba(255,255,255,.15)', textAlign: 'left', whiteSpace: 'nowrap' }

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
        <button onClick={guardar} className="flex items-center gap-1.5 bg-[#1f2b5e] text-white rounded-lg px-3 py-1.5 text-xs font-bold">
          Guardar
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

        {/* CONTROL DE GASTOS */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <TableHead label="CONTROL DE GASTOS" />
          <div className="overflow-x-auto">
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, width: 36, textAlign: 'center' }}>#</th>
                  <th style={{ ...thBase, width: 88 }}>Fecha</th>
                  <th style={{ ...thBase, width: 110 }}>Gasto</th>
                  <th style={{ ...thBase }}>Concepto</th>
                  <th style={{ ...thBase, width: 80 }}>Monto $</th>
                  <th style={{ ...thBase, width: 100 }}>Forma de pago</th>
                  <th style={{ ...thBase, width: 90 }}>Categoría</th>
                  <th style={{ ...thBase, width: 32 }} />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let lastDay = null
                  return rows.flatMap((row, i) => {
                    const day = row.fecha || ''
                    const items = []
                    const isFilled = row.gasto || row.concepto || row.monto
                    if (isFilled && day && day !== lastDay) {
                      lastDay = day
                      const [y, m, d] = day.split('-')
                      const dateObj = new Date(day + 'T12:00:00')
                      items.push(
                        <tr key={`div-${i}`}>
                          <td colSpan={8} style={{ background: '#f0f0f5', padding: '4px 10px', fontSize: 9, fontWeight: 800, color: '#888', letterSpacing: 1, textTransform: 'uppercase', borderTop: '1px solid #e0e0e8', borderBottom: '1px solid #e0e0e8' }}>
                            {labelDia(day + 'T12:00:00')}
                          </td>
                        </tr>
                      )
                    }
                    items.push(
                  <tr key={row.id}
                    style={{ background: '#fff' }}
                    onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => { if (!c.dataset.colored) c.style.background = '#fafaff' })}
                    onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => { if (!c.dataset.colored) c.style.background = '' })}
                  >
                    {/* # */}
                    <td style={{ ...tdBase, textAlign: 'center', fontSize: 10, color: '#aaa', fontWeight: 600 }}>
                      {i + 1}
                    </td>

                    {/* Fecha */}
                    <td style={tdBase}>
                      <input type="date" value={row.fecha} onChange={e => updRow(i, 'fecha', e.target.value)}
                        style={{ width: '100%', height: 32, padding: '0 4px', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 10, color: '#1a1a22' }} />
                    </td>

                    {/* Gasto — fondo rosa */}
                    <td style={{ ...tdBase, background: '#fde8e0' }} data-colored="1">
                      <Cell value={row.gasto} onChange={v => updRow(i, 'gasto', v)} placeholder="Categoría…" style={{ background: 'transparent' }} />
                    </td>

                    {/* Concepto */}
                    <td style={tdBase}>
                      <Cell value={row.concepto} onChange={v => updRow(i, 'concepto', v)} placeholder="Descripción…" />
                    </td>

                    {/* Monto */}
                    <td style={tdBase}>
                      <Cell type="number" value={row.monto} onChange={v => updRow(i, 'monto', v)} placeholder="0" style={{ textAlign: 'right' }} />
                    </td>

                    {/* Forma de pago — fondo amarillo */}
                    <td style={{ ...tdBase, background: '#fef9c3' }} data-colored="1">
                      <FormaPagoPicker value={row.formaPago} onChange={v => updRow(i, 'formaPago', v)} />
                    </td>

                    {/* Categoría */}
                    <td style={tdBase}>
                      <CategoriaPicker value={row.categoria} onChange={v => updRow(i, 'categoria', v)} />
                    </td>

                    {/* Eliminar */}
                    <td style={{ ...tdBase, textAlign: 'center' }}>
                      <button onClick={() => deleteRow(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 4, display: 'grid', placeItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
                        onMouseLeave={e => e.currentTarget.style.color = '#ccc'}>
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                    )
                    return items
                  })
                })()}
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
          <div className="grid grid-cols-3 bg-ink text-cream">
            {['Tarjeta', 'Transferencia', 'Efectivo'].map(m => (
              <div key={m} className="px-2 py-2 text-[10px] font-bold text-center border-r border-cream/20 last:border-r-0">{m}</div>
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
          <div className="grid grid-cols-2 bg-ink text-cream">
            {['Pasteleria', 'Personal'].map(c => (
              <div key={c} className="px-2 py-2 text-[10px] font-bold text-center border-r border-cream/20 last:border-r-0">{c}</div>
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
