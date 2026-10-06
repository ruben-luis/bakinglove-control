// Reintenta una vez una escritura de Firestore si el servidor la rechaza
// con 'permission-denied'. Existe por una carrera conocida del SDK de
// Firebase (sin fix oficial: firebase-js-sdk#1478, flutterfire#6024/#3618):
// tras signInWithCustomToken() con un claim nuevo (ej. nipVerified), el
// claim puede tardar un instante en propagarse a la conexión activa de
// Firestore, así que el primer write justo después de verificar el NIP
// puede fallar aunque el NIP sea correcto. Un segundo intento, dando
// tiempo a que el claim se propague, resuelve el caso típico.
export async function withPermissionRetry(fn, { waitMs = 400 } = {}) {
  try {
    return await fn()
  } catch (err) {
    if (err?.code !== 'permission-denied') throw err
    await new Promise(resolve => setTimeout(resolve, waitMs))
    return await fn()
  }
}
