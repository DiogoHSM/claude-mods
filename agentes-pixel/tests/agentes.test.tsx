import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'agentes-pixel',
  component: 'Pane',
  requestId: 'agentes-pixel',
  props: {
    title: 'Agentes',
    isFocused: false,
    bodyColumns: 50,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const BAND = {
  plugin: 'agentes-pixel',
  component: 'AbovePrompt',
  requestId: 'band',
  props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
} as const

test('um subagent aparece no painel com modelo, status e resumo', async ($, on) => {
  const clock = mock.clock(on)
  on('agent.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'agentes' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.agent.spawn({
    tool_use_id: 't1',
    prompt: 'Revise o plano de arquitetura dos mods',
    description: 'Revisar plano',
    subagentType: 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' },
    model: 'opus',
    parentModel: 'claude-opus-5-5',
    background: false,
    fork: false,
  })
  await clock.advance(2000)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /^Opus$/ }))?.text).toBe('Opus')
    expect(await ui.find({ type: 'Text', text: /executando/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Revise o plano/ })).toBeDefined()
    await ui.unmount()
  }
})

test('o plano vira bolinhas e barra acima do prompt', async ($, on) => {
  const clock = mock.clock(on)
  on('agent.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'agentes' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__ccd_turn__update_plan',
    items: [
      { content: 'Mapear API', status: 'completed' },
      { content: 'Escrever mod', status: 'in_progress' },
      { content: 'Testar', status: 'pending' },
    ],
  })
  await clock.settle()

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /Etapa 2\/3 · Escrever mod — executando/ })).toBeDefined()
  await band.unmount()

  const desktop = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desktop.find({ type: 'Svg' })).toBeDefined()
  await desktop.unmount()

  await $.tool.call({ tool: 'mcp__ccd_turn__update_plan', advance: true })
  await clock.settle()
  const after = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await after.find({ type: 'Text', text: /Etapa 3\/3 · Testar — executando/ })).toBeDefined()
  await after.unmount()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /Principal/ })).toBeDefined()
  expect((await pane.findAll({ type: 'Text', text: /●/ })).length).toBe(3)
  await pane.unmount()
})
