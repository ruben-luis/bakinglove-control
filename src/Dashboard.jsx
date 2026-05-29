import { motion } from 'framer-motion'
import {
  ReceiptText, TrendingUp, TrendingDown, CalendarDays,
  Plus, Pencil, ArrowRight, Calendar,
  CakeSlice, Cookie, Candy, IceCreamCone,
  Croissant, Cherry, Cake, Coffee, ClipboardList,
} from 'lucide-react'

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
    <section className="relative z-10 px-6 pt-6 pb-8 text-center">
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
]

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════

export default function Dashboard({ onNavigate = () => {}, notas = [] }) {
  const modules = buildModules(onNavigate)

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-cream">
      <div className="bkl-texture pointer-events-none absolute inset-0 opacity-10" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cream/40 via-transparent to-cream" />
      <FloatingBg />

      <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pb-16">
        <TopBar />
        <Hero />
        <main className="grid grid-cols-1 sm:grid-cols-2 gap-5 px-1">
          {modules.map((m, i) => (
            <ModuleCard key={m.title} data={m} index={i} onOpen={m.onOpen} />
          ))}
        </main>
        <footer className="mt-12 text-center text-ink/35 text-xs font-semibold tracking-wide">
          Bakinglove · Sistema de gestión interno · Diseñado por LDR A&S
        </footer>
      </div>
    </div>
  )
}
