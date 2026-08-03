// Lazy-load and configure QZ Tray for community/unsigned use. Browser-only:
// never import this from a Server Component or at a module's top level in one.
// Unsigned mode uses an empty certificate + empty signature, so QZ shows a
// one-time "Allow this site?" prompt instead of requiring a signing cert.
// The API surface is typed in src/types/qz-tray.d.ts — no `any` needed.
import type { QzTray } from 'qz-tray'

let qzPromise: Promise<QzTray> | null = null

// Not exported: `connectQz` is the only entry point callers should use — a bare
// `getQz` hands back a client whose socket may not be open yet.
function getQz(): Promise<QzTray> {
  if (!qzPromise) {
    qzPromise = import('qz-tray').then(({ default: qz }) => {
      qz.security.setCertificatePromise((resolve) => resolve())
      qz.security.setSignaturePromise(() => (resolve) => resolve())
      return qz
    })
  }
  return qzPromise
}

// In-flight `connect()` call, shared by concurrent callers. `isActive()` is also
// true while the socket is still CONNECTING, so a second caller that only checked
// it would skip `connect()` and print against a socket that isn't open yet
// (reachable by clicking "Deteksi Printer" then "Cetak Epson" quickly). Cleared
// once the attempt settles so a later disconnect can be reconnected.
let connectPromise: Promise<void> | null = null

export async function connectQz(): Promise<QzTray> {
  const qz = await getQz()
  if (connectPromise) {
    await connectPromise
    return qz
  }
  if (qz.websocket.isActive()) return qz

  connectPromise = Promise.resolve(qz.websocket.connect())
  try {
    await connectPromise
  } finally {
    connectPromise = null
  }
  return qz
}
