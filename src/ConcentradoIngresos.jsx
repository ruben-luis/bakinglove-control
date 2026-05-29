import { useState } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, FileDown } from 'lucide-react'
import { printNota } from './printNota'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']

function fmt(n) {
  if (!n || n === 0) return '$ -'
  return `$ ${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
}

function fmtShort(n) {
  if (!n || n === 0) return '-'
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
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
    <div className="bg-gray-200 text-ink text-center py-2 text-[10px] font-bold tracking-widest">
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

export default function ConcentradoIngresos({ notas, gastos = [], onBack }) {
  const now  = new Date()
  const [refDate, setRefDate] = useState(now)
  const week = getWeekRange(refDate)

  const notasMes = notas.filter(n => {
    const d = new Date(n.createdAt)
    return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear()
  })

  const gastosMes = gastos.filter(g => {
    const d = new Date(g.createdAt)
    return d.getMonth() === refDate.getMonth() && d.getFullYear() === refDate.getFullYear()
  })

  // Acumulado de ingresos por método
  const acum = { Terminal: 0, Transferencia: 0, Efectivo: 0 }
  notasMes.forEach(n => {
    n.pagos.forEach(p => {
      if (p.metodoPago && acum[p.metodoPago] !== undefined) {
        acum[p.metodoPago] += parseFloat(p.monto) || 0
      }
    })
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

  const saldoBancos   = ingBancos   - gastoBancos
  const saldoEfectivo = ingEfectivo - gastoEfectivo
  const saldoTotal    = saldoBancos + saldoEfectivo

  const prevWeek = () => { const d = new Date(refDate); d.setDate(d.getDate() - 7); setRefDate(d) }
  const nextWeek = () => { const d = new Date(refDate); d.setDate(d.getDate() + 7); setRefDate(d) }

  const MIN_ROWS = 16
  const rawRows = []
  let rowIdx = 1
  notasMes.forEach(n => {
    const prodActivos = n.productos.filter(p => p.descripcion)
    if (prodActivos.length === 0) {
      rawRows.push({ idx: rowIdx++, nota: n, producto: null, pago: n.pagos[0] })
    } else {
      prodActivos.forEach((p, pi) => {
        rawRows.push({ idx: rowIdx++, nota: n, producto: p, pago: n.pagos[pi] || null })
      })
    }
  })
  while (rawRows.length < MIN_ROWS) {
    rawRows.push({ idx: rowIdx++, nota: null, producto: null, pago: null })
  }

  // Insertar divisores de fecha entre días distintos
  const rows = []
  let lastDay = null
  rawRows.forEach(row => {
    if (row.nota) {
      const day = row.nota.createdAt.split('T')[0]
      if (day !== lastDay) {
        lastDay = day
        rows.push({ type: 'divider', label: labelDia(row.nota.createdAt) })
      }
      rows.push({ type: 'row', ...row })
    } else {
      rows.push({ type: 'row', ...row })
    }
  })

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
      <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur-sm border-b-2 border-ink flex items-center px-4 py-3 shadow-hard-sm gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-ink font-bold text-sm">
          <ArrowLeft size={18} strokeWidth={2.5} />
          Volver
        </button>
        <span className="font-display font-bold text-ink text-base">Concentrado de Ingresos</span>
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
            <SaldoRow label="Bancos"   value="$ -" />
            <SaldoRow label="Efectivo" value="$ -" last />
            <TotalGreenRow value="-" />
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

        {/* Control de ingresos */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <TableHead label="CONTROL DE INGRESOS" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[10px]">
              <thead>
                <tr className="bg-ink text-cream">
                  {['#', 'Fecha', 'Nota de venta', 'Producto', 'Monto Total', 'Anticipo', 'Restante', 'Forma de pago', ''].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-bold border-r border-cream/20 last:border-r-0 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const seenNotas = new Set()
                  return rows.map((item, i) => {
                    if (item.type === 'divider') {
                      return (
                        <tr key={`div-${i}`}>
                          <td colSpan={9} style={{ background: '#f0f0f5', padding: '4px 10px', fontSize: 9, fontWeight: 800, color: '#888', letterSpacing: 1, textTransform: 'uppercase', borderTop: '1px solid #e0e0e8', borderBottom: '1px solid #e0e0e8' }}>
                            {item.label}
                          </td>
                        </tr>
                      )
                    }
                    const { idx, nota, producto, pago } = item
                    const isFirst = nota && !seenNotas.has(nota.id)
                    if (nota) seenNotas.add(nota.id)

                    const totalPedido = nota?.totalPedido || 0
                    const totalPagado = nota?.totalPagado || 0
                    const resta       = nota?.resta ?? (totalPedido - totalPagado)
                    const liquidado   = resta <= 0

                    return (
                      <tr key={i} className="border-t border-ink/10 hover:bg-cream/60 transition-colors">
                        <td className="px-2 py-2.5 text-ink/50 border-r border-ink/10 font-semibold w-7">{idx}</td>

                        {/* Fecha de creación */}
                        <td className="px-2 py-2.5 text-ink border-r border-ink/10 whitespace-nowrap">
                          {nota ? new Date(nota.createdAt).toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'2-digit' }) : ''}
                        </td>

                        <td className="px-2 py-2.5 text-ink border-r border-ink/10 font-semibold">
                          {nota ? nota.folio : <span className="text-ink/25">{folioPH}</span>}
                        </td>
                        <td className="px-2 py-2.5 text-ink border-r border-ink/10">
                          {producto?.descripcion || ''}
                        </td>

                        {/* Monto Total — fijo, solo en primera fila de la nota */}
                        <td className="px-2 py-2.5 border-r border-ink/10 font-bold text-ink">
                          {isFirst && totalPedido > 0 ? fmtShort(totalPedido) : ''}
                        </td>

                        {/* Anticipo / Pagado acumulado */}
                        <td className="px-2 py-2.5 border-r border-ink/10 font-bold" style={{ color: '#3d7a2a' }}>
                          {isFirst && totalPagado > 0 ? fmtShort(totalPagado) : ''}
                        </td>

                        {/* Restante */}
                        <td className="px-2 py-2.5 border-r border-ink/10 font-bold whitespace-nowrap">
                          {isFirst && nota ? (
                            liquidado
                              ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-mint-soft/60 text-green-700 border border-green-200">Pagado</span>
                              : <span style={{ color: '#c04070' }}>{fmtShort(resta)}</span>
                          ) : ''}
                        </td>

                        {/* Forma de pago — todos los métodos de la nota */}
                        <td className="px-2 py-1.5 border-r border-ink/10">
                          {isFirst && nota ? (
                            <div className="flex flex-col gap-0.5">
                              {(nota.pagos || []).filter(p => p.metodoPago && p.monto).map((p, pi) => {
                                const colors = {
                                  Transferencia: 'bg-sky-soft/60 text-sky-700',
                                  Efectivo:      'bg-mint-soft/60 text-green-700',
                                  Terminal:      'bg-lilac-soft/60 text-purple-700',
                                }
                                return (
                                  <span key={pi} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${colors[p.metodoPago] || 'bg-amber-50 text-amber-700'}`}>
                                    {p.metodoPago} · {fmtShort(parseFloat(p.monto) || 0)}
                                  </span>
                                )
                              })}
                            </div>
                          ) : ''}
                        </td>

                        {/* PDF */}
                        <td className="px-1.5 py-1.5 text-center">
                          {isFirst && (
                            <button
                              onClick={() => handlePrintNota(nota)}
                              className="flex items-center gap-1 bg-[#1f2b5e] text-white rounded px-1.5 py-1 text-[9px] font-bold"
                            >
                              <FileDown size={10} /> PDF
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Acumulado de ingresos */}
        <div className="border-2 border-ink rounded-2xl overflow-hidden shadow-hard bg-white">
          <TableHead label="ACUMULADO DE INGRESOS" />
          <div className="grid grid-cols-3 bg-ink text-cream">
            {['Terminal', 'Transferencia', 'Efectivo'].map(m => (
              <div key={m} className="px-2 py-2 text-[10px] font-bold text-center border-r border-cream/20 last:border-r-0">{m}</div>
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
