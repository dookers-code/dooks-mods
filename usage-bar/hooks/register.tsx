import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limitsA = atom({ plugin: 'usage-bar', key: 'limits' } as const, [] as Limit[])

const ORANGE = '#FF8200'
const LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d', spend_limit: 'spend' }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WIDTH = 10

export const bar = (pct: number) => {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((pct / 100) * WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

const clock = (d: Date) => {
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`
}

// Same day shows just the time; later days lead with the weekday.
export const resets = (iso: string | undefined, now: Date) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const sameDay = d.toDateString() === now.toDateString()
  return `resets ${sameDay ? '' : DAYS[d.getDay()] + ' '}${clock(d)}`
}

const pick = (limits: readonly Limit[]): Limit[] =>
  limits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt }))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const { rateLimits } = await $.session.usage()
    if (rateLimits.length) await update($, limitsA, () => pick(rateLimits))
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await update($, limitsA, () => pick(e.rateLimits))
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const limits = await read($, limitsA)
    if (e.props.hasSurvey || !limits.length) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = new Date(await $.clock.now())

    return (
      <Box flexDirection="row" flexWrap="wrap">
        {limits.map((l, i) => (
          <Box key={l.kind} flexDirection="row">
            {i > 0 ? <Text color={ORANGE}>{'   ·   '}</Text> : null}
            <Text color={ORANGE} bold>{LABELS[l.kind] ?? l.kind} </Text>
            <Text color={ORANGE}>{bar(l.percentUsed)} {Math.round(l.percentUsed)}%</Text>
            <Text color={ORANGE} dimColor>{l.resetsAt ? '  ' + resets(l.resetsAt, now) : ''}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
