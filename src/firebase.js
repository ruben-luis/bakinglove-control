import { initializeApp } from 'firebase/app'
import {
  initializeFirestore, getFirestore,
  persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
// persistentLocalCache (IndexedDB) reduce lecturas al reabrir la app: sirve
// snapshots desde disco antes de ir al servidor, en vez de releer todo de
// red cada vez. Antes se había quitado porque se asumía que con caché
// persistente las escrituras se resuelven en cuanto quedan en cola local,
// aun si el servidor las rechaza después (ej. permiso de NIP aún no
// propagado) — verificado contra el código fuente del SDK
// (firestoreClientWrite → syncEngineWrite) que eso es falso: la promesa de
// setDoc/updateDoc/deleteDoc solo resuelve/rechaza cuando el backend
// confirma o rechaza la escritura, sea cual sea el modo de caché. La
// carrera real (SDK sin fix oficial: firebase-js-sdk#1478) es otra: tras
// signInWithCustomToken() el claim nuevo (nipVerified) puede tardar un
// instante en llegar a la conexión activa de Firestore, así que el primer
// write justo después de verificar el NIP puede salir rechazado — eso
// afecta solo a los 3 writes protegidos por NIP (gastos, cortes_semana,
// config/pin), y esos ya están cubiertos por withPermissionRetry (ver
// firestoreRetry.js), que reintenta ante un rechazo real en vez de confiar
// en que la promesa tarde en resolver. El resto de escrituras (notas, San
// Ramón, CD Judicial, balance) solo requieren la sesión anónima, que ya
// está lista antes de que la app renderice (ver authReady abajo), así que
// no sufren esa carrera.
// Si IndexedDB falla (cuota excedida, modo privado, conflicto multi-tab),
// el propio SDK ya cae a caché en memoria internamente con un warning
// (verificado en el código fuente: ensureOfflineComponents) — no rompe la
// app, solo pierde el ahorro de lecturas en ese caso. El try/catch de abajo
// es solo para el caso, mucho más raro, de que initializeFirestore() se
// llame dos veces con opciones distintas (ej. doble montaje en HMR).
let db
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
} catch {
  db = getFirestore(app)
}
export { db }
export const auth = getAuth(app)

// Las reglas de Firestore exigen una sesión autenticada (ver firestore.rules).
// Mientras no exista login real por NIP (fase 2), usamos una sesión anónima
// automática solo para satisfacer ese requisito de las reglas.
export const authReady = new Promise((resolve, reject) => {
  const unsubscribe = onAuthStateChanged(auth, user => {
    if (user) {
      unsubscribe()
      resolve(user)
    }
  }, reject)
  signInAnonymously(auth).catch(reject)
})
