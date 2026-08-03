/**
 * qz-tray ships no usable type definitions. This declares exactly the surface
 * this app calls, rather than the bare `declare module 'qz-tray'` that was here
 * before — that form types the whole module as `any`, which forced four
 * `no-explicit-any` suppressions in `lib/qz.ts` and left `qz.print(...)` and
 * `qz.configs.create(...)` completely unchecked at their call sites.
 *
 * Only what we use is modelled. Widen it when a new call is added; don't
 * reach for `any`.
 */
declare module 'qz-tray' {
  /** Opaque printer config handle produced by `configs.create`. */
  export interface QzConfig {
    readonly __brand: unique symbol
  }

  /**
   * A single print job entry. This app only ever sends raw ESC/P commands
   * (see `lib/escp.ts`), so the raw variant is the only one modelled.
   */
  export interface QzRawPrintData {
    type: 'raw'
    format: 'command'
    flavor: 'plain' | 'base64' | 'file' | 'hex'
    data: string
  }

  /**
   * QZ resolves the caller's promise itself, so these hooks receive a
   * resolver rather than returning a value. Unsigned/community mode passes
   * an empty certificate and signature.
   */
  export interface QzSecurity {
    setCertificatePromise(handler: (resolve: () => void, reject: (e?: unknown) => void) => void): void
    setSignaturePromise(
      handler: (toSign: string) => (resolve: () => void, reject: (e?: unknown) => void) => void
    ): void
  }

  export interface QzWebsocket {
    /** True while the socket is CONNECTING as well as OPEN — see `connectQz`. */
    isActive(): boolean
    connect(options?: { retries?: number; delay?: number }): Promise<void>
    disconnect(): Promise<void>
  }

  export interface QzPrinters {
    /** Returns a bare string when exactly one printer matches, otherwise an array. */
    find(query?: string): Promise<string | string[]>
    getDefault(): Promise<string | null>
  }

  export interface QzConfigs {
    create(printer: string, options?: Record<string, unknown>): QzConfig
  }

  export interface QzTray {
    security: QzSecurity
    websocket: QzWebsocket
    printers: QzPrinters
    configs: QzConfigs
    print(config: QzConfig, data: QzRawPrintData[]): Promise<void>
  }

  const qz: QzTray
  export default qz
}
