import { increment } from 'firebase/firestore'

// Convierte un delta de balance.js ({ prevBklEf: 150, ... }) en un
// objeto listo para updateDoc/tx.update, usando FieldValue.increment
// para que Firestore lo combine de forma segura sin importar cuántos
// dispositivos escriban al mismo tiempo.
export function toIncrements(delta) {
  const out = {}
  for (const k in delta) {
    if (Math.abs(delta[k]) >= 0.005) out[k] = increment(delta[k])
  }
  return out
}
