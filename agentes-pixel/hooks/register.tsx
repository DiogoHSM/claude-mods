import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { AgentRow, AgentState, TaskDot, TaskState } from '../types'

const PANE = 'agentes-pixel'
const MAIN = 'main'

const agents = atom({ plugin: 'agentes-pixel', key: 'agents' } as const, [])
const tasks = atom({ plugin: 'agentes-pixel', key: 'tasks' } as const, {})
const now = atom({ plugin: 'agentes-pixel', key: 'now' } as const, 0)

const HEX: Record<TaskState, string> = {
  pending: '#888780',
  running: '#D97757',
  done: '#639922',
  error: '#E24B4A',
}
const THEME: Record<TaskState, 'inactive' | 'claude' | 'success' | 'error'> = {
  pending: 'inactive',
  running: 'claude',
  done: 'success',
  error: 'error',
}
const TASK_LABEL: Record<TaskState, string> = {
  pending: 'planejado',
  running: 'executando',
  done: 'concluído',
  error: 'erro',
}
const AGENT_LABEL: Record<AgentState, string> = {
  running: 'executando',
  done: 'concluído',
  error: 'erro',
}
const AGENT_TASK: Record<AgentState, TaskState> = {
  running: 'running',
  done: 'done',
  error: 'error',
}

type Creature = 'owl' | 'fox' | 'bird' | 'cat' | 'bot'

const SPRITES: Record<Creature, { colors: Record<string, string>; grid: string[] }> = {
  owl: {
    colors: { a: '#534AB7', b: '#AFA9EC', e: '#FAEEDA', k: '#26215C', y: '#EF9F27' },
    grid: ['.a....a.', 'aaaaaaaa', 'aeekkeea', 'aeekkeea', 'aaayyaaa', 'abbbbbba', 'abbbbbba', '.a.aa.a.'],
  },
  fox: {
    colors: { a: '#D85A30', b: '#FAECE7', k: '#4A1B0C' },
    grid: ['a......a', 'aa....aa', 'aaaaaaaa', 'akaaaaka', 'abaaaaba', '.bbkkbb.', '..bbbb..', '...aa...'],
  },
  bird: {
    colors: { a: '#1D9E75', b: '#9FE1CB', k: '#04342C', y: '#EF9F27' },
    grid: ['........', '..aaaa..', '.aaaaaa.', '.akaaaay', '.aaaaaa.', '.abbbba.', '..bbbb..', '..y..y..'],
  },
  cat: {
    colors: { a: '#D4537E', b: '#FBEAF0', k: '#4B1528' },
    grid: ['a......a', 'aa....aa', 'aaaaaaaa', 'akaaaaka', 'aaabbaaa', 'abbkkbba', '.aaaaaa.', '.a....a.'],
  },
  bot: {
    colors: { a: '#888780', b: '#D3D1C7', k: '#2C2C2A' },
    grid: ['...k....', '.aaaaaa.', '.akaaka.', '.aaaaaa.', '..abba..', 'aaaaaaaa', 'a.aaaa.a', '..a..a..'],
  },
}

const GLYPH: Record<Creature, string> = { owl: '🦉', fox: '🦊', bird: '🐦', cat: '🐱', bot: '🤖' }

function family(model: string): { name: string; creature: Creature } {
  const id = model.toLowerCase()
  if (id.includes('opus')) return { name: 'Opus', creature: 'owl' }
  if (id.includes('sonnet')) return { name: 'Sonnet', creature: 'fox' }
  if (id.includes('haiku')) return { name: 'Haiku', creature: 'bird' }
  if (id.includes('fable')) return { name: 'Fable', creature: 'cat' }

  return { name: model || 'modelo', creature: 'bot' }
}

function sprite(creature: Creature, state: AgentState): string {
  const { colors, grid } = SPRITES[creature]
  let cells = ''
  grid.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = ch === 'k' && state === 'error' ? '#E24B4A' : colors[ch]
      if (fill) cells += `<rect x="${x + 1}" y="${y + 1}" width="1" height="1" fill="${fill}"/>`
    }),
  )
  const bob =
    state === 'running'
      ? '<animateTransform attributeName="transform" type="translate" values="0 0;0 -0.6" dur="0.8s" calcMode="discrete" repeatCount="indefinite"/>'
      : ''
  const badge =
    state === 'done'
      ? `<rect x="8" y="8" width="2" height="2" fill="${HEX.done}"/>`
      : state === 'error'
        ? `<rect x="8" y="8" width="2" height="2" fill="${HEX.error}"/>`
        : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="36" height="36" shape-rendering="crispEdges"><g>${cells}${bob}</g>${badge}</svg>`
}

function escape(text: string): string {
  return text.replace(/[<>&"']/g, ch => `&#${ch.charCodeAt(0)};`)
}

function elapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`

  return `${Math.floor(m / 60)}h ${m % 60}m`
}

function tokens(n: number): string {
  if (n < 1000) return `${n}`
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`

  return `${(n / 1_000_000).toFixed(1)}M`
}

function oneLine(text: string, max = 90): string {
  const line = text.replace(/\s+/g, ' ').trim()

  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function toTaskState(status: unknown): TaskState {
  if (status === 'in_progress') return 'running'
  if (status === 'completed') return 'done'

  return 'pending'
}

function moveTo(task: TaskDot, state: TaskState, at: number): TaskDot {
  if (task.state === state) return task
  const next: TaskDot = { ...task, state }
  if (state === 'running') next.startedAt = at
  if (state === 'done' || state === 'error') next.endedAt = at

  return next
}

function replaceAll(previous: TaskDot[], items: { subject: string; status: unknown }[], at: number): TaskDot[] {
  return items.map((item, i) => {
    const old = previous.find(one => one.subject === item.subject)
    const base: TaskDot = old ?? { id: `p${i}`, subject: item.subject, state: 'pending' }

    return moveTo({ ...base, id: `p${i}` }, toTaskState(item.status), at)
  })
}

function applyPlan(previous: TaskDot[], e: Record<string, unknown>, at: number): TaskDot[] {
  let list = previous
  if (Array.isArray(e.items)) {
    const items = e.items.map((item: { content?: unknown; status?: unknown }) => ({
      subject: String(item.content ?? ''),
      status: item.status,
    }))
    list = replaceAll(list, items, at)
  }
  if (e.advance === true) {
    const current = list.findIndex(task => task.state === 'running')
    const after = list.findIndex((task, i) => i > current && task.state === 'pending')
    list = list.map((task, i) =>
      i === current ? moveTo(task, 'done', at) : i === after ? moveTo(task, 'running', at) : task,
    )
  }
  if (Array.isArray(e.done)) {
    const done = new Set(e.done.map(n => Number(n) - 1))
    list = list.map((task, i) => (done.has(i) ? moveTo(task, 'done', at) : task))
  }
  if (typeof e.start === 'number') {
    const start = e.start - 1
    list = list.map((task, i) => (i === start ? moveTo(task, 'running', at) : task))
  }

  return list
}

function failRunning(list: TaskDot[] | undefined, at: number): TaskDot[] | undefined {
  return list?.map(task => (task.state === 'running' ? moveTo(task, 'error', at) : task))
}

function dotsSvg(list: TaskDot[]): string {
  const dots = list
    .map((task, i) => {
      const cx = 7 + i * 16
      const title = `<title>${i + 1}. ${escape(task.subject)} — ${TASK_LABEL[task.state]}</title>`
      const shape =
        task.state === 'pending'
          ? `<circle cx="${cx}" cy="8" r="5" fill="none" stroke="${HEX.pending}" stroke-width="1.5"/>`
          : `<circle cx="${cx}" cy="8" r="5.5" fill="${HEX[task.state]}">${
              task.state === 'running'
                ? '<animate attributeName="opacity" values="1;0.35;1" dur="1.2s" repeatCount="indefinite"/>'
                : ''
            }</circle>`

      return `<g>${title}${shape}</g>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${list.length * 16}" height="16">${dots}</svg>`
}

const PLAN_W = 700

function planSvg(list: TaskDot[]): string {
  const n = list.length
  const gap = 6
  const width = (PLAN_W - gap * (n - 1)) / n
  const bars = list
    .map((task, i) => {
      const fill = task.state === 'pending' ? 'var(--empty)' : HEX[task.state]
      const pulse =
        task.state === 'running'
          ? '<animate attributeName="opacity" values="1;0.45;1" dur="1.4s" repeatCount="indefinite"/>'
          : ''

      return `<rect x="${i * (width + gap)}" y="2" width="${width}" height="8" rx="4" fill="${fill}">${pulse}</rect>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="10000" height="12" viewBox="0 0 ${PLAN_W} 12" preserveAspectRatio="none"><style>svg{--empty:#D3D1C7}@media (prefers-color-scheme:dark){svg{--empty:#444441}}</style>${bars}</svg>`
}

function stepLine(task: TaskDot, i: number, n: number, at: number): string {
  const time =
    task.state === 'running' && task.startedAt
      ? ` · há ${elapsed(at - task.startedAt)}`
      : task.state === 'done' && task.startedAt && task.endedAt
        ? ` · em ${elapsed(task.endedAt - task.startedAt)}`
        : ''

  return `${i + 1}/${n} · ${task.subject} — ${TASK_LABEL[task.state]}${time}`
}

let isOpen = false
let ticker: Timer | undefined

async function openPane($: EngineInterface) {
  if (isOpen) return
  isOpen = true
  await $.ui.open({ id: PANE, title: 'Agentes' })
}

async function finish($: EngineInterface, ended: Map<string, AgentState>, at: number) {
  await update($, agents, list =>
    list.map(row => {
      const state = ended.get(row.id)

      return state && row.state === 'running' ? { ...row, state, endedAt: at } : row
    }),
  )
  await update($, tasks, plan => {
    const next = { ...plan }
    for (const [id, state] of ended) {
      const failed = state === 'error' ? failRunning(next[id], at) : next[id]
      if (failed) next[id] = failed
    }

    return next
  })
}

async function tick($: EngineInterface) {
  const rows = await read($, agents)
  const plan = await read($, tasks)
  const isBusy =
    rows.some(row => row.state === 'running') ||
    Object.values(plan).some(list => list.some(task => task.state === 'running'))
  if (!isBusy) return
  const at = await $.clock.now()
  await update($, now, () => at)
  if (!rows.some(row => row.state === 'running')) return
  const live = await $.agent.list()
  const ended = new Map<string, AgentState>()
  for (const info of live) {
    if (info.status === 'completed') ended.set(info.id, 'done')
    if (info.status === 'failed' || info.status === 'killed') ended.set(info.id, 'error')
  }
  if (ended.size > 0) await finish($, ended, at)
}

async function setTasks($: EngineInterface, owner: string, fn: (list: TaskDot[], at: number) => TaskDot[]) {
  const at = await $.clock.now()
  await update($, tasks, plan => ({ ...plan, [owner]: fn(plan[owner] ?? [], at) }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'agentes', description: 'Abre o painel de agentes e tarefas' })
    ticker?.cancel()
    ticker = $.clock.every(1000, () => void tick($))
    if ((await read($, agents)).length > 0) void openPane($)

    return next(e)
  })

  on('command.run', { command: 'agentes' }, async $ => {
    isOpen = false
    await openPane($)

    return { text: 'Painel de agentes aberto.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    if (spawned.deny !== undefined || spawned.agentId === undefined) return spawned
    const row: AgentRow = {
      id: spawned.agentId,
      toolUseId: e.tool_use_id,
      description: e.description,
      summary: oneLine(e.prompt),
      type: e.subagentType,
      model: spawned.model,
      state: 'running',
      startedAt: await $.clock.now(),
      tokens: 0,
    }
    await update($, agents, list => [...list.filter(one => one.id !== row.id), row].slice(-30))
    void openPane($)

    return spawned
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    const step = yield* next(e)
    const id = e.agentId
    const usage = step.usage
    if (id !== undefined && usage) {
      const spent =
        usage.input_tokens + usage.output_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens
      await update($, agents, list =>
        list.map(row => (row.id === id ? { ...row, tokens: row.tokens + spent, model: usage.model || row.model } : row)),
      )
    }

    return step
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    const at = await $.clock.now()
    if (e.agentId !== undefined) {
      const state: AgentState = e.reason === 'answer' ? 'done' : 'error'
      await finish($, new Map([[e.agentId, state]]), at)
    } else if (e.reason === 'error') {
      await update($, tasks, plan => ({ ...plan, [MAIN]: failRunning(plan[MAIN], at) ?? [] }))
    }

    return done
  })

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    const created = ran.deny === undefined ? (ran.result as { task?: { id?: string } } | undefined) : undefined
    const id = created?.task?.id
    if (id !== undefined) {
      await setTasks($, e.agentId ?? MAIN, list => [...list, { id, subject: e.subject, state: 'pending' }])
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      await setTasks($, e.agentId ?? MAIN, (list, at) =>
        e.status === 'deleted'
          ? list.filter(task => task.id !== e.taskId)
          : list.map(task =>
              task.id === e.taskId
                ? moveTo({ ...task, subject: e.subject ?? task.subject }, e.status ? toTaskState(e.status) : task.state, at)
                : task,
            ),
      )
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      await setTasks($, e.agentId ?? MAIN, (list, at) =>
        replaceAll(list, e.todos.map(todo => ({ subject: todo.content, status: todo.status })), at),
      )
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__ccd_turn__update_plan' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      await setTasks($, e.agentId ?? MAIN, (list, at) => applyPlan(list, e, at))
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__ccd_turn__wrap_up' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      await setTasks($, e.agentId ?? MAIN, (list, at) =>
        list.map(task => (task.state === 'done' || task.state === 'error' ? task : moveTo(task, 'done', at))),
      )
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const Svg = e.surface === 'terminal' ? undefined : $.ui.resolve(e).Svg
    const rows = await read($, agents)
    const plan = await read($, tasks)
    const at = Math.max(await read($, now), ...rows.map(row => row.endedAt ?? row.startedAt))
    const ordered = [...rows].sort(
      (a, b) => Number(b.state === 'running') - Number(a.state === 'running') || b.startedAt - a.startedAt,
    )
    const owners = Object.entries(plan).filter(([, list]) => list.length > 0)
    const ownerLabel = (owner: string) => {
      if (owner === MAIN) return 'Principal'
      const row = rows.find(one => one.id === owner)

      return row ? `${family(row.model).name} · ${row.description}` : 'Subagent'
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor size="caption">
          Subagents
        </Text>
        {ordered.length === 0 && <Text dimColor>Nenhum subagent nesta sessão ainda.</Text>}
        {ordered.slice(0, 12).map(row => {
          const { name, creature } = family(row.model)
          const color = THEME[AGENT_TASK[row.state]]

          return (
            <Box key={row.id} flexDirection="row" gap={1} borderStyle="round" borderColor={color} paddingX={1}>
              {Svg ? (
                <Svg source={sprite(creature, row.state)} alt={`${name}, ${AGENT_LABEL[row.state]}`} width={36} height={36} isInteractive />
              ) : (
                <Text>{GLYPH[creature]}</Text>
              )}
              <Box flexDirection="column" flexGrow={1}>
                <Text>
                  <Text bold>{name}</Text> <Text color={color}>● {AGENT_LABEL[row.state]}</Text>{' '}
                  <Text dimColor>{row.type}</Text>
                </Text>
                <Text>{row.description}</Text>
                <Text dimColor>{row.summary}</Text>
                <Text dimColor tabular>
                  {elapsed((row.endedAt ?? at) - row.startedAt)} · ~{tokens(row.tokens)} tokens
                </Text>
              </Box>
              <Button key={`ver-${row.id}`} label="Ver" plain onPress={() => void $.ui.view({ agentId: row.id })} />
            </Box>
          )
        })}
        {owners.length > 0 && (
          <Text dimColor size="caption">
            Tarefas
          </Text>
        )}
        {owners.map(([owner, list]) => (
          <Box key={`t-${owner}`} flexDirection="row" gap={1} alignItems="center">
            <Box width={22}>
              <Text dimColor>{oneLine(ownerLabel(owner), 22)}</Text>
            </Box>
            {Svg ? (
              <Svg
                source={dotsSvg(list)}
                alt={list.map(task => `${task.subject}: ${TASK_LABEL[task.state]}`).join('; ')}
                height={16}
                isInteractive
              />
            ) : (
              <Box flexDirection="row">
                {list.map(task => (
                  <Text color={THEME[task.state]}>{task.state === 'pending' ? '○ ' : '● '}</Text>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = (await read($, tasks))[MAIN] ?? []
    const isActive = list.length >= 2 && list.some(task => task.state !== 'done')
    if (e.props.hasSurvey || !isActive) return next(e)
    const at = await read($, now)
    const { Box, Text } = $.ui.resolve(e)
    const n = list.length
    const index = Math.max(
      0,
      list.findIndex(task => task.state === 'running') >= 0
        ? list.findIndex(task => task.state === 'running')
        : list.findIndex(task => task.state !== 'done'),
    )
    const head = list[index]
    const Svg = e.surface === 'terminal' ? undefined : $.ui.resolve(e).Svg
    const bar =
      !Svg ? (
        <Box flexDirection="row">
          {list.map(task => (
            <Text color={THEME[task.state]}>{'━━━━ '}</Text>
          ))}
        </Box>
      ) : (
        <Svg source={planSvg(list)} alt={head ? `Etapa atual: ${head.subject}` : 'Plano em andamento'} height={12} />
      )

    return (
      <Box key="plano" flexDirection="column">
        {bar}
        {head && (
          <Text dimColor>{`Etapa ${index + 1}/${n} · ${head.subject} — ${TASK_LABEL[head.state]}`}</Text>
        )}
        <Box flexDirection="column" display="none" hover={{ display: 'flex' }}>
          {list.map((task, i) => (
            <Text key={`etapa-${i}`} color={THEME[task.state]}>{`● ${stepLine(task, i, n, at)}`}</Text>
          ))}
        </Box>
      </Box>
    )
  })
}
