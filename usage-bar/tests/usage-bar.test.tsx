import { expect, mock, test } from 'claude-code/testing'

import { bar, left, resets } from '../hooks/register'

const PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 9 },
  view: {},
} as const

const LIMITS = [
  { kind: 'five_hour', percentUsed: 23.5, resetsAt: '2026-10-15T20:40:00Z' },
  { kind: 'seven_day', percentUsed: 41, resetsAt: '2026-10-19T14:00:00Z' },
]

test('bar fills in tenths and clamps', () => {
  expect(bar(0)).toBe('░░░░░░░░░░')
  expect(bar(23.5)).toBe('██░░░░░░░░')
  expect(bar(150)).toBe('██████████')
})

test('resets shows time only when same day', () => {
  const now = new Date('2026-10-15T12:00:00Z')
  expect(resets('2026-10-15T13:00:00Z', now)).not.toMatch(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/)
  expect(resets('2026-10-19T14:00:00Z', now)).toMatch(/^resets (Sun|Mon|Tue) /)
  expect(resets(undefined, now)).toBe('')
})

test('left counts down in days, hours and minutes', () => {
  const now = new Date('2026-10-15T12:00:00Z')
  expect(left('2026-10-19T00:30:00Z', now)).toBe('3d 12h left')
  expect(left('2026-10-15T14:13:00Z', now)).toBe('2h 13m left')
  expect(left('2026-10-15T12:45:00Z', now)).toBe('45m left')
  expect(left('2026-10-15T11:00:00Z', now)).toBe('0m left')
  expect(left(undefined, now)).toBe('')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`draws both windows on ${surface} and keeps them through an empty reading`, async ($, on) => {
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    mock.clock(on, { now: Date.parse('2026-10-15T12:00:00Z') })

    await $.session.measure({ context: { window: 200000 } as never, rateLimits: LIMITS, changed: ['rateLimits'] })
    const ui = await $.ui.mount({ plugin: 'usage-bar', surface, component: 'AbovePrompt', props: PROPS as never })

    expect((await ui.find({ text: 'Weekly' }))).toBeDefined()
    expect((await ui.find({ text: '4d 2h left' }))).toBeDefined()
    expect((await ui.find({ text: '24%' }))).toBeDefined()
    expect((await ui.find({ text: '41%' }))).toBeDefined()
    // One row per window, no separator between them; white bar, gray details.
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn).not.toContain('   ·   ')
    expect(drawn).toContain('"color":"text"')
    expect(drawn).toContain('"color":"#B4B4B4"')

    await $.session.measure({ context: { window: 200000 } as never, rateLimits: [], changed: ['rateLimits'] })
    await ui.redraw()
    expect((await ui.find({ text: '41%' }))).toBeDefined()
  })

  test(`/usage-bar toggles the band on ${surface}`, async ($, on) => {
    mock.clock(on, { now: Date.parse('2026-10-15T12:00:00Z') })
    mock.store(on)
    on('session.measure', (_$, e) => ({ changed: e.changed }))
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Box } = $.ui.resolve(e)
      return <Box />
    })

    await $.session.measure({ context: { window: 200000 } as never, rateLimits: LIMITS, changed: ['rateLimits'] })
    await $.command.run({ command: 'usage-bar', args: '' } as never)
    const ui = await $.ui.mount({ plugin: 'usage-bar', surface, component: 'AbovePrompt', props: PROPS as never })
    expect(await ui.find({ text: '41%' })).toBeUndefined()

    await $.command.run({ command: 'usage-bar', args: '' } as never)
    await ui.redraw()
    expect(await ui.find({ text: '41%' })).toBeDefined()
  })
}
