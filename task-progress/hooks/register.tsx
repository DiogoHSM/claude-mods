import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Step } from '../types'

const steps = atom({ plugin: 'task-progress', key: 'steps' } as const, [] as Step[])

export function colorFor(ratio: number): string {
  if (ratio >= 1) return '#22c55e'
  if (ratio >= 0.75) return '#84cc16'
  if (ratio >= 0.5) return '#eab308'
  if (ratio >= 0.25) return '#f97316'
  return '#ef4444'
}

const DEMO = ['Lendo o código', 'Planejando', 'Escrevendo testes', 'Implementando', 'Rodando os testes', 'Revisando', 'Finalizando']

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'progresso-demo', description: 'Simula 7 passos para ver a barra de progresso' })
    return next(e)
  })

  on('command.run', { command: 'progresso-demo' }, async $ => {
    void (async () => {
      for (let i = 0; i <= DEMO.length; i++) {
        if (i > 0) await $.clock.sleep(2000)
        await update($, steps, () =>
          DEMO.map((d, j) => ({
            id: `demo${j}`,
            subject: d,
            active: d,
            status: j < i ? 'completed' : j === i ? 'in_progress' : 'pending',
          })),
        )
      }
    })()
    return { text: 'Demo da barra iniciada (7 passos, ~14s).' }
  })

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      await update($, steps, () =>
        e.todos.map((t, i) => ({ id: String(i), subject: t.content, active: t.activeForm, status: t.status })),
      )
    }
    return ran
  })

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      const id = ran.result.task.id
      await update($, steps, s => [
        ...(s.every(x => x.status === 'completed') ? [] : s.filter(x => x.id !== id)),
        { id, subject: e.subject, active: e.activeForm ?? e.subject, status: 'pending' },
      ])
    }
    return ran
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      await update($, steps, s =>
        e.status === 'deleted'
          ? s.filter(x => x.id !== e.taskId)
          : s.map(x =>
              x.id === e.taskId
                ? {
                    ...x,
                    subject: e.subject ?? x.subject,
                    active: e.activeForm ?? x.active,
                    status: e.status ?? x.status,
                  }
                : x,
            ),
      )
    }
    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, steps)
    if (e.props.hasSurvey || list.length === 0) return next(e)

    const total = list.length
    const done = list.filter(s => s.status === 'completed').length

    const current = list.find(s => s.status === 'in_progress')
    const position = current ? list.indexOf(current) + 1 : Math.min(done + 1, total)
    const ratio = done / total
    const color = colorFor(ratio)

    const label = done === total ? 'Concluído' : current ? current.active : (list[done]?.subject ?? '')
    const counter = ` ${position}/${total}`
    const { Box, Text } = $.ui.resolve(e)

    if (e.surface === 'terminal') {
      const width = Math.max(10, e.props.bodyColumns - counter.length - 1)
      const filled = Math.round(ratio * width)
      return (
        <Box flexDirection="column">
          <Box>
            <Text color={color}>{'█'.repeat(filled)}</Text>
            <Text dimColor>{'░'.repeat(width - filled)}</Text>
            <Text color={color} bold>{counter}</Text>
          </Box>
          <Text dimColor wrap="truncate-end">{label}</Text>
        </Box>
      )
    }

    const pct = `${Math.round(ratio * 100)}%`
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Box flexGrow={1} flexDirection="row" backgroundColor="subtle" overflow="hidden">
            <Box width={pct} backgroundColor={color}>
              <Text> </Text>
            </Box>
          </Box>
          <Text color={color} bold>{counter.trim()}</Text>
        </Box>
        <Text dimColor wrap="truncate-end">{label}</Text>
      </Box>
    )
  })
}
