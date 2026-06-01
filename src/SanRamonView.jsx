import { useState, useRef } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const localISO = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

function emptyRow(fecha) {
  return {
    id: crypto.randomUUID(),
    fecha,
    tipo: null,
    producto: '',
    precio: '',
    metodo: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function padRows(rows, fecha) {
  const arr = [...rows]
  while (arr.length < 2) arr.push(emptyRow(fecha))
  return arr
}

function labelDia(iso) {
  if (iso === todayISO()) return 'Hoy'
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} ${new Date(iso + 'T12:00:00').getFullYear()}`
}

const VENTA_BG  = '#d9efd2'; const VENTA_TX  = '#5d8a49'
const SALIDA_BG = '#fbe0ea'; const SALIDA_TX = '#d9748f'
const NAVY      = '#1f2b5e'
const LINE      = '#bfbfc6'; const LINE_SOFT = '#d7d7dd'

const CHECK = (
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 10, height: 10 }}>
    <path d="M4 12l5 5L20 6"/>
  </svg>
)

export default function SanRamonView({ onBack, onSrChange }) {
  const allRowsRef = useRef(
    (() => { try { return JSON.parse(localStorage.getItem('bkl_sanramon') || '[]') } catch { return [] } })()
  )
  const saldosRef = useRef(
    (() => { try { return JSON.parse(localStorage.getItem('bkl_sanramon_saldos') || '{}') } catch { return {} } })()
  )

  const [filterDate, setFilterDate] = useState(todayISO)
  const [dayRows,    setDayRows]    = useState(() =>
    padRows(allRowsRef.current.filter(r => r.fecha === todayISO()), todayISO())
  )
  const [saldoIni, setSaldoIni] = useState(
    () => saldosRef.current[todayISO()] != null ? String(saldosRef.current[todayISO()]) : ''
  )

  function persist(rows, fecha, saldo) {
    const filled = rows.filter(r => r.producto || r.precio || r.tipo)
    const others = allRowsRef.current.filter(r => r.fecha !== fecha)
    const newAll = [...others, ...filled]
    allRowsRef.current = newAll
    const n = parseFloat(saldo)
    if (!isNaN(n) && n >= 0) saldosRef.current[fecha] = n
    else delete saldosRef.current[fecha]
    localStorage.setItem('bkl_sanramon', JSON.stringify(newAll))
    localStorage.setItem('bkl_sanramon_saldos', JSON.stringify(saldosRef.current))
    onSrChange?.(newAll)
  }

  function switchDate(newDate) {
    persist(dayRows, filterDate, saldoIni)
    setFilterDate(newDate)
    setDayRows(padRows(allRowsRef.current.filter(r => r.fecha === newDate), newDate))
    setSaldoIni(saldosRef.current[newDate] != null ? String(saldosRef.current[newDate]) : '')
  }

  function prevDay() { const d = new Date(filterDate + 'T12:00:00'); d.setDate(d.getDate() - 1); switchDate(localISO(d)) }
  function nextDay() { const d = new Date(filterDate + 'T12:00:00'); d.setDate(d.getDate() + 1); switchDate(localISO(d)) }

  function updRow(i, field, val) {
    const next = dayRows.map((r, idx) => idx === i ? { ...r, [field]: val, updatedAt: new Date().toISOString() } : r)
    setDayRows(next)
    persist(next, filterDate, saldoIni)
  }

  function toggleTipo(i, tipo) { updRow(i, 'tipo', dayRows[i].tipo === tipo ? null : tipo) }
  function toggleMetodo(i, met) { updRow(i, 'metodo', dayRows[i].metodo === met ? null : met) }

  function addRow() {
    const next = [...dayRows, emptyRow(filterDate)]
    setDayRows(next)
    persist(next, filterDate, saldoIni)
  }

  function deleteRow(i) {
    const next = dayRows.length <= 2
      ? dayRows.map((r, idx) => idx === i ? emptyRow(filterDate) : r)
      : dayRows.filter((_, idx) => idx !== i)
    setDayRows(next)
    persist(next, filterDate, saldoIni)
  }

  function handleSaldoBlur() {
    const n = parseFloat(saldoIni)
    const val = !isNaN(n) && n >= 0 ? n.toFixed(2) : ''
    setSaldoIni(val)
    persist(dayRows, filterDate, val)
  }

  const totalVentas  = dayRows.reduce((s, r) => r.tipo === 'venta'  ? s + (parseFloat(r.precio) || 0) : s, 0)
  const totalSalidas = dayRows.reduce((s, r) => r.tipo === 'salida' ? s + (parseFloat(r.precio) || 0) : s, 0)
  const saldoFinal   = (parseFloat(saldoIni) || 0) + totalVentas - totalSalidas
  const isDiaHoy     = filterDate === todayISO()

  const fmt = n => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const tdBase = { border: `1px solid ${LINE_SOFT}`, verticalAlign: 'middle', padding: 0, height: 36 }
  const thBase = {
    background: '#f4f3f6', color: '#111018', fontWeight: 800, fontSize: 11,
    padding: '9px 8px', border: `1px solid ${LINE}`, textAlign: 'center',
    whiteSpace: 'nowrap', letterSpacing: 0.5,
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="bkl-texture pointer-events-none fixed inset-0 opacity-[0.06]" />

      {/* ── Nav bar ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur-sm border-b-2 border-ink shadow-hard-sm">
        {/* Row 1: back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px 6px' }}>
          <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#2b2731', padding: 0 }}>
            <ArrowLeft size={17} strokeWidth={2.5} />
            Volver
          </button>
          <div style={{ width: 1, height: 18, background: '#2b273122' }} />
          <div>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: '#2b273155', textTransform: 'uppercase' }}>Control Sucursal</div>
            <div style={{ fontSize: 14, fontWeight: 900, color: NAVY, letterSpacing: 0.2, lineHeight: 1.1 }}>San Ramón</div>
          </div>
        </div>

        {/* Row 2: day navigation full-width */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '4px 16px 10px' }}>
          <button onClick={prevDay} style={{ border: '2px solid #2b2731', borderRadius: '50%', width: 30, height: 30, display: 'grid', placeItems: 'center', background: '#fff', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronLeft size={15} strokeWidth={2.5} />
          </button>

          <label style={{ position: 'relative', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: isDiaHoy ? NAVY : '#2b2731', padding: '6px 18px', border: `2px solid ${isDiaHoy ? NAVY : '#2b2731'}`, borderRadius: 22, background: isDiaHoy ? '#eef1fb' : '#fff', display: 'inline-block', userSelect: 'none', whiteSpace: 'nowrap', textAlign: 'center', flex: 1, maxWidth: 260 }}>
            {isDiaHoy ? '📅 Hoy' : labelDia(filterDate)}
            <input type="date" value={filterDate} onChange={e => switchDate(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
          </label>

          <button onClick={nextDay} style={{ border: '2px solid #2b2731', borderRadius: '50%', width: 30, height: 30, display: 'grid', placeItems: 'center', background: '#fff', cursor: 'pointer', flexShrink: 0 }}>
            <ChevronRight size={15} strokeWidth={2.5} />
          </button>

          {!isDiaHoy && (
            <button onClick={() => switchDate(todayISO())} style={{ fontSize: 11, fontWeight: 700, padding: '5px 11px', border: `2px solid ${NAVY}`, borderRadius: 14, background: NAVY, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Saldos */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <div style={{ background: '#f4f3f6', textAlign: 'center', padding: '6px', fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#666', borderBottom: `1px solid ${LINE}` }}>
            SALDOS DEL DÍA
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {/* Saldo Inicial */}
            <div style={{ borderRight: `1px solid ${LINE_SOFT}`, padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#9a9aa3', marginBottom: 4 }}>SALDO INICIAL</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ color: '#9a9aa3', fontWeight: 700, fontSize: 14 }}>$</span>
                <input
                  type="text" value={saldoIni}
                  onChange={e => setSaldoIni(e.target.value)}
                  onBlur={handleSaldoBlur}
                  placeholder="0.00"
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, color: '#1a51c4', width: '100%', minWidth: 0 }}
                />
              </div>
            </div>
            {/* Saldo Final */}
            <div style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#9a9aa3', marginBottom: 4 }}>SALDO FINAL</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ color: '#9a9aa3', fontWeight: 700, fontSize: 14 }}>$</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: saldoFinal >= 0 ? '#1a51c4' : SALIDA_TX }}>
                  {fmt(saldoFinal)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <div style={{ background: NAVY, textAlign: 'center', padding: '7px', fontSize: 10, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,.6)' }}>
            CONTROL DE VENTAS Y SALIDAS
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ ...thBase, width: 28 }}>#</th>
                  <th style={{ ...thBase, width: 54 }}>TIPO</th>
                  <th style={{ ...thBase, textAlign: 'left', paddingLeft: 8 }}>PRODUCTO</th>
                  <th style={{ ...thBase, width: 80 }}>$ TOTAL</th>
                  <th style={{ ...thBase, width: 52 }}>MÉT</th>
                  <th style={{ ...thBase, width: 26 }}></th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row, i) => {
                  const isV = row.tipo === 'venta'
                  const isS = row.tipo === 'salida'
                  return (
                    <tr key={row.id}
                      style={{ background: isV ? 'rgba(217,239,210,.15)' : isS ? 'rgba(251,224,234,.15)' : '#fff' }}
                      onMouseEnter={e => { if (!isV && !isS) e.currentTarget.style.background = '#fafaff' }}
                      onMouseLeave={e => { if (!isV && !isS) e.currentTarget.style.background = '#fff' }}
                    >
                      {/* # */}
                      <td style={{ ...tdBase, textAlign: 'center', fontSize: 11, color: '#aaa', fontWeight: 700 }}>
                        {String(i + 1).padStart(2, '0')}
                      </td>

                      {/* TIPO */}
                      <td style={{ ...tdBase, padding: 0, width: 54 }}>
                        <div style={{ display: 'flex', height: '100%' }}>
                          <div
                            onClick={() => toggleTipo(i, 'venta')}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 800,
                              color: isV ? VENTA_TX : '#ccc',
                              background: isV ? VENTA_BG : 'transparent',
                              cursor: 'pointer', borderRight: `1px solid ${LINE_SOFT}`,
                              transition: 'background 0.1s',
                            }}
                          >V</div>
                          <div
                            onClick={() => toggleTipo(i, 'salida')}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 800,
                              color: isS ? SALIDA_TX : '#ccc',
                              background: isS ? SALIDA_BG : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.1s',
                            }}
                          >S</div>
                        </div>
                      </td>

                      {/* Producto */}
                      <td style={tdBase}>
                        <input
                          value={row.producto}
                          onChange={e => updRow(i, 'producto', e.target.value)}
                          placeholder="Producto o descripción…"
                          style={{ width: '100%', height: '100%', minHeight: 34, padding: '0 10px', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: '#1a1a22' }}
                        />
                      </td>

                      {/* Precio */}
                      <td style={tdBase}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4 }}>
                          <span style={{ color: '#9a9aa3', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>$</span>
                          <input
                            type="text" value={row.precio}
                            onChange={e => updRow(i, 'precio', e.target.value)}
                            onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n) && n > 0) updRow(i, 'precio', n.toFixed(2)) }}
                            placeholder="0.00"
                            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#1a1a22', textAlign: 'right', minWidth: 0 }}
                          />
                        </div>
                      </td>

                      {/* Método */}
                      <td style={{ ...tdBase, padding: 0, width: 52 }}>
                        <div style={{ display: 'flex', height: '100%' }}>
                          {[['Efectivo','EF'], ['Banco','BK']].map(([m, label], mi) => (
                            <div key={m}
                              onClick={() => toggleMetodo(i, m)}
                              style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 10, fontWeight: row.metodo === m ? 800 : 600,
                                color: row.metodo === m ? NAVY : '#bbb',
                                cursor: 'pointer', userSelect: 'none',
                                borderRight: mi === 0 ? `1px solid ${LINE_SOFT}` : 'none',
                                background: row.metodo === m ? '#e7eefb' : 'transparent',
                                transition: 'background 0.1s',
                              }}
                            >{label}</div>
                          ))}
                        </div>
                      </td>

                      {/* Borrar */}
                      <td style={{ ...tdBase, textAlign: 'center' }}>
                        <button
                          onClick={() => deleteRow(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', padding: 4, display: 'grid', placeItems: 'center' }}
                          onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
                          onMouseLeave={e => e.currentTarget.style.color = '#ddd'}
                        >
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Total */}
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ ...tdBase, textAlign: 'right', paddingRight: 16, fontWeight: 800, fontSize: 12, letterSpacing: 0.8, background: '#f4f3f6' }}>
                    TOTAL
                  </td>
                  <td colSpan={2} style={{ ...tdBase, background: '#f4f3f6', padding: '0 14px' }}>
                    <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                      {totalVentas > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 800, color: VENTA_TX }}>▲ ${fmt(totalVentas)}</span>
                      )}
                      {totalSalidas > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 800, color: SALIDA_TX }}>▼ ${fmt(totalSalidas)}</span>
                      )}
                      {totalVentas === 0 && totalSalidas === 0 && (
                        <span style={{ fontSize: 13, color: '#bbb' }}>—</span>
                      )}
                    </div>
                  </td>
                  <td style={{ ...tdBase, background: '#f4f3f6' }}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Agregar fila */}
          <button
            onClick={addRow}
            className="w-full flex items-center justify-center gap-2 py-3 text-[11px] font-bold text-ink/40 hover:text-ink/70 hover:bg-gray-50 transition-colors border-t border-ink/10"
          >
            <Plus size={12} strokeWidth={2.5} /> Agregar fila
          </button>
        </div>

        <button
          onClick={onBack}
          className="w-full py-4 bg-ink border-2 border-ink rounded-2xl text-cream font-bold text-sm shadow-hard active:scale-95 transition-transform mb-4"
        >
          Volver al panel
        </button>

      </div>
    </div>
  )
}
