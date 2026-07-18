export function getCurrentMonday() {
  const now = new Date()
  const day = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((day + 6) % 7))
  mon.setHours(0, 0, 0, 0)
  return iso(mon)
}

export function getNextMonday(mondayISO) {
  const d = new Date(mondayISO + 'T12:00:00')
  d.setDate(d.getDate() + 7)
  return iso(d)
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function dateOf(str) {
  if (!str) return null
  return new Date(str.length === 10 ? str + 'T12:00:00' : str)
}

function before(dateStr, cutoff) {
  const d = dateOf(dateStr)
  return d !== null && d < new Date(cutoff + 'T00:00:00')
}

function between(dateStr, from, to) {
  const d = dateOf(dateStr)
  return d !== null && d >= new Date(from + 'T00:00:00') && d < new Date(to + 'T00:00:00')
}

const empty = () => ({
  prevBklEf: 0, prevBklBancoDay: 0, prevBklBancoJorge: 0,
  prevBklEfGast: 0, prevBklBancoGast: 0, prevBklBancoJorgeGast: 0,
  prevSrEfV: 0, prevSrBancoDayV: 0, prevSrBancoJorgeV: 0,
  prevSrEfS: 0, prevSrBancoDayS: 0, prevSrBancoJorgeS: 0,
})

function addNotas(acc, notas, testFn) {
  notas.forEach(n =>
    (n.pagos || []).forEach(p => {
      if (p.sucursal === 'SR') return
      const pf = p.fecha || n.createdAt
      if (!testFn(pf)) return
      const m = parseFloat(p.monto) || 0
      if      (p.metodoPago === 'Efectivo')    acc.prevBklEf         += m
      else if (p.metodoPago === 'Banco JORGE') acc.prevBklBancoJorge += m
      else                                     acc.prevBklBancoDay    += m
    })
  )
}

function addNotasSR(acc, notas, testFn) {
  notas.forEach(n =>
    (n.pagos || []).forEach(p => {
      if (p.sucursal !== 'SR') return
      const pf = p.fecha || n.createdAt
      if (!testFn(pf)) return
      const m = parseFloat(p.monto) || 0
      if      (p.metodoPago === 'Efectivo')    acc.prevSrEfV         += m
      else if (p.metodoPago === 'Banco JORGE') acc.prevSrBancoJorgeV += m
      else                                     acc.prevSrBancoDayV    += m
    })
  )
}

function addGastos(acc, gastos, testFn) {
  gastos.forEach(g => {
    const f = g.fecha ? g.fecha + 'T12:00:00' : g.createdAt
    if (!testFn(f)) return
    const m = parseFloat(g.monto) || 0
    if      (g.formaPago === 'Efectivo')    acc.prevBklEfGast         += m
    else if (g.formaPago === 'Banco JORGE') acc.prevBklBancoJorgeGast += m
    else                                    acc.prevBklBancoGast       += m
  })
}

function addSrRows(acc, srRows, testFn) {
  srRows.forEach(r => {
    if (r.fromNota) return  // ya contado vía addNotasSR
    if (!r.fecha || !testFn(r.fecha)) return
    const m = parseFloat(r.precio) || 0
    if (r.tipo === 'venta') {
      if      (r.metodo === 'Efectivo')    acc.prevSrEfV         += m
      else if (r.metodo === 'Banco JORGE') acc.prevSrBancoJorgeV += m
      else                                 acc.prevSrBancoDayV    += m
    } else if (r.tipo === 'salida') {
      if      (r.metodo === 'Efectivo')    acc.prevSrEfS         += m
      else if (r.metodo === 'Banco JORGE') acc.prevSrBancoJorgeS += m
      else                                 acc.prevSrBancoDayS    += m
    }
  })
}

export function computeBalanceFull(notas, gastos, srRows, weekStart) {
  const acc = empty()
  const test = pf => before(pf, weekStart)
  addNotas(acc, notas, test)
  addNotasSR(acc, notas, test)
  addGastos(acc, gastos, test)
  addSrRows(acc, srRows, test)
  return { weekStart, ...acc }
}

export function rolloverBalance(balance, notas, gastos, srRows, newWeekStart) {
  const acc = { ...balance }
  const from = balance.weekStart
  const to   = newWeekStart
  const test = pf => between(pf, from, to)
  addNotas(acc, notas, test)
  addNotasSR(acc, notas, test)
  addGastos(acc, gastos, test)
  addSrRows(acc, srRows, test)
  acc.weekStart = newWeekStart
  return acc
}

export function applyNotaEditDiff(balance, oldNota, newNota) {
  const acc = { ...balance }
  const weekStart = balance.weekStart

  // BKL payments (non-SR)
  const applyBkl = (nota, sign) =>
    (nota.pagos || []).forEach(p => {
      if (p.sucursal === 'SR') return
      const pf = p.fecha || nota.createdAt
      if (!before(pf, weekStart)) return
      const m = (parseFloat(p.monto) || 0) * sign
      if      (p.metodoPago === 'Efectivo')    acc.prevBklEf         += m
      else if (p.metodoPago === 'Banco JORGE') acc.prevBklBancoJorge += m
      else                                     acc.prevBklBancoDay    += m
    })
  applyBkl(oldNota, -1)
  applyBkl(newNota, +1)

  // SR payments (synced to sanramon_rows as tipo='venta')
  const applySr = (nota, sign) =>
    (nota.pagos || []).forEach(p => {
      if (p.sucursal !== 'SR') return
      const pf = p.fecha || nota.createdAt
      if (!before(pf, weekStart)) return
      const m = (parseFloat(p.monto) || 0) * sign
      if      (p.metodoPago === 'Efectivo')    acc.prevSrEfV         += m
      else if (p.metodoPago === 'Banco JORGE') acc.prevSrBancoJorgeV += m
      else                                     acc.prevSrBancoDayV    += m
    })
  applySr(oldNota, -1)
  applySr(newNota, +1)

  return acc
}

export function applyGastosEditDiff(balance, oldGastos, newGastos) {
  const acc = { ...balance }
  const weekStart = balance.weekStart
  const apply = (g, sign) => {
    const f = g.fecha ? g.fecha + 'T12:00:00' : g.createdAt
    if (!before(f, weekStart)) return
    const m = (parseFloat(g.monto) || 0) * sign
    if      (g.formaPago === 'Efectivo')    acc.prevBklEfGast         += m
    else if (g.formaPago === 'Banco JORGE') acc.prevBklBancoJorgeGast += m
    else                                    acc.prevBklBancoGast       += m
  }
  oldGastos.forEach(g => apply(g, -1))
  newGastos.forEach(g => apply(g, +1))
  return acc
}
