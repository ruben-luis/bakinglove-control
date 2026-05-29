import { useState } from 'react'
import { ArrowLeft, FileDown, ChevronDown, X, Plus, Save } from 'lucide-react'
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
const MIN_ROWS  = 18

const METODOS = ['Transferencia', 'Efectivo', 'Terminal']
const DIAS_ES  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

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
      color:      pagado ? '#3d7a2a' : '#c04070',
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

const todayISO = () => new Date().toISOString().split('T')[0]
const fmtMoney = (n) => { const v = Number(n) || 0; return v > 0 ? `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '-' }
const fmtEntrega  = (iso) => { if (!iso) return '—'; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }
const fmtCreacion = (isoStr) => { if (!isoStr) return ''; const d = new Date(isoStr); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}` }
const labelFecha  = (isoStr) => { const d = new Date(isoStr); return `${DIAS_ES[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]} ${d.getFullYear()}` }
const creacionDay = (nota) => nota.createdAt ? nota.createdAt.split('T')[0] : ''

// ── Modal de edición de pagos ─────────────────────────────────
function EditModal({ nota, onClose, onSave }) {
  const [pagos, setPagos] = useState(
    (nota.pagos || []).map(p => ({ monto: p.monto || '', fecha: p.fecha || todayISO(), met: p.metodoPago || null }))
  )

  const totalPedido = nota.totalPedido || 0
  const totalPagado = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
  const resta       = totalPedido - totalPagado

  const updP = (i, f, v) => setPagos(a => { const n = [...a]; n[i] = { ...n[i], [f]: v }; return n })
  const addRow = () => setPagos(a => [...a, { monto: '', fecha: todayISO(), met: null }])

  const handleSave = () => {
    const updatedPagos = pagos.map(p => ({ monto: p.monto, fecha: p.fecha, metodoPago: p.met }))
    const totalPagadoFinal = pagos.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0)
    onSave({
      ...nota,
      pagos:       updatedPagos,
      totalPagado: totalPagadoFinal,
      resta:       totalPedido - totalPagadoFinal,
      estado:      totalPagadoFinal >= totalPedido ? 'pagado' : 'pendiente',
    })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', maxHeight: '85vh', overflowY: 'auto', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: HEAD_INK }}>Editar pagos</div>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 600, marginTop: 2 }}>{nota.folio} · {nota.cliente || 'Sin cliente'}</div>
          </div>
          <button onClick={onClose} style={{ background: BTN, border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <X size={16} color="#555" />
          </button>
        </div>

        {/* Resumen */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
          {[
            { label: 'Total pedido', value: fmtMoney(totalPedido), color: '#1a1a22' },
            { label: 'Pagado',       value: fmtMoney(totalPagado), color: '#3d7a2a' },
            { label: 'Resta',        value: fmtMoney(Math.abs(resta)), color: resta > 0 ? '#c04070' : '#3d7a2a' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: BG, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: .5, marginBottom: 3 }}>{label.toUpperCase()}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Tabla de pagos */}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: '#888', marginBottom: 8 }}>PAGOS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pagos.map((p, i) => (
            <div key={i} style={{ background: BG, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 8 }}>Pago {i + 1}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#888', marginBottom: 4 }}>MONTO</div>
                  <input type="number" value={p.monto} onChange={e => updP(i, 'monto', e.target.value)}
                    placeholder="$0"
                    style={{ width: '100%', height: 36, padding: '0 10px', border: `1px solid ${LINE_SOFT}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#1a1a22', background: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#888', marginBottom: 4 }}>FECHA</div>
                  <input type="date" value={p.fecha} onChange={e => updP(i, 'fecha', e.target.value)}
                    style={{ width: '100%', height: 36, padding: '0 8px', border: `1px solid ${LINE_SOFT}`, borderRadius: 6, outline: 'none', fontFamily: 'inherit', fontSize: 12, color: '#1a1a22', background: '#fff' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#888', marginBottom: 4 }}>MÉTODO DE PAGO</div>
                <MethodPicker value={p.met} onChange={v => updP(i, 'met', v)} />
              </div>
            </div>
          ))}
        </div>

        {/* Agregar pago */}
        <button onClick={addRow} style={{ width: '100%', marginTop: 10, padding: '10px', border: `1.5px dashed ${LINE}`, borderRadius: 10, background: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={13} strokeWidth={2.5} /> Agregar pago
        </button>

        {/* Guardar */}
        <button onClick={handleSave} style={{ width: '100%', marginTop: 14, padding: '13px', borderRadius: 12, background: NAVY, color: '#fff', border: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Save size={15} /> Guardar cambios
        </button>

      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
export default function HistorialNotas({ notas = [], onBack, onEdit }) {
  const [editando, setEditando] = useState(null)

  const groups = []
  const seen = new Map()
  notas.forEach(nota => {
    const day = creacionDay(nota)
    if (!seen.has(day)) { seen.set(day, []); groups.push({ day, notas: seen.get(day) }) }
    seen.get(day).push(nota)
  })

  const emptyCount = Math.max(0, MIN_ROWS - notas.length)

  const TH = (extra = {}) => ({
    background: '#fff', color: HEAD_INK, fontWeight: 800, fontSize: 12,
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
        <span style={{ fontWeight: 800, fontSize: 15, color: HEAD_INK }}>Registro de Notas</span>
        <div style={{ width: 70 }} />
      </div>

      {/* Stage */}
      <div className="hist-stage" style={{ display: 'flex', justifyContent: 'center', padding: '28px 16px 60px' }}>
        <div style={{ width: '100%', maxWidth: 860 }}>

          {/* Toolbar */}
          <div className="hist-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: -.2, color: HEAD_INK }}>Registro de Notas</h1>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>
              {notas.length} nota{notas.length !== 1 ? 's' : ''} guardada{notas.length !== 1 ? 's' : ''}
            </span>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>EDITAR <FilterIcon /></div>
                  </th>
                  <th style={{ ...TH(), width: 90 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>PDF <FilterIcon /></div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map(({ day, notas: grupoNotas }) => (
                  <>
                    <tr key={`sep-${day}`}>
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
                  </>
                ))}
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
            {notas.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: '#aaa', fontWeight: 700, fontSize: 14 }}>
                Sin notas registradas
              </div>
            )}
            {groups.map(({ day, notas: grupoNotas }) => (
              <div key={day} style={{ marginBottom: 8 }}>
                {/* Divisor de fecha */}
                <div style={{ background: NAVY, color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: 1, padding: '6px 14px', textTransform: 'uppercase' }}>
                  {labelFecha(grupoNotas[0].createdAt)}
                </div>
                {/* Cards */}
                {grupoNotas.map((nota, idx) => (
                  <div key={nota.id} style={{ background: '#fff', borderBottom: `1px solid ${LINE_SOFT}`, padding: '14px 16px', borderLeft: `3px solid ${nota.estado === 'pagado' ? '#3d7a2a' : PINK_TEXT}` }}>
                    {/* Fila 1: folio + estatus */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ color: LINK, fontWeight: 800, fontSize: 16 }}>{nota.folio}</span>
                      <StatusBadge estado={nota.estado} />
                    </div>
                    {/* Cliente */}
                    {nota.cliente && (
                      <div style={{ fontWeight: 700, fontSize: 14, color: HEAD_INK, marginBottom: 8 }}>{nota.cliente}</div>
                    )}
                    {/* Fechas */}
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
                    {/* Botones */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEditando(nota)}
                        style={{ flex: 1, padding: '9px', background: NAVY, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Editar pagos
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
        />
      )}

    </div>
  )
}
