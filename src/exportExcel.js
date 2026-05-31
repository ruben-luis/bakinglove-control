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
  return Number(v || 0)
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

export function exportarExcel() {
  const notas  = JSON.parse(localStorage.getItem('bkl_notas')  || '[]')
  const gastos = JSON.parse(localStorage.getItem('bkl_gastos') || '[]')

  const wb = XLSX.utils.book_new()

  // ── Hoja 1: INGRESOS ──────────────────────────────────────────

  // Cuántos pagos tiene como máximo una sola nota (mínimo 1 columna)
  const maxPagos = Math.max(1, ...notas.map(n =>
    (n.pagos || []).filter(p => p.monto).length
  ))

  const ingHead = [
    'Folio', 'Fecha Registro', 'Fecha Entrega', 'Cliente', 'Contacto',
    'Productos', 'Total Pedido', 'Total Pagado', 'Restante',
    ...Array.from({ length: maxPagos }, (_, i) =>
      maxPagos === 1 ? 'Forma de Pago' : `Pago ${i + 1}`
    ),
  ]

  const sortedNotas = [...notas].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  const ingRows = sortedNotas.map(n => {
    const prods = (n.productos || [])
      .filter(p => p.descripcion)
      .map(p => `${p.cantidad ? p.cantidad + 'x ' : ''}${p.descripcion}`)
      .join(' | ')

    const pagosArr = (n.pagos || [])
      .filter(p => p.monto)
      .map(p => `${p.metodoPago || ''}: $${Number(p.monto).toFixed(2)}`)

    // Rellenar con vacíos hasta llegar al máximo de columnas
    while (pagosArr.length < maxPagos) pagosArr.push('')

    const totalPedido = num(n.totalPedido)
    const totalPagado = num(n.totalPagado)
    const resta       = num(n.resta ?? (totalPedido - totalPagado))

    return [
      n.folio || '',
      n.createdAt ? new Date(n.createdAt).toLocaleDateString('es-MX') : '',
      n.fecha || n.fechaEntrega || '',
      n.cliente || '',
      n.contacto || '',
      prods,
      totalPedido,
      totalPagado,
      resta,
      ...pagosArr,
    ]
  })

  const wsIng = XLSX.utils.aoa_to_sheet([ingHead, ...ingRows])
  wsIng['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 16 },
    { wch: 42 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    ...Array.from({ length: maxPagos }, () => ({ wch: 26 })),
  ]
  if (ingRows.length) applyMoneyFmt(wsIng, ['G', 'H', 'I'], 2, ingRows.length + 1)
  XLSX.utils.book_append_sheet(wb, wsIng, 'Ingresos')

  // ── Hoja 2: GASTOS ───────────────────────────────────────────
  const gastHead = ['Fecha', 'Descripción del gasto', 'Monto', 'Forma de Pago', 'Categoría']

  const gastRows = [...gastos]
    .filter(g => g.concepto || g.monto)
    .sort((a, b) => {
      const da = new Date(a.fecha ? a.fecha + 'T12:00:00' : a.createdAt)
      const db = new Date(b.fecha ? b.fecha + 'T12:00:00' : b.createdAt)
      return da - db
    })
    .map(g => [
      g.fecha || '',
      g.concepto || '',
      num(g.monto),
      g.formaPago || '',
      g.categoria || '',
    ])

  const wsGast = XLSX.utils.aoa_to_sheet([gastHead, ...gastRows])
  wsGast['!cols'] = [
    { wch: 12 }, { wch: 42 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
  ]
  if (gastRows.length) applyMoneyFmt(wsGast, ['C'], 2, gastRows.length + 1)
  XLSX.utils.book_append_sheet(wb, wsGast, 'Gastos')

  // ── Hoja 3: BALANCE GENERAL ──────────────────────────────────
  const weekMap = new Map()

  notas.forEach(n => {
    if (!n.createdAt) return
    const { key } = getWeekBounds(n.createdAt)
    if (!weekMap.has(key)) weekMap.set(key, { ingresos: 0, gastos: 0 })
    weekMap.get(key).ingresos += num(n.totalPagado)
  })

  gastos.filter(g => g.monto).forEach(g => {
    const src = g.fecha ? g.fecha + 'T12:00:00' : g.createdAt
    const { key } = getWeekBounds(src)
    if (!weekMap.has(key)) weekMap.set(key, { ingresos: 0, gastos: 0 })
    weekMap.get(key).gastos += num(g.monto)
  })

  const sortedWeeks = [...weekMap.entries()].sort((a, b) => a[0] - b[0])
  const totalIng  = sortedWeeks.reduce((s, [, d]) => s + d.ingresos, 0)
  const totalGast = sortedWeeks.reduce((s, [, d]) => s + d.gastos, 0)
  const totalBal  = totalIng - totalGast

  const balHead = ['Semana', 'Ingresos', 'Gastos', 'Balance']
  const balWeekRows = sortedWeeks.map(([ts, d]) => [
    weekLabel(ts),
    d.ingresos,
    d.gastos,
    d.ingresos - d.gastos,
  ])
  const balData = [
    balHead,
    ...balWeekRows,
    ['', '', '', ''],
    ['TOTAL GENERAL', totalIng, totalGast, totalBal],
  ]

  const wsBal = XLSX.utils.aoa_to_sheet(balData)
  wsBal['!cols'] = [
    { wch: 36 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
  ]
  const lastBal = balData.length
  applyMoneyFmt(wsBal, ['B', 'C', 'D'], 2, lastBal)
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
