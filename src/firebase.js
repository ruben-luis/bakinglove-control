import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
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
// Sin persistentLocalCache: con caché persistente, las escrituras se
// resuelven en cuanto quedan en cola local (aunque haya red), aun si el
// servidor las rechaza después (ej. permiso de NIP aún no propagado) —
// eso hacía que guardar() "tuviera éxito" sin haber guardado nada. Con
// caché en memoria (default), la promesa de setDoc/deleteDoc solo se
// resuelve cuando el servidor confirma, así los catch() sí funcionan.
export const db = getFirestore(app)
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
