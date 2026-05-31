import { useState, useRef } from 'react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
const localISO = d =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

function emptyRow(fecha) {
  return {
    id: `sr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    fecha,
    tipo:     null,
    producto: '',
    precio:   '',
    metodo:   null,
    createdAt: new Date().toISOString(),
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
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
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

export default function SanRamonCard({ onSrChange }) {
  // Use refs so persist() never has stale closure issues
  const allRowsRef = useRef(
    (() => { try { return JSON.parse(localStorage.getItem('bkl_sanramon') || '[]') } catch { return [] } })()
  )
  const saldosRef = useRef(
    (() => { try { return JSON.parse(localStorage.getItem('bkl_sanramon_saldos') || '{}') } catch { return {} } })()
  )

  const [filterDate, setFilterDate] = useState(todayISO)
  const [dayRows,    setDayRows]    = useState(() => padRows(
    allRowsRef.current.filter(r => r.fecha === todayISO()), todayISO()
  ))
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

  function prevDay() {
    const d = new Date(filterDate + 'T12:00:00'); d.setDate(d.getDate() - 1); switchDate(localISO(d))
  }
  function nextDay() {
    const d = new Date(filterDate + 'T12:00:00'); d.setDate(d.getDate() + 1); switchDate(localISO(d))
  }

  function updRow(i, field, val) {
    const next = dayRows.map((r, idx) => idx === i ? { ...r, [field]: val } : r)
    setDayRows(next)
    persist(next, filterDate, saldoIni)
  }

  function toggleTipo(i, tipo) {
    updRow(i, 'tipo', dayRows[i].tipo === tipo ? null : tipo)
  }

  function toggleMetodo(i, met) {
    updRow(i, 'metodo', dayRows[i].metodo === met ? null : met)
  }

  function addRow() {
    const next = [...dayRows, emptyRow(filterDate)]
    setDayRows(next)
    persist(next, filterDate, saldoIni)
  }

  function deleteRow(i) {
    let next
    if (dayRows.length <= 2) {
      next = dayRows.map((r, idx) => idx === i ? emptyRow(filterDate) : r)
    } else {
      next = dayRows.filter((_, idx) => idx !== i)
    }
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
  const saldoIniNum  = parseFloat(saldoIni) || 0
  const saldoFinal   = saldoIniNum + totalVentas - totalSalidas
  const isDiaHoy     = filterDate === todayISO()

  const fmt = n => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const tdBase = { border: `1px solid ${LINE_SOFT}`, verticalAlign: 'middle', padding: 0, height: 34 }
  const thBase = {
    background: '#f4f3f6', color: '#111018', fontWeight: 800, fontSize: 10.5,
    padding: '7px 6px', border: `1px solid ${LINE}`, textAlign: 'center',
    whiteSpace: 'nowrap', letterSpacing: 0.5,
  }

  return (
    <section style={{
      margin: '0 4px 22px',
      borderRadius: 24,
      border: '2.5px solid #2b2731',
      background: '#fff',
      boxShadow: '5px 5px 0 #2b2731',
      overflow: 'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{
        background: NAVY,
        padding: '11px 16px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase' }}>
            Control Sucursal
          </span>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: 0.5 }}>
            San Ramón
          </span>
        </div>

        {/* Day navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <button onClick={prevDay} style={{ border: '1.5px solid rgba(255,255,255,.3)', borderRadius: '50%', width: 26, height: 26, display: 'grid', placeItems: 'center', background: 'transparent', cursor: 'pointer', color: '#fff', flexShrink: 0 }}>
            <ChevronLeft size={13} strokeWidth={2.5} />
          </button>
          <label style={{ position: 'relative', cursor: 'pointer', fontWeight: 700, fontSize: 11, color: isDiaHoy ? '#6ee7b7' : 'rgba(255,255,255,.9)', padding: '4px 12px', border: '1.5px solid rgba(255,255,255,.28)', borderRadius: 14, background: 'rgba(255,255,255,.07)', display: 'inline-block', userSelect: 'none', whiteSpace: 'nowrap' }}>
            {labelDia(filterDate)}
            <input type="date" value={filterDate} onChange={e => switchDate(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
          </label>
          <button onClick={nextDay} style={{ border: '1.5px solid rgba(255,255,255,.3)', borderRadius: '50%', width: 26, height: 26, display: 'grid', placeItems: 'center', background: 'transparent', cursor: 'pointer', color: '#fff', flexShrink: 0 }}>
            <ChevronRight size={13} strokeWidth={2.5} />
          </button>
          {!isDiaHoy && (
            <button onClick={() => switchDate(todayISO())} style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', border: '1.5px solid rgba(255,255,255,.3)', borderRadius: 12, background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* ── Meta: Saldo Inicial / Saldo Final ──────────────────── */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${LINE}` }}>
        {/* Saldo Inicial */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', borderRight: `1px solid ${LINE_SOFT}` }}>
          <span style={{ background: '#e4e4e8', fontWeight: 700, fontSize: 11, letterSpacing: 0.5, display: 'flex', alignItems: 'center', padding: '0 12px', whiteSpace: 'nowrap', borderRight: `1px solid ${LINE}` }}>
            SALDO INICIAL
          </span>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', flex: 1, gap: 4 }}>
            <span style={{ color: '#9a9aa3', fontWeight: 700, fontSize: 13 }}>$</span>
            <input
              type="text" value={saldoIni}
              onChange={e => setSaldoIni(e.target.value)}
              onBlur={handleSaldoBlur}
              placeholder="0.00"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#1a51c4', width: '100%', height: 36 }}
            />
          </div>
        </div>
        {/* Saldo Final */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
          <span style={{ background: '#e4e4e8', fontWeight: 700, fontSize: 11, letterSpacing: 0.5, display: 'flex', alignItems: 'center', padding: '0 12px', whiteSpace: 'nowrap', borderRight: `1px solid ${LINE}` }}>
            SALDO FINAL
          </span>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', gap: 4 }}>
            <span style={{ color: '#9a9aa3', fontWeight: 700, fontSize: 13 }}>$</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: saldoFinal >= 0 ? '#1a51c4' : SALIDA_TX }}>
              {fmt(saldoFinal)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 500 }}>
          <thead>
            <tr>
              <th style={{ ...thBase, width: 38 }}>#</th>
              <th style={{ ...thBase, width: 64, color: VENTA_TX }}>VENTA</th>
              <th style={{ ...thBase, width: 64, color: SALIDA_TX }}>SALIDA</th>
              <th style={{ ...thBase, textAlign: 'left', paddingLeft: 10 }}>PRODUCTO / DESCRIPCIÓN</th>
              <th style={{ ...thBase, width: 110 }}>PRECIO</th>
              <th style={{ ...thBase, width: 136 }}>MÉTODO</th>
              <th style={{ ...thBase, width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {dayRows.map((row, i) => {
              const isV = row.tipo === 'venta'
              const isS = row.tipo === 'salida'
              return (
                <tr key={row.id} style={{ background: isV ? 'rgba(217,239,210,.14)' : isS ? 'rgba(251,224,234,.14)' : '#fff' }}>
                  {/* Nº */}
                  <td style={{ ...tdBase, textAlign: 'center', fontSize: 10, color: '#aaa', fontWeight: 700 }}>
                    {String(i + 1).padStart(2, '0')}
                  </td>

                  {/* VENTA toggle */}
                  <td style={{ ...tdBase, cursor: 'pointer', background: isV ? VENTA_BG : undefined }}
                    onClick={() => toggleTipo(i, 'venta')}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 5 }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: `1.8px solid ${isV ? VENTA_TX : '#c2c2cc'}`,
                        background: isV ? VENTA_TX : 'transparent',
                        display: 'grid', placeItems: 'center',
                      }}>
                        {isV && CHECK}
                      </div>
                      {isV && <span style={{ fontSize: 10, fontWeight: 800, color: VENTA_TX }}>V</span>}
                    </div>
                  </td>

                  {/* SALIDA toggle */}
                  <td style={{ ...tdBase, cursor: 'pointer', background: isS ? SALIDA_BG : undefined }}
                    onClick={() => toggleTipo(i, 'salida')}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 5 }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: `1.8px solid ${isS ? SALIDA_TX : '#c2c2cc'}`,
                        background: isS ? SALIDA_TX : 'transparent',
                        display: 'grid', placeItems: 'center',
                      }}>
                        {isS && CHECK}
                      </div>
                      {isS && <span style={{ fontSize: 10, fontWeight: 800, color: SALIDA_TX }}>S</span>}
                    </div>
                  </td>

                  {/* Producto */}
                  <td style={tdBase}>
                    <input
                      value={row.producto}
                      onChange={e => updRow(i, 'producto', e.target.value)}
                      placeholder="Producto o descripción…"
                      style={{ width: '100%', height: '100%', minHeight: 32, padding: '0 9px', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: '#1a1a22' }}
                    />
                  </td>

                  {/* Precio */}
                  <td style={tdBase}>
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 7px', gap: 3 }}>
                      <span style={{ color: '#9a9aa3', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>$</span>
                      <input
                        type="text" value={row.precio}
                        onChange={e => updRow(i, 'precio', e.target.value)}
                        onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n) && n > 0) updRow(i, 'precio', n.toFixed(2)) }}
                        placeholder="0.00"
                        style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#1a1a22', textAlign: 'right', minWidth: 0 }}
                      />
                    </div>
                  </td>

                  {/* Método */}
                  <td style={{ ...tdBase, padding: 0 }}>
                    <div style={{ display: 'flex', height: '100%' }}>
                      {['Efectivo', 'Banco'].map((m, mi) => (
                        <div key={m}
                          onClick={() => toggleMetodo(i, m)}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: row.metodo === m ? 800 : 600,
                            color: row.metodo === m ? NAVY : '#aaa',
                            cursor: 'pointer', userSelect: 'none',
                            borderRight: mi === 0 ? `1px solid ${LINE_SOFT}` : 'none',
                            background: row.metodo === m ? '#e7eefb' : 'transparent',
                            transition: 'background 0.12s',
                          }}
                        >
                          {m}
                        </div>
                      ))}
                    </div>
                  </td>

                  {/* Eliminar */}
                  <td style={{ ...tdBase, textAlign: 'center' }}>
                    <button
                      onClick={() => deleteRow(i)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ddd', padding: 3, display: 'grid', placeItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#e57373'}
                      onMouseLeave={e => e.currentTarget.style.color = '#ddd'}
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Totales */}
          <tfoot>
            <tr>
              <td colSpan={4} style={{ ...tdBase, textAlign: 'right', paddingRight: 14, fontWeight: 800, fontSize: 11, letterSpacing: 0.5, background: '#f4f3f6', color: '#111018' }}>
                TOTAL DEL DÍA
              </td>
              <td colSpan={2} style={{ ...tdBase, background: '#f4f3f6', padding: '0 12px' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  {totalVentas > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: VENTA_TX }}>
                      ▲ ${fmt(totalVentas)}
                    </span>
                  )}
                  {totalSalidas > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: SALIDA_TX }}>
                      ▼ ${fmt(totalSalidas)}
                    </span>
                  )}
                  {totalVentas === 0 && totalSalidas === 0 && (
                    <span style={{ fontSize: 12, color: '#bbb' }}>—</span>
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
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px', border: 'none', borderTop: `1px solid ${LINE_SOFT}`,
          background: 'transparent', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: '#bbb',
          transition: 'background 0.12s, color 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#f8f7f9'; e.currentTarget.style.color = '#555' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#bbb' }}
      >
        <Plus size={12} strokeWidth={2.5} />
        Agregar fila
      </button>
    </section>
  )
}
