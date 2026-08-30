import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import {
  doc, setDoc, getDoc, deleteDoc, updateDoc,
} from 'firebase/firestore'

const results = []
function record(name, pass, detail) {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ' :: ' + detail : ''}`)
}

const testEnv = await initializeTestEnvironment({
  projectId: 'bakinglove-control-test',
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: 'localhost',
    port: 8180,
  },
})

const anon = testEnv.authenticatedContext('anon-uid-1')
const nip = testEnv.authenticatedContext('bkl-shared-nip', { nipVerified: true })
const noAuth = testEnv.unauthenticatedContext()

async function run() {
  // seed with admin (bypasses rules) so folio_counter/pin docs exist for some tests
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'config', 'folio_counter'), { current: 10 })
  })

  // 1. Sin auth: todo denegado
  {
    const db = noAuth.firestore()
    try {
      await assertFails(getDoc(doc(db, 'notas', 'x')))
      record('sin-auth: leer notas denegado', true)
    } catch (e) { record('sin-auth: leer notas denegado', false, e.message) }
  }
  {
    const db = noAuth.firestore()
    try {
      await assertFails(setDoc(doc(db, 'notas', 'n1'), {
        id: 'n1', folio: '#1', fecha: '2026-08-29', productos: [], pagos: [],
      }))
      record('sin-auth: crear nota denegado', true)
    } catch (e) { record('sin-auth: crear nota denegado', false, e.message) }
  }

  // 2. Anonimo: puede notas, NO gastos/cortes/pin
  {
    const db = anon.firestore()
    try {
      await assertSucceeds(setDoc(doc(db, 'notas', 'n1'), {
        id: 'n1', folio: '#1', fecha: '2026-08-29', productos: [{ a: 1 }], pagos: [],
      }))
      record('anonimo: crear nota valida permitido', true)
    } catch (e) { record('anonimo: crear nota valida permitido', false, e.message) }
  }
  {
    const db = anon.firestore()
    try {
      await assertFails(setDoc(doc(db, 'notas', 'n2'), {
        id: 'OTRO-ID', folio: '#2', fecha: '2026-08-29', productos: [], pagos: [],
      }))
      record('anonimo: crear nota con id distinto al doc denegado', true)
    } catch (e) { record('anonimo: crear nota con id distinto al doc denegado', false, e.message) }
  }
  {
    const db = anon.firestore()
    try {
      await assertFails(setDoc(doc(db, 'gastos', 'g1'), {
        id: 'g1', fecha: '2026-08-29', concepto: 'harina', monto: 100, formaPago: 'Efectivo',
      }))
      record('anonimo: crear gasto denegado (requiere NIP)', true)
    } catch (e) { record('anonimo: crear gasto denegado (requiere NIP)', false, e.message) }
  }
  {
    const db = anon.firestore()
    try {
      await assertFails(setDoc(doc(db, 'cortes_semana', 'c1'), { tipo: 'manual', weekStart: '2026-08-25' }))
      record('anonimo: crear corte denegado (requiere NIP)', true)
    } catch (e) { record('anonimo: crear corte denegado (requiere NIP)', false, e.message) }
  }
  {
    const db = anon.firestore()
    try {
      await assertFails(setDoc(doc(db, 'config', 'pin'), { hash: 'a'.repeat(64) }))
      record('anonimo: escribir config/pin denegado', true)
    } catch (e) { record('anonimo: escribir config/pin denegado', false, e.message) }
  }
  {
    const db = anon.firestore()
    try {
      await assertFails(getDoc(doc(db, 'config', 'pin')))
      record('anonimo: leer config/pin denegado (nadie lo lee)', true)
    } catch (e) { record('anonimo: leer config/pin denegado (nadie lo lee)', false, e.message) }
  }
  {
    const db = anon.firestore()
    try {
      await assertFails(getDoc(doc(db, 'config', 'pin_security')))
      await assertFails(setDoc(doc(db, 'config', 'pin_security'), { failCount: 0 }))
      record('anonimo: pin_security bloqueado lectura y escritura', true)
    } catch (e) { record('anonimo: pin_security bloqueado lectura y escritura', false, e.message) }
  }
  {
    const db = anon.firestore()
    try {
      await assertSucceeds(updateDoc(doc(db, 'config', 'folio_counter'), { current: 11 }))
      record('anonimo: incrementar folio_counter permitido', true)
    } catch (e) { record('anonimo: incrementar folio_counter permitido', false, e.message) }
  }
  {
    const db = anon.firestore()
    try {
      await assertFails(updateDoc(doc(db, 'config', 'folio_counter'), { current: 5 }))
      record('anonimo: retroceder folio_counter denegado', true)
    } catch (e) { record('anonimo: retroceder folio_counter denegado', false, e.message) }
  }
  {
    const db = anon.firestore()
    try {
      await assertSucceeds(setDoc(doc(db, 'sanramon_rows', 'r1'), {
        id: 'r1', fecha: '2026-08-29', tipo: 'venta', precio: 50,
      }))
      record('anonimo: crear sanramon_row valido permitido', true)
    } catch (e) { record('anonimo: crear sanramon_row valido permitido', false, e.message) }
  }

  // 3. NIP verificado: puede gastos, cortes, cambiar pin
  {
    const db = nip.firestore()
    try {
      await assertSucceeds(setDoc(doc(db, 'gastos', 'g1'), {
        id: 'g1', fecha: '2026-08-29', concepto: 'harina', monto: 100, formaPago: 'Efectivo',
      }))
      record('nip-verificado: crear gasto valido permitido', true)
    } catch (e) { record('nip-verificado: crear gasto valido permitido', false, e.message) }
  }
  {
    const db = nip.firestore()
    try {
      await assertSucceeds(deleteDoc(doc(db, 'gastos', 'g1')))
      record('nip-verificado: borrar gasto permitido', true)
    } catch (e) { record('nip-verificado: borrar gasto permitido', false, e.message) }
  }
  {
    const db = nip.firestore()
    try {
      await assertSucceeds(setDoc(doc(db, 'cortes_semana', 'c1'), { tipo: 'manual', weekStart: '2026-08-25' }))
      record('nip-verificado: crear corte permitido', true)
    } catch (e) { record('nip-verificado: crear corte permitido', false, e.message) }
  }
  {
    const db = nip.firestore()
    try {
      await assertFails(updateDoc(doc(db, 'cortes_semana', 'c1'), { tipo: 'editado' }))
      record('nip-verificado: editar corte existente denegado (inmutable)', true)
    } catch (e) { record('nip-verificado: editar corte existente denegado (inmutable)', false, e.message) }
  }
  {
    const db = nip.firestore()
    try {
      await assertSucceeds(setDoc(doc(db, 'config', 'pin'), { hash: 'b'.repeat(64) }))
      record('nip-verificado: cambiar pin con hash valido permitido', true)
    } catch (e) { record('nip-verificado: cambiar pin con hash valido permitido', false, e.message) }
  }
  {
    const db = nip.firestore()
    try {
      await assertFails(setDoc(doc(db, 'config', 'pin'), { hash: 'corto' }))
      record('nip-verificado: cambiar pin con hash invalido denegado', true)
    } catch (e) { record('nip-verificado: cambiar pin con hash invalido denegado', false, e.message) }
  }

  await testEnv.cleanup()

  const failed = results.filter(r => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} pruebas pasaron`)
  if (failed.length) {
    console.log('FALLARON:', failed.map(f => f.name).join(', '))
    process.exit(1)
  }
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
