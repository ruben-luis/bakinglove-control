import { useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, FileDown, Sheet } from 'lucide-react'
import { printNota } from './printNota'
import { exportarExcel } from './exportExcel'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function fmt(n) {
  if (!n || n === 0) return '$ -'
  return `$ ${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtShort(n) {
  if (!n || n === 0) return '-'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getWeekRange(date) {
  const d   = new Date(date)
  const day = d.getDay()
  const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return {
    start: mon,
    end:   sun,
    label: `Del ${DIAS[mon.getDay()]} ${String(mon.getDate()).padStart(2,'0')} al ${DIAS[sun.getDay()]} ${String(sun.getDate()).padStart(2,'0')}`,
  }
}

function TableHead({ label }) {
  return (
    <div className="bg-mint-soft text-ink text-center py-2 text-[10px] font-bold tracking-widest">
      {label}
    </div>
  )
}

function SaldoRow({ label, value, last = false }) {
  return (
    <div className={`grid grid-cols-2 bg-ink text-cream ${!last ? 'border-b border-cream/10' : ''}`}>
      <div className="px-2.5 py-2 text-[10px] font-bold border-r border-cream/20">{label}</div>
      <div className="px-2.5 py-2 text-[10px] text-right">{value}</div>
    </div>
  )
}

function TotalGreenRow({ value }) {
  return (
    <div className="grid grid-cols-2 bg-mint-soft/60 border-t border-ink/15">
      <div className="px-2.5 py-2 text-[10px] font-bold text-ink">$</div>
      <div className="px-2.5 py-2 text-[10px] font-bold text-right text-ink">{value}</div>
    </div>
  )
}

const DIAS_ES  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function labelDia(isoStr) {
  const d = new Date(isoStr)
  return `${DIAS_ES[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]}`
}

const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }

const toISO = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

function getMondayISO(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - ((day + 6) % 7))
  return toISO(d)
}

export default function ConcentradoIngresos({ notas, gastos = [], srRows = [], saldosSemana = [], onBack }) {
  const now  = new Date()
  const [refDate,    setRefDate]    = useState(now)
  const [filterDate, setFilterDate] = useState(todayISO)
  const week    = getWeekRange(refDate)
  const weekKey = getMondayISO(refDate)
  const saldoSemana = saldosSemana.find(s => s.id === weekKey) || { efectivoBkl: 0, efectivoSr: 0, bancos: 0 }
  const saldoInicialEfectivo = (saldoSemana.efectivoBkl || 0) + (saldoSemana.efectivoSr || 0)
  const saldoInicialBancos   = saldoSemana.bancos || 0

  const localISO = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const prevDay = () => { const d = new Date(filterDate + 'T12:00:00'); d.setDate(d.getDate() - 1); setFilterDate(localISO(d)) }
  const nextDay = () => { const d = new Date(filterDate + 'T12:00:00'); d.setDate(d.getDate() + 1); setFilterDate(localISO(d)) }
  const isDiaHoy = filterDate === todayISO()
  const labelDiaFiltro = (iso) => {
    if (iso === todayISO()) return 'Hoy'
    const d = new Date(iso + 'T12:00:00')
    return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} ${d.getFullYear()}`
  }

  const notasMes = notas.filter(n => {
    const d = new Date(n.createdAt)
    return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear()
  })

  const notasDia = notasMes.filter(n => { const d = new Date(n.createdAt); return localISO(d) === filterDate })

  const gastosMes = gastos.filter(g => {
    const d = new Date(g.createdAt)
    return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear()
  })

  // SR ventas del mes y del día
  const srVentasMes = (srRows || []).filter(r => {
    if (r.tipo !== 'venta') return false
    const d = new Date(r.fecha + 'T12:00:00')
    return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear()
  })
  const srVentasDia = srVentasMes.filter(r => r.fecha === filterDate)

  // Acumulado de ingresos por método
  const acum = { Terminal: 0, Transferencia: 0, Efectivo: 0 }
  notasMes.forEach(n => {
    n.pagos.forEach(p => {
      if (p.metodoPago && acum[p.metodoPago] !== undefined) {
        acum[p.metodoPago] += parseFloat(p.monto) || 0
      }
    })
  })
  // SR ventas al acumulado
  srVentasMes.forEach(r => {
    const m = parseFloat(r.precio) || 0
    if (r.metodo === 'Banco') acum.Terminal += m
    else if (r.metodo === 'Efectivo') acum.Efectivo += m
  })

  // Acumulado de gastos por método
  const gastoAcum = { Tarjeta: 0, Transferencia: 0, Efectivo: 0 }
  gastosMes.forEach(g => {
    const m = parseFloat(g.monto) || 0
    if (g.formaPago && gastoAcum[g.formaPago] !== undefined) gastoAcum[g.formaPago] += m
  })

  // Ingresos
  const ingBancos   = acum.Terminal + acum.Transferencia
  const ingEfectivo = acum.Efectivo

  // Gastos
  const gastoBancos   = gastoAcum.Tarjeta + gastoAcum.Transferencia
  const gastoEfectivo = gastoAcum.Efectivo

  // Saldo neto (ingresos - gastos)
  const totalBancos   = acum.Terminal + acum.Transferencia  // para acumulado
  const totalEfectivo = acum.Efectivo
  const totalGeneral  = totalBancos + totalEfectivo

  const saldoBancos   = saldoInicialBancos   + ingBancos   - gastoBancos
  const saldoEfectivo = saldoInicialEfectivo + ingEfectivo - gastoEfectivo
  const saldoTotal    = saldoBancos + saldoEfectivo

  const prevWeek = () => { const d = new Date(refDate); d.setDate(d.getDate() - 7); setRefDate(d) }
  const nextWeek = () => { const d = new Date(refDate); d.setDate(d.getDate() + 7); setRefDate(d) }

  const rows = notasDia.map((n, i) => ({ idx: i + 1, nota: n, type: 'nota' }))
  const srRows2 = srVentasDia.map((r, i) => ({ idx: rows.length + i + 1, sr: r, type: 'sr' }))

  const folioPH = `BL${String(refDate.getFullYear()).slice(2)}${String(refDate.getMonth()+1).padStart(2,'0')}`

  const handlePrintNota = (nota) => printNota({
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
  })

  return (
    <div className="min-h-screen bg-cream">
      <div className="bkl-texture pointer-events-none fixed inset-0 opacity-[0.06]" />

      {/* Nav */}
      <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur-sm border-b-2 border-ink flex items-center justify-between px-4 py-3 shadow-hard-sm gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-2 text-ink font-bold text-sm">
            <ArrowLeft size={18} strokeWidth={2.5} />
            Volver
          </button>
          <span className="font-display font-bold text-ink text-sm" style={{ whiteSpace: 'nowrap' }}>Concentrado de Ingresos</span>
        </div>
        <button
          onClick={() => exportarExcel(notas, gastos, srRows)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 12,
            border: '2px solid #1a6b3c',
            background: '#22a05a', color: '#fff',
            fontSize: 12, fontWeight: 800,
            cursor: 'pointer', boxShadow: '3px 3px 0 #1a6b3c',
            whiteSpace: 'nowrap',
          }}
          onPointerDown={e => { e.currentTarget.style.transform = 'translate(2px,2px)'; e.currentTarget.style.boxShadow = '1px 1px 0 #1a6b3c' }}
          onPointerUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0 #1a6b3c' }}
          onPointerLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0 #1a6b3c' }}
        >
          <Sheet size={14} strokeWidth={2.5} />
          Excel
        </button>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Encabezado de mes */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <div className="bg-gray-100 text-center py-4 px-4">
            <h1 className="font-display font-black text-ink text-4xl tracking-tight">
              {MESES[refDate.getMonth()].toUpperCase()}
            </h1>
            <div className="flex items-center justify-center gap-3 mt-2">
              <button onClick={prevWeek} className="border-2 border-ink rounded-full p-1 bg-white shadow-hard-sm active:scale-95 transition-transform">
                <ChevronLeft size={14} strokeWidth={2.5} />
              </button>
              <p className="text-ink/60 text-xs font-semibold capitalize">{week.label}</p>
              <button onClick={nextWeek} className="border-2 border-ink rounded-full p-1 bg-white shadow-hard-sm active:scale-95 transition-transform">
                <ChevronRight size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Saldo inicial / Saldo final */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard">
            <TableHead label="SALDO INICIAL" />
            <SaldoRow label="Bancos"   value={fmt(saldoInicialBancos)}   />
            <SaldoRow label="Efectivo" value={fmt(saldoInicialEfectivo)} last />
            <TotalGreenRow value={saldoInicialBancos + saldoInicialEfectivo > 0 ? fmtShort(saldoInicialBancos + saldoInicialEfectivo) : '-'} />
          </div>
          <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard">
            <TableHead label="SALDO FINAL" />
            <SaldoRow label="Bancos"   value={fmt(saldoBancos)}   />
            <SaldoRow label="Efectivo" value={fmt(saldoEfectivo)} last />
            <TotalGreenRow value={saldoTotal !== 0 ? fmtShort(saldoTotal) : '-'} />
          </div>
        </div>

        {totalGeneral > 0 && (
          <p className="text-right text-[10px] text-ink/45 font-semibold pr-1">
            {fmt(totalGeneral)} — Total Ingreso libre semanal
          </p>
        )}

        {/* Navegación por día */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '2px 0' }}>
          <button onClick={prevDay} style={{ border: '2px solid #1a1a22', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', background: '#fff', cursor: 'pointer' }}>
            <ChevronLeft size={14} strokeWidth={2.5} />
          </button>
          <label style={{ position: 'relative', cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#1a1a22', padding: '4px 14px', border: '2px solid #1a1a22', borderRadius: 20, background: '#fff', display: 'inline-block', userSelect: 'none' }}>
            {labelDiaFiltro(filterDate)}
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
          </label>
          <button onClick={nextDay} style={{ border: '2px solid #1a1a22', borderRadius: '50%', width: 28, height: 28, display: 'grid', placeItems: 'center', background: '#fff', cursor: 'pointer' }}>
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
          {!isDiaHoy && (
            <button onClick={() => setFilterDate(todayISO())} style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', border: '2px solid #1f2b5e', borderRadius: 14, background: '#1f2b5e', color: '#fff', cursor: 'pointer' }}>
              Hoy
            </button>
          )}
        </div>

        {/* Control de ingresos */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <TableHead label="CONTROL DE INGRESOS" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[10px]">
              <thead>
                <tr style={{ background: '#E0EDDA' }}>
                  {['#', 'Fecha', 'Nota de venta', 'Producto', 'Monto Total', 'Anticipo', 'Restante', 'Forma de pago', ''].map(h => (
                    <th key={h} style={{ color: '#2b2731', fontWeight: 700, fontSize: 10, padding: '8px 8px', borderRight: '1px solid rgba(116,160,95,.3)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: '#bbb', fontSize: 11, padding: 20 }}>
                      Sin ingresos para este día
                    </td>
                  </tr>
                ) : rows.map(({ idx, nota }) => {
                  const totalPedido = nota.totalPedido || 0
                  const totalPagado = nota.totalPagado || 0
                  const resta       = nota.resta ?? (totalPedido - totalPagado)
                  const liquidado   = resta <= 0

                  const prods = (nota.productos || []).filter(p => p.descripcion)
                  const prodStr = prods.length === 0
                    ? '—'
                    : prods.map(p => `${p.cantidad ? p.cantidad + '× ' : ''}${p.descripcion}`).join(' · ')

                  const pagosValidos = (nota.pagos || []).filter(p => p.metodoPago && p.monto)
                  const pagoColors = {
                    Transferencia: 'bg-sky-soft/60 text-sky-700',
                    Efectivo:      'bg-mint-soft/60 text-green-700',
                    Terminal:      'bg-lilac-soft/60 text-purple-700',
                  }

                  return (
                    <tr key={nota.id} className="border-t border-ink/10 hover:bg-cream/60 transition-colors">
                      <td className="px-2 py-2.5 text-ink/50 border-r border-ink/10 font-semibold w-7">{idx}</td>

                      <td className="px-2 py-2.5 text-ink border-r border-ink/10 whitespace-nowrap">
                        {new Date(nota.createdAt).toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                      </td>

                      <td className="px-2 py-2.5 text-ink border-r border-ink/10 font-semibold whitespace-nowrap">
                        {nota.folio}
                      </td>

                      {/* Todos los productos en un solo renglón */}
                      <td className="px-2 py-2.5 text-ink border-r border-ink/10" style={{ maxWidth: 180 }}>
                        <span className="line-clamp-2 leading-tight">{prodStr}</span>
                      </td>

                      <td className="px-2 py-2.5 border-r border-ink/10 font-bold text-ink whitespace-nowrap">
                        {totalPedido > 0 ? fmtShort(totalPedido) : ''}
                      </td>

                      <td className="px-2 py-2.5 border-r border-ink/10 font-bold whitespace-nowrap" style={{ color: '#3d7a2a' }}>
                        {totalPagado > 0 ? fmtShort(totalPagado) : ''}
                      </td>

                      <td className="px-2 py-2.5 border-r border-ink/10 font-bold whitespace-nowrap">
                        {liquidado
                          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-mint-soft/60 text-green-700 border border-green-200">Pagado</span>
                          : <span style={{ color: '#c04070' }}>{fmtShort(resta)}</span>
                        }
                      </td>

                      <td className="px-2 py-1.5 border-r border-ink/10">
                        <div className="flex flex-col gap-0.5">
                          {pagosValidos.map((p, pi) => (
                            <span key={pi} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${pagoColors[p.metodoPago] || 'bg-amber-50 text-amber-700'}`}>
                              {p.metodoPago} · {fmtShort(parseFloat(p.monto) || 0)}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="px-1.5 py-1.5 text-center">
                        <button
                          onClick={() => handlePrintNota(nota)}
                          className="flex items-center gap-1 bg-[#1f2b5e] text-white rounded px-1.5 py-1 text-[9px] font-bold"
                        >
                          <FileDown size={10} /> PDF
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {/* Filas San Ramón */}
                {srRows2.map(({ idx, sr }) => (
                  <tr key={sr.id} style={{ background: 'rgba(217,239,210,.12)' }}>
                    <td className="px-2 py-2.5 text-ink/50 border-r border-ink/10 font-semibold w-7">{idx}</td>
                    <td className="px-2 py-2.5 text-ink border-r border-ink/10 whitespace-nowrap">{sr.fecha}</td>
                    <td className="px-2 py-1.5 border-r border-ink/10">
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 8, background: '#d9efd2', color: '#5d8a49', fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>
                        SAN RAMÓN
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-ink border-r border-ink/10" style={{ maxWidth: 180 }}>
                      <span className="line-clamp-2 leading-tight">{sr.producto || '—'}</span>
                    </td>
                    <td className="px-2 py-2.5 border-r border-ink/10 font-bold text-ink whitespace-nowrap">
                      {sr.precio ? fmtShort(parseFloat(sr.precio) || 0) : ''}
                    </td>
                    <td className="px-2 py-2.5 border-r border-ink/10 font-bold whitespace-nowrap" style={{ color: '#3d7a2a' }}>
                      {sr.precio ? fmtShort(parseFloat(sr.precio) || 0) : ''}
                    </td>
                    <td className="px-2 py-2.5 border-r border-ink/10">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-mint-soft/60 text-green-700 border border-green-200">Pagado</span>
                    </td>
                    <td className="px-2 py-1.5 border-r border-ink/10">
                      {sr.metodo && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-mint-soft/60 text-green-700">
                          {sr.metodo}
                        </span>
                      )}
                    </td>
                    <td className="px-1.5 py-1.5 text-center text-ink/20 text-[9px]">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Acumulado de ingresos */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <TableHead label="ACUMULADO DE INGRESOS" />
          <div className="grid grid-cols-3 bg-mint-soft text-ink">
            {['Terminal', 'Transferencia', 'Efectivo'].map(m => (
              <div key={m} className="px-2 py-2 text-[10px] font-bold text-center border-r border-mint-deep/20 last:border-r-0">{m}</div>
            ))}
          </div>
          <div className="grid grid-cols-3">
            {['Terminal', 'Transferencia', 'Efectivo'].map(m => (
              <div key={m} className="px-2 py-3 text-[10px] font-bold text-ink text-center border-r border-ink/10 last:border-r-0 bg-mint-soft/30">
                {acum[m] > 0 ? fmtShort(acum[m]) : '$ -'}
              </div>
            ))}
          </div>
        </div>

        {/* Total ingresos */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <TableHead label="TOTAL INGRESOS" />
          <div className="grid grid-cols-2 bg-ink text-cream">
            <div className="px-3 py-2.5 text-[10px] font-bold border-r border-cream/20">Bancos</div>
            <div className="px-3 py-2.5 text-[10px] text-right">{fmt(totalBancos)}</div>
          </div>
          <div className="grid grid-cols-2 bg-ink text-cream border-t border-cream/10">
            <div className="px-3 py-2.5 text-[10px] font-bold border-r border-cream/20">Efectivo</div>
            <div className="px-3 py-2.5 text-[10px] text-right">{fmt(totalEfectivo)}</div>
          </div>
          <div className="grid grid-cols-[auto_1fr_auto] border-t border-ink/20 bg-gray-50 py-2.5 px-3 items-center">
            <span className="text-[10px] font-bold text-ink mr-2">$</span>
            <span className="text-[10px] font-black text-ink">{fmtShort(totalGeneral)}</span>
            <span className="text-[10px] text-ink/45 font-medium">Total General</span>
          </div>
          <div className="flex justify-end border-t border-ink/10 bg-gray-50 py-2 px-3">
            <span className="text-[10px] text-ink/40 font-medium">Diferencias</span>
          </div>
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
