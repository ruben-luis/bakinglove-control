import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ReceiptText, TrendingUp, TrendingDown, CalendarDays,
  Plus, Pencil, ArrowRight, Calendar,
  CakeSlice, Cookie, Candy, IceCreamCone,
  Croissant, Cherry, Cake, Coffee, ClipboardList,
  Lock, KeyRound, Store,
} from 'lucide-react'
import PinModal from './PinModal'
import { db } from './firebase'
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'

// ═══════════════════════════════════════════════════════════════
// ÍCONOS FLOTANTES DE FONDO
// ═══════════════════════════════════════════════════════════════

const FLOATERS = [
  { Icon: CakeSlice,    colorClass: 'text-pink',  top: '14%', left: '8%',  size: 46, dur: 9,  delay: 0,   r: 8  },
  { Icon: Cookie,       colorClass: 'text-mint',  top: '68%', left: '6%',  size: 40, dur: 11, delay: 1.5, r: -6 },
  { Icon: Candy,        colorClass: 'text-lilac', top: '24%', left: '88%', size: 44, dur: 10, delay: 0.8, r: 10 },
  { Icon: IceCreamCone, colorClass: 'text-sky',   top: '74%', left: '90%', size: 48, dur: 12, delay: 0.4, r: -9 },
  { Icon: Croissant,    colorClass: 'text-mint',  top: '44%', left: '94%', size: 38, dur: 13, delay: 2.2, r: 7  },
  { Icon: Cherry,       colorClass: 'text-pink',  top: '84%', left: '46%', size: 36, dur: 10, delay: 1.1, r: -8 },
  { Icon: Cake,         colorClass: 'text-lilac', top: '10%', left: '52%', size: 40, dur: 12, delay: 1.8, r: 6  },
  { Icon: Coffee,       colorClass: 'text-sky',   top: '52%', left: '3%',  size: 34, dur: 11, delay: 0.6, r: -5 },
]

function FloatingBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {FLOATERS.map(({ Icon, colorClass, top, left, size, dur, delay, r }, i) => (
        <div
          key={i}
          className={`absolute bkl-float opacity-40 ${colorClass}`}
          style={{ top, left, width: size, height: size, '--dur': `${dur}s`, '--delay': `${delay}s`, '--r': `${r}deg` }}
        >
          <Icon size={size} strokeWidth={1.5} />
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// TOP BAR
// ═══════════════════════════════════════════════════════════════

function TopBar() {
  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const cap = today.charAt(0).toUpperCase() + today.slice(1)
  return (
    <header className="relative z-10 flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-2.5">
        <div className="h-11 rounded-2xl border-2 border-ink bg-white shadow-hard-sm flex items-center justify-center px-2.5">
          <img src="/bkl-logo.png" alt="BKL" className="h-6 w-auto object-contain" onError={e => { e.target.style.display = 'none' }} />
        </div>
        <span className="font-display font-bold text-ink text-lg tracking-tight">Bakinglove</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 rounded-full border-2 border-ink bg-white px-3.5 py-1.5 shadow-hard-sm">
          <Calendar size={15} className="text-ink" />
          <span className="text-sm font-semibold text-ink">{cap}</span>
        </div>
        <div className="h-11 w-11 rounded-full border-2 border-ink bg-pink-soft flex items-center justify-center shadow-hard-sm">
          <span className="font-display font-bold text-pink-deep text-sm">BL</span>
        </div>
      </div>
    </header>
  )
}

// ═══════════════════════════════════════════════════════════════
// HERO
// ═══════════════════════════════════════════════════════════════

function Hero() {
  return (
    <section className="relative z-10 px-6 pt-6 pb-6 text-center">
      <img
        src="/bakinglove-logo.png"
        alt="Bakinglove"
        className="mx-auto w-[220px] sm:w-[260px] object-contain"
        onError={e => { e.target.style.display = 'none' }}
      />
      <h1 className="font-display font-bold text-ink text-2xl sm:text-3xl leading-tight tracking-tight mt-2">
        ¡Qué bueno verte de nuevo!
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-ink/60 text-sm sm:text-base font-medium leading-relaxed">
        Gestiona tus ventas, finanzas y entregas desde un solo lugar.
      </p>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// CORTE DE CAJA — helpers
// ═══════════════════════════════════════════════════════════════

function thisWeekRange() {
  const now = new Date()
  const day = now.getDay() // 0=Dom
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  sun.setHours(23, 59, 59, 999)
  return { mon, sun }
}

function useCountUp(target) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    cancelAnimationFrame(raf.current)
    const start = performance.now()
    const duration = 1100
    const from = 0
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - p) ** 4
      setVal(from + (target - from) * eased)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target])
  return val
}

// ═══════════════════════════════════════════════════════════════
// MONEY RAIN
// ═══════════════════════════════════════════════════════════════

const PARTICLES = [
  { id: 0, left: '4%',  delay: 0.00, rot: 15,  sym: '💸', size: 20 },
  { id: 1, left: '13%', delay: 0.08, rot: -12, sym: '$',  size: 17 },
  { id: 2, left: '22%', delay: 0.15, rot: 20,  sym: '🪙', size: 16 },
  { id: 3, left: '31%', delay: 0.04, rot: -18, sym: '💰', size: 18 },
  { id: 4, left: '41%', delay: 0.11, rot: 10,  sym: '💸', size: 22 },
  { id: 5, left: '50%', delay: 0.02, rot: -8,  sym: '$',  size: 15 },
  { id: 6, left: '60%', delay: 0.13, rot: 16,  sym: '🪙', size: 17 },
  { id: 7, left: '70%', delay: 0.06, rot: -14, sym: '💰', size: 20 },
  { id: 8, left: '80%', delay: 0.09, rot: 22,  sym: '💸', size: 16 },
  { id: 9, left: '90%', delay: 0.03, rot: -10, sym: '$',  size: 14 },
]

function MoneyRain({ rainKey }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 'inherit', zIndex: 0 }}>
      <AnimatePresence>
        {PARTICLES.map(p => (
          <motion.div
            key={`${rainKey}-${p.id}`}
            initial={{ y: -36, opacity: 1, rotate: 0 }}
            animate={{ y: 140, opacity: [1, 1, 0.6, 0], rotate: p.rot }}
            transition={{ duration: 1.2, delay: p.delay, ease: 'easeIn' }}
            style={{ position: 'absolute', top: 0, left: p.left, fontSize: p.size, userSelect: 'none', lineHeight: 1 }}
          >
            {p.sym}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// STAT BOX inside CorteCard
// ═══════════════════════════════════════════════════════════════

function StatBox({ label, amount, color, isNeg = false }) {
  const animated = useCountUp(Math.abs(amount))
  const fmted = animated.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div style={{ textAlign: 'center', padding: '14px 6px 12px', position: 'relative', zIndex: 1 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: 'rgba(255,255,255,.45)', marginBottom: 6 }}>
        {label.toUpperCase()}
      </div>
      <div style={{
        fontSize: 'clamp(13px, 4.5vw, 20px)',
        fontWeight: 900,
        color,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1.1,
        letterSpacing: -0.3,
      }}>
        {isNeg && amount < 0 ? '-' : ''}${fmted}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// CORTE DE CAJA CARD
// ═══════════════════════════════════════════════════════════════

// ── etiqueta de sección dentro del corte ─────────────────────────────────────
function SectionLabel({ children, color = 'rgba(255,255,255,.35)' }) {
  return (
    <div style={{
      padding: '6px 14px 2px',
      fontSize: 9, fontWeight: 800, letterSpacing: 2,
      color, textTransform: 'uppercase',
      position: 'relative', zIndex: 1,
    }}>
      {children}
    </div>
  )
}

function getMondayISODash() {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))
  const d = mon
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function CorteCard({ notas, gastos, srRows = [], saldosSemana = [], unlocked = false, onUnlockClick }) {
  const [rainKey, setRainKey] = useState(0)

  const weekKey = getMondayISODash()
  const saldoSemana = saldosSemana.find(s => s.id === weekKey) || { efectivoBkl: 0, efectivoSr: 0 }

  const stats = useMemo(() => {
    const { mon, sun } = thisWeekRange()

    const inWeek = fecha => {
      const d = new Date(fecha.length === 10 ? fecha + 'T12:00:00' : fecha)
      return d >= mon && d <= sun
    }

    const bklGanaste = notas
      .filter(n => inWeek(n.createdAt))
      .reduce((s, n) => s + (Number(n.totalPagado) || 0), 0)

    const bklGastaste = gastos
      .filter(g => inWeek(g.fecha && g.fecha.length === 10 ? g.fecha + 'T12:00:00' : g.createdAt))
      .reduce((s, g) => s + (Number(g.monto) || 0), 0)

    const srVentas = srRows
      .filter(r => r.tipo === 'venta' && r.fecha && inWeek(r.fecha))
      .reduce((s, r) => s + (Number(r.precio) || 0), 0)

    const srSalidas = srRows
      .filter(r => r.tipo === 'salida' && r.fecha && inWeek(r.fecha))
      .reduce((s, r) => s + (Number(r.precio) || 0), 0)

    return { bklGanaste, bklGastaste, srVentas, srSalidas }
  }, [notas, gastos, srRows])

  const { bklGanaste, bklGastaste, srVentas, srSalidas } = stats
  const bklTienes   = bklGanaste - bklGastaste + (saldoSemana.efectivoBkl || 0)
  const srNeto      = srVentas - srSalidas + (saldoSemana.efectivoSr || 0)
  const totalTienes = bklTienes + srNeto + (saldoSemana.bancos || 0)
  const positivo    = totalTienes >= 0

  useEffect(() => { setRainKey(k => k + 1) }, [bklGanaste, bklGastaste, srVentas, srSalidas])

  const sep = <div style={{ background: 'rgba(255,255,255,.1)', alignSelf: 'stretch' }} />

  return (
    <section style={{ position: 'relative', margin: '0 4px 22px', borderRadius: 24, border: '2px solid #2b2731', background: '#1f2b5e', overflow: 'hidden', boxShadow: '5px 5px 0 #2b2731' }}>
      <MoneyRain rainKey={rainKey} />

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '11px 16px 7px', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: 'rgba(255,255,255,.55)' }}>CORTE DE CAJA</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.3)', marginLeft: 8 }}>Esta semana</span>
      </div>

      {/* Blurable area */}
      <div style={{ position: 'relative' }}>
        <div style={{
          filter: unlocked ? 'none' : 'blur(7px)',
          userSelect: unlocked ? 'auto' : 'none',
          transition: 'filter 0.35s',
        }}>

          {/* ── Bakinglove ─────────────────────────────────── */}
          <SectionLabel>● Bakinglove</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr' }}>
            <StatBox label="Ganaste"  amount={bklGanaste}  color="#6ee7b7" />
            {sep}
            <StatBox label="Gastaste" amount={bklGastaste} color="#fca5a5" />
            {sep}
            <StatBox label="Tienes"   amount={bklTienes}   color={bklTienes >= 0 ? '#fde68a' : '#fca5a5'} isNeg />
          </div>

          {/* ── San Ramón ───────────────────────────────────── */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
            <SectionLabel color="rgba(249,168,212,.6)">● San Ramón</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr' }}>
              <StatBox label="Ventas"   amount={srVentas}  color="#6ee7b7" />
              {sep}
              <StatBox label="Salidas"  amount={srSalidas} color="#fca5a5" />
              {sep}
              <StatBox label="Debo tener" amount={srNeto}  color={srNeto >= 0 ? '#fde68a' : '#fca5a5'} isNeg />
            </div>
          </div>

          {/* ── Total general ───────────────────────────────── */}
          <div style={{ borderTop: '2px solid rgba(255,255,255,.18)' }}>
            <SectionLabel color="rgba(255,255,255,.5)">◆ Total general</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr' }}>
              <StatBox label="Total ganado"  amount={bklGanaste + srVentas}  color="#6ee7b7" />
              {sep}
              <StatBox label="Total gastado" amount={bklGastaste + srSalidas} color="#fca5a5" />
              {sep}
              <StatBox label="Total tienes"  amount={totalTienes} color={positivo ? '#fde68a' : '#fca5a5'} isNeg />
            </div>
          </div>
        </div>

        {!unlocked && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
            <button
              onClick={onUnlockClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 20px', borderRadius: 22,
                border: '2px solid rgba(255,255,255,.55)',
                background: 'rgba(255,255,255,.18)', color: '#fff',
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                backdropFilter: 'blur(4px)', letterSpacing: 0.4,
                boxShadow: '0 2px 10px rgba(0,0,0,.25)',
              }}
            >
              <Lock size={13} strokeWidth={2.5} />
              Ver corte
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ position: 'relative', zIndex: 1, borderTop: '1px solid rgba(255,255,255,.08)', padding: '6px 16px', textAlign: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: positivo ? 'rgba(110,231,183,.7)' : 'rgba(252,165,165,.7)' }}>
          {positivo ? '✓ Vas muy bien esta semana' : '⚠ Los gastos superan los ingresos'}
        </span>
      </div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
// CHIP
// ═══════════════════════════════════════════════════════════════

const CHIP_TONE = {
  mint:  'bg-mint-soft  text-mint-deep',
  sky:   'bg-sky-soft   text-sky-deep',
  pink:  'bg-pink-soft  text-pink-deep',
  lilac: 'bg-lilac-soft text-lilac-deep',
}

function Chip({ icon: ChipIcon, label, tone, onClick }) {
  return (
    <span
      onClick={e => { e.stopPropagation(); onClick?.() }}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-1 text-xs font-bold cursor-pointer active:scale-95 transition-transform ${CHIP_TONE[tone]}`}
    >
      <ChipIcon size={11} strokeWidth={2.5} />
      {label}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════
// TARJETA DE MÓDULO
// ═══════════════════════════════════════════════════════════════

const TILE_COLOR = {
  pink:  'bg-pink-soft  text-pink-deep',
  mint:  'bg-mint-soft  text-mint-deep',
  sky:   'bg-sky-soft   text-sky-deep',
  lilac: 'bg-lilac-soft text-lilac-deep',
}

function ModuleCard({ data, index, onOpen }) {
  const { icon: CardIcon, accent, title, desc, chips } = data
  const tileClass = TILE_COLOR[accent]

  return (
    <motion.div
      className="bkl-card group flex flex-col text-left rounded-[26px] border-2 border-ink bg-white p-6 shadow-hard cursor-pointer"
      whileHover={{ y: -4, boxShadow: '7px 7px 0 #2B2731' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-ink shadow-hard-sm ${tileClass}`}>
          <CardIcon size={30} strokeWidth={1.8} />
        </div>
        <span className="font-display font-bold text-ink/15 text-2xl select-none">0{index + 1}</span>
      </div>

      <h3 className="font-display font-bold text-ink text-xl sm:text-2xl mt-5 tracking-tight leading-tight">
        {title}
      </h3>
      <p className="text-ink/55 text-sm font-medium mt-1.5 leading-relaxed">{desc}</p>

      {chips && (
        <div className="flex flex-wrap gap-2 mt-4" onClick={e => e.stopPropagation()}>
          {chips.map(c => <Chip key={c.label} {...c} />)}
        </div>
      )}

      <div className="mt-auto pt-6 flex items-center gap-2 text-ink font-bold text-sm">
        <span>Abrir módulo</span>
        <span className="bkl-arrow inline-flex items-center justify-center h-7 w-7 rounded-full border-2 border-ink bg-white">
          <ArrowRight size={14} strokeWidth={2.5} />
        </span>
      </div>
    </motion.div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MÓDULOS
// ═══════════════════════════════════════════════════════════════

const buildModules = (onNavigate) => [
  {
    title: 'Nota de Venta',
    icon: ReceiptText,
    accent: 'pink',
    desc: 'Registra pedidos y cobra en segundos.',
    chips: [
      { icon: Plus,          label: 'Nuevo pago',         tone: 'mint',  onClick: () => onNavigate('nota')     },
      { icon: Pencil,        label: 'Editar',             tone: 'sky',   onClick: () => onNavigate('historial') },
      { icon: ClipboardList, label: 'Historial de notas', tone: 'lilac', onClick: () => onNavigate('historial') },
    ],
    onOpen: () => onNavigate('nota'),
  },
  { title: 'Concentrado de Ingresos', icon: TrendingUp,   accent: 'mint',  desc: 'Visualiza tus entradas por periodo.',          onOpen: () => onNavigate('concentrado') },
  { title: 'Concentrado de Gastos',   icon: TrendingDown, accent: 'sky',   desc: 'Controla insumos y costos de operación.',      onOpen: () => onNavigate('gastos') },
  { title: 'Calendario de Entregas',  icon: CalendarDays, accent: 'lilac', desc: 'Organiza tus pedidos por fecha de entrega.',   onOpen: () => onNavigate('calendario') },
  { title: 'Control San Ramón',       icon: Store,        accent: 'pink',  desc: 'Registro de ventas y salidas de la sucursal.', onOpen: () => onNavigate('sanramon') },
]

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

async function fixFolios() {
  const snap = await getDocs(collection(db, 'notas'))
  const notas = snap.docs.map(d => ({ ref: d.ref, ...d.data() }))
  notas.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return ta - tb
  })
  const batch = writeBatch(db)
  notas.forEach((nota, i) => {
    batch.update(nota.ref, { folio: `#${i + 1}` })
  })
  batch.set(doc(db, 'config', 'folio_counter'), { current: notas.length })
  await batch.commit()
  return notas.length
}

export default function Dashboard({ onNavigate = () => {}, notas = [], gastos = [], srRows = [], saldosSemana = [], onSrChange, onChangePinRequest }) {
  const modules = buildModules(onNavigate)
  const [corteUnlocked, setCorteUnlocked] = useState(false)
  const [showCortePin,  setShowCortePin]  = useState(false)
  const [fixStatus,     setFixStatus]     = useState('')

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-cream">
      <div className="bkl-texture pointer-events-none absolute inset-0 opacity-10" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cream/40 via-transparent to-cream" />
      <FloatingBg />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-16">
        <TopBar />
        <Hero />

        <CorteCard
          notas={notas}
          gastos={gastos}
          srRows={srRows}
          saldosSemana={saldosSemana}
          unlocked={corteUnlocked}
          onUnlockClick={() => setShowCortePin(true)}
        />

        <main className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-1">
          {modules.map((m, i) => (
            <ModuleCard key={m.title} data={m} index={i} onOpen={m.onOpen} />
          ))}
        </main>

        <footer className="mt-12 text-center text-ink/35 text-xs font-semibold tracking-wide">
          Bakinglove · Sistema de gestión interno · Diseñado por LDR A&S
          {onChangePinRequest && (
            <div style={{ marginTop: 10 }}>
              <button
                onClick={onChangePinRequest}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#d9748f', fontSize: 11, fontWeight: 700,
                  textDecoration: 'underline', padding: '2px 4px',
                  opacity: 0.75,
                }}
              >
                <KeyRound size={11} strokeWidth={2.5} />
                Cambiar NIP
              </button>
            </div>
          )}
          {/* TEMPORAL — borrar después de usar */}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={async () => {
                if (!window.confirm('¿Reasignar folios de todas las notas por orden de creación? Solo se toca el campo folio.')) return
                setFixStatus('Procesando…')
                try {
                  const total = await fixFolios()
                  setFixStatus(`✓ ${total} notas actualizadas`)
                } catch (e) {
                  setFixStatus(`Error: ${e.message}`)
                }
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#888', fontSize: 11, fontWeight: 700,
                textDecoration: 'underline', padding: '2px 4px',
              }}
            >
              🔧 Reparar folios
            </button>
            {fixStatus && <div style={{ fontSize: 11, marginTop: 4, color: '#555' }}>{fixStatus}</div>}
          </div>
        </footer>
      </div>

      {showCortePin && (
        <PinModal
          title="Ingresa tu NIP"
          mode="verify"
          onSuccess={() => { setCorteUnlocked(true); setShowCortePin(false) }}
          onCancel={() => setShowCortePin(false)}
        />
      )}
    </div>
  )
}
