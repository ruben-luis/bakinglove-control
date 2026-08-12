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
  // Nunca retrocedas: si newWeekStart no es posterior a la semana ya
  // guardada, no hay nada que avanzar (evita corromper weekStart si
  // un dispositivo calcula mal la semana actual).
  if (newWeekStart <= balance.weekStart) return balance

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

// ── Deltas (para incrementos atómicos en Firestore) ────────────────
// A diferencia de applyXDiff (que regresaban el balance completo ya
// modificado), estas funciones regresan SOLO lo que cambió. Así, el
// que llama puede mandar ese delta como FieldValue.increment(...) sin
// necesitar leer el documento primero — y sin importar qué tan
// desactualizado esté su propio balanceActual en memoria, el cambio
// que aplica siempre es correcto (nunca sobreescribe lo que otro
// dispositivo ya sumó).

export function notaBalanceDelta(oldNota, newNota, weekStart) {
  const acc = empty()

  // Pagos BKL (no SR)
  const applyBkl = (nota, sign) =>
    (nota?.pagos || []).forEach(p => {
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

  // Pagos SR (se reflejan en sanramon_rows como tipo='venta', fromNota:true)
  const applySr = (nota, sign) =>
    (nota?.pagos || []).forEach(p => {
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

export function gastosBalanceDelta(oldGastos, newGastos, weekStart) {
  const acc = empty()
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

// Fila de San Ramón (venta/salida capturada directo, no vía nota)
export function srRowBalanceDelta(oldRow, newRow, weekStart) {
  const acc = empty()
  const apply = (r, sign) => {
    if (!r || r.fromNota) return // ya se cuenta vía notaBalanceDelta
    if (!r.fecha || !before(r.fecha, weekStart)) return
    const m = (parseFloat(r.precio) || 0) * sign
    if (r.tipo === 'venta') {
      if      (r.metodo === 'Efectivo')    acc.prevSrEfV         += m
      else if (r.metodo === 'Banco JORGE') acc.prevSrBancoJorgeV += m
      else                                 acc.prevSrBancoDayV    += m
    } else if (r.tipo === 'salida') {
      if      (r.metodo === 'Efectivo')    acc.prevSrEfS         += m
      else if (r.metodo === 'Banco JORGE') acc.prevSrBancoJorgeS += m
      else                                 acc.prevSrBancoDayS    += m
    }
  }
  apply(oldRow, -1)
  apply(newRow, +1)
  return acc
}

export function mergeDeltas(...deltas) {
  const acc = empty()
  deltas.forEach(d => { for (const k in acc) acc[k] += (d[k] || 0) })
  return acc
}

export function isZeroDelta(delta) {
  return Object.values(delta).every(v => Math.abs(v) < 0.005)
}

export function addDelta(balance, delta) {
  const acc = { ...balance }
  for (const k in delta) acc[k] = (acc[k] || 0) + delta[k]
  return acc
}
