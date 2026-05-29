import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Package, Clock, CreditCard, Banknote, Smartphone } from 'lucide-react'

// ── Design tokens ────────────────────────────────────────────
const NAVY      = '#1f2b5e'
const PINK_HI   = '#fbe0ea'
const PINK_TEXT = '#d9748f'
const MINT_BG   = '#d9efd2'
const MINT_TEXT = '#5d8a49'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS  = ['L','M','M','J','V','S','D']

const fmt = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const fmtMoney = (n) => {
  const v = Number(n)
  return isNaN(v) ? '-' : `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}
const todayKey = () => {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
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
      <Icon size={10} strokeWidth={2.5} />
      {method}
    </span>
  )
}

function NotaCard({ nota }) {
  const pagado   = (nota.pagos || []).reduce((s, p) => s + Number(p.monto || 0), 0)
  const total    = Number(nota.totalGeneral || nota.costo || 0)
  const resta    = Math.max(0, total - pagado)
  const pagadoPct = total > 0 ? Math.round((pagado / total) * 100) : 0
  const isPagado = resta <= 0

  return (
    <div style={{ border:'2px solid #2b2731', borderRadius:16, background:'#fff', padding:'14px 16px', marginBottom:10 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <span style={{ fontFamily:'var(--font-display,Georgia)', fontWeight:800, fontSize:15, color:'#2b2731' }}>
          Folio {nota.folio || '—'}
        </span>
        <span style={{
          background: isPagado ? MINT_BG : PINK_HI,
          color:      isPagado ? MINT_TEXT : PINK_TEXT,
          border:     `1.5px solid ${isPagado ? MINT_TEXT : PINK_TEXT}`,
          borderRadius: 999, padding:'2px 10px', fontSize:11, fontWeight:700
        }}>
          {isPagado ? 'Pagado' : 'Pendiente'}
        </span>
      </div>

      {/* Client */}
      <p style={{ fontSize:14, fontWeight:700, color:'#2b2731', marginBottom:4 }}>
        {nota.cli || 'Sin cliente'}
      </p>

      {/* Time & products */}
      <div style={{ display:'flex', gap:12, marginBottom:8, flexWrap:'wrap' }}>
        {nota.hora && (
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#666', fontWeight:600 }}>
            <Clock size={12} strokeWidth={2} />
            {nota.hora}
          </span>
        )}
        {nota.lugar && (
          <span style={{ fontSize:12, color:'#666', fontWeight:600 }}>
            📍 {nota.lugar}
          </span>
        )}
        {(nota.prods || []).length > 0 && (
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'#666', fontWeight:600 }}>
            <Package size={12} strokeWidth={2} />
            {(nota.prods || []).filter(p => p.descripcion).length} producto(s)
          </span>
        )}
      </div>

      {/* Products list */}
      {(nota.prods || []).filter(p => p.descripcion).length > 0 && (
        <div style={{ background:'#f7f6f8', borderRadius:8, padding:'6px 10px', marginBottom:8 }}>
          {(nota.prods || []).filter(p => p.descripcion).map((p, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#444', marginBottom:2, fontWeight:500 }}>
              <span>{p.cantidad ? `${p.cantidad}x ` : ''}{p.descripcion}</span>
              {p.precioU && <span>{fmtMoney(Number(p.cantidad||1) * Number(p.precioU))}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Payments */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
        {(nota.pagos || []).map((p, i) => (
          <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, background:'#f3f4f6', borderRadius:8, padding:'3px 8px', color:'#444' }}>
            <MethodBadge method={p.met} />
            <span style={{ marginLeft:2 }}>{fmtMoney(p.monto)}</span>
          </span>
        ))}
      </div>

      {/* Money summary */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
        {[
          { label:'Total', value: fmtMoney(total), color:'#2b2731' },
          { label:'Pagado', value: fmtMoney(pagado), color: MINT_TEXT },
          { label:'Resta', value: resta > 0 ? fmtMoney(resta) : 'Pagado', color: resta > 0 ? PINK_TEXT : MINT_TEXT },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background:'#f7f6f8', borderRadius:8, padding:'6px 8px', textAlign:'center' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#999', marginBottom:2, letterSpacing:.5 }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ marginTop:8, height:5, background:'#e4e4e8', borderRadius:999, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${Math.min(100, pagadoPct)}%`, background: isPagado ? MINT_TEXT : PINK_TEXT, borderRadius:999, transition:'width .4s' }} />
        </div>
      )}
    </div>
  )
}

export default function CalendarioEntregas({ notas = [], onBack }) {
  const today  = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [sel,   setSel]   = useState(null) // selected 'YYYY-MM-DD'

  const TODAY = todayKey()

  // Map: dateKey → [nota, ...]
  const deliveryMap = useMemo(() => {
    const map = {}
    notas.forEach(n => {
      if (!n.fechaEntrega) return
      const key = n.fechaEntrega.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(n)
    })
    return map
  }, [notas])

  // Calendar grid cells
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

  // Stats for the month
  const monthStats = useMemo(() => {
    const prefix = `${year}-${String(month+1).padStart(2,'0')}`
    const mes = Object.entries(deliveryMap)
      .filter(([k]) => k.startsWith(prefix))
      .flatMap(([, ns]) => ns)
    const total   = mes.length
    const pagados = mes.filter(n => {
      const pagado = (n.pagos||[]).reduce((s,p)=>s+Number(p.monto||0),0)
      return pagado >= Number(n.totalGeneral||n.costo||0)
    }).length
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
            { label:'Entregas', value: monthStats.total,     bg:'#fff',    color:'#2b2731' },
            { label:'Pagadas',  value: monthStats.pagados,   bg: MINT_BG,  color: MINT_TEXT },
            { label:'Pend.',    value: monthStats.pendientes, bg: PINK_HI, color: PINK_TEXT },
          ].map(({ label, value, bg, color }) => (
            <div key={label} style={{ background:bg, border:'2px solid #2b2731', borderRadius:14, padding:'12px 10px', textAlign:'center', boxShadow:'3px 3px 0 #2b2731' }}>
              <div style={{ fontSize:22, fontWeight:800, color }}>{value}</div>
              <div style={{ fontSize:11, fontWeight:700, color:'#888', marginTop:2, letterSpacing:.5 }}>{label}</div>
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
            const rows = []
            for (let i = 0; i < grid.length; i += 7) {
              const week = grid.slice(i, i + 7)
              // pad last row
              while (week.length < 7) week.push(null)
              const isLastRow = i + 7 >= grid.length
              rows.push(
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
                        onClick={() => { setSel(isSel ? null : cell.key) }}
                        style={{
                          padding:'8px 4px 6px',
                          minHeight:56,
                          borderRight: j < 6 ? '1px solid #e4e4e8' : 'none',
                          background: isSel ? NAVY : isToday ? '#fff9f0' : isWeekend ? '#fef6f8' : '#fff',
                          cursor: 'pointer',
                          transition: 'background .15s',
                          display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                        }}
                      >
                        <span style={{
                          width:26, height:26,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          borderRadius: '50%',
                          background: isSel ? '#fff' : isToday ? NAVY : 'transparent',
                          color: isSel ? NAVY : isToday ? '#fff' : isWeekend ? PINK_TEXT : '#2b2731',
                          fontWeight: (isToday || isSel) ? 800 : 600,
                          fontSize:13,
                        }}>
                          {cell.day}
                        </span>
                        {hasEntrega && (
                          <div style={{ display:'flex', gap:2, flexWrap:'wrap', justifyContent:'center' }}>
                            {cell.deliveries.slice(0, 3).map((n, k) => {
                              const pagado = (n.pagos||[]).reduce((s,p)=>s+Number(p.monto||0),0)
                              const total  = Number(n.totalGeneral||n.costo||0)
                              const done   = pagado >= total
                              return (
                                <span key={k} style={{ width:6, height:6, borderRadius:'50%', background: isSel ? '#fff' : done ? MINT_TEXT : PINK_TEXT }} />
                              )
                            })}
                            {cell.deliveries.length > 3 && (
                              <span style={{ fontSize:8, fontWeight:800, color: isSel ? '#fff' : '#666' }}>+{cell.deliveries.length-3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            }
            return rows
          })()}
        </div>

        {/* ── LEGEND ── */}
        <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:12, fontSize:11, fontWeight:700, color:'#888' }}>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background: MINT_TEXT, display:'inline-block' }} />
            Pagada
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background: PINK_TEXT, display:'inline-block' }} />
            Pendiente
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background: NAVY, display:'inline-block' }} />
            Hoy
          </span>
        </div>
      </div>

      {/* ── SIDE DRAWER: deliveries for selected day ── */}
      <AnimatePresence>
        {sel && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity:0 }}
              animate={{ opacity:1 }}
              exit={{ opacity:0 }}
              onClick={() => setSel(null)}
              style={{ position:'fixed', inset:0, background:'rgba(43,39,49,.45)', zIndex:100 }}
            />
            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ y:'100%' }}
              animate={{ y:0 }}
              exit={{ y:'100%' }}
              transition={{ type:'spring', stiffness:340, damping:30 }}
              style={{
                position:'fixed', bottom:0, left:0, right:0, zIndex:101,
                background:'#f5f0e8', borderTop:'2px solid #2b2731',
                borderRadius:'22px 22px 0 0',
                maxHeight:'80vh', overflowY:'auto',
                padding:'0 16px 32px',
              }}
            >
              {/* Handle */}
              <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px' }}>
                <div style={{ width:36, height:4, borderRadius:999, background:'#c9c9d0' }} />
              </div>

              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, paddingTop:4 }}>
                <div>
                  <h2 style={{ fontFamily:'var(--font-display,Georgia)', fontWeight:800, fontSize:17, color:NAVY, margin:0 }}>
                    Entregas del {fmt(sel)}
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
                selNotas.map((n, i) => <NotaCard key={n.id || i} nota={n} />)
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
