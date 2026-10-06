/**
 * Reproduce contra el emulador (Firestore + Auth) el escenario real que
 * motivó withPermissionRetry: verificar NIP (signInWithCustomToken) y
 * disparar de inmediato un write protegido por nipVerified, sin esperar a
 * que el claim se propague a la conexión activa de Firestore.
 *
 * No prueba persistentLocalCache en sí (requiere IndexedDB, no disponible
 * en Node) — pero el mecanismo de la carrera (el listener interno de
 * Firestore que actualiza credenciales de la conexión activa) es el mismo
 * en Node y en navegador, y ya se verificó por separado (contra el código
 * fuente del SDK) que la promesa de setDoc/deleteDoc resuelve/rechaza
 * igual sin importar el modo de caché. Lo que este test sí mide con
 * certeza: (a) si la carrera se reproduce contra el emulador local (sin la
 * latencia de red real que la dispara en producción) y (b) que
 * withPermissionRetry nunca deja pasar un permission-denied sin resolverlo
 * o sin propagarlo de forma visible.
 *
 * Ejecutar (requiere emuladores activos, variables FIRESTORE_EMULATOR_HOST
 * / FIREBASE_AUTH_EMULATOR_HOST ya puestas por `firebase emulators:exec`):
 *   npx firebase emulators:exec --only firestore,auth "node tests/race_scenario.mjs"
 */

import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithCustomToken } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, doc, setDoc, deleteDoc } from 'firebase/firestore'

import { withPermissionRetry } from '../src/firestoreRetry.js'

const PROJECT_ID = 'bakinglove-control-test'
const SHARED_UID = 'bkl-shared-nip'
const ITERATIONS = 30

const [authHost, authPort] = (process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9199').split(':')
const [fsHost, fsPort] = (process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8180').split(':')

const adminApp = initAdminApp({ projectId: PROJECT_ID })
const adminAuth = getAdminAuth(adminApp)

async function mintToken() {
  return adminAuth.createCustomToken(SHARED_UID, { nipVerified: true })
}

// Un intento completo del escenario: sesión anónima nueva (como al abrir la
// app) -> escribe algo benigno para forzar que la conexión de Firestore
// quede establecida con esas credenciales -> verifica NIP -> dispara el
// primer write protegido SIN esperar nada -> reporta si chocó con la
// carrera, y si withPermissionRetry lo resolvió.
async function attempt(i, { useMitigation }) {
  const app = initializeApp({ projectId: PROJECT_ID, apiKey: 'fake-key' }, `race-${i}`)
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true })
  const db = getFirestore(app)
  connectFirestoreEmulator(db, fsHost, Number(fsPort))

  try {
    await signInAnonymously(auth)
    // Fuerza que la conexión de Firestore quede activa con credenciales
    // anónimas antes de verificar el NIP (igual que en la app real, donde
    // la sesión anónima ya lleva rato activa cuando el usuario abre el
    // modal de NIP).
    await setDoc(doc(db, 'sanramon_saldos', `warmup-${i}`), { weekStart: '2026-08-25', total: 0 })

    const token = await mintToken()
    await signInWithCustomToken(auth, token)
    // Mitigación real del código (Paso 5): si useMitigation, el equivalente
    // de lo que ahora hace verifyPin() en PinModal.jsx.
    if (useMitigation) await auth.currentUser.getIdToken(true)

    const write = () => setDoc(doc(db, 'gastos', `race-${i}`), {
      id: `race-${i}`, fecha: '2026-08-29', concepto: 'test-race', monto: 1, formaPago: 'Efectivo',
    })

    let raceHit = false
    let recovered = false
    let unrecovered = null
    try {
      await write()
    } catch (e) {
      if (e.code === 'permission-denied') {
        raceHit = true
        try {
          await withPermissionRetry(write, { waitMs: 300 })
          recovered = true
        } catch (e2) {
          unrecovered = e2
        }
      } else {
        unrecovered = e
      }
    }
    return { raceHit, recovered, unrecovered }
  } finally {
    await deleteApp(app).catch(() => {})
  }
}

async function run() {
  console.log(`Corriendo ${ITERATIONS} intentos SIN getIdToken(true) (línea base, sin Paso 5)...`)
  let raceHits = 0, recovered = 0, unrecoveredCount = 0
  for (let i = 0; i < ITERATIONS; i++) {
    const r = await attempt(`base-${i}`, { useMitigation: false })
    if (r.raceHit) raceHits++
    if (r.recovered) recovered++
    if (r.unrecovered) { unrecoveredCount++; console.error(`  ✗ intento ${i}: error sin recuperar:`, r.unrecovered.code || r.unrecovered.message) }
  }
  console.log(`  Carrera reproducida: ${raceHits}/${ITERATIONS} | Recuperada por retry: ${recovered}/${raceHits || 1} | Sin recuperar: ${unrecoveredCount}`)

  console.log(`\nCorriendo ${ITERATIONS} intentos CON getIdToken(true) (con Paso 5, como quedó el código)...`)
  let raceHits2 = 0, recovered2 = 0, unrecoveredCount2 = 0
  for (let i = 0; i < ITERATIONS; i++) {
    const r = await attempt(`mit-${i}`, { useMitigation: true })
    if (r.raceHit) raceHits2++
    if (r.recovered) recovered2++
    if (r.unrecovered) { unrecoveredCount2++; console.error(`  ✗ intento ${i}: error sin recuperar:`, r.unrecovered.code || r.unrecovered.message) }
  }
  console.log(`  Carrera reproducida: ${raceHits2}/${ITERATIONS} | Recuperada por retry: ${recovered2}/${raceHits2 || 1} | Sin recuperar: ${unrecoveredCount2}`)

  console.log(`\n${unrecoveredCount + unrecoveredCount2 === 0 ? 'OK' : 'FALLÓ'}: ningún intento quedó sin resolver por withPermissionRetry`)
  process.exit(unrecoveredCount + unrecoveredCount2 === 0 ? 0 : 1)
}

run().catch(e => { console.error(e); process.exit(1) })
