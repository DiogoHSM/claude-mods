export type ContextUse = { tokens: number; window: number; percent: number }

declare module 'claude-code' {
  interface PluginState {
    'visual-polish': { context: ContextUse | null; withMedia: string[] }
  }
}
