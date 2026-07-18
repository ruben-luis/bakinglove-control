/**
 * Tests de lógica pura para balance.js
 * No requiere Firebase ni servidor — solo Node.js
 * Simula 20 días de movimientos y verifica consistencia numérica
 *
 * Ejecutar: node tests/balance_logic.mjs
 */

import {
  computeBalanceFull,
  rolloverBalance,
  applyNotaEditDiff,
  applyGastosEditDiff,
  getCurrentMonday,
  getNextMonday,
} from '../src/balance.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(description, actual, expected) {
  const ok = Math.abs(actual - expected) < 0.001
  if (ok) {
    console.log(`  ✓ ${description}: ${actual}`)
    passed++
  } else {
    console.error(`  ✗ ${description}: esperado ${expected}, recibido ${actual}`)
    failed++
  }
}

function assertDeep(description, obj, expectedKeys) {
  let allOk = true
  for (const [k, v] of Object.entries(expectedKeys)) {
    if (Math.abs((obj[k] || 0) - v) >= 0.001) {
      console.error(`  ✗ ${description} — ${k}: esperado ${v}, recibido ${obj[k]}`)
      allOk = false
      failed++
    }
  }
  if (allOk) {
    console.log(`  ✓ ${description}: todas las claves correctas`)
    passed++
  }
}

// ── Datos de prueba: 20 días de movimientos ──────────────────────────────────

// weekStart fijo = 2025-07-14 (lunes 14 de julio)
const WEEK_START = '2025-07-14'
const PREV_WEEK  = '2025-07-07'

/**
 * 20 días: 2025-07-01 al 2025-07-20
 *
 * Antes de la semana (< 2025-07-14):
 *   Días 1-13: notas BKL + pagos SR + gastos
 *
 * Esta semana (>= 2025-07-14):
 *   Días 14-20: notas y pagos de la semana actual
 */

const notas = [
  // ── Antes de la semana ──────────────────────────────────────────────────
  // Día 1 Jul: BKL Efectivo 500
  {
    id: 'n01', createdAt: '2025-07-01T16:00:00.000Z', folio: '#1',
    pagos: [{ monto: '500', fecha: '2025-07-01', metodoPago: 'Efectivo', sucursal: 'BKL' }],
  },
  // Día 2 Jul: BKL Terminal 800 (→ Banco Day)
  {
    id: 'n02', createdAt: '2025-07-02T16:00:00.000Z', folio: '#2',
    pagos: [{ monto: '800', fecha: '2025-07-02', metodoPago: 'Terminal', sucursal: 'BKL' }],
  },
  // Día 3 Jul: BKL Banco JORGE 1200
  {
    id: 'n03', createdAt: '2025-07-03T16:00:00.000Z', folio: '#3',
    pagos: [{ monto: '1200', fecha: '2025-07-03', metodoPago: 'Banco JORGE', sucursal: 'BKL' }],
  },
  // Día 5 Jul: BKL Efectivo 300 + pago SR Efectivo 200
  {
    id: 'n04', createdAt: '2025-07-05T16:00:00.000Z', folio: '#4',
    pagos: [
      { monto: '300', fecha: '2025-07-05', metodoPago: 'Efectivo',  sucursal: 'BKL' },
      { monto: '200', fecha: '2025-07-05', metodoPago: 'Efectivo',  sucursal: 'SR'  },
    ],
  },
  // Día 7 Jul (semana anterior): BKL Efectivo 600
  {
    id: 'n05', createdAt: '2025-07-07T16:00:00.000Z', folio: '#5',
    pagos: [{ monto: '600', fecha: '2025-07-07', metodoPago: 'Efectivo', sucursal: 'BKL' }],
  },
  // Día 8 Jul: BKL Transferencia 900 (→ Banco Day)
  {
    id: 'n06', createdAt: '2025-07-08T16:00:00.000Z', folio: '#6',
    pagos: [{ monto: '900', fecha: '2025-07-08', metodoPago: 'Transferencia', sucursal: 'BKL' }],
  },
  // Día 10 Jul: BKL Efectivo 400 + SR Banco JORGE 300
  {
    id: 'n07', createdAt: '2025-07-10T16:00:00.000Z', folio: '#7',
    pagos: [
      { monto: '400', fecha: '2025-07-10', metodoPago: 'Efectivo',    sucursal: 'BKL' },
      { monto: '300', fecha: '2025-07-10', metodoPago: 'Banco JORGE', sucursal: 'SR'  },
    ],
  },
  // Día 12 Jul: nota con pago dividido
  {
    id: 'n08', createdAt: '2025-07-12T16:00:00.000Z', folio: '#8',
    pagos: [
      { monto: '450', fecha: '2025-07-12', metodoPago: 'Efectivo',    sucursal: 'BKL' },
      { monto: '550', fecha: '2025-07-12', metodoPago: 'Terminal',    sucursal: 'BKL' },
    ],
  },
  // Día 13 Jul: BKL Banco JORGE 700
  {
    id: 'n09', createdAt: '2025-07-13T16:00:00.000Z', folio: '#9',
    pagos: [{ monto: '700', fecha: '2025-07-13', metodoPago: 'Banco JORGE', sucursal: 'BKL' }],
  },
  // ── Esta semana (>= 2025-07-14) ─────────────────────────────────────────
  // Día 14 Jul: BKL Efectivo 700
  {
    id: 'n10', createdAt: '2025-07-14T16:00:00.000Z', folio: '#10',
    pagos: [{ monto: '700', fecha: '2025-07-14', metodoPago: 'Efectivo', sucursal: 'BKL' }],
  },
  // Día 15 Jul: BKL Terminal 1100 (→ Banco Day)
  {
    id: 'n11', createdAt: '2025-07-15T16:00:00.000Z', folio: '#11',
    pagos: [{ monto: '1100', fecha: '2025-07-15', metodoPago: 'Terminal', sucursal: 'BKL' }],
  },
  // Día 17 Jul: BKL Efectivo 550 + SR Banco JORGE 250
  {
    id: 'n12', createdAt: '2025-07-17T16:00:00.000Z', folio: '#12',
    pagos: [
      { monto: '550', fecha: '2025-07-17', metodoPago: 'Efectivo',    sucursal: 'BKL' },
      { monto: '250', fecha: '2025-07-17', metodoPago: 'Banco JORGE', sucursal: 'SR'  },
    ],
  },
]

const gastos = [
  // Antes de la semana
  { id: 'g01', fecha: '2025-07-01', monto: '200',  formaPago: 'Efectivo'    },
  { id: 'g02', fecha: '2025-07-03', monto: '350',  formaPago: 'Banco Day'   },
  { id: 'g03', fecha: '2025-07-05', monto: '180',  formaPago: 'Banco JORGE' },
  { id: 'g04', fecha: '2025-07-08', monto: '150',  formaPago: 'Efectivo'    },
  { id: 'g05', fecha: '2025-07-09', monto: '400',  formaPago: 'Banco JORGE' },
  { id: 'g06', fecha: '2025-07-11', monto: '120',  formaPago: 'Efectivo'    },
  { id: 'g07', fecha: '2025-07-13', monto: '220',  formaPago: 'Transferencia' },
  // Esta semana
  { id: 'g08', fecha: '2025-07-14', monto: '250',  formaPago: 'Efectivo'    },
  { id: 'g09', fecha: '2025-07-15', monto: '500',  formaPago: 'Banco Day'   },
  { id: 'g10', fecha: '2025-07-16', monto: '300',  formaPago: 'Banco JORGE' },
]

const srRows = [
  // Antes de la semana — entradas manuales (fromNota: false)
  { id: 'sr01', fecha: '2025-07-01', tipo: 'venta',  precio: 300, metodo: 'Efectivo',    fromNota: false },
  { id: 'sr02', fecha: '2025-07-04', tipo: 'venta',  precio: 450, metodo: 'Banco Day',   fromNota: false },
  { id: 'sr03', fecha: '2025-07-06', tipo: 'salida', precio: 100, metodo: 'Efectivo',    fromNota: false },
  { id: 'sr04', fecha: '2025-07-08', tipo: 'venta',  precio: 200, metodo: 'Banco JORGE', fromNota: false },
  { id: 'sr05', fecha: '2025-07-11', tipo: 'salida', precio:  50, metodo: 'Efectivo',    fromNota: false },
  { id: 'sr06', fecha: '2025-07-13', tipo: 'venta',  precio: 350, metodo: 'Banco JORGE', fromNota: false },
  // fromNota: true (ya contados via addNotasSR en n04 y n07)
  { id: 'srf04', fecha: '2025-07-05', tipo: 'venta', precio: 200, metodo: 'Efectivo',    fromNota: true, notaId: 'n04' },
  { id: 'srf07', fecha: '2025-07-10', tipo: 'venta', precio: 300, metodo: 'Banco JORGE', fromNota: true, notaId: 'n07' },
  // Esta semana — entradas manuales
  { id: 'sr07', fecha: '2025-07-14', tipo: 'venta',  precio: 600, metodo: 'Efectivo',    fromNota: false },
  { id: 'sr08', fecha: '2025-07-15', tipo: 'venta',  precio: 800, metodo: 'Banco Day',   fromNota: false },
  { id: 'sr09', fecha: '2025-07-16', tipo: 'salida', precio: 150, metodo: 'Efectivo',    fromNota: false },
  // fromNota: true (de n12)
  { id: 'srf12', fecha: '2025-07-17', tipo: 'venta', precio: 250, metodo: 'Banco JORGE', fromNota: true, notaId: 'n12' },
]

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1: computeBalanceFull — valores esperados antes del WEEK_START (2025-07-14)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══ TEST 1: computeBalanceFull ════════════════════════════════════')

const balance = computeBalanceFull(notas, gastos, srRows, WEEK_START)

// BKL Efectivo (antes del 14): n01(500) + n04(300) + n05(600) + n07(400) + n08(450) = 2250
assert('prevBklEf',    balance.prevBklEf,    2250)

// BKL BancoDay (antes del 14): n02(800 Terminal) + n06(900 Transferencia) + n08(550 Terminal) = 2250
assert('prevBklBancoDay',    balance.prevBklBancoDay,    2250)

// BKL BancoJorge (antes del 14): n03(1200) + n09(700) = 1900
assert('prevBklBancoJorge',  balance.prevBklBancoJorge,  1900)

// BKL Ef Gastos (antes del 14): g01(200) + g04(150) + g06(120) = 470
assert('prevBklEfGast',      balance.prevBklEfGast,      470)

// BKL BancoDay Gastos (antes del 14): g02(350 BancoDay) + g07(220 Transferencia) = 570
assert('prevBklBancoGast',   balance.prevBklBancoGast,   570)

// BKL BancoJorge Gastos (antes del 14): g03(180) + g05(400) = 580
assert('prevBklBancoJorgeGast', balance.prevBklBancoJorgeGast, 580)

// SR Ef Ventas (antes del 14):
//   addNotasSR: n04 SR Efectivo(200) + (n07 SR BancoJorge → no es efectivo)
//   addSrRows manual: sr01(300) + sr02(450 BancoDay → no) + sr04(200 JORGE → no) + sr06(350 JORGE → no)
//   → sr01=300 + n04_SR=200 = 500
assert('prevSrEfV',          balance.prevSrEfV,           500)

// SR BancoDay Ventas (antes del 14):
//   addSrRows: sr02(450 BancoDay) = 450
assert('prevSrBancoDayV',    balance.prevSrBancoDayV,     450)

// SR BancoJorge Ventas (antes del 14):
//   addNotasSR: n07 SR BancoJorge(300)
//   addSrRows: sr04(200 JORGE) + sr06(350 JORGE) = 550
//   Total: 300 + 550 = 850
assert('prevSrBancoJorgeV',  balance.prevSrBancoJorgeV,   850)

// SR Ef Salidas (antes del 14): sr03(100) + sr05(50) = 150
assert('prevSrEfS',          balance.prevSrEfS,           150)

// SR BancoDay Salidas: 0
assert('prevSrBancoDayS',    balance.prevSrBancoDayS,     0)

// SR BancoJorge Salidas: 0
assert('prevSrBancoJorgeS',  balance.prevSrBancoJorgeS,   0)

assert('weekStart guardado', balance.weekStart === WEEK_START ? 1 : 0, 1)

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2: rolloverBalance (de semana anterior al lunes actual)
// Simula: guardé el balance desde PREV_WEEK (2025-07-07)
// y ahora hago rollover a WEEK_START (2025-07-14)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══ TEST 2: rolloverBalance ═══════════════════════════════════════')

// Balance base como si estuviera guardado desde PREV_WEEK
// (datos antes del 07 Jul = todo hasta el 6 Jul)
const balancePrevWeek = computeBalanceFull(notas, gastos, srRows, PREV_WEEK)

// Verificar weekStart del base
assert('prevWeek weekStart', balancePrevWeek.weekStart === PREV_WEEK ? 1 : 0, 1)

// Hacer rollover al lunes actual
const rolled = rolloverBalance(balancePrevWeek, notas, gastos, srRows, WEEK_START)
assert('rolled weekStart correcto', rolled.weekStart === WEEK_START ? 1 : 0, 1)

// Los valores del rolled deben coincidir con computeBalanceFull(WEEK_START)
assertDeep('rollover == computeBalanceFull', rolled, {
  prevBklEf:            balance.prevBklEf,
  prevBklBancoDay:      balance.prevBklBancoDay,
  prevBklBancoJorge:    balance.prevBklBancoJorge,
  prevBklEfGast:        balance.prevBklEfGast,
  prevBklBancoGast:     balance.prevBklBancoGast,
  prevBklBancoJorgeGast: balance.prevBklBancoJorgeGast,
  prevSrEfV:            balance.prevSrEfV,
  prevSrBancoDayV:      balance.prevSrBancoDayV,
  prevSrBancoJorgeV:    balance.prevSrBancoJorgeV,
  prevSrEfS:            balance.prevSrEfS,
  prevSrBancoDayS:      balance.prevSrBancoDayS,
  prevSrBancoJorgeS:    balance.prevSrBancoJorgeS,
})

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3: applyNotaEditDiff — editar una nota ANTERIOR a la semana
// Nota n03 (BKL Banco JORGE 1200) → cambia a BKL Efectivo 1000
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══ TEST 3: applyNotaEditDiff (BKL) ══════════════════════════════')

const n03_old = notas.find(n => n.id === 'n03')
const n03_new = {
  ...n03_old,
  pagos: [{ monto: '1000', fecha: '2025-07-03', metodoPago: 'Efectivo', sucursal: 'BKL' }],
}

const afterEditBKL = applyNotaEditDiff(balance, n03_old, n03_new)

// prevBklEf: 2250 + 1000 = 3250
assert('prevBklEf tras edit',     afterEditBKL.prevBklEf,     2250 + 1000)
// prevBklBancoJorge: 1900 - 1200 = 700
assert('prevBklBancoJorge tras edit', afterEditBKL.prevBklBancoJorge, 1900 - 1200)
// Resto sin cambios
assert('prevBklBancoDay sin cambio', afterEditBKL.prevBklBancoDay, balance.prevBklBancoDay)
assert('prevSrEfV sin cambio',       afterEditBKL.prevSrEfV,       balance.prevSrEfV)

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4: applyNotaEditDiff — editar nota CON pago SR anterior a la semana
// Nota n07 (BKL Ef 400 + SR JORGE 300) → cambia SR JORGE a SR Efectivo 250
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══ TEST 4: applyNotaEditDiff (con SR) ═══════════════════════════')

const n07_old = notas.find(n => n.id === 'n07')
const n07_new = {
  ...n07_old,
  pagos: [
    { monto: '400', fecha: '2025-07-10', metodoPago: 'Efectivo', sucursal: 'BKL' },
    { monto: '250', fecha: '2025-07-10', metodoPago: 'Efectivo', sucursal: 'SR'  }, // era JORGE 300, ahora Ef 250
  ],
}

const afterEditSR = applyNotaEditDiff(balance, n07_old, n07_new)

// prevSrBancoJorgeV: 850 - 300 = 550
assert('prevSrBancoJorgeV tras edit SR', afterEditSR.prevSrBancoJorgeV, 850 - 300)
// prevSrEfV: 500 + 250 = 750
assert('prevSrEfV tras edit SR',         afterEditSR.prevSrEfV,         500 + 250)
// BKL sin cambios (el pago BKL no cambió)
assert('prevBklEf sin cambio',           afterEditSR.prevBklEf,         balance.prevBklEf)

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5: applyNotaEditDiff — editar nota de ESTA SEMANA (no debe cambiar balance)
// Nota n10 (BKL Ef 700, fecha 2025-07-14) → está en la semana actual
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══ TEST 5: applyNotaEditDiff (nota esta semana, sin efecto) ═════')

const n10_old = notas.find(n => n.id === 'n10')
const n10_new = {
  ...n10_old,
  pagos: [{ monto: '999', fecha: '2025-07-14', metodoPago: 'Efectivo', sucursal: 'BKL' }],
}

const afterEditThisWeek = applyNotaEditDiff(balance, n10_old, n10_new)

assertDeep('nota esta semana no altera balance', afterEditThisWeek, {
  prevBklEf:         balance.prevBklEf,
  prevBklBancoDay:   balance.prevBklBancoDay,
  prevBklBancoJorge: balance.prevBklBancoJorge,
  prevSrEfV:         balance.prevSrEfV,
})

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6: applyNotaEditDiff — eliminar nota (pagos → [])
// Nota n01 (BKL Ef 500): al eliminar, resta 500 del balance
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══ TEST 6: applyNotaEditDiff (eliminación de nota) ══════════════')

const n01_old = notas.find(n => n.id === 'n01')
const n01_deleted = { ...n01_old, pagos: [] }

const afterDelete = applyNotaEditDiff(balance, n01_old, n01_deleted)

// prevBklEf: 2250 - 500 = 1750
assert('prevBklEf tras eliminar n01', afterDelete.prevBklEf, 2250 - 500)
// Resto sin cambios
assert('prevBklBancoDay sin cambio',  afterDelete.prevBklBancoDay,  balance.prevBklBancoDay)

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7: applyGastosEditDiff — cambiar un gasto anterior
// g01 (Efectivo 200) → cambia a Banco JORGE 350
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══ TEST 7: applyGastosEditDiff ══════════════════════════════════')

const gastos_old = gastos
const gastos_new = gastos.map(g => g.id === 'g01'
  ? { ...g, monto: '350', formaPago: 'Banco JORGE' }
  : g
)

const afterGastoEdit = applyGastosEditDiff(balance, gastos_old, gastos_new)

// prevBklEfGast: 470 - 200 = 270
assert('prevBklEfGast tras editar g01',       afterGastoEdit.prevBklEfGast,       470 - 200)
// prevBklBancoJorgeGast: 580 + 350 = 930
assert('prevBklBancoJorgeGast tras editar g01', afterGastoEdit.prevBklBancoJorgeGast, 580 + 350)
// prevBklBancoGast sin cambio
assert('prevBklBancoGast sin cambio',          afterGastoEdit.prevBklBancoGast,      balance.prevBklBancoGast)

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8: applyGastosEditDiff — gasto de esta semana (sin efecto)
// g08 (Efectivo 250, fecha 2025-07-14) → esta semana, no debe cambiar balance
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══ TEST 8: applyGastosEditDiff (gasto esta semana, sin efecto) ═')

const gastos_new_thisWeek = gastos.map(g => g.id === 'g08'
  ? { ...g, monto: '999', formaPago: 'Banco Day' }
  : g
)

const afterGastoThisWeek = applyGastosEditDiff(balance, gastos, gastos_new_thisWeek)

assertDeep('gasto esta semana no altera balance', afterGastoThisWeek, {
  prevBklEfGast:         balance.prevBklEfGast,
  prevBklBancoGast:      balance.prevBklBancoGast,
  prevBklBancoJorgeGast: balance.prevBklBancoJorgeGast,
})

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9: Consistencia — getCurrentMonday y getNextMonday
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══ TEST 9: getCurrentMonday / getNextMonday ══════════════════════')

const curMon = getCurrentMonday()
const parsed = new Date(curMon + 'T12:00:00')
// Debe ser lunes (day 1 en getDay con ajuste: (parsed.getDay() + 6) % 7 === 0)
assert('getCurrentMonday es lunes', (parsed.getDay() + 6) % 7, 0)

const nextMon = getNextMonday(curMon)
const parsedNext = new Date(nextMon + 'T12:00:00')
const daysDiff = (parsedNext - parsed) / (1000 * 60 * 60 * 24)
assert('getNextMonday es 7 días después', daysDiff, 7)

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10: Inmutabilidad — balance original no se modifica
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══ TEST 10: Inmutabilidad del balance original ═══════════════════')

const balanceCopy = { ...balance }
applyNotaEditDiff(balance, n03_old, n03_new)
applyGastosEditDiff(balance, gastos_old, gastos_new)

assert('prevBklEf original intacto',    balance.prevBklEf,    balanceCopy.prevBklEf)
assert('prevSrEfV original intacto',    balance.prevSrEfV,    balanceCopy.prevSrEfV)
assert('prevBklEfGast original intacto', balance.prevBklEfGast, balanceCopy.prevBklEfGast)

// ─────────────────────────────────────────────────────────────────────────────
// Resumen final
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════════')
console.log(`Resultado: ${passed} pasaron, ${failed} fallaron`)
if (failed > 0) {
  console.error(`\n⚠ ${failed} prueba(s) fallaron`)
  process.exit(1)
} else {
  console.log('\n✅ Todas las pruebas pasaron')
  process.exit(0)
}
