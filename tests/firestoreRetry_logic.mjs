/**
 * Tests de lógica pura para firestoreRetry.js (sin Firebase ni servidor).
 * Simula los distintos escenarios de la carrera NIP+write que motivó este
 * helper, mockeando fn() en vez de depender del SDK real.
 *
 * Ejecutar: node tests/firestoreRetry_logic.mjs
 */

import { withPermissionRetry } from '../src/firestoreRetry.js'

let passed = 0
let failed = 0

async function assertOk(description, promise) {
  try {
    await promise
    console.log(`  ✓ ${description}`)
    passed++
  } catch (e) {
    console.error(`  ✗ ${description}: lanzó ${e.message}`)
    failed++
  }
}

async function assertThrows(description, promise, expectedCode) {
  try {
    await promise
    console.error(`  ✗ ${description}: no lanzó nada`)
    failed++
  } catch (e) {
    if (!expectedCode || e.code === expectedCode) {
      console.log(`  ✓ ${description}`)
      passed++
    } else {
      console.error(`  ✗ ${description}: código ${e.code}, esperado ${expectedCode}`)
      failed++
    }
  }
}

function permissionDeniedError() {
  const e = new Error('Missing or insufficient permissions.')
  e.code = 'permission-denied'
  return e
}

async function run() {
  // 1. Éxito al primer intento: fn() se llama una sola vez.
  {
    let calls = 0
    const fn = async () => { calls++; return 'ok' }
    const result = await withPermissionRetry(fn, { waitMs: 10 })
    if (result === 'ok' && calls === 1) {
      console.log('  ✓ éxito al primer intento: fn() se llama una vez'); passed++
    } else {
      console.error(`  ✗ éxito al primer intento: calls=${calls}, result=${result}`); failed++
    }
  }

  // 2. Escenario real de la carrera: falla con permission-denied la primera
  // vez (claim aún no propagado) y tiene éxito en el reintento.
  {
    let calls = 0
    const fn = async () => {
      calls++
      if (calls === 1) throw permissionDeniedError()
      return 'ok-tras-retry'
    }
    const result = await withPermissionRetry(fn, { waitMs: 10 })
    if (result === 'ok-tras-retry' && calls === 2) {
      console.log('  ✓ permission-denied una vez: reintenta y tiene éxito'); passed++
    } else {
      console.error(`  ✗ permission-denied una vez: calls=${calls}, result=${result}`); failed++
    }
  }

  // 3. Falla persistente (ej. NIP realmente incorrecto/revocado): reintenta
  // UNA vez y luego propaga el error — no debe reintentar indefinidamente.
  {
    let calls = 0
    const fn = async () => { calls++; throw permissionDeniedError() }
    await assertThrows(
      'permission-denied persistente: reintenta una vez y luego propaga',
      withPermissionRetry(fn, { waitMs: 10 }),
      'permission-denied',
    )
    if (calls === 2) { console.log(`  ✓ exactamente 2 intentos (1 + 1 retry), no un loop infinito`); passed++ }
    else { console.error(`  ✗ se esperaban 2 intentos, hubo ${calls}`); failed++ }
  }

  // 4. Error NO relacionado con permisos (ej. red caída, documento inválido):
  // no debe reintentar, debe propagar de inmediato.
  {
    let calls = 0
    const fn = async () => { calls++; const e = new Error('network error'); e.code = 'unavailable'; throw e }
    await assertThrows('error no permission-denied: no reintenta', withPermissionRetry(fn, { waitMs: 10 }), 'unavailable')
    if (calls === 1) { console.log('  ✓ no reintentó un error ajeno a permisos'); passed++ }
    else { console.error(`  ✗ reintentó un error que no debía (calls=${calls})`); failed++ }
  }

  // 5. Respeta el tiempo de espera entre intentos (no reintenta instantáneo).
  {
    let calls = 0
    const start = Date.now()
    const fn = async () => { calls++; if (calls === 1) throw permissionDeniedError(); return 'ok' }
    await withPermissionRetry(fn, { waitMs: 150 })
    const elapsed = Date.now() - start
    if (elapsed >= 140) { console.log(`  ✓ esperó ~150ms entre intentos (${elapsed}ms)`); passed++ }
    else { console.error(`  ✗ no esperó lo suficiente entre intentos (${elapsed}ms)`); failed++ }
  }

  console.log(`\n${passed}/${passed + failed} pruebas pasaron`)
  if (failed > 0) process.exit(1)
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
