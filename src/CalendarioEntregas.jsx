import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Clock, CreditCard, Banknote, Smartphone, Pencil } from 'lucide-react'
import { db } from './firebase'
import { getDocs, collection, query, where } from 'firebase/firestore'

const NAVY      = '#1f2b5e'
const PINK_HI   = '#fbe0ea'
const PINK_TEXT = '#d9748f'
const MINT_BG   = '#d9efd2'
const MINT_TEXT = '#5d8a49'

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

function NotaCard({ nota, onEdit }) {
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
              <Clock size={12} strokeWidth={2} /> {nota.horaEntrega}
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

      {/* ── Botón editar ── */}
      {onEdit && (
        <button
          onClick={() => onEdit(nota)}
          style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px', borderRadius:10, border:`1.5px solid ${NAVY}`, background:'#fff', color:NAVY, fontSize:12, fontWeight:700, cursor:'pointer' }}
        >
          <Pencil size={13} strokeWidth={2.5} /> Editar nota
        </button>
      )}
    </div>
  )
}

export default function CalendarioEntregas({ notas = [], onBack, onEditNota }) {
  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [sel,   setSel]   = useState(null)
  const [extraNotas, setExtraNotas] = useState([])

  const TODAY = todayKey()

  // Carga notas con fechaEntrega reciente/futura que ya no están en el prop (>14 días)
  useEffect(() => {
    const d60 = new Date()
    d60.setDate(d60.getDate() - 60)
    const cutoff = `${d60.getFullYear()}-${String(d60.getMonth()+1).padStart(2,'0')}-${String(d60.getDate()).padStart(2,'0')}`
    getDocs(query(collection(db, 'notas'), where('fechaEntrega', '>=', cutoff)))
      .then(snap => setExtraNotas(snap.docs.map(d => d.data())))
  }, [])

  // Merge: prop (tiempo real) tiene prioridad; extra llena los huecos de notas viejas
  const allNotas = useMemo(() => {
    const byId = new Map(notas.map(n => [n.id, n]))
    extraNotas.forEach(n => { if (!byId.has(n.id)) byId.set(n.id, n) })
    return [...byId.values()]
  }, [notas, extraNotas])

  const deliveryMap = useMemo(() => {
    const map = {}
    allNotas.forEach(n => {
      if (!n.fechaEntrega) return
      const key = n.fechaEntrega.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(n)
    })
    return map
  }, [allNotas])

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
    const prefix = `${year}-${String(month+1).padStart(2,'0')}`
    const mes = Object.entries(deliveryMap)
      .filter(([k]) => k.startsWith(prefix))
      .flatMap(([, ns]) => ns)
    const total     = mes.length
    const pagados   = mes.filter(isPagada).length
    return { total, pagados, pendientes: total - pagados }
  }, [deliveryMap, year, month])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
    setSel(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
    setSel(null)
  }

  const selNotas = sel ? (deliveryMap[sel] || []) : []

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
        <div style={{ width:80 }} />
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
                selNotas.map((n, i) => <NotaCard key={n.id || i} nota={n} onEdit={onEditNota} />)
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
