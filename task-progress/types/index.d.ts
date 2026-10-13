export type Step = { id: string; subject: string; active: string; status: 'pending' | 'in_progress' | 'completed' }

declare module 'claude-code' {
  interface PluginState {
    'task-progress': { steps: Step[] }
  }
}
