import * as XLSX from 'xlsx'

// ── Helpers ─────────────────────────────────────────────────────

function getWeekBounds(dateInput) {
  const d   = new Date(dateInput)
  const day = d.getDay()
  const mon = new Date(d)
  mon.setDate(d.getDate() - ((day + 6) % 7))
  mon.setHours(0, 0, 0, 0)
  return { key: mon.getTime(), mon }
}

function weekLabel(ts) {
  const mon = new Date(ts)
  const sun = new Date(ts)
  sun.setDate(mon.getDate() + 6)
  const f = d =>
    d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${f(mon)}  →  ${f(sun)}`
}

function num(v) {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

function applyMoneyFmt(ws, cols, rowStart, rowEnd) {
  for (let r = rowStart; r <= rowEnd; r++) {
    for (const col of cols) {
      const ref = `${col}${r}`
      if (ws[ref] && typeof ws[ref].v === 'number') {
        ws[ref].z = '"$"#,##0.00'
      }
    }
  }
}

// ── Exportar ────────────────────────────────────────────────────
// notas, gastos y srRows se reciben desde el componente (datos de Firestore)

export function exportarExcel(notas = [], gastos = [], srRows = [], saldosSemana = []) {
  const wb = XLSX.utils.book_new()

  // ── Hoja 1: INGRESOS (Notas de venta) ─────────────────────────

  const maxPagos = Math.max(1, ...notas.map(n =>
    (n.pagos || []).filter(p => p.monto).length
  ))

  const ingHead = [
    'Folio', 'Fecha Registro', 'Fecha Entrega', 'Cliente', 'Contacto',
    'Productos', 'Total Pedido', 'Total Pagado', 'Restante', 'Estado',
    ...Array.from({ length: maxPagos }, (_, i) =>
      maxPagos === 1
        ? ['Fecha de Pago', 'Forma de Pago', 'Monto']
        : [`Pago ${i + 1} Fecha`, `Pago ${i + 1} Método`, `Pago ${i + 1} Monto`]
    ).flat(),
  ]

  const sortedNotas = [...notas].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  const ingRows = sortedNotas.map(n => {
    const prods = (n.productos || [])
      .filter(p => p.descripcion)
      .map(p => `${p.cantidad ? p.cantidad + 'x ' : ''}${p.descripcion}`)
      .join(' | ')

    const pagosArr = (n.pagos || [])
      .filter(p => p.monto)
      .flatMap(p => {
        const fecha = p.fecha ? p.fecha.split('-').reverse().join('/') : ''
        return [fecha, p.metodoPago || '', num(p.monto)]
      })

    while (pagosArr.length < maxPagos * 3) pagosArr.push('')

    const totalPedido = num(n.totalPedido)
    const totalPagado = num(n.totalPagado)
    const resta       = num(n.resta ?? (totalPedido - totalPagado))

    return [
      n.folio || '',
      n.createdAt ? new Date(n.createdAt).toLocaleDateString('es-MX') : '',
      n.fechaEntrega || '',
      n.cliente || '',
      n.contacto || '',
      prods,
      totalPedido,
      totalPagado,
      resta,
      n.estado || '',
      ...pagosArr,
    ]
  })

  const wsIng = XLSX.utils.aoa_to_sheet([ingHead, ...ingRows])
  wsIng['!cols'] = [
    { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 14 },
    { wch: 40 }, { wch: 13 }, { wch: 13 }, { wch: 11 }, { wch: 11 },
    ...Array.from({ length: maxPagos }, () => [{ wch: 13 }, { wch: 16 }, { wch: 12 }]).flat(),
  ]
  const colLetter = n => { let s='', x=n+1; while(x>0){s=String.fromCharCode(64+(x%26||26))+s;x=Math.floor((x-1)/26)}; return s }
  const montosCols = Array.from({ length: maxPagos }, (_, i) => colLetter(10 + i * 3 + 2))
  if (ingRows.length) {
    applyMoneyFmt(wsIng, ['G', 'H', 'I'], 2, ingRows.length + 1)
    applyMoneyFmt(wsIng, montosCols, 2, ingRows.length + 1)
  }
  XLSX.utils.book_append_sheet(wb, wsIng, 'Ingresos')

  // ── Hoja 2: GASTOS (Bakinglove) ───────────────────────────────
  const gastHead = ['Fecha', 'Descripción del gasto', 'Monto', 'Forma de Pago', 'Categoría', 'Semana']

  const gastRows = [...gastos]
    .filter(g => g.concepto || g.monto)
    .sort((a, b) => {
      const da = new Date(a.fecha ? a.fecha + 'T12:00:00' : a.createdAt)
      const db = new Date(b.fecha ? b.fecha + 'T12:00:00' : b.createdAt)
      return da - db
    })
    .map(g => {
      const { mon } = getWeekBounds(g.fecha ? g.fecha + 'T12:00:00' : g.createdAt)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      const fmt = d => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
      return [
        g.fecha || '',
        g.concepto || '',
        num(g.monto),
        g.formaPago || '',
        g.categoria || '',
        `${fmt(mon)} – ${fmt(sun)}`,
      ]
    })

  const wsGast = XLSX.utils.aoa_to_sheet([gastHead, ...gastRows])
  wsGast['!cols'] = [
    { wch: 12 }, { wch: 42 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
  ]
  if (gastRows.length) applyMoneyFmt(wsGast, ['C'], 2, gastRows.length + 1)
  XLSX.utils.book_append_sheet(wb, wsGast, 'Gastos BKL')

  // ── Hoja 3: SAN RAMÓN (ventas y salidas) ──────────────────────
  const srHead = ['Fecha', 'Tipo', 'Producto / Descripción', 'Monto', 'Método', 'Semana']

  const srData = [...srRows]
    .filter(r => r.producto || r.precio)
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
    .map(r => {
      const { mon } = getWeekBounds(r.fecha + 'T12:00:00')
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      const fmt = d => d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
      return [
        r.fecha || '',
        r.tipo === 'venta' ? 'Venta' : r.tipo === 'salida' ? 'Salida' : '',
        r.producto || '',
        num(r.precio),
        r.metodo || '',
        `${fmt(mon)} – ${fmt(sun)}`,
      ]
    })

  const wsSR = XLSX.utils.aoa_to_sheet([srHead, ...srData])
  wsSR['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
  ]
  if (srData.length) applyMoneyFmt(wsSR, ['D'], 2, srData.length + 1)
  XLSX.utils.book_append_sheet(wb, wsSR, 'San Ramón')

  // ── Hoja 4: BALANCE GENERAL por semana ────────────────────────
  const weekMap = new Map()

  sortedNotas.forEach(n => {
    ;(n.pagos || []).forEach(p => {
      const pagoDate = p.fecha || n.createdAt
      if (!pagoDate) return
      const { key } = getWeekBounds(pagoDate.length === 10 ? pagoDate + 'T12:00:00' : pagoDate)
      if (!weekMap.has(key)) weekMap.set(key, { ingBKL: 0, gastBKL: 0, ingSR: 0, salidaSR: 0 })
      weekMap.get(key).ingBKL += num(p.monto)
    })
  })

  gastos.filter(g => g.monto).forEach(g => {
    const src = g.fecha ? g.fecha + 'T12:00:00' : g.createdAt
    const { key } = getWeekBounds(src)
    if (!weekMap.has(key)) weekMap.set(key, { ingBKL: 0, gastBKL: 0, ingSR: 0, salidaSR: 0 })
    weekMap.get(key).gastBKL += num(g.monto)
  })

  srRows.filter(r => r.precio && r.fecha).forEach(r => {
    const { key } = getWeekBounds(r.fecha + 'T12:00:00')
    if (!weekMap.has(key)) weekMap.set(key, { ingBKL: 0, gastBKL: 0, ingSR: 0, salidaSR: 0 })
    if (r.tipo === 'venta')  weekMap.get(key).ingSR    += num(r.precio)
    if (r.tipo === 'salida') weekMap.get(key).salidaSR += num(r.precio)
  })

  const sortedWeeks = [...weekMap.entries()].sort((a, b) => a[0] - b[0])

  // Semilla = entrada más antigua en saldos_semana
  const seed = saldosSemana.reduce((earliest, s) =>
    !earliest || s.id < earliest.id ? s : earliest
  , null) || { efectivoBkl: 0, efectivoSr: 0, bancos: 0 }
  const seedTotal = (seed.efectivoBkl || 0) + (seed.efectivoSr || 0) + (seed.bancos || 0)

  const balHead = ['Semana', 'Ingresos BKL', 'Gastos BKL', 'Balance BKL', 'Ventas SR', 'Salidas SR', 'Balance SR', 'Flujo Neto', 'Saldo Final']

  let saldoAcum = seedTotal
  const balRows = sortedWeeks.map(([ts, d]) => {
    const flujoNeto = (d.ingBKL - d.gastBKL) + (d.ingSR - d.salidaSR)
    saldoAcum += flujoNeto
    return [
      weekLabel(ts),
      d.ingBKL,
      d.gastBKL,
      d.ingBKL - d.gastBKL,
      d.ingSR,
      d.salidaSR,
      d.ingSR - d.salidaSR,
      flujoNeto,
      saldoAcum,
    ]
  })

  const totIng  = sortedWeeks.reduce((s, [, d]) => s + d.ingBKL, 0)
  const totGast = sortedWeeks.reduce((s, [, d]) => s + d.gastBKL, 0)
  const totSRV  = sortedWeeks.reduce((s, [, d]) => s + d.ingSR, 0)
  const totSRS  = sortedWeeks.reduce((s, [, d]) => s + d.salidaSR, 0)

  const balData = [
    balHead,
    ['Semilla inicial', '', '', '', '', '', '', '', seedTotal],
    ...balRows,
    ['', '', '', '', '', '', '', '', ''],
    ['TOTAL GENERAL', totIng, totGast, totIng - totGast, totSRV, totSRS, totSRV - totSRS, (totIng - totGast) + (totSRV - totSRS), saldoAcum],
  ]

  const wsBal = XLSX.utils.aoa_to_sheet(balData)
  wsBal['!cols'] = [
    { wch: 34 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
  ]
  const lastBal = balData.length
  applyMoneyFmt(wsBal, ['B','C','D','E','F','G','H','I'], 2, lastBal)
  XLSX.utils.book_append_sheet(wb, wsBal, 'Balance General')

  // ── Descargar ────────────────────────────────────────────────
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  XLSX.writeFile(wb, `Bakinglove_Reporte_${stamp}.xlsx`)
}
