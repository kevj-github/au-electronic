// Lazy-load and configure QZ Tray for community/unsigned use. Browser-only:
// never import this from a Server Component or at a module's top level in one.
// Unsigned mode uses an empty certificate + empty signature, so QZ shows a
// one-time "Allow this site?" prompt instead of requiring a signing cert.
// The `any` types below are deliberate: qz-tray ships no usable type definitions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let qzPromise: Promise<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getQz(): Promise<any> {
  if (!qzPromise) {
    qzPromise = import('qz-tray').then(({ default: qz }) => {
      qz.security.setCertificatePromise((resolve: () => void) => resolve())
      qz.security.setSignaturePromise(() => (resolve: () => void) => resolve())
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let connectPromise: Promise<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function connectQz(): Promise<any> {
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
