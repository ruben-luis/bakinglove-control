import { useState, useMemo } from 'react'
import { ArrowLeft, Save, Plus, Phone, MapPin, FileDown, CalendarDays } from 'lucide-react'
import { printNota } from './printNota'

// ── Design tokens ────────────────────────────────────────────
const NAVY      = '#1f2b5e'
const BLUE      = '#2f5fb0'
const GRAY      = '#e4e4e8'
const GRAY_LINE = '#c9c9d0'
const PINK_HI   = '#fbe0ea'
const PINK_TEXT = '#d9748f'
const MINT_BG   = '#d9efd2'
const MINT_TEXT = '#5d8a49'


const todayISO  = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const dash      = (n) => (n > 0 ? `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-')

const DIAS_FULL  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const formatDateES = (iso) => {
  if (!iso) return 'Seleccionar fecha…'
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${DIAS_FULL[dt.getDay()]} ${d} de ${MESES_FULL[m - 1]} del ${y}`
}
const fmtMoney  = (n) => n > 0 ? `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'
const fmtDate   = (iso) => iso ? iso.split('-').reverse().join('/') : ''

const emptyP = () => ({ cantidad: '', descripcion: '', precioU: '' })
const emptyG = () => ({ monto: '', fecha: todayISO(), met: null })

const METODOS = ['Transferencia', 'Efectivo', 'Terminal']

// ── Shared table styles ──────────────────────────────────────
const LAB = {
  background: GRAY, fontWeight: 700, padding: '0 12px',
  whiteSpace: 'nowrap', border: `1px solid ${GRAY_LINE}`,
  fontSize: 13.5, verticalAlign: 'middle',
}
const VAL = { border: `1px solid ${GRAY_LINE}`, padding: 0, verticalAlign: 'middle', height: 34 }

function FI({ type = 'text', value, onChange, onBlur, placeholder, bg = 'transparent' }) {
  return (
    <input type={type} value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder} step={type === 'number' ? '0.01' : undefined}
      style={{ width: '100%', height: '100%', minHeight: 34, padding: '0 10px', outline: 'none', background: bg, fontFamily: 'inherit', fontSize: 13.5, color: '#2b2731', border: 'none' }} />
  )
}

function DateFieldES({ value, onChange, bg = 'transparent' }) {
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: 38, background: bg, display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8 }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: value ? '#2b2731' : '#bbb', userSelect: 'none', pointerEvents: 'none', whiteSpace: 'nowrap', flex: 1 }}>
        {formatDateES(value)}
      </span>
      <CalendarDays size={16} strokeWidth={2} color="#d9748f" style={{ flexShrink: 0, pointerEvents: 'none' }} />
      <input type="date" value={value} onChange={onChange}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 1 }} />
    </div>
  )
}

function BarHead({ label }) {
  return (
    <div style={{ background: GRAY, textAlign: 'center', fontWeight: 800, letterSpacing: 1, fontSize: 15, padding: '8px', border: `1px solid ${GRAY_LINE}` }}>
      {label}
    </div>
  )
}

function NavyTH({ cols }) {
  return (
    <tr style={{ background: '#FBE0E8' }}>
      {cols.map(({ label, width }, i) => (
        <th key={label} style={{ color: '#2b2731', fontWeight: 700, fontSize: 11, letterSpacing: 0.4, padding: '8px 6px', borderRight: i < cols.length - 1 ? '1px solid rgba(217,116,143,.25)' : 'none', width: width || undefined, textAlign: 'left', whiteSpace: 'nowrap' }}>
          {label}
        </th>
      ))}
    </tr>
  )
}

function MethodPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {METODOS.map((m, i) => {
        const on = value === m
        return (
          <button key={m} onClick={() => onChange(on ? null : m)} className="nota-method-btn"
            style={{ flex: 1, textAlign: 'center', fontSize: 11.5, fontWeight: on ? 800 : 600, color: on ? PINK_TEXT : '#555', padding: '6px 4px', background: on ? PINK_HI : 'transparent', cursor: 'pointer', border: 'none', borderRight: i < METODOS.length - 1 ? `1px solid ${GRAY_LINE}` : 'none' }}>
            {m}
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
export default function NotaDeVenta({ onBack, onSave }) {
  const [fecha, setF]   = useState(todayISO)
  const [hora,  setH]   = useState('')
  const [cli,   setC]   = useState('')
  const [lugar, setL]   = useState('')
  const [costo, setK]   = useState('')
  const [tel,   setT]   = useState('')
  // Solo BH y SR son exclusivos; CONSUMO siempre igual
  const [ubicSel, setUbicSel] = useState(null)  // null | 'BELLO HORIZONTE' | 'SAN RAMON'
  const [prods, setProds] = useState([emptyP(), emptyP()])
  const [obs,   setObs]   = useState(['', ''])
  const [pagos, setPagos] = useState([emptyG(), emptyG(), emptyG()])
  const [saving, setSaving] = useState(false)

  const costoEntrega = parseFloat(costo) || 0
  const totalProds   = useMemo(() =>
    prods.reduce((s, p) => s + (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioU) || 0), 0), [prods])
  const totalGeneral = totalProds + costoEntrega
  const totalG       = useMemo(() =>
    pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0), [pagos])
  const resta        = totalGeneral - totalG

  const updP = (i, f, v) => setProds(a => { const n = [...a]; n[i] = { ...n[i], [f]: v }; return n })
  const updG = (i, f, v) => setPagos(a => { const n = [...a]; n[i] = { ...n[i], [f]: v }; return n })
  const updO = (i, v)    => setObs(a  => { const n = [...a]; n[i] = v; return n })

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await onSave({
        id: crypto.randomUUID(),
        fechaEntrega: fecha, horaEntrega: hora, cliente: cli,
        lugarEntrega: lugar, costoEntrega, contacto: tel,
        ubicacion: ubicSel,
        productos: prods.map(p => ({ ...p, total: (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioU) || 0) })),
        observaciones: obs,
        pagos: pagos.map(p => ({ monto: p.monto, fecha: p.fecha, metodoPago: p.met })),
        totalProductos: totalProds, totalPedido: totalGeneral,
        totalPagado: totalG, resta,
        estado: resta <= 0 ? 'pagado' : 'pendiente',
        mes: new Date().getMonth(), año: new Date().getFullYear(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    } finally {
      setSaving(false)
    }
  }

  const DT = { borderCollapse: 'collapse', width: '100%', border: `1px solid ${NAVY}` }
  const TD = (extra = {}) => ({ border: `1px solid ${GRAY_LINE}`, padding: '0 10px', height: 42, fontSize: 13.5, verticalAlign: 'middle', ...extra })

  return (
    <div style={{ background: '#eceaee', minHeight: '100vh', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', color: '#2b2731' }}>
      <style>{`
        @media (max-width: 520px) {
          .nota-paper   { padding: 14px 10px 24px !important; }
          .nota-title   { font-size: 22px !important; }
          .nota-logo    { width: 100px !important; }
          .nota-scroll  { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .nota-totales { width: 100% !important; }
          .nota-folio-copy { width: 100% !important; }
          .nota-method-btn { font-size: 10px !important; padding: 6px 2px !important; }
          .nota-field-label {
            width: 140px !important;
            min-width: 140px !important;
            font-size: 12px !important;
            box-sizing: border-box;
          }
        }
      `}</style>

      {/* ── Nav ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,.1)', background: '#eceaee', gap: 8 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 14, color: 'rgba(43,39,49,.6)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <ArrowLeft size={16} strokeWidth={2.5} /> Volver
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => printNota({ folio: '---', fecha, hora, cli, lugar, costo, tel, ubicSel, prods, obs, pagos, costoEntrega, totalGeneral, resta })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: NAVY, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <FileDown size={14} /> PDF
          </button>
          <button onClick={save} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: saving ? '#888' : '#2b2731', color: '#FBFAFB', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
            <Save size={14} /> {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* ── Paper ── */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px 100px' }}>
        <div className="nota-paper" style={{ width: '100%', maxWidth: 640, background: '#fff', padding: '24px 18px 38px', boxShadow: '0 18px 50px rgba(31,43,94,.16)', borderRadius: 6 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
            <h1 className="nota-title" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: 37, lineHeight: 0.98, letterSpacing: -0.5, color: '#111018', textTransform: 'uppercase', margin: '2px 0 0', flexShrink: 0 }}>
              Nota<br />de&nbsp;venta
            </h1>
            <img src="/bakinglove-logo.png" alt="Bakinglove" className="nota-logo"
              style={{ width: 150, height: 'auto', objectFit: 'contain', marginTop: 2 }}
              onError={e => { e.target.style.display = 'none' }} />
          </div>

          {/* Folio + Contact */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${GRAY_LINE}`, borderRadius: 4, overflow: 'hidden', height: 38, flexShrink: 0 }}>
              <span style={{ background: GRAY, fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', padding: '0 14px', letterSpacing: 0.5, flexShrink: 0 }}>FOLIO</span>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 14px', color: BLUE, fontWeight: 800, fontSize: 20, letterSpacing: 0.5, whiteSpace: 'nowrap' }}>---</span>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#1a1a22' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                <span style={{ width: 20, height: 20, border: `1.5px solid ${NAVY}`, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Phone size={11} color={NAVY} />
                </span>
                <b style={{ fontWeight: 700 }}>222 116 40 61</b>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
                <MapPin size={15} color={PINK_TEXT} style={{ flexShrink: 0 }} />
                <b style={{ fontWeight: 700 }}>Calle Del Sol #68, Bello Horizonte</b>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <MapPin size={15} color={PINK_TEXT} style={{ flexShrink: 0 }} />
                <b style={{ fontWeight: 700 }}>Local 2, C Tulipanes, San Ramon</b>
              </div>
            </div>
          </div>

          {/* ── Fields ── */}
          <div style={{ border: `1px solid ${GRAY_LINE}`, borderRadius: 2, overflow: 'hidden' }}>
            {/* Fecha */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${GRAY_LINE}`, minHeight: 38 }}>
              <div className="nota-field-label" style={{ ...LAB, display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: 120 }}>Fecha de Entrega</div>
              <div style={{ flex: 1, background: PINK_HI }}><DateFieldES value={fecha} onChange={e => setF(e.target.value)} bg={PINK_HI} /></div>
            </div>
            {/* Cliente */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${GRAY_LINE}`, minHeight: 38 }}>
              <div className="nota-field-label" style={{ ...LAB, display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: 120 }}>Cliente</div>
              <div style={{ flex: 1 }}><FI value={cli} onChange={e => setC(e.target.value)} placeholder="Nombre del cliente" /></div>
            </div>
            {/* Lugar + Hora (flex-wrap para que se apile en móvil) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: `1px solid ${GRAY_LINE}` }}>
              <div className="nota-field-label" style={{ ...LAB, display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: 120, borderBottom: 0, borderRight: `1px solid ${GRAY_LINE}` }}>Lugar de Entrega</div>
              <div style={{ flex: '1 1 120px', minHeight: 38, borderRight: `1px solid ${GRAY_LINE}` }}><FI value={lugar} onChange={e => setL(e.target.value)} placeholder="Dirección" /></div>
              <div className="nota-field-label" style={{ ...LAB, display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: 100, borderBottom: 0, borderRight: `1px solid ${GRAY_LINE}` }}>Hora de Entrega</div>
              <div style={{ flex: '1 1 80px', minHeight: 38 }}><FI type="time" value={hora} onChange={e => setH(e.target.value)} /></div>
            </div>
            {/* Costo + Contacto */}
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              <div className="nota-field-label" style={{ ...LAB, display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: 120, borderBottom: 0, borderRight: `1px solid ${GRAY_LINE}` }}>Costo por entrega</div>
              <div style={{ flex: '1 1 80px', minHeight: 38, borderRight: `1px solid ${GRAY_LINE}` }}><FI type="number" value={costo} onChange={e => setK(e.target.value)} onBlur={() => { const n = parseFloat(costo); if (!isNaN(n) && n > 0) setK(n.toFixed(2)) }} placeholder="$0" /></div>
              <div className="nota-field-label" style={{ ...LAB, display: 'flex', alignItems: 'center', flexShrink: 0, minWidth: 100, borderBottom: 0, borderRight: `1px solid ${GRAY_LINE}` }}>Contacto</div>
              <div style={{ flex: '1 1 80px', minHeight: 38 }}><FI value={tel} onChange={e => setT(e.target.value)} placeholder="Teléfono" /></div>
            </div>
          </div>

          {/* ── Ubicación ──
              CONSUMO: siempre igual (estático, no afecta selección)
              BELLO HORIZONTE / SAN RAMON: exclusivos entre sí ── */}
          <div style={{ display: 'flex', gap: 10, margin: '14px 0 16px', flexWrap: 'wrap' }}>
            {/* CONSUMO: siempre igual */}
            <div style={{ border: `1px solid ${GRAY_LINE}`, borderRadius: 4, height: 30, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 13, fontWeight: 700, letterSpacing: 0.5, background: '#fff', userSelect: 'none' }}>
              CONSUMO
            </div>

            {/* BH: seleccionable */}
            {[
              { id: 'BELLO HORIZONTE', label: 'BELLO HORIZONTE', onStyle: { background: PINK_HI, color: PINK_TEXT, border: '1px solid #f4a0be' } },
              { id: 'SAN RAMON',       label: 'SAN RAMON',       onStyle: { background: MINT_BG, color: MINT_TEXT, border: '1px solid #bfe0b4' } },
            ].map(({ id, label, onStyle }) => {
              const active = ubicSel === id
              const blank  = ubicSel !== null && !active
              return (
                <button key={id} onClick={() => setUbicSel(active ? null : id)}
                  style={{ borderRadius: 4, height: 30, display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 13, fontWeight: active ? 700 : 600, letterSpacing: 0.5, cursor: 'pointer', transition: 'all .15s', ...(active ? onStyle : blank ? { background: '#fff', color: '#ccc', border: '1px solid #eee' } : { background: '#fff', color: '#2b2731', border: `1px solid ${GRAY_LINE}` }) }}>
                  {label}
                </button>
              )
            })}
          </div>

          {/* ── PEDIDO ── */}
          <div style={{ marginTop: 6 }}>
            <BarHead label="PEDIDO" />
            <div className="nota-scroll">
            <table style={DT}>
              <thead>
                <NavyTH cols={[{ label: 'CANTIDAD', width: 80 }, { label: 'DESCRIPCION' }, { label: 'PRECIO U', width: 80 }, { label: 'TOTAL', width: 70 }]} />
              </thead>
              <tbody>
                {prods.map((p, i) => {
                  const ln = (parseFloat(p.cantidad) || 0) * (parseFloat(p.precioU) || 0)
                  return (
                    <tr key={i}>
                      <td style={{ ...TD({ width: 80 }), padding: 0 }}>
                        <input type="number" value={p.cantidad} onChange={e => updP(i, 'cantidad', e.target.value)}
                          style={{ width: '100%', height: 42, padding: '0 6px', textAlign: 'center', outline: 'none', background: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 13.5, color: '#444', fontWeight: 700 }} />
                      </td>
                      <td style={{ ...TD(), padding: 0 }}>
                        <input type="text" value={p.descripcion} onChange={e => updP(i, 'descripcion', e.target.value)}
                          style={{ width: '100%', height: 42, padding: '0 8px', outline: 'none', background: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 16, color: '#2b2731' }} />
                      </td>
                      <td style={{ ...TD({ width: 80 }), padding: 0 }}>
                        <input type="number" value={p.precioU} onChange={e => updP(i, 'precioU', e.target.value)}
                          onBlur={() => { const n = parseFloat(p.precioU); if (!isNaN(n) && n > 0) updP(i, 'precioU', n.toFixed(2)) }}
                          step="0.01"
                          style={{ width: '100%', height: 42, padding: '0 6px', textAlign: 'center', outline: 'none', background: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 13.5, color: '#444', fontWeight: 700 }} />
                      </td>
                      <td style={TD({ width: 70, textAlign: 'right', color: '#888', fontWeight: 700 })}>
                        {ln > 0 ? dash(ln) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ border: `1px solid ${GRAY_LINE}`, padding: 0 }}>
                    <button onClick={() => setProds(a => [...a, emptyP()])}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', fontSize: 12, fontWeight: 700, color: 'rgba(43,39,49,.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Plus size={11} strokeWidth={2.5} /> Agregar fila
                    </button>
                  </td>
                </tr>
                {costoEntrega > 0 && (
                  <tr>
                    <td colSpan={2} style={TD()}></td>
                    <td style={{ ...TD(), textAlign: 'right', fontSize: 12, color: '#888' }}>Entrega</td>
                    <td style={TD({ textAlign: 'right', color: '#888', fontWeight: 700 })}>{dash(costoEntrega)}</td>
                  </tr>
                )}
                <tr style={{ fontWeight: 800 }}>
                  <td colSpan={2} style={TD()}></td>
                  <td style={{ ...TD(), textAlign: 'right', letterSpacing: 0.5 }}>TOTAL</td>
                  <td style={TD({ textAlign: 'right', color: '#888' })}>{dash(totalGeneral)}</td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>

          {/* ── OBSERVACIONES ── */}
          <div style={{ marginTop: 6 }}>
            <BarHead label="OBSERVACIONES" />
            <div className="nota-scroll">
            <table style={DT}>
              <tbody>
                {obs.map((o, i) => (
                  <tr key={i}>
                    <td style={TD({ width: 44, textAlign: 'center', fontSize: 15, fontWeight: 700 })}>{i + 1}</td>
                    <td style={{ border: `1px solid ${GRAY_LINE}`, padding: 0, height: 46 }}>
                      <input type="text" value={o} onChange={e => updO(i, e.target.value)}
                        style={{ width: '100%', height: 46, padding: '0 10px', outline: 'none', background: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 13.5, color: '#2b2731' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2} style={{ border: `1px solid ${GRAY_LINE}`, padding: 0 }}>
                    <button onClick={() => setObs(a => [...a, ''])}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px', fontSize: 12, fontWeight: 700, color: 'rgba(43,39,49,.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                      <Plus size={11} strokeWidth={2.5} /> Agregar obs.
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>

          {/* ── PAGOS ── */}
          <div style={{ marginTop: 6 }}>
            <BarHead label="PAGOS" />
            <div className="nota-scroll">
            <table style={DT}>
              <thead>
                <NavyTH cols={[{ label: 'N°', width: 36 }, { label: 'MONTO' }, { label: 'FECHA' }, { label: 'METODO DE PAGO' }]} />
              </thead>
              <tbody>
                {pagos.map((p, i) => (
                  <tr key={i}>
                    <td style={TD({ width: 36, textAlign: 'center', fontWeight: 700, fontSize: 15 })}>{i + 1}</td>
                    <td style={{ border: `1px solid ${GRAY_LINE}`, padding: 0, height: 38 }}>
                      <input type="number" value={p.monto} onChange={e => updG(i, 'monto', e.target.value)}
                        onBlur={() => { const n = parseFloat(p.monto); if (!isNaN(n) && n > 0) updG(i, 'monto', n.toFixed(2)) }}
                        step="0.01"
                        style={{ width: '100%', height: 38, padding: '0 8px', outline: 'none', background: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 13.5, color: '#2b2731' }} />
                    </td>
                    <td style={{ border: `1px solid ${GRAY_LINE}`, padding: 0, height: 38 }}>
                      <input type="date" value={p.fecha} onChange={e => updG(i, 'fecha', e.target.value)}
                        style={{ width: '100%', height: 38, padding: '0 6px', outline: 'none', background: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 12, color: '#2b2731' }} />
                    </td>
                    <td style={{ border: `1px solid ${GRAY_LINE}`, padding: 0, height: 42 }}>
                      <MethodPicker value={p.met} onChange={v => updG(i, 'met', v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {/* ── Totales ── */}
          <table className="nota-totales" style={{ borderCollapse: 'collapse', marginTop: 14, width: '62%' }}>
            <tbody>
              <tr>
                <td style={{ border: `1px solid ${GRAY_LINE}`, height: 34, padding: '0 12px', fontWeight: 800, letterSpacing: 0.5, width: '40%', fontSize: 14 }}>TOTAL</td>
                <td style={{ border: `1px solid ${GRAY_LINE}`, height: 34, padding: '0 12px', textAlign: 'right', color: '#444', fontWeight: 700, fontSize: 14 }}>{dash(totalGeneral)}</td>
              </tr>
              <tr>
                <td style={{ border: `1px solid ${GRAY_LINE}`, height: 34, padding: '0 12px', fontWeight: 800, letterSpacing: 0.5, fontSize: 14 }}>RESTA</td>
                <td style={{ border: `1px solid ${GRAY_LINE}`, height: 34, padding: '0 12px', textAlign: 'right', color: resta > 0 ? PINK_TEXT : '#444', fontWeight: 700, fontSize: 14 }}>{dash(Math.abs(resta))}</td>
              </tr>
            </tbody>
          </table>


        </div>
      </div>

      {/* ── Botones fijos ── */}
      <div style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 12, padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,.1)', background: '#eceaee' }}>
        <button onClick={onBack}
          style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 700, fontSize: 14, color: '#2b2731', background: 'rgba(255,255,255,.7)', border: '1px solid rgba(0,0,0,.2)', cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancelar
        </button>
        <button onClick={save} disabled={saving}
          style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 700, fontSize: 14, color: '#FBFAFB', background: saving ? '#888' : '#2b2731', border: 'none', cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          {saving ? 'Guardando…' : 'Guardar Nota'}
        </button>
      </div>

    </div>
  )
}
