import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limitsA = atom({ plugin: 'usage-bar', key: 'limits' } as const, [] as Limit[])
const hiddenA = atom({ plugin: 'usage-bar', key: 'isHidden' } as const, false)
const tickA = atom({ plugin: 'usage-bar', key: 'tick' } as const, 0)

const ORANGE = '#FF8200'
const LABELS: Record<string, string> = { five_hour: 'Session', seven_day: 'Weekly', spend_limit: 'Spend' }
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

// Time until the window resets: "3d 12h", "2h 13m" or "45m".
export const left = (iso: string | undefined, now: Date) => {
  const at = iso ? new Date(iso).getTime() : NaN
  if (isNaN(at)) return ''
  const mins = Math.max(0, Math.ceil((at - now.getTime()) / 60000))
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  return `${d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`} left`
}

const pick = (limits: readonly Limit[]): Limit[] =>
  limits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt }))

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await $.command.register({ name: 'usage-bar', description: 'Toggle the usage bar' })
    const isHidden = (await $.store.get('isHidden')) === true
    await update($, hiddenA, () => isHidden)
    const { rateLimits } = await $.session.usage()
    if (rateLimits.length) await update($, limitsA, () => pick(rateLimits))
    // Redraw each minute so the time left counts down.
    $.clock.every(60000, () => void update($, tickA, n => n + 1))
    return result
  })

  // A response without rate-limit figures reports an empty list; keep the last reading.
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') && e.rateLimits.length) {
      await update($, limitsA, () => pick(e.rateLimits))
    }
    return next(e)
  })

  on('command.run', { command: 'usage-bar' }, async $ => {
    const isHidden = !(await read($, hiddenA))
    await update($, hiddenA, () => isHidden)
    await $.store.set('isHidden', isHidden)
    return { text: isHidden ? 'Usage bar hidden.' : 'Usage bar shown.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const isHidden = await read($, hiddenA)
    await read($, tickA)
    let limits = await read($, limitsA)
    if (!limits.length) limits = pick((await $.session.usage()).rateLimits)
    if (e.props.hasSurvey || isHidden) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    if (!limits.length) {
      return <Text color={ORANGE} dimColor>Usage: waiting for the first reply</Text>
    }
    const now = new Date(await $.clock.now())

    return (
      <Box flexDirection="row" flexWrap="wrap">
        {limits.map((l, i) => (
          <Box key={l.kind} flexDirection="row">
            {i > 0 ? <Text color={ORANGE}>{'   ·   '}</Text> : null}
            <Text color={ORANGE} bold>{LABELS[l.kind] ?? l.kind} </Text>
            <Text color={ORANGE}>{bar(l.percentUsed)} {Math.round(l.percentUsed)}%</Text>
            <Text color={ORANGE} dimColor>{l.resetsAt ? `  ${left(l.resetsAt, now)} · ${resets(l.resetsAt, now)}` : ''}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
