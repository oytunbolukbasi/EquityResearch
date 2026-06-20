/*
 * react-draggable / react-resizable (used by react-grid-layout) are CJS and
 * read `process.env.DRAGGABLE_DEBUG` at interaction time. The browser has no
 * `process`, so without this shim every drag/resize throws
 * "process is not defined". Import this first, before any grid code.
 */
const g = globalThis as unknown as { process?: { env: Record<string, unknown> } }
if (!g.process) g.process = { env: {} }

export {}
