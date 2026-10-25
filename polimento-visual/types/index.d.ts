export type ContextUse = { tokens: number; window: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    'polimento-visual': { context: ContextUse | null }
  }
}
