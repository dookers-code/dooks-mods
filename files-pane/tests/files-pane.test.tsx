import { expect, mock, test } from 'claude-code/testing'

import { meter, resets } from '../hooks/register'

const LIMITS = [
  { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-15T20:40:00Z' },
  { kind: 'seven_day', percentUsed: 41, resetsAt: '2026-10-19T14:00:00Z' },
]
const NOW = Date.parse('2026-10-15T12:00:00Z')
const PROPS = { title: 'Files', isFocused: false, bodyColumns: 80 }

test('meter fills in tenths and clamps', () => {
  expect(meter(0)).toBe('░░░░░░░░░░')
  expect(meter(23.5)).toBe('██░░░░░░░░')
  expect(meter(150)).toBe('██████████')
})

test('resets shows the weekday only on later days', () => {
  const now = new Date(NOW)
  expect(resets('2026-10-15T13:00:00Z', now)).not.toMatch(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/)
  expect(resets('2026-10-19T14:00:00Z', now)).toMatch(/^resets (Sun|Mon|Tue) /)
  expect(resets(undefined, now)).toBe('')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Claude touched starts over on each prompt on ${surface}`, async ($, on) => {
    mock.clock(on, { now: NOW })
    on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
    on('fs.list', () => ({ value: [] }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'file-pane' } }))
    on('ui.open', () => ({ value: { isPlaced: false } }) as never)
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 } as never, rateLimits: [] } }))
    on('tool.call', () => ({ result: { text: 'ok' } }) as never)
    on('prompt.submit', (_$, e) => ({ text: e.text }) as never)

    await $.session.start({ cwd: '/tmp/project', surface, isInteractive: true })
    await $.prompt.submit({ text: 'first' } as never)
    await $.tool.call({ tool: 'Read', file_path: '/tmp/project/notes.md' } as never)
    const ui = await $.ui.mount({ plugin: 'files-pane', surface, component: 'Pane', requestId: 'files-pane', props: PROPS as never } as never)
    expect(await ui.find({ text: 'notes.md' })).toBeDefined()

    await $.prompt.submit({ text: 'second' } as never)
    await ui.redraw()
    expect(await ui.find({ text: 'notes.md' })).toBeUndefined()
    expect(await ui.find({ text: 'Nothing touched for this prompt yet.' })).toBeDefined()
  })

  test(`status card shows usage on ${surface} and keeps it through an empty reading`, async ($, on) => {
    mock.clock(on, { now: NOW })
    on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
    on('fs.list', () => ({ value: [] }))
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'file-pane' } }))
    on('ui.open', () => ({ value: { isPlaced: false } }) as never)
    on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 } as never, rateLimits: [] } }))

    await $.session.start({ cwd: '/tmp/project', surface, isInteractive: true })

    await $.session.measure({ context: { window: 200000 } as never, rateLimits: LIMITS, changed: ['rateLimits'] })
    const ui = await $.ui.mount({ plugin: 'files-pane', surface, component: 'Pane', requestId: 'files-pane', props: PROPS as never } as never)
    expect(await ui.find({ text: '24%' })).toBeDefined()
    expect(await ui.find({ text: '41%' })).toBeDefined()

    await $.session.measure({ context: { window: 200000 } as never, rateLimits: [], changed: ['rateLimits'] })
    await ui.redraw()
    expect(await ui.find({ text: '41%' })).toBeDefined()
  })
}
