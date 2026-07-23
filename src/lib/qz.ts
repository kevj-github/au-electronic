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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function connectQz(): Promise<any> {
  const qz = await getQz()
  if (!qz.websocket.isActive()) await qz.websocket.connect()
  return qz
}
