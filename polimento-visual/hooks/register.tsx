import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const context = atom({ plugin: 'polimento-visual', key: 'context' } as const, null)

const PERSON = new Set(['composer', 'bridge', 'sdk'])

type Kind = 'read' | 'search' | 'edit' | 'shell' | 'web' | 'agent' | 'plan' | 'skill' | 'mcp' | 'other'

const COLOR: Record<Kind, string> = {
  read: '#378ADD',
  search: '#378ADD',
  edit: '#D4537E',
  shell: '#888780',
  web: '#1D9E75',
  agent: '#7F77DD',
  plan: '#639922',
  skill: '#D85A30',
  mcp: '#BA7517',
  other: '#888780',
}

const GLYPH: Record<Kind, string> = {
  read: '▤',
  search: '⌕',
  edit: '✎',
  shell: '›_',
  web: '◍',
  agent: '◉',
  plan: '☰',
  skill: '✦',
  mcp: '⧉',
  other: '•',
}

const PATHS: Record<Kind, string> = {
  read: '<path d="M5 2.5h4.5L12 5v8.5H5z"/><path d="M9.5 2.5V5H12M7 8h3M7 10.5h3"/>',
  search: '<circle cx="7.5" cy="7.5" r="3.5"/><path d="M10 10l3 3"/>',
  edit: '<path d="M3.5 12.5l1-3 6-6 2 2-6 6z"/><path d="M9.5 4.5l2 2"/>',
  shell: '<path d="M3.5 5l3 3-3 3M8 11.5h4.5"/>',
  web: '<circle cx="8" cy="8" r="5"/><path d="M3 8h10M8 3c-2 2.5-2 7.5 0 10M8 3c2 2.5 2 7.5 0 10"/>',
  agent: '<rect x="3.5" y="5" width="9" height="7" rx="2"/><path d="M8 2.5V5M6.5 8.5v.5M9.5 8.5v.5"/>',
  plan: '<path d="M3 4.5l1 1 1.5-2M3 9.5l1 1 1.5-2M7.5 4.5h5.5M7.5 9.5h5.5M7.5 13h5.5"/>',
  skill: '<path d="M8 2.5l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z"/>',
  mcp: '<path d="M6 2.5v3M10 2.5v3M4.5 5.5h7v2a3.5 3.5 0 0 1-7 0zM8 11v2.5"/>',
  other: '<circle cx="8" cy="8" r="2"/>',
}

function kindOf(tool: string): Kind {
  if (['Read', 'NotebookRead', 'LS'].includes(tool)) return 'read'
  if (['Grep', 'Glob', 'ToolSearch', 'LSP'].includes(tool)) return 'search'
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) return 'edit'
  if (['Bash', 'BashOutput', 'KillShell', 'Monitor'].includes(tool)) return 'shell'
  if (['WebFetch', 'WebSearch'].includes(tool) || /^mcp__(Claude_Browser|claude-in-chrome|plugin_playwright|plugin_chrome-devtools)/.test(tool)) {
    return 'web'
  }
  if (['Agent', 'Task', 'SendMessage', 'Workflow', 'TaskStop'].includes(tool)) return 'agent'
  if (['TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TodoWrite', 'EnterPlanMode', 'ExitPlanMode'].includes(tool) || tool.startsWith('mcp__ccd_turn__')) {
    return 'plan'
  }
  if (tool === 'Skill') return 'skill'
  if (tool.startsWith('mcp__')) return 'mcp'

  return 'other'
}

function icon(kind: Kind, color = COLOR[kind]): string {

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="18" height="18"><rect x="0" y="0" width="16" height="16" rx="4" fill="${color}" fill-opacity="0.16"/><g fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${PATHS[kind]}</g></svg>`
}

function short(n: number): string {
  if (n < 1000) return `${n}`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`

  return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
}

async function refreshContext($: EngineInterface) {
  const usage = await $.session.usage()
  const { tokens, window } = usage.context
  if (tokens === undefined || !window) return
  const percent = usage.context.percent ?? (tokens / window) * 100
  await update($, context, () => ({ tokens, window, percent }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    void refreshContext($)

    return started
  })

  on('turn.step', async function* ($, e, next) {
    const step = yield* next(e)
    if (e.agentId === undefined) void refreshContext($)

    return step
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) void refreshContext($)

    return done
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const use = await read($, context)
    const own = await next(e)
    if (!use) return own
    const { Box, Text } = $.ui.resolve(e)
    const tone = use.percent < 50 ? 'success' : use.percent < 80 ? 'warning' : 'error'

    return (
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Box flexShrink={1} minWidth={0}>
          {own}
        </Box>
        <Box borderStyle="round" borderColor="subtle" paddingX={1} flexShrink={0}>
          <Text size="caption" tabular>
            <Text color={tone}>●</Text>{' '}
            <Text dimColor>{`${short(use.tokens)} / ${short(use.window)} · ${Math.round(use.percent)}%`}</Text>
          </Text>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const own = await next(e)
    if (!PERSON.has(e.props.origin.kind) || e.props.from !== undefined) return own
    const { Box } = $.ui.resolve(e)

    return (
      <Box alignSelf="flex-start" borderStyle="round" borderColor="claude">
        {own}
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const own = await next(e)
    if (!e.props.isFirstOfReply) return own
    const { Box, Text } = $.ui.resolve(e)
    const Svg = e.surface === 'terminal' ? undefined : $.ui.resolve(e).Svg

    return (
      <Box flexDirection="row" gap={1} alignItems="flex-start">
        {Svg ? (
          <Svg source={icon('skill')} alt="Resposta do Claude" width={18} height={18} />
        ) : (
          <Text color="claude">{GLYPH.skill}</Text>
        )}
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          {own}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const own = await next(e)
    const kind = kindOf(e.props.tool)
    const color = e.props.isErrored ? '#E24B4A' : COLOR[kind]
    const { Box, Text } = $.ui.resolve(e)
    const Svg = e.surface === 'terminal' ? undefined : $.ui.resolve(e).Svg

    return (
      <Box flexDirection="row" gap={1} alignItems="flex-start">
        {Svg ? (
          <Svg source={icon(kind, color)} alt={e.props.tool} width={18} height={18} />
        ) : (
          <Text color={color}>{GLYPH[kind]}</Text>
        )}
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          {own}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const own = await next(e)
    const first = e.props.calls[0]
    if (!first) return own
    const kind = kindOf(first.tool)
    const { Box, Text } = $.ui.resolve(e)
    const Svg = e.surface === 'terminal' ? undefined : $.ui.resolve(e).Svg

    return (
      <Box flexDirection="row" gap={1} alignItems="flex-start">
        {Svg ? (
          <Svg source={icon(kind)} alt={first.tool} width={18} height={18} />
        ) : (
          <Text color={COLOR[kind]}>{GLYPH[kind]}</Text>
        )}
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          {own}
        </Box>
      </Box>
    )
  })
}
