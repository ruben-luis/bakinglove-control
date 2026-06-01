import { useState, Fragment } from 'react'
import { ArrowLeft, FileDown, ChevronDown, X, Plus, Save, Trash2 } from 'lucide-react'
import { printNota } from './printNota'

const LINK      = '#1a51c4'
const HEAD_INK  = '#111018'
const NAVY      = '#1f2b5e'
const LINE      = '#bfbfc6'
const LINE_SOFT = '#dadadf'
const BTN       = '#f1f1f4'
const BTN_LINE  = '#b6b6bf'
const BG        = '#eceaee'
const PINK_HI   = '#fbe0ea'
const PINK_TEXT = '#d9748f'
const RED_BG    = '#fce8ee'
const RED_TEXT  = '#c04070'
const MIN_ROWS  = 18

const METODOS  = ['Transferencia', 'Efectivo', 'Terminal']
const DIAS_ES  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const todayISO  = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
const fmtMoney  = (n) => { const v = Number(n) || 0; return v > 0 ? `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-' }
const fmtEntrega  = (iso) => { if (!iso) return '—'; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }
const fmtCreacion = (isoStr) => { if (!isoStr) return ''; const d = new Date(isoStr); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` }
const labelFecha  = (isoStr) => { const d = new Date(isoStr); return `${DIAS_ES[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]} ${d.getFullYear()}` }
const creacionDay = (nota) => { if (!nota.createdAt) return ''; const d = new Date(nota.createdAt); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

const emptyP = () => ({ cantidad: '', descripcion: '', precioU: '' })
const emptyG = () => ({ monto: '', fecha: todayISO(), met: null })

function FilterIcon() {
  return (
    <span style={{ width: 22, height: 18, flexShrink: 0, border: `1px solid ${BTN_LINE}`, borderRadius: 2, background: BTN, display: 'inline-grid', placeItems: 'center', cursor: 'pointer' }}>
      <ChevronDown size={9} color="#444" strokeWidth={1.8} />
    </span>
  )
}

function StatusBadge({ estado }) {
  if (!estado) return null
  const pagado = estado === 'pagado'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 10px',
      borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: .3,
      background: pagado ? '#d9efd2' : PINK_HI,
      color:      pagado ? '#3d7a2a' : RED_TEXT,
      border:     `1px solid ${pagado ? '#bfe0b4' : '#f4b8cf'}`,
    }}>
      {pagado ? 'Pagado' : 'Pendiente'}
    </span>
  )
}

function MethodPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${LINE_SOFT}`, borderRadius: 6, overflow: 'hidden', height: 36 }}>
      {METODOS.map((m, i) => {
        const on = value === m
        return (
          <button key={m} onClick={() => onChange(on ? null : m)} style={{
            flex: 1, fontSize: 11, fontWeight: on ? 800 : 600,
            color: on ? PINK_TEXT : '#666',
            background: on ? PINK_HI : '#fff',
            border: 'none', borderRight: i < METODOS.length - 1 ? `1px solid ${LINE_SOFT}` : 'none',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {m}
          </button>
        )
      })}
    </div>
  )
}

function SectionHead({ label }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: '#aaa', margin: '18px 0 8px' }}>
      {label}
    </div>
  )
}

function FieldInput({ label, value, onChange, onBlur, type = 'text', placeholder = '' }) {
  return (
    <div style={{ flex: 1 }}>
      {label && <div style={{ fontSize: 10, fontWeight: 700, color: '#888', marginBottom: 3 }}>{label}</div>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        step={type === 'number' ? '0.01' : undefined}
        style={{ width: '100%', height: 36, padding: '0 10px', border: `1px solid ${LINE_SOFT}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit', fontSize: 13, color: '#1a1a22', background: '#fff' }}
      />
    </div>
  )
}

function adaptForPrint(nota) {
  return {
    folio:        nota.folio,
    fecha:        nota.fechaEntrega,
    hora:         nota.horaEntrega,
    cli:          nota.cliente,
    lugar:        nota.lugarEntrega,
    costo:        nota.costoEntrega ? String(nota.costoEntrega) : '',
    tel:          nota.contacto,
    ubicSel:      nota.ubicacion,
    prods:        (nota.productos || []).map(p => ({ cantidad: p.cantidad, descripcion: p.descripcion, precioU: p.precioU })),
    obs:          nota.observaciones || [],
    pagos:        (nota.pagos || []).map(p => ({ monto: p.monto, fecha: p.fecha, met: p.metodoPago })),
    costoEntrega: nota.costoEntrega || 0,
    totalGeneral: nota.totalPedido,
    resta:        nota.resta,
  }
}

// ═══════════════════════════════════════════════════════════════
// MODAL DE EDICIÓN COMPLETA
// ═══════════════════════════════════════════════════════════════
function EditModal({ nota, onClose, onSave, onDelete }) {
  const [cli,   setCli]   = useState(nota.cliente || '')
  const [fecha, setFecha] = useState(nota.fechaEntrega || '')
  const [hora,  setHora]  = useState(nota.horaEntrega || '')
  const [lugar, setLugar] = useState(nota.lugarEntrega || '')
  const [costo, setCosto] = useState(nota.costoEntrega ? String(nota.costoEntrega) : '')
  const [tel,   setTel]   = useState(nota.contacto || '')

  const [prods, setProds] = useState(
    nota.productos?.filter(p => p.descripcion).length
      ? nota.productos.map(p => ({ cantidad: p.cantidad || '', descripcion: p.descripcion || '', precioU: p.precioU || '' }))
      : [emptyP()]
  )
  const [obs, setObs] = useState(
    nota.observaciones?.filter(o => o).length ? [...nota.observaciones] : ['']
  )
  const [pagos, setPagos] = useState(
    nota.pagos?.filter(p => p.monto).length
      ? nota.pagos.map(p => ({ monto: p.monto || '', fecha: p.fecha || todayISO(), met: p.metodoPago || null }))
      : [emptyG()]
  )
  const [confirmDel, setConfirmDel] = useState(false)

  const updP = (i, f, v) => setProds(a => { const n = [...a]; n[i] = { ...n[i], [f]: v }; return n })
  const updO = (i, v)    => setObs(a  => { const n = [...a]; n[i] = v; return n })
  const updG = (i, f, v) => setPagos(a => { const n = [...a]; n[i] = { ...n[i], [f]: v }; return n })

  const totalProds   = prods.reduce((s, p) => s + (parseFloat(p.cantidad)||0) * (parseFloat(p.precioU)||0), 0)
  const costoNum     = parseFloat(costo) || 0
  const totalGeneral = totalProds + costoNum
  const totalPagado  = pagos.reduce((s, p) => s + (parseFloat(p.monto)||0), 0)
  const resta        = totalGeneral - totalPagado

  const handleSave = () => {
    onSave({
      ...nota,
      cliente:       cli,
      fechaEntrega:  fecha,
      horaEntrega:   hora,
      lugarEntrega:  lugar,
      costoEntrega:  costoNum,
      contacto:      tel,
      productos:     prods.map(p => ({ ...p, total: (parseFloat(p.cantidad)||0)*(parseFloat(p.precioU)||0) })),
      observaciones: obs.filter(o => o.trim()),
      pagos:         pagos.map(p => ({ monto: p.monto, fecha: p.fecha, metodoPago: p.met })),
      totalProductos: totalProds,
      totalPedido:   totalGeneral,
      totalPagado,
      resta,
      estado:        totalPagado >= totalGeneral && totalGeneral > 0 ? 'pagado' : 'pendiente',
      updatedAt:     new Date().toISOString(),
    })
    onClose()
  }

  const inputSm = { width: '100%', height: 34, padding: '0 8px', border: `1px solid ${LINE_SOFT}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit', fontSize: 13, color: '#1a1a22', background: '#fff' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 540, background: '#f7f7fa', borderRadius: '22px 22px 0 0', maxHeight: '92vh', overflowY: 'auto', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', paddingBottom: 40 }}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: '#d0d0d8' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 14px', borderBottom: `1px solid ${LINE_SOFT}` }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: HEAD_INK }}>Editar nota</div>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginTop: 2 }}>{nota.folio} · {nota.cliente || 'Sin cliente'}</div>
          </div>
          <button onClick={onClose} style={{ background: BTN, border: 'none', borderRadius: 8, padding: 7, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={16} color="#555" />
          </button>
        </div>

        <div style={{ padding: '0 18px' }}>

          {/* ── DATOS GENERALES ── */}
          <SectionHead label="DATOS GENERALES" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <FieldInput label="Cliente" value={cli} onChange={setCli} placeholder="Nombre del cliente" />
            <div style={{ display: 'flex', gap: 9 }}>
              <FieldInput label="Fecha de entrega" type="date" value={fecha} onChange={setFecha} />
              <FieldInput label="Hora de entrega"  type="time" value={hora}  onChange={setHora}  />
            </div>
            <FieldInput label="Lugar de entrega" value={lugar} onChange={setLugar} placeholder="Dirección…" />
            <div style={{ display: 'flex', gap: 9 }}>
              <FieldInput label="Costo por entrega" type="number" value={costo} onChange={setCosto} placeholder="0"
                onBlur={() => { const n = parseFloat(costo); if (!isNaN(n) && n > 0) setCosto(n.toFixed(2)) }} />
              <FieldInput label="Contacto" value={tel} onChange={setTel} placeholder="Teléfono…" />
            </div>
          </div>

          {/* ── PRODUCTOS ── */}
          <SectionHead label="PRODUCTOS" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {prods.map((p, i) => (
              <div key={i} style={{ background: '#fff', border: `1px solid ${LINE_SOFT}`, borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
                  <div style={{ width: 58 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', marginBottom: 3 }}>CANT.</div>
                    <input type="number" value={p.cantidad} onChange={e => updP(i, 'cantidad', e.target.value)} placeholder="1" style={inputSm} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', marginBottom: 3 }}>DESCRIPCIÓN</div>
                    <input type="text" value={p.descripcion} onChange={e => updP(i, 'descripcion', e.target.value)} placeholder="Producto…" style={inputSm} />
                  </div>
                  <div style={{ width: 76 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', marginBottom: 3 }}>PRECIO U</div>
                    <input type="number" value={p.precioU} onChange={e => updP(i, 'precioU', e.target.value)}
                      onBlur={() => { const n = parseFloat(p.precioU); if (!isNaN(n) && n > 0) updP(i, 'precioU', n.toFixed(2)) }}
                      step="0.01" placeholder="0" style={inputSm} />
                  </div>
                  <button onClick={() => setProds(a => a.filter((_, idx) => idx !== i))}
                    style={{ width: 34, height: 34, background: RED_BG, border: 'none', borderRadius: 6, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <X size={13} color={RED_TEXT} />
                  </button>
                </div>
                {(parseFloat(p.cantidad) > 0 && parseFloat(p.precioU) > 0) && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textAlign: 'right', marginTop: 5 }}>
                    Subtotal: {fmtMoney((parseFloat(p.cantidad)||0)*(parseFloat(p.precioU)||0))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => setProds(a => [...a, emptyP()])}
              style={{ width: '100%', padding: 9, border: `1.5px dashed ${LINE}`, borderRadius: 8, background: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Plus size={12} strokeWidth={2.5} /> Agregar producto
            </button>
          </div>

          {/* ── OBSERVACIONES ── */}
          <SectionHead label="OBSERVACIONES" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {obs.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 6 }}>
                <input type="text" value={o} onChange={e => updO(i, e.target.value)} placeholder={`Observación ${i + 1}…`}
                  style={{ flex: 1, height: 34, padding: '0 10px', border: `1px solid ${LINE_SOFT}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit', fontSize: 13, color: '#1a1a22', background: '#fff' }} />
                {obs.length > 1 && (
                  <button onClick={() => setObs(a => a.filter((_, idx) => idx !== i))}
                    style={{ width: 34, height: 34, background: RED_BG, border: 'none', borderRadius: 6, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
                    <X size={13} color={RED_TEXT} />
                  </button>
                )}
              </div>
            ))}
            <button onClick={() => setObs(a => [...a, ''])}
              style={{ width: '100%', padding: 9, border: `1.5px dashed ${LINE}`, borderRadius: 8, background: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Plus size={12} strokeWidth={2.5} /> Agregar observación
            </button>
          </div>

          {/* ── PAGOS ── */}
          <SectionHead label="PAGOS" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagos.map((p, i) => (
              <div key={i} style={{ background: '#fff', border: `1px solid ${LINE_SOFT}`, borderRadius: 10, padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#aaa' }}>Pago {i + 1}</span>
                  <button onClick={() => setPagos(a => a.filter((_, idx) => idx !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, display: 'grid', placeItems: 'center' }}>
                    <Trash2 size={13} color={RED_TEXT} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', marginBottom: 3 }}>MONTO</div>
                    <input type="number" value={p.monto} onChange={e => updG(i, 'monto', e.target.value)} placeholder="$0"
                      onBlur={() => { const n = parseFloat(p.monto); if (!isNaN(n) && n > 0) updG(i, 'monto', n.toFixed(2)) }}
                      step="0.01"
                      style={{ width: '100%', height: 34, padding: '0 10px', border: `1px solid ${LINE_SOFT}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#1a1a22', background: '#fff' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', marginBottom: 3 }}>FECHA</div>
                    <input type="date" value={p.fecha} onChange={e => updG(i, 'fecha', e.target.value)}
                      style={{ width: '100%', height: 34, padding: '0 8px', border: `1px solid ${LINE_SOFT}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit', fontSize: 12, color: '#1a1a22', background: '#fff' }} />
                  </div>
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', marginBottom: 4 }}>MÉTODO DE PAGO</div>
                <MethodPicker value={p.met} onChange={v => updG(i, 'met', v)} />
              </div>
            ))}
            <button onClick={() => setPagos(a => [...a, emptyG()])}
              style={{ width: '100%', padding: 9, border: `1.5px dashed ${LINE}`, borderRadius: 8, background: 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Plus size={12} strokeWidth={2.5} /> Agregar pago
            </button>
          </div>

          {/* ── RESUMEN ── */}
          <SectionHead label="RESUMEN" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
            {[
              { label: 'Total pedido', value: fmtMoney(totalGeneral), color: '#1a1a22' },
              { label: 'Pagado',       value: fmtMoney(totalPagado),  color: '#3d7a2a' },
              { label: 'Resta',        value: fmtMoney(Math.abs(resta)), color: resta > 0 ? RED_TEXT : '#3d7a2a' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: BG, borderRadius: 10, padding: '10px 8px' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#aaa', letterSpacing: .5, marginBottom: 3 }}>{label.toUpperCase()}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── GUARDAR ── */}
          <button onClick={handleSave}
            style={{ width: '100%', padding: 13, borderRadius: 12, background: NAVY, color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
            <Save size={15} /> Guardar cambios
          </button>

          {/* ── CANCELAR NOTA ── */}
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)}
              style={{ width: '100%', padding: 12, borderRadius: 12, background: RED_BG, color: RED_TEXT, border: `1.5px solid #f4b8cf`, fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              <Trash2 size={14} /> Cancelar / Eliminar nota
            </button>
          ) : (
            <div style={{ background: RED_BG, border: `1.5px solid #f4b8cf`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: RED_TEXT, marginBottom: 12, textAlign: 'center' }}>
                ¿Seguro? Esta acción no se puede deshacer.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDel(false)}
                  style={{ flex: 1, padding: 10, borderRadius: 8, background: '#fff', border: `1px solid ${LINE}`, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#555', cursor: 'pointer' }}>
                  No, volver
                </button>
                <button onClick={() => { onDelete(nota.id); onClose() }}
                  style={{ flex: 1, padding: 10, borderRadius: 8, background: RED_TEXT, border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer' }}>
                  Sí, eliminar
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
export default function HistorialNotas({ notas = [], onBack, onEdit, onDelete }) {
  const [editando,   setEditando]   = useState(null)
  const [filterDate, setFilterDate] = useState(todayISO)

  const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const prevDay = () => {
    const d = new Date(filterDate + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setFilterDate(localISO(d))
  }
  const nextDay = () => {
    const d = new Date(filterDate + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setFilterDate(localISO(d))
  }
  const isToday = filterDate === todayISO()

  const labelDiaFiltro = (iso) => {
    if (iso === todayISO()) return 'Hoy'
    const d = new Date(iso + 'T12:00:00')
    return `${DIAS_ES[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]} ${d.getFullYear()}`
  }

  const filteredNotas = notas
    .filter(n => creacionDay(n) === filterDate)
    .sort((a, b) => {
      const aNum = parseInt(a.folio?.replace('#', '') || '0')
      const bNum = parseInt(b.folio?.replace('#', '') || '0')
      return bNum - aNum
    })

  const groups = []
  const seen = new Map()
  filteredNotas.forEach(nota => {
    const day = creacionDay(nota)
    if (!seen.has(day)) { seen.set(day, []); groups.push({ day, notas: seen.get(day) }) }
    seen.get(day).push(nota)
  })

  const emptyCount = Math.max(0, MIN_ROWS - filteredNotas.length)

  const TH = (extra = {}) => ({
    background: '#E9E0F6', color: HEAD_INK, fontWeight: 800, fontSize: 12,
    letterSpacing: .3, padding: '9px 8px', border: `1px solid ${LINE}`,
    textAlign: 'center', whiteSpace: 'nowrap', fontFamily: 'inherit', ...extra,
  })
  const TD = (extra = {}) => ({
    border: `1px solid ${LINE_SOFT}`, fontSize: 13, height: 30,
    padding: '0 8px', verticalAlign: 'middle', ...extra,
  })

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', color: '#1a1a22' }}>
      <style>{`
        @media (max-width: 640px) {
          .hist-table-view { display: none !important; }
          .hist-card-view  { display: block !important; }
          .hist-stage      { padding: 16px 0 60px !important; }
          .hist-toolbar    { padding: 0 14px 12px !important; }
        }
        @media (min-width: 641px) {
          .hist-card-view { display: none !important; }
        }
      `}</style>

      {/* Nav */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${LINE}`, background: BG }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, color: '#1a1a22', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <ArrowLeft size={16} strokeWidth={2.5} /> Volver
        </button>
        <span style={{ fontWeight: 800, fontSize: 15, color: HEAD_INK }}>Historial de Notas</span>
        <div style={{ width: 70 }} />
      </div>

      {/* Stage */}
      <div className="hist-stage" style={{ display: 'flex', justifyContent: 'center', padding: '28px 16px 60px' }}>
        <div style={{ width: '100%', maxWidth: 860 }}>

          {/* Toolbar */}
          <div className="hist-toolbar" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -.2, color: HEAD_INK }}>Historial de Notas</h1>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>
                {filteredNotas.length} nota{filteredNotas.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Selector de fecha */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, padding: '5px 8px', boxShadow: '0 2px 8px rgba(31,43,94,.07)' }}>
              <button onClick={prevDay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: `1px solid ${LINE_SOFT}`, borderRadius: 6, background: BTN, cursor: 'pointer' }}>
                <span style={{ fontSize: 12, color: '#555', fontWeight: 700 }}>◀</span>
              </button>
              <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', position: 'relative' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: isToday ? NAVY : HEAD_INK, flex: 1, textAlign: 'center', letterSpacing: -.1 }}>
                  {labelDiaFiltro(filterDate)}
                </span>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                  style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0, cursor: 'pointer' }} />
              </label>
              <button onClick={nextDay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: `1px solid ${LINE_SOFT}`, borderRadius: 6, background: BTN, cursor: 'pointer' }}>
                <span style={{ fontSize: 12, color: '#555', fontWeight: 700 }}>▶</span>
              </button>
              {!isToday && (
                <button onClick={() => setFilterDate(todayISO())} style={{ padding: '4px 10px', border: `1px solid ${NAVY}`, borderRadius: 6, background: NAVY, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  Hoy
                </button>
              )}
            </div>
          </div>

          {/* ── VISTA TABLA (desktop) ── */}
          <div className="hist-table-view" style={{ background: '#fff', border: `1px solid ${LINE}`, boxShadow: '0 14px 44px rgba(31,43,94,.14)', overflow: 'hidden' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ ...TH(), textAlign: 'left', width: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>N° <FilterIcon /></div>
                  </th>
                  <th style={{ ...TH(), width: 145 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>FECHA CREACIÓN <FilterIcon /></div>
                  </th>
                  <th style={{ ...TH(), width: 145 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>FECHA ENTREGA <FilterIcon /></div>
                  </th>
                  <th style={{ ...TH(), width: 130 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>ESTATUS <FilterIcon /></div>
                  </th>
                  <th style={{ ...TH(), width: 90 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>EDITAR</div>
                  </th>
                  <th style={{ ...TH(), width: 90 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>PDF</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map(({ day, notas: grupoNotas }) => (
                  <Fragment key={day}>
                    <tr>
                      <td colSpan={6} style={{ background: NAVY, color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: 1, padding: '5px 12px', textTransform: 'uppercase', border: `1px solid ${NAVY}` }}>
                        {labelFecha(grupoNotas[0].createdAt)}
                      </td>
                    </tr>
                    {grupoNotas.map(nota => (
                      <tr key={nota.id}
                        onMouseEnter={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background = '#fafaff')}
                        onMouseLeave={e => Array.from(e.currentTarget.cells).forEach(c => c.style.background = '')}>
                        <td style={{ ...TD(), color: LINK, fontWeight: 700 }}>{nota.folio}</td>
                        <td style={{ ...TD(), textAlign: 'center' }}>{fmtCreacion(nota.createdAt)}</td>
                        <td style={{ ...TD(), textAlign: 'center' }}>{fmtEntrega(nota.fechaEntrega)}</td>
                        <td style={{ ...TD(), textAlign: 'center' }}><StatusBadge estado={nota.estado} /></td>
                        <td style={{ ...TD(), textAlign: 'center' }}>
                          <button onClick={() => setEditando(nota)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#fff', fontWeight: 700, fontSize: 11, background: NAVY, border: 'none', borderRadius: 5, padding: '3px 9px', cursor: 'pointer', fontFamily: 'inherit' }}>
                            Editar
                          </button>
                        </td>
                        <td style={{ ...TD(), textAlign: 'center' }}>
                          <button onClick={() => printNota(adaptForPrint(nota))}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: LINK, fontWeight: 700, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                            <FileDown size={13} /> PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {filteredNotas.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#aaa', fontWeight: 700, fontSize: 14, border: `1px solid ${LINE_SOFT}` }}>
                      {isToday ? 'Sin notas hoy' : 'Sin notas para este día'}
                    </td>
                  </tr>
                )}
                {Array.from({ length: emptyCount }).map((_, i) => (
                  <tr key={`empty-${i}`}>
                    {[...Array(6)].map((__, j) => <td key={j} style={TD()} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── VISTA CARDS (móvil) ── */}
          <div className="hist-card-view" style={{ display: 'none' }}>
            {filteredNotas.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#aaa', fontWeight: 700, fontSize: 14 }}>
                {isToday ? 'Sin notas hoy' : 'Sin notas para este día'}
              </div>
            )}
            {groups.map(({ day, notas: grupoNotas }) => (
              <div key={day} style={{ marginBottom: 8 }}>
                <div style={{ background: NAVY, color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: 1, padding: '6px 14px', textTransform: 'uppercase' }}>
                  {labelFecha(grupoNotas[0].createdAt)}
                </div>
                {grupoNotas.map(nota => (
                  <div key={nota.id} style={{ background: '#fff', borderBottom: `1px solid ${LINE_SOFT}`, padding: '14px 16px', borderLeft: `3px solid ${nota.estado === 'pagado' ? '#3d7a2a' : PINK_TEXT}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ color: LINK, fontWeight: 800, fontSize: 16 }}>{nota.folio}</span>
                      <StatusBadge estado={nota.estado} />
                    </div>
                    {nota.cliente && (
                      <div style={{ fontWeight: 700, fontSize: 14, color: HEAD_INK, marginBottom: 8 }}>{nota.cliente}</div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                      <div style={{ background: BG, borderRadius: 8, padding: '7px 10px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: .5, marginBottom: 2 }}>CREADA</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#444' }}>{fmtCreacion(nota.createdAt)}</div>
                      </div>
                      <div style={{ background: BG, borderRadius: 8, padding: '7px 10px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: .5, marginBottom: 2 }}>ENTREGA</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#444' }}>{fmtEntrega(nota.fechaEntrega)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditando(nota)}
                        style={{ flex: 1, padding: '9px', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Editar nota
                      </button>
                      <button onClick={() => printNota(adaptForPrint(nota))}
                        style={{ flex: 1, padding: '9px', background: '#fff', color: LINK, border: `1px solid ${LINE}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <FileDown size={14} /> PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Modal */}
      {editando && (
        <EditModal
          nota={editando}
          onClose={() => setEditando(null)}
          onSave={notaEditada => { onEdit?.(notaEditada); setEditando(null) }}
          onDelete={notaId => { onDelete?.(notaId); setEditando(null) }}
        />
      )}

    </div>
  )
}
