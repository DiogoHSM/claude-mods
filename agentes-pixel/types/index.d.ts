export type AgentState = 'running' | 'done' | 'error'

export type AgentRow = {
  id: string
  toolUseId: string
  description: string
  summary: string
  type: string
  model: string
  state: AgentState
  startedAt: number
  endedAt?: number
  tokens: number
}

export type TaskState = 'pending' | 'running' | 'done' | 'error'

export type TaskDot = {
  id: string
  subject: string
  state: TaskState
  startedAt?: number
  endedAt?: number
}

declare module 'claude-code' {
  interface PluginState {
    'agentes-pixel': {
      agents: AgentRow[]
      tasks: Record<string, TaskDot[]>
      now: number
    }
  }
}
