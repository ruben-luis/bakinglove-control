import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 5 * 60 * 1000
const DEFAULT_PIN = '1234'
const SHARED_UID = 'bkl-shared-nip'

function getAdminApp() {
  if (getApps().length) return getApps()[0]
  const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf-8')
  return initializeApp({ credential: cert(JSON.parse(json)) })
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const { pin } = req.body || {}
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    res.status(400).json({ error: 'invalid_pin_format' })
    return
  }

  const db = getFirestore(getAdminApp())
  const securityRef = db.doc('config/pin_security')
  const pinRef = db.doc('config/pin')

  const [securitySnap, pinSnap] = await Promise.all([securityRef.get(), pinRef.get()])
  const security = securitySnap.exists ? securitySnap.data() : {}
  const now = Date.now()

  if (security.lockedUntil && security.lockedUntil > now) {
    res.status(429).json({ error: 'locked', waitMinutes: Math.ceil((security.lockedUntil - now) / 60000) })
    return
  }

  const storedHash = pinSnap.exists ? pinSnap.data().hash : null

  let ok
  if (!storedHash) {
    ok = pin === DEFAULT_PIN
  } else if (storedHash.length < 64) {
    ok = pin === storedHash // migración: hash antiguo en texto plano
  } else {
    ok = (await sha256(pin)) === storedHash
  }

  if (!ok) {
    const failCount = (security.failCount || 0) + 1
    const update = { failCount, lastAttempt: now }
    if (failCount >= MAX_ATTEMPTS) {
      update.lockedUntil = now + LOCKOUT_MS
      update.failCount = 0
    }
    await securityRef.set(update, { merge: true })
    res.status(401).json({ error: 'wrong_pin' })
    return
  }

  await securityRef.set({ failCount: 0, lockedUntil: FieldValue.delete(), lastAttempt: now }, { merge: true })
  if (!storedHash || storedHash.length < 64) {
    await pinRef.set({ hash: await sha256(pin) })
  }

  const token = await getAuth(getAdminApp()).createCustomToken(SHARED_UID, { nipVerified: true })
  res.status(200).json({ token })
}
