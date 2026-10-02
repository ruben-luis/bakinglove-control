import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { collection, query as fsQuery, where, onSnapshot, getDocs } from 'firebase/firestore'
import { ChevronLeft, ChevronRight, X, Clock, CreditCard, Banknote, Smartphone, Pencil, Trash2, Search } from 'lucide-react'
import { db } from './firebase'
import { isNotaCongelada } from './balance'

const NAVY      = '#1f2b5e'
const PINK_HI   = '#fbe0ea'
const PINK_TEXT = '#d9748f'
const MINT_BG   = '#d9efd2'
const MINT_TEXT = '#5d8a49'
const RED_BG    = '#fbe0ea'
const RED_TEXT  = '#c23a63'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS  = ['L','M','M','J','V','S','D']

const fmtDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const fmtMoney = (n) => {
  const v = Number(n)
  return isNaN(v) || v === 0 ? '$0.00' : `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const todayKey = () => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
}

const isPagada = (n) => n.estado === 'pagado' || Number(n.resta ?? Infinity) <= 0

const fmtHoraRango = (hora) => {
  if (!hora) return ''
  const m = /^(\d{1,2}):00$/.exec(hora)
  if (!m) return hora
  const h = Number(m[1])
  const per = (x) => (x % 24) < 12 ? 'am' : 'pm'
  const h12 = (x) => { const v = x % 12; return v === 0 ? 12 : v }
  return `${h12(h)}${per(h)}–${h12(h + 1)}${per(h + 1)}`
}

const METHOD_ICON = { Transferencia: Smartphone, Terminal: CreditCard, Efectivo: Banknote }

function MethodBadge({ method }) {
  const Icon = METHOD_ICON[method] || CreditCard
  const styles = {
    Transferencia: { bg: '#dbeafe', color: '#1d4ed8' },
    Terminal:      { bg: '#ede9fe', color: '#6d28d9' },
    Efectivo:      { bg: MINT_BG,   color: MINT_TEXT  },
  }
  const s = styles[method] || { bg: '#f3f4f6', color: '#374151' }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, background:s.bg, color:s.color, borderRadius:999, padding:'2px 8px', fontSize:11, fontWeight:700, border:'1.5px solid currentColor' }}>
      <Icon size={10} strokeWidth={2.5} /> {method}
    </span>
  )
}

function NotaCard({ nota, onEdit, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const total   = Number(nota.totalPedido || 0)
  const pagado  = nota.totalPagado !== undefined
    ? Number(nota.totalPagado)
    : (nota.pagos || []).reduce((s, p) => s + Number(p.monto || 0), 0)
  const resta   = nota.resta !== undefined
    ? Number(nota.resta)
    : Math.max(0, total - pagado)
  const liquidado  = isPagada(nota)
  const pagadoPct  = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0

  const productos = (nota.productos || []).filter(p => p.descripcion)
  const pagosValidos = (nota.pagos || []).filter(p => p.monto && Number(p.monto) > 0)

  return (
    <div style={{ border:'2px solid #2b2731', borderRadius:16, background:'#fff', padding:'14px 16px', marginBottom:12 }}>

      {/* ── Encabezado: folio + estado ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:13, color:'#aaa', letterSpacing:.5, marginBottom:2 }}>
            {nota.folio || '—'}
          </div>
          <div style={{ fontFamily:'var(--font-display,Georgia)', fontWeight:800, fontSize:17, color:'#2b2731', lineHeight:1.15 }}>
            {nota.cliente || 'Sin cliente'}
          </div>
        </div>
        <div style={{ flexShrink:0 }}>
          {liquidado ? (
            <span style={{ background:MINT_BG, color:MINT_TEXT, border:`1.5px solid ${MINT_TEXT}`, borderRadius:999, padding:'4px 12px', fontSize:11, fontWeight:800, display:'block', textAlign:'center' }}>
              ✓ Pagado
            </span>
          ) : (
            <div style={{ textAlign:'right' }}>
              <span style={{ background:PINK_HI, color:PINK_TEXT, border:`1.5px solid ${PINK_TEXT}`, borderRadius:999, padding:'4px 12px', fontSize:11, fontWeight:800, display:'block' }}>
                Pendiente
              </span>
              <span style={{ fontSize:13, fontWeight:800, color:PINK_TEXT, display:'block', marginTop:3 }}>
                Falta {fmtMoney(resta)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Hora y lugar ── */}
      {(nota.horaEntrega || nota.lugarEntrega) && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:10 }}>
          {nota.horaEntrega && (
            <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#555', fontWeight:600, background:'#f3f4f6', borderRadius:8, padding:'3px 9px' }}>
              <Clock size={12} strokeWidth={2} /> {fmtHoraRango(nota.horaEntrega)}
            </span>
          )}
          {nota.lugarEntrega && (
            <span style={{ fontSize:12, color:'#555', fontWeight:600, background:'#f3f4f6', borderRadius:8, padding:'3px 9px' }}>
              📍 {nota.lugarEntrega}
            </span>
          )}
        </div>
      )}

      {/* ── Productos ── */}
      {productos.length > 0 && (
        <div style={{ background:'#f7f6f8', borderRadius:10, padding:'8px 10px', marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#aaa', letterSpacing:.5, marginBottom:5 }}>PRODUCTOS</div>
          {productos.map((p, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, color:'#333', marginBottom: i < productos.length-1 ? 4 : 0 }}>
              <span style={{ fontWeight:600 }}>
                {p.cantidad ? <strong style={{ color:'#2b2731' }}>{p.cantidad}×</strong> : null}
                {' '}{p.descripcion}
              </span>
              {p.precioU && Number(p.precioU) > 0 && (
                <span style={{ fontWeight:700, color:'#2b2731', marginLeft:8 }}>
                  {fmtMoney(Number(p.cantidad || 1) * Number(p.precioU))}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Pagos realizados ── */}
      {pagosValidos.length > 0 && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:10, fontWeight:800, color:'#aaa', letterSpacing:.5, marginBottom:5 }}>PAGOS REALIZADOS</div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {pagosValidos.map((p, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f7f6f8', borderRadius:8, padding:'6px 10px', gap:8 }}>
                <MethodBadge method={p.metodoPago} />
                <span style={{ flex:1 }} />
                {p.fecha && (
                  <span style={{ fontSize:10, color:'#bbb', fontWeight:600 }}>{fmtDate(p.fecha)}</span>
                )}
                <span style={{ fontSize:14, fontWeight:800, color:'#2b2731' }}>{fmtMoney(p.monto)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Resumen de dinero ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom: total > 0 ? 8 : 0 }}>
        {[
          { label:'Total pedido', value: fmtMoney(total),  color:'#2b2731' },
          { label:'Pagado',       value: fmtMoney(pagado), color: MINT_TEXT },
          { label: liquidado ? 'Liquidado' : 'Pendiente',
            value: liquidado ? '✓' : fmtMoney(resta),
            color: liquidado ? MINT_TEXT : PINK_TEXT },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'#f7f6f8', borderRadius:8, padding:'6px 6px', textAlign:'center' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#aaa', marginBottom:2, letterSpacing:.3 }}>{label.toUpperCase()}</div>
            <div style={{ fontSize:13, fontWeight:800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Barra de progreso ── */}
      {total > 0 && (
        <div style={{ height:5, background:'#e4e4e8', borderRadius:999, overflow:'hidden', marginBottom:10 }}>
          <div style={{ height:'100%', width:`${pagadoPct}%`, background: liquidado ? MINT_TEXT : PINK_TEXT, borderRadius:999, transition:'width .4s' }} />
        </div>
      )}

      {/* ── Botones editar / eliminar ── */}
      {confirmDel ? (
        <div style={{ background:RED_BG, border:`1.5px solid ${RED_TEXT}`, borderRadius:10, padding:'10px 12px' }}>
          <div style={{ fontWeight:700, fontSize:12, color:RED_TEXT, marginBottom:8, textAlign:'center' }}>
            ¿Seguro? Esta acción no se puede deshacer.
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={() => setConfirmDel(false)}
              style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid #bfbfc6', background:'#fff', color:'#555', fontSize:12, fontWeight:700, cursor:'pointer' }}
            >
              No, volver
            </button>
            <button
              onClick={() => { onDelete(nota.id); setConfirmDel(false) }}
              style={{ flex:1, padding:'8px', borderRadius:8, border:'none', background:RED_TEXT, color:'#fff', fontSize:12, fontWeight:800, cursor:'pointer' }}
            >
              Sí, eliminar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns: onDelete ? '1fr 1fr' : '1fr', gap:8 }}>
          {onEdit && (
            <button
              onClick={() => onEdit(nota)}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:10, border:`1.5px solid ${NAVY}`, background:'#fff', color:NAVY, fontSize:12, fontWeight:700, cursor:'pointer' }}
            >
              <Pencil size={13} strokeWidth={2.5} /> Editar nota
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => setConfirmDel(true)}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:10, border:`1.5px solid ${RED_TEXT}`, background:'#fff', color:RED_TEXT, fontSize:12, fontWeight:700, cursor:'pointer' }}
            >
              <Trash2 size={13} strokeWidth={2.5} /> Eliminar nota
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function CalendarioEntregas({ onBack, onEditNota, onDeleteNota }) {
  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [sel,   setSel]   = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [pendingReopen, setPendingReopen] = useState(null)
  const [monthNotas, setMonthNotas] = useState([])
  const [searchNotas, setSearchNotas] = useState(null)
  const TODAY = todayKey()

  // Consulta acotada al mes visible (por fechaEntrega): el prop `notas` de
  // App.jsx solo cubre el mes en curso (+gracia), así que una entrega futura
  // o pasada de una nota ya "congelada" (sin ediciones recientes) desaparecía
  // del calendario. Aquí se pide directamente el mes que se está mostrando.
  useEffect(() => {
    const pad = String(month + 1).padStart(2, '0')
    const monthStart = `${year}-${pad}-01`
    const nextY = month === 11 ? year + 1 : year
    const nextM = month === 11 ? 1 : month + 2
    const monthEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`
    const unsub = onSnapshot(
      fsQuery(collection(db, 'notas'),
        where('fechaEntrega', '>=', monthStart),
        where('fechaEntrega', '<', monthEnd)),
      snap => setMonthNotas(snap.docs.map(d => d.data()))
    )
    return () => unsub()
  }, [year, month])

  // Buscador perezoso: solo trae el historial completo de notas la primera
  // vez que se abre el buscador (folio/cliente pueden estar en cualquier mes).
  useEffect(() => {
    if (!searchOpen || searchNotas !== null) return
    getDocs(collection(db, 'notas')).then(snap => setSearchNotas(snap.docs.map(d => d.data())))
  }, [searchOpen, searchNotas])

  function handleEditClick(nota) {
    if (isNotaCongelada(nota)) setPendingReopen(nota)
    else onEditNota?.(nota)
  }

  const deliveryMap = useMemo(() => {
    const map = {}
    monthNotas.forEach(n => {
      if (!n.fechaEntrega) return
      const key = n.fechaEntrega.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(n)
    })
    return map
  }, [monthNotas])

  const grid = useMemo(() => {
    const firstDay = new Date(year, month, 1)
    let startOffset = firstDay.getDay() - 1
    if (startOffset < 0) startOffset = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      cells.push({ day: d, key, deliveries: deliveryMap[key] || [] })
    }
    return cells
  }, [year, month, deliveryMap])

  const monthStats = useMemo(() => {
    const total     = monthNotas.length
    const pagados   = monthNotas.filter(isPagada).length
    return { total, pagados, pendientes: total - pagados }
  }, [monthNotas])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSel(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSel(null)
  }

  const selNotas = sel ? (deliveryMap[sel] || []) : []

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || !searchNotas) return []
    return searchNotas
      .filter(n => (n.folio || '').toLowerCase().includes(q) || (n.cliente || '').toLowerCase().includes(q))
      .sort((a, b) => (b.fechaEntrega || '').localeCompare(a.fechaEntrega || ''))
      .slice(0, 30)
  }, [searchNotas, query])

  const closeSearch = () => { setSearchOpen(false); setQuery('') }

  const goToNota = (n) => {
    if (!n.fechaEntrega) return
    const key = n.fechaEntrega.slice(0, 10)
    const [y, m] = key.split('-').map(Number)
    setYear(y); setMonth(m - 1); setSel(key)
    closeSearch()
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f5f0e8', fontFamily:'inherit' }}>

      {/* ── NAV ── */}
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'2px solid #2b2731', background:'#fff', position:'sticky', top:0, zIndex:50 }}>
        <button
          onClick={onBack}
          style={{ display:'flex', alignItems:'center', gap:6, border:'2px solid #2b2731', borderRadius:12, background:'#f5f0e8', padding:'7px 14px', fontWeight:700, fontSize:13, color:'#2b2731', cursor:'pointer' }}
        >
          <ChevronLeft size={16} strokeWidth={2.5} /> Inicio
        </button>
        <span style={{ fontFamily:'var(--font-display,Georgia)', fontWeight:800, fontSize:17, color:NAVY }}>
          Calendario de Entregas
        </span>
        <button
          onClick={() => setSearchOpen(true)}
          style={{ display:'flex', alignItems:'center', gap:6, border:'2px solid #2b2731', borderRadius:12, background:'#f5f0e8', padding:'7px 12px', fontWeight:700, fontSize:13, color:'#2b2731', cursor:'pointer' }}
        >
          <Search size={16} strokeWidth={2.5} />
        </button>
      </header>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'20px 16px 80px' }}>

        {/* ── STATS ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
          {[
            { label:'Entregas', value: monthStats.total,      bg:'#fff',   color:'#2b2731' },
            { label:'Pagadas',  value: monthStats.pagados,    bg: MINT_BG, color: MINT_TEXT },
            { label:'Pendiente',value: monthStats.pendientes, bg: PINK_HI, color: PINK_TEXT },
          ].map(({ label, value, bg, color }) => (
            <div key={label} style={{ background:bg, border:'2px solid #2b2731', borderRadius:14, padding:'12px 10px', textAlign:'center', boxShadow:'3px 3px 0 #2b2731' }}>
              <div style={{ fontSize:22, fontWeight:800, color }}>{value}</div>
              <div style={{ fontSize:11, fontWeight:700, color:'#888', marginTop:2, letterSpacing:.5 }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* ── MONTH NAV ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'#fff', border:'2px solid #2b2731', borderRadius:16, padding:'10px 16px', marginBottom:14, boxShadow:'4px 4px 0 #2b2731' }}>
          <button onClick={prevMonth} style={{ border:'2px solid #2b2731', borderRadius:10, padding:'6px 10px', background:'#f5f0e8', cursor:'pointer', display:'flex', alignItems:'center' }}>
            <ChevronLeft size={18} strokeWidth={2.5} color="#2b2731" />
          </button>
          <span style={{ fontFamily:'var(--font-display,Georgia)', fontWeight:800, fontSize:16, color:NAVY }}>
            {MESES[month]} {year}
          </span>
          <button onClick={nextMonth} style={{ border:'2px solid #2b2731', borderRadius:10, padding:'6px 10px', background:'#f5f0e8', cursor:'pointer', display:'flex', alignItems:'center' }}>
            <ChevronRight size={18} strokeWidth={2.5} color="#2b2731" />
          </button>
        </div>

        {/* ── CALENDAR GRID ── */}
        <div style={{ background:'#fff', border:'2px solid #2b2731', borderRadius:18, overflow:'hidden', boxShadow:'4px 4px 0 #2b2731' }}>
          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'2px solid #2b2731' }}>
            {DIAS.map((d, i) => (
              <div key={i} style={{
                textAlign:'center', padding:'9px 0',
                fontWeight:800, fontSize:12, letterSpacing:.5,
                color: i >= 5 ? PINK_TEXT : NAVY,
                borderRight: i < 6 ? '1px solid #e4e4e8' : 'none',
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          {(() => {
            const rowEls = []
            for (let i = 0; i < grid.length; i += 7) {
              const week = grid.slice(i, i + 7)
              while (week.length < 7) week.push(null)
              const isLastRow = i + 7 >= grid.length
              rowEls.push(
                <div key={i} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom: isLastRow ? 'none' : '1px solid #e4e4e8' }}>
                  {week.map((cell, j) => {
                    if (!cell) return (
                      <div key={j} style={{ padding:'10px 4px', minHeight:56, borderRight: j < 6 ? '1px solid #e4e4e8' : 'none', background:'#faf9f7' }} />
                    )
                    const isToday    = cell.key === TODAY
                    const isSel      = cell.key === sel
                    const hasEntrega = cell.deliveries.length > 0
                    const isWeekend  = j >= 5
                    return (
                      <div
                        key={j}
                        onClick={() => setSel(isSel ? null : cell.key)}
                        style={{
                          padding:'8px 4px 6px', minHeight:56,
                          borderRight: j < 6 ? '1px solid #e4e4e8' : 'none',
                          background: isSel ? NAVY : isToday ? '#fff9f0' : isWeekend ? '#fef6f8' : '#fff',
                          cursor:'pointer', transition:'background .15s',
                          display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                        }}
                      >
                        <span style={{
                          width:26, height:26,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          borderRadius:'50%',
                          background: isSel ? '#fff' : isToday ? NAVY : 'transparent',
                          color: isSel ? NAVY : isToday ? '#fff' : isWeekend ? PINK_TEXT : '#2b2731',
                          fontWeight: (isToday || isSel) ? 800 : 600,
                          fontSize:13,
                        }}>
                          {cell.day}
                        </span>
                        {hasEntrega && (
                          <div style={{ display:'flex', gap:2, flexWrap:'wrap', justifyContent:'center' }}>
                            {cell.deliveries.slice(0, 3).map((n, k) => (
                              <span key={k} style={{ width:6, height:6, borderRadius:'50%', background: isSel ? '#fff' : isPagada(n) ? MINT_TEXT : PINK_TEXT }} />
                            ))}
                            {cell.deliveries.length > 3 && (
                              <span style={{ fontSize:8, fontWeight:800, color: isSel ? '#fff' : '#888' }}>+{cell.deliveries.length-3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }
            return rowEls
          })()}
        </div>

        {/* ── LEGEND ── */}
        <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:12, fontSize:11, fontWeight:700, color:'#888' }}>
          {[
            { dot: MINT_TEXT, label:'Pagada' },
            { dot: PINK_TEXT, label:'Pendiente' },
            { dot: NAVY,      label:'Hoy' },
          ].map(({ dot, label }) => (
            <span key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:dot, display:'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── BOTTOM DRAWER ── */}
      <AnimatePresence>
        {sel && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setSel(null)}
              style={{ position:'fixed', inset:0, background:'rgba(43,39,49,.45)', zIndex:100 }}
            />
            <motion.div
              key="drawer"
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', stiffness:340, damping:30 }}
              style={{
                position:'fixed', bottom:0, left:0, right:0, zIndex:101,
                background:'#f5f0e8', borderTop:'2px solid #2b2731',
                borderRadius:'22px 22px 0 0',
                maxHeight:'82vh', overflowY:'auto',
                padding:'0 16px 36px',
              }}
            >
              {/* Handle */}
              <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
                <div style={{ width:36, height:4, borderRadius:999, background:'#c9c9d0' }} />
              </div>

              {/* Drawer header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, paddingTop:4 }}>
                <div>
                  <h2 style={{ fontFamily:'var(--font-display,Georgia)', fontWeight:800, fontSize:17, color:NAVY, margin:0 }}>
                    Entregas — {fmtDate(sel)}
                  </h2>
                  <p style={{ fontSize:12, color:'#888', fontWeight:600, margin:'2px 0 0' }}>
                    {selNotas.length} entrega{selNotas.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setSel(null)}
                  style={{ border:'2px solid #2b2731', borderRadius:10, padding:'6px', background:'#fff', cursor:'pointer', display:'flex', alignItems:'center' }}
                >
                  <X size={16} strokeWidth={2.5} color="#2b2731" />
                </button>
              </div>

              {selNotas.length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0', color:'#aaa', fontWeight:700, fontSize:14 }}>
                  Sin entregas para este día
                </div>
              ) : (
                selNotas.map((n, i) => <NotaCard key={n.id || i} nota={n} onEdit={handleEditClick} onDelete={onDeleteNota} />)
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── BUSCADOR ── */}
      <AnimatePresence>
        {searchOpen && (
          <>
            <motion.div
              key="search-backdrop"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={closeSearch}
              style={{ position:'fixed', inset:0, background:'rgba(43,39,49,.45)', zIndex:110 }}
            />
            <motion.div
              key="search-panel"
              initial={{ y:'-100%' }} animate={{ y:0 }} exit={{ y:'-100%' }}
              transition={{ type:'spring', stiffness:340, damping:30 }}
              style={{
                position:'fixed', top:0, left:0, right:0, zIndex:111,
                background:'#fff', borderBottom:'2px solid #2b2731',
                borderRadius:'0 0 22px 22px',
                maxHeight:'85vh', overflowY:'auto',
                padding:'16px 16px 24px',
              }}
            >
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, border:'2px solid #2b2731', borderRadius:12, padding:'8px 12px', background:'#f5f0e8' }}>
                  <Search size={16} strokeWidth={2.5} color={NAVY} />
                  <input
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Buscar por folio o nombre…"
                    style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:14, fontWeight:600, color:'#2b2731', fontFamily:'inherit' }}
                  />
                </div>
                <button
                  onClick={closeSearch}
                  style={{ border:'2px solid #2b2731', borderRadius:10, padding:'8px', background:'#f5f0e8', cursor:'pointer', display:'flex', alignItems:'center' }}
                >
                  <X size={16} strokeWidth={2.5} color="#2b2731" />
                </button>
              </div>

              {query.trim() === '' ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'#aaa', fontWeight:700, fontSize:13 }}>
                  Escribe un folio o nombre de cliente
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'#aaa', fontWeight:700, fontSize:13 }}>
                  Sin resultados
                </div>
              ) : (
                searchResults.map(n => (
                  <button
                    key={n.id}
                    onClick={() => goToNota(n)}
                    style={{ display:'flex', width:'100%', alignItems:'center', justifyContent:'space-between', gap:10, textAlign:'left', border:'1.5px solid #e4e4e8', borderRadius:12, padding:'10px 12px', marginBottom:8, background:'#fff', cursor:'pointer' }}
                  >
                    <div>
                      <div style={{ fontSize:11, fontWeight:800, color:'#aaa' }}>{n.folio || '—'}</div>
                      <div style={{ fontFamily:'var(--font-display,Georgia)', fontWeight:800, fontSize:14, color:'#2b2731' }}>{n.cliente || 'Sin cliente'}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:12, fontWeight:700, color:NAVY }}>{fmtDate(n.fechaEntrega)}</div>
                      {n.horaEntrega && (
                        <div style={{ fontSize:11, color:'#888', fontWeight:600 }}>{fmtHoraRango(n.horaEntrega)}</div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── CONFIRMACIÓN REABRIR NOTA CONGELADA ── */}
      <AnimatePresence>
        {pendingReopen && (
          <>
            <motion.div
              key="reopen-backdrop"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => setPendingReopen(null)}
              style={{ position:'fixed', inset:0, background:'rgba(43,39,49,.45)', zIndex:120 }}
            />
            <motion.div
              key="reopen-modal"
              initial={{ scale:.95, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:.95, opacity:0 }}
              style={{
                position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', zIndex:121,
                background:'#fff', border:'2px solid #2b2731', borderRadius:18,
                padding:'20px 20px', width:'calc(100% - 48px)', maxWidth:360,
                boxShadow:'4px 4px 0 #2b2731',
              }}
            >
              <h3 style={{ fontFamily:'var(--font-display,Georgia)', fontWeight:800, fontSize:16, color:NAVY, margin:'0 0 10px' }}>
                Nota de un periodo cerrado
              </h3>
              <p style={{ fontSize:13, color:'#555', fontWeight:600, lineHeight:1.4, margin:'0 0 18px' }}>
                Esta nota es de un mes ya cerrado. Al guardar cambios se reabrirá y volverá a sincronizarse en tiempo real.
              </p>
              <div style={{ display:'flex', gap:8 }}>
                <button
                  onClick={() => setPendingReopen(null)}
                  style={{ flex:1, padding:'10px', borderRadius:10, border:'1.5px solid #bfbfc6', background:'#fff', color:'#555', fontSize:13, fontWeight:700, cursor:'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { onEditNota?.(pendingReopen); setPendingReopen(null) }}
                  style={{ flex:1, padding:'10px', borderRadius:10, border:'none', background:NAVY, color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer' }}
                >
                  Continuar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
