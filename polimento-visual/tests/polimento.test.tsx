import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const engine = (on: On) =>
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

test('sua mensagem ganha borda laranja; a de outro agente não', async ($, on) => {
  engine(on)
  const base = { plugin: 'polimento-visual', component: 'UserMessage', surface: 'desktop' } as const
  const mine = await $.ui.mount({
    ...base,
    requestId: 'm1',
    props: { text: 'oi', origin: { kind: 'sdk' }, isExpanded: false },
  })
  expect(await mine.drawn()).toMatchObject({ type: 'Box', props: { borderColor: 'claude' } })
  await mine.unmount()

  const note = await $.ui.mount({
    ...base,
    requestId: 'm2',
    props: { text: 'feito', origin: { kind: 'task-notification' }, isExpanded: false },
  })
  expect(await note.drawn()).toMatchObject({ type: 'Text' })
  await note.unmount()
})

test('cada ferramenta ganha um ícone, svg no desktop e glifo no terminal', async ($, on) => {
  engine(on)
  const row = {
    plugin: 'polimento-visual',
    component: 'ToolUse',
    requestId: 't1',
    props: { tool_use_id: 't1', tool: 'Edit', input: {}, isRunning: false, isErrored: false, isInterrupted: false },
  } as const
  const desktop = await $.ui.mount({ ...row, surface: 'desktop' })
  expect(await desktop.find({ type: 'Svg' })).toBeDefined()
  expect(await desktop.find({ type: 'Text', text: 'engine' })).toBeDefined()
  await desktop.unmount()

  const terminal = await $.ui.mount({ ...row, surface: 'terminal' })
  expect(await terminal.find({ type: 'Text', text: '✎' })).toBeDefined()
  await terminal.unmount()
})

test('a pill mostra o contexto usado e o total', async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 48_000, window: 200_000, percent: 24 }, rateLimits: [] } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.settle()

  const hint = await $.ui.mount({
    plugin: 'polimento-visual',
    component: 'PromptHint',
    requestId: 'hint',
    surface: 'desktop',
    props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
  })
  expect(await hint.find({ type: 'Text', text: /48k \/ 200k · 24%/ })).toBeDefined()
  await hint.unmount()
})
