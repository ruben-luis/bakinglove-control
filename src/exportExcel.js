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

const colLetter = n => { let s='', x=n+1; while(x>0){s=String.fromCharCode(64+(x%26||26))+s;x=Math.floor((x-1)/26)}; return s }

// Arma y agrega la hoja de "Ingresos BKL" (notas de venta). Incluye
// todos los pagos de cada nota sin importar en qué sucursal se
// cobraron: una nota es una venta de Baking Love, así que su ingreso
// es de BKL aunque el pago se haya recibido en San Ramón (eso se
// reconcilia aparte, por caja, en la hoja "San Ramón").
function addIngresosSheet(wb, sheetName, notas) {
  const notasFiltradas = notas
    .map(n => ({ ...n, pagos: (n.pagos || []).filter(p => p.monto) }))
    .filter(n => n.pagos.length > 0)

  const maxPagos = Math.max(1, ...notasFiltradas.map(n => n.pagos.length))

  const ingHead = [
    'Folio', 'Fecha Registro', 'Fecha Entrega', 'Cliente', 'Contacto',
    'Productos', 'Total Pedido', 'Total Pagado', 'Restante', 'Estado',
    ...Array.from({ length: maxPagos }, (_, i) =>
      maxPagos === 1
        ? ['Fecha de Pago', 'Forma de Pago', 'Monto']
        : [`Pago ${i + 1} Fecha`, `Pago ${i + 1} Método`, `Pago ${i + 1} Monto`]
    ).flat(),
  ]

  const sortedNotas = [...notasFiltradas].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  const ingRows = sortedNotas.map(n => {
    const prods = (n.productos || [])
      .filter(p => p.descripcion)
      .map(p => `${p.cantidad ? p.cantidad + 'x ' : ''}${p.descripcion}`)
      .join(' | ')

    const pagosArr = n.pagos.flatMap(p => {
      const fecha = p.fecha ? p.fecha.split('-').reverse().join('/') : ''
      return [fecha, p.metodoPago || '', num(p.monto)]
    })

    while (pagosArr.length < maxPagos * 3) pagosArr.push('')

    const totalPedido = num(n.totalPedido)
    const totalPagado = n.pagos.reduce((s, p) => s + num(p.monto), 0)
    const restante    = n.resta ?? (totalPedido - totalPagado)

    return [
      n.folio || '',
      n.createdAt ? new Date(n.createdAt).toLocaleDateString('es-MX') : '',
      n.fechaEntrega || '',
      n.cliente || '',
      n.contacto || '',
      prods,
      totalPedido,
      totalPagado,
      restante,
      n.estado || '',
      ...pagosArr,
    ]
  })

  const wsIng = XLSX.utils.aoa_to_sheet([ingHead, ...ingRows])
  wsIng['!cols'] = [
    { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 14 },
    { wch: 40 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 11 },
    ...Array.from({ length: maxPagos }, () => [{ wch: 13 }, { wch: 16 }, { wch: 12 }]).flat(),
  ]
  const montosCols = Array.from({ length: maxPagos }, (_, i) => colLetter(10 + i * 3 + 2))
  if (ingRows.length) {
    applyMoneyFmt(wsIng, ['G', 'H', 'I'], 2, ingRows.length + 1)
    applyMoneyFmt(wsIng, montosCols, 2, ingRows.length + 1)
  }
  XLSX.utils.book_append_sheet(wb, wsIng, sheetName)
}

export function exportarExcel(notas = [], gastos = [], srRows = []) {
  const wb = XLSX.utils.book_new()

  // ── Hoja 1: INGRESOS BKL ────────────────────────────────────────
  addIngresosSheet(wb, 'Ingresos BKL', notas)

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

  // ── Descargar ────────────────────────────────────────────────
  const now = new Date()
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('')
  XLSX.writeFile(wb, `Bakinglove_Reporte_${stamp}.xlsx`)
}
