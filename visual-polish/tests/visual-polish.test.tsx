import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

const engine = (on: On) =>
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })

test('your message gets an orange border; another agent\'s does not', async ($, on) => {
  engine(on)
  const base = { plugin: 'visual-polish', component: 'UserMessage', surface: 'desktop' } as const
  const mine = await $.ui.mount({
    ...base,
    requestId: 'm1',
    props: { text: 'hi', origin: { kind: 'sdk' }, isExpanded: false },
  })
  expect(await mine.drawn()).toMatchObject({ type: 'Box', children: [{ type: 'Box', props: { borderColor: 'claude' } }] })
  await mine.unmount()

  const note = await $.ui.mount({
    ...base,
    requestId: 'm2',
    props: { text: 'done', origin: { kind: 'task-notification' }, isExpanded: false },
  })
  expect(await note.drawn()).toMatchObject({ type: 'Text' })
  await note.unmount()
})

test('a message with a photo keeps the app\'s bubble, which shows the image', async ($, on) => {
  engine(on)
  on('prompt.submit', (_, e) => ({ text: e.text }))
  on('store.set', () => ({ value: undefined }))
  await $.prompt.submit({ text: 'look at this photo', attachments: [{ type: 'image' }], wait: false, origin: { kind: 'composer' } } as never)

  const ui = await $.ui.mount({
    plugin: 'visual-polish',
    component: 'UserMessage',
    surface: 'desktop',
    requestId: 'photo',
    props: { text: 'look at this photo', origin: { kind: 'composer' }, isExpanded: false },
  })
  expect(await ui.drawn()).toMatchObject({ type: 'Text', children: ['engine'] })
  await ui.unmount()
})

test('each tool gets an icon, svg on desktop and glyph in the terminal', async ($, on) => {
  engine(on)
  const row = {
    plugin: 'visual-polish',
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

test('the pill shows context used and total', async ($, on) => {
  const clock = mock.clock(on)
  engine(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 48_000, window: 200_000, percent: 24 }, rateLimits: [] } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await clock.settle()

  const hint = await $.ui.mount({
    plugin: 'visual-polish',
    component: 'PromptHint',
    requestId: 'hint',
    surface: 'desktop',
    props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
  })
  expect(await hint.find({ type: 'Text', text: /48k \/ 200k · 24%/ })).toBeDefined()
  await hint.unmount()
})

test('the border color comes from the mod option', { options: { borderColor: '#3B82F6' } }, async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({
    plugin: 'visual-polish',
    component: 'UserMessage',
    surface: 'desktop',
    requestId: 'color',
    props: { text: 'hi', origin: { kind: 'composer' }, isExpanded: false },
  })
  expect(await ui.drawn()).toMatchObject({ type: 'Box', children: [{ type: 'Box', props: { borderColor: '#3B82F6' } }] })
  await ui.unmount()
})
