// Lazy-load and configure QZ Tray for community/unsigned use. Browser-only:
// never import this from a Server Component or at a module's top level in one.
// Unsigned mode uses an empty certificate + empty signature, so QZ shows a
// one-time "Allow this site?" prompt instead of requiring a signing cert.
let qzPromise: Promise<any> | null = null

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

export async function connectQz(): Promise<any> {
  const qz = await getQz()
  if (!qz.websocket.isActive()) await qz.websocket.connect()
  return qz
}
