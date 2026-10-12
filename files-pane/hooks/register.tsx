import { atom, read, update } from 'claude-code'
import type { Elements, Register } from 'claude-code'

import type { Current, Touch } from '../types'

const PANE = 'files-pane'

const cwdA = atom({ plugin: 'files-pane', key: 'cwd' } as const, '')
const touchedA = atom({ plugin: 'files-pane', key: 'touched' } as const, [] as Touch[])
const currentA = atom({ plugin: 'files-pane', key: 'current' } as const, null as Current)
const queryA = atom({ plugin: 'files-pane', key: 'query' } as const, '')
const openA = atom({ plugin: 'files-pane', key: 'open' } as const, [] as string[])
const hiddenA = atom({ plugin: 'files-pane', key: 'showHidden' } as const, true)
const sizesA = atom({ plugin: 'files-pane', key: 'showSizes' } as const, false)
const branchA = atom({ plugin: 'files-pane', key: 'branch' } as const, '')
const changesA = atom({ plugin: 'files-pane', key: 'changes' } as const, 0)
const previewA = atom({ plugin: 'files-pane', key: 'preview' } as const, '')
const diffA = atom({ plugin: 'files-pane', key: 'previewDiff' } as const, true)
const expandA = atom({ plugin: 'files-pane', key: 'expandAll' } as const, false)
const headA = atom({ plugin: 'files-pane', key: 'head' } as const, '')
const snapA = atom({ plugin: 'files-pane', key: 'snapshot' } as const, {} as Record<string, string>)
const tickA = atom({ plugin: 'files-pane', key: 'tick' } as const, 0)

const READ = ['Read', 'NotebookRead']
const EDIT = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']

const BADGES: Record<string, [string, string]> = {
  js: ['JS', '#f7df1e'], mjs: ['JS', '#f7df1e'], cjs: ['JS', '#f7df1e'], jsx: ['JSX', '#61dafb'],
  ts: ['TS', '#3b82f6'], tsx: ['TSX', '#3b82f6'], vue: ['VUE', '#42b883'], php: ['PHP', '#8892bf'],
  json: ['JSN', '#cbcb41'], css: ['CSS', '#a78bfa'], scss: ['SCS', '#f472b6'], html: ['HTM', '#e34c26'],
  md: ['MD', '#9ca3af'], pdf: ['PDF', '#ef4444'], csv: ['CSV', '#4ade80'], sql: ['SQL', '#fb923c'],
  yml: ['YML', '#f87171'], yaml: ['YML', '#f87171'], sh: ['SH', '#4ade80'], py: ['PY', '#60a5fa'],
  png: ['IMG', '#c084fc'], jpg: ['IMG', '#c084fc'], svg: ['SVG', '#fbbf24'], lock: ['LCK', '#9ca3af'],
  env: ['ENV', '#fbbf24'], xml: ['XML', '#fb923c'], txt: ['TXT', '#9ca3af'],
}
const badge = (name: string): [string, string] => {
  const lower = name.toLowerCase()
  if (lower.endsWith('.blade.php')) return ['BLD', '#f05340']
  if (lower.startsWith('.env')) return ['ENV', '#fbbf24']
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.') + 1) : ''
  return BADGES[ext] ?? [ext ? ext.slice(0, 3).toUpperCase() : 'FIL', '#9ca3af']
}

const PURPLE = '#c084fc'
const ORANGE = '#fb923c'
const YELLOW = '#facc15'

const rel = (cwd: string, p: string) => (p.startsWith(cwd + '/') ? p.slice(cwd.length + 1) : p)
const base = (p: string) => p.slice(p.lastIndexOf('/') + 1)
const parent = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.')
const size = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)

async function refreshGit($: any) {
  const cwd = await read($, cwdA)
  if (!cwd) return
  const out = await $.process.run(['git', 'status', '--porcelain', '-b'], { cwd, timeoutMs: 5000 })
  if (out.exitCode !== 0) return
  const lines = String(out.stdout).split('\n').filter(Boolean)
  const branchName = (lines.shift() ?? '').replace(/^## /, '').split('...')[0]
  const stale = branchName !== (await read($, branchA)) || lines.length !== (await read($, changesA))
  if (stale) {
    await update($, branchA, () => branchName)
    await update($, changesA, () => lines.length)
  }

  // A new commit (including a pull or checkout) starts the "Claude touched" list over;
  // a file whose changes are gone (reverted, stashed) drops out of it.
  const rev = await $.process.run(['git', 'rev-parse', 'HEAD'], { cwd, timeoutMs: 5000 })
  const headSha = rev.exitCode === 0 ? String(rev.stdout).trim() : ''
  const lastSha = await read($, headA)
  const dirty = new Set(lines.map(l => `${cwd}/${l.slice(3).split(' -> ').pop()}`))
  let cleared = false
  if (headSha && headSha !== lastSha) {
    await update($, headA, () => headSha)
    if (lastSha) {
      await update($, touchedA, () => [])
      cleared = true
    }
  }
  if (!cleared) {
    const touched = await read($, touchedA)
    const kept = touched.filter(t => t.kind === 'read' || dirty.has(t.path))
    if (kept.length !== touched.length) {
      await update($, touchedA, () => kept)
      cleared = true
    }
  }
  if (stale || cleared) $.ui.invalidate('ui.render')
}

async function snapshot($: any): Promise<Record<string, string>> {
  const cwd = await read($, cwdA)
  const snap: Record<string, string> = {}
  if (!cwd) return snap
  const st = await $.process.run(['git', 'status', '--porcelain'], { cwd, timeoutMs: 5000 })
  const ns = await $.process.run(['git', 'diff', '--numstat', 'HEAD'], { cwd, timeoutMs: 5000 })
  if (st.exitCode !== 0) return snap
  const nums = new Map<string, string>()
  for (const l of String(ns.stdout).split('\n').filter(Boolean)) {
    const [add, del, ...rest] = l.split('\t')
    nums.set(rest.join('\t'), `${add}/${del}`)
  }
  for (const l of String(st.stdout).split('\n').filter(Boolean)) {
    const path = l.slice(3).split(' -> ').pop() as string
    snap[path] = `${l.slice(0, 2)}:${nums.get(path) ?? ''}`
  }
  return snap
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, cwdA, () => e.cwd)
    await $.command.register({ name: 'dooks-mods:file-pane', description: 'Show the files pane' })
    await refreshGit($)
    const first = await snapshot($)
    await update($, snapA, () => first)
    void $.ui.open({ id: PANE, title: 'Files' })
    $.clock.every(5000, () => void refreshGit($))

    return next(e)
  })

  on('command.run', { command: 'dooks-mods:file-pane' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Files' })

    return { text: 'Files pane opened.' }
  })

  on('tool.call', async ($, e, next) => {
    const input = e as { file_path?: string; notebook_path?: string }
    const path = input.file_path ?? input.notebook_path
    const tool = String(e.tool)
    const isRead = READ.includes(tool)
    const isEdit = EDIT.includes(tool)
    const tracked = Boolean(path) && (isRead || isEdit)
    const before = await read($, snapA)
    if (tracked && path) await update($, currentA, () => ({ tool, path }))
    const ran = await next(e)
    if (tracked && path) {
      await update($, touchedA, list => {
        const rest = list.filter(t => t.path !== path || (t.kind === 'edited' && isRead))
        if (rest.some(t => t.path === path)) return rest
        return [...rest, { path, kind: isEdit ? 'edited' : 'read' } as Touch]
      })
      await update($, currentA, () => null)
    }
    // Anything else that changed the working tree (Bash, scripts) counts as edited too.
    const after = await snapshot($)
    const cwd = await read($, cwdA)
    const changedPaths = Object.keys(after).filter(k => after[k] !== before[k])
    if (changedPaths.length > 0) {
      await update($, touchedA, list => {
        const merged: Touch[] = [...list]
        for (const k of changedPaths) {
          const abs = `${cwd}/${k}`
          const at = merged.findIndex(t => t.path === abs)
          if (at >= 0) merged[at] = { path: abs, kind: 'edited' }
          else merged.push({ path: abs, kind: 'edited' })
        }
        return merged
      })
    }
    await update($, snapA, () => after)
    await refreshGit($)
    await update($, tickA, n => n + 1)
    $.ui.invalidate('ui.render')

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input, Code, Svg } = $.ui.resolve(e) as Elements['desktop']
    const cwd = await read($, cwdA)
    const touched = await read($, touchedA)
    const current = await read($, currentA)
    const query = await read($, queryA)
    const open = await read($, openA)
    const showHidden = await read($, hiddenA)
    const showSizes = await read($, sizesA)
    const branch = await read($, branchA)
    const changes = await read($, changesA)
    const preview = await read($, previewA)
    const showDiff = await read($, diffA)
    const expandAll = await read($, expandA)
    await read($, tickA)

    const SLOT = 24
    const logo = (inner: string, alt: string) => {
      const src = `<svg xmlns="http://www.w3.org/2000/svg" width="${SLOT}" height="22" viewBox="0 0 ${SLOT} 22">${inner}</svg>`
      return <Svg source={src} alt={alt} width={SLOT} height={22} />
    }
    const chip = (name: string, where = '') => {
      const lower = name.toLowerCase()
      if (lower.endsWith('.php') && /(^|\/)tests\//.test(where)) {
        return logo(
          '<svg x="2" y="5" width="13" height="12" viewBox="0 0 240 220">'
          + '<path fill="#f43f5e" fill-rule="evenodd" d="M36.844 61.111 51.014 0H240l-32.594 140.556H81.417L62.995 220H0L32.593 79.445h125.989l4.252-18.334z"/></svg>',
          'Pest',
        )
      }
      if (lower.endsWith('.vue')) {
        return logo(
          '<svg x="2" y="4" width="15" height="14" viewBox="5 6 54 52">'
          + '<path d="M17.595,11.204l8.91,0l5.536,9.391l5.591,-9.391l8.831,0l-14.422,25.359l-14.446,-25.359Z" fill="#9fb3c8"/>'
          + '<path d="M8.089,11.204l23.952,41.845l24.126,-41.845l-9.704,0l-14.422,25.359l-14.446,-25.359l-9.506,0Z" fill="#4dba87"/></svg>',
          'Vue',
        )
      }
      if (/\.(yml|yaml)$/i.test(name)) {
        return logo(
          '<svg x="2" y="4.5" width="17" height="13" viewBox="1 1.5 15.2 11.8">'
          + '<path fill="#2396ED" d="M12.342 4.536l.15-.227.262.159.116.083c.28.216.869.768.996 1.684.223-.04.448-.06.673-.06.534 0 .893.124 1.097.227l.105.057.068.045.191.156-.066.2a2.044 2.044 0 01-.47.73c-.29.299-.8.652-1.609.698l-.178.005h-.148c-.37.977-.867 2.078-1.702 3.066a7.081 7.081 0 01-1.74 1.488 7.941 7.941 0 01-2.549.968c-.644.125-1.298.187-1.953.185-1.45 0-2.73-.288-3.517-.792-.703-.449-1.243-1.182-1.606-2.177a8.25 8.25 0 01-.461-2.83.516.516 0 01.432-.516l.068-.005h10.54l.092-.007.149-.016c.256-.034.646-.11.92-.27-.328-.543-.421-1.178-.268-1.854a3.3 3.3 0 01.3-.81l.108-.187zM2.89 5.784l.04.007a.127.127 0 01.077.082l.006.04v1.315l-.006.041a.127.127 0 01-.078.082l-.039.006H1.478a.124.124 0 01-.117-.088l-.007-.04V5.912l.007-.04a.127.127 0 01.078-.083l.039-.006H2.89zm1.947 0l.039.007a.127.127 0 01.078.082l.006.04v1.315l-.007.041a.127.127 0 01-.078.082l-.039.006H3.424a.125.125 0 01-.117-.088L3.3 7.23V5.913a.13.13 0 01.085-.123l.039-.007h1.413zm1.976 0l.039.007a.127.127 0 01.077.082l.007.04v1.315l-.007.041a.127.127 0 01-.078.082l-.039.006H5.4a.124.124 0 01-.117-.088l-.006-.04V5.912l.006-.04a.127.127 0 01.078-.083l.039-.006h1.413zm1.952 0l.039.007a.127.127 0 01.078.082l.007.04v1.315a.13.13 0 01-.085.123l-.04.006H7.353a.124.124 0 01-.117-.088l-.006-.04V5.912l.006-.04a.127.127 0 01.078-.083l.04-.006h1.412zm1.97 0l.039.007a.127.127 0 01.078.082l.006.04v1.315a.13.13 0 01-.085.123l-.039.006H9.322a.124.124 0 01-.117-.088l-.006-.04V5.912l.006-.04a.127.127 0 01.078-.083l.04-.006h1.411zM4.835 3.892l.04.007a.127.127 0 01.077.081l.007.041v1.315a.13.13 0 01-.085.123l-.039.007H3.424a.125.125 0 01-.117-.09l-.007-.04V4.021a.13.13 0 01.085-.122l.039-.007h1.412zm1.976 0l.04.007a.127.127 0 01.077.081l.007.041v1.315a.13.13 0 01-.085.123l-.039.007H5.4a.125.125 0 01-.117-.09l-.006-.04V4.021l.006-.04a.127.127 0 01.078-.082l.039-.007h1.412zm1.953 0c.054 0 .1.037.117.088l.007.041v1.315a.13.13 0 01-.085.123l-.04.007H7.353a.125.125 0 01-.117-.09l-.006-.04V4.021l.006-.04a.127.127 0 01.078-.082l.04-.007h1.412zm0-1.892c.054 0 .1.037.117.088l.007.04v1.316a.13.13 0 01-.085.123l-.04.006H7.353a.124.124 0 01-.117-.088l-.006-.04V2.128l.006-.04a.127.127 0 01.078-.082L7.353 2h1.412z"/></svg>',
          'YAML',
        )
      }
      if (/\.(md|markdown)$/i.test(name)) {
        return logo(
          '<svg x="2" y="6.2" width="17" height="9.1" viewBox="0 0 30 16" fill="none" stroke="#3d8fe0" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">'
          + '<path d="M2 14.5V2l6 7 6-7v12.5"/><path d="M23 2v12"/><path d="M18.5 9.5l4.5 4.5 4.5-4.5"/></svg>',
          'Markdown',
        )
      }
      if (/\.php$/i.test(name) && !/\.blade\.php$/i.test(name)) {
        return logo(
          '<svg x="1" y="5.5" width="21" height="10.9" viewBox="1.5 8.5 29 15">'
          + '<path d="M7.6,13.791a2.352,2.352,0,0,1,1.745.483,1.916,1.916,0,0,1,.207,1.66,2.78,2.78,0,0,1-.918,1.748,3.375,3.375,0,0,1-2.07.529h-1.4L6.024,13.8ZM2,22.677H4.3l.545-2.8H6.812A7.049,7.049,0,0,0,8.956,19.6a4.06,4.06,0,0,0,1.53-.918A4.585,4.585,0,0,0,11.93,16.1a3.288,3.288,0,0,0-.55-2.922A3.671,3.671,0,0,0,8.47,12.129H4.057Z" fill="#8993be"/><path d="M13.617,9.323H15.9l-.553,2.8h2.031a3.956,3.956,0,0,1,2.645.669,2.213,2.213,0,0,1,.436,2.167l-.954,4.909H17.195l.908-4.667a1.267,1.267,0,0,0-.114-1.086,1.6,1.6,0,0,0-1.144-.286H15.022l-1.175,6.044H11.559Z" fill="#8993be"/><path d="M25.539,13.791a2.352,2.352,0,0,1,1.745.483,1.916,1.916,0,0,1,.207,1.66,2.78,2.78,0,0,1-.918,1.748,3.375,3.375,0,0,1-2.074.529H23.1l.858-4.416Zm-5.6,8.886h2.3l.545-2.8h1.968A7.049,7.049,0,0,0,26.9,19.6a4.06,4.06,0,0,0,1.53-.918A4.585,4.585,0,0,0,29.869,16.1a3.288,3.288,0,0,0-.55-2.922,3.671,3.671,0,0,0-2.909-1.046h-4.42Z" fill="#8993be"/></svg>',
          'PHP',
        )
      }
      if (/\.(ts|tsx|mts)$/i.test(name)) {
        return logo(
          '<svg x="2" y="6.5" width="14" height="9.8" viewBox="2.5 7.5 25 17.5">'
          + '<path d="M23.827,8.243A4.424,4.424,0,0,1,26.05,9.524a5.853,5.853,0,0,1,.852,1.143c.011.045-1.534,1.083-2.471,1.662-.034.023-.169-.124-.322-.35a2.014,2.014,0,0,0-1.67-1c-1.077-.074-1.771.49-1.766,1.433a1.3,1.3,0,0,0,.153.666c.237.49.677.784,2.059,1.383,2.544,1.095,3.636,1.817,4.31,2.843a5.158,5.158,0,0,1,.416,4.333,4.764,4.764,0,0,1-3.932,2.815,10.9,10.9,0,0,1-2.708-.028,6.531,6.531,0,0,1-3.616-1.884,6.278,6.278,0,0,1-.926-1.371,2.655,2.655,0,0,1,.327-.208c.158-.09.756-.434,1.32-.761L19.1,19.6l.214.312a4.771,4.771,0,0,0,1.35,1.292,3.3,3.3,0,0,0,3.458-.175,1.545,1.545,0,0,0,.2-1.974c-.276-.395-.84-.727-2.443-1.422a8.8,8.8,0,0,1-3.349-2.055,4.687,4.687,0,0,1-.976-1.777,7.116,7.116,0,0,1-.062-2.268,4.332,4.332,0,0,1,3.644-3.374A9,9,0,0,1,23.827,8.243ZM15.484,9.726l.011,1.454h-4.63V24.328H7.6V11.183H2.97V9.755A13.986,13.986,0,0,1,3.01,8.289c.017-.023,2.832-.034,6.245-.028l6.211.017Z" fill="#2f9be0"/></svg>',
          'TypeScript',
        )
      }
      const [base, color] = badge(name)
      const label = name.startsWith('.') ? `.${base.toLowerCase()}` : base
      return logo(
        `<text x="2" y="15" font-family="ui-monospace,Menlo,monospace" font-size="${label.length > 3 ? 9 : label.length > 2 ? 9.5 : 11}" font-weight="700" fill="${color}">${label}</text>`,
        label,
      )
    }
    const folder = (isOpen: boolean) => {
      const src = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="20" viewBox="0 0 28.8 24" fill="none">'
        + `<path d="M3 9.312C3 4.93757 3.93757 4 8.312 4H9.92963C10.5983 4 11.2228 4.3342 11.5937 4.8906L12.4063 6.1094C12.7772 6.6658 13.4017 7 14.0704 7C15.9647 7 17.8145 7 19.1258 7C20.1807 7 21.0128 7.82095 21.0029 8.8758C21.0013 9.05376 21 9.20638 21 9.312V14.688C21 19.0624 20.0624 20 15.688 20H8.312C3.93757 20 3 19.0624 3 14.688V9.312Z" fill="#60a5fa" fill-opacity="${isOpen ? 0.35 : 0.12}" stroke="#60a5fa" stroke-width="1.8"/></svg>`
      return <Svg source={src} alt={isOpen ? 'open folder' : 'folder'} width={24} height={20} />
    }
    const toggle = (path: string) => () => void update($, previewA, p => (p === path ? '' : path))
    const peek = async (path: string, key: string) => {
      const out = await $.process.run(['git', 'diff', '--no-color', '-U3', 'HEAD', '--', path], { cwd, timeoutMs: 5000 })
      const diff = out.exitCode === 0 ? String(out.stdout).split('\n').filter(l => l && !/^(diff |index |--- |\+\+\+ |new file|deleted file)/.test(l)) : []
      const hasDiff = diff.length > 0
      const text = await $.fs.read(path).then(t => String(t), () => '(cannot preview this file)')
      const lineColor = (l: string) => (l.startsWith('+') ? '#4ade80' : l.startsWith('-') ? '#f87171' : undefined)
      return (
        <Box key={key} flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
          {hasDiff && (
            <Box gap={1}>
              <Button key={`pm-c-${key}`} label={showDiff ? '● Changes' : 'Changes'} onPress={() => void update($, diffA, () => true)} />
              <Button key={`pm-f-${key}`} label={showDiff ? 'File' : '● File'} onPress={() => void update($, diffA, () => false)} />
            </Box>
          )}
          {hasDiff && showDiff
            ? diff.slice(0, 120).map((l, i) => (
                <Text key={`${key}-l${i}`} color={lineColor(l)} backgroundColor={l.startsWith('+') ? '#4ade8022' : l.startsWith('-') ? '#f8717122' : undefined} dimColor={l.startsWith('@@')}>{l}</Text>
              ))
            : <Code source={text.split('\n').slice(0, 120).join('\n')} path={path} />}
        </Box>
      )
    }

    const rows: unknown[] = []
    const MAX_ROWS = 120
    let cut = false
    const walk = async (dir: string, depth: number): Promise<void> => {
      let entries = await $.fs.list(dir).catch(() => [])
      if (!showHidden) entries = entries.filter(x => !x.name.startsWith('.'))
      entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
      for (const x of entries) {
        if (rows.length >= MAX_ROWS) {
          cut = true
          return
        }
        const path = dir === '.' ? x.name : `${dir}/${x.name}`
        const guides = depth > 0 ? <Text>{'\u00a0'.repeat(4 * depth)}</Text> : null
        if (x.kind === 'dir') {
          const isOpen = open.includes(path)
          rows.push(
            <Box key={`d-${path}`} flexWrap="nowrap" alignItems="center" gap={0}>
              {guides}
              <Button plain key={`caret:${path}`} label={isOpen ? '▾' : '▸'}
                onPress={() => void update($, openA, list => (list.includes(path) ? list.filter(d => d !== path) : [...list, path]))} />
              {folder(isOpen)}
              <Button plain key={`dir:${path}`} label={x.name}
                onPress={() => void update($, openA, list => (list.includes(path) ? list.filter(d => d !== path) : [...list, path]))} />
            </Box>,
          )
          if (isOpen) await walk(path, depth + 1)
        } else {
          rows.push(
            <Box key={`f-${path}`} flexWrap="nowrap" alignItems="center" gap={0}>
              {guides}
              <Text>{'\u00a0\u00a0'}</Text>
              {chip(x.name, path)}
              <Button plain key={`fb-${path}`} label={x.name} onPress={toggle(path)} />
              {showSizes && <Text dimColor> {size(x.size)}</Text>}
            </Box>,
          )
          if (preview === path) rows.push(await peek(path, `p-${path}`))
        }
      }
    }

    if (query) {
      const ls = await $.process.run(['git', 'ls-files', '-co', '--exclude-standard'], { cwd, timeoutMs: 5000 })
      const q = query.toLowerCase()
      String(ls.stdout).split('\n').filter(p => p && p.toLowerCase().includes(q)).slice(0, 50).forEach(p =>
        rows.push(
          <Box key={`s-${p}`} alignItems="center" gap={0}>
            {chip(base(p), p)}
            <Button plain key={`sb-${p}`} label={base(p)} onPress={toggle(p)} />
            <Text dimColor> {parent(p)}</Text>
          </Box>,
        ),
      )
    } else {
      await walk('.', 0)
      if (cut) rows.push(<Text key="cut" dimColor>Showing the first {MAX_ROWS} rows. Collapse folders or search to see more.</Text>)
    }

    const busy = current != null
    const verb = current && EDIT.includes(current.tool) ? 'editing' : 'reading'
    const headline = busy
      ? `Claude is ${verb} ${base(current.path)}`
      : touched.length
        ? `Claude touched ${touched.length} file${touched.length === 1 ? '' : 's'}`
        : 'Waiting for Claude'
    const accent = busy ? PURPLE : ORANGE

    const status = (kind: Touch['kind']) => {
      const label = kind === 'edited' ? 'Edited' : 'Opened'
      const color = kind === 'edited' ? ORANGE : PURPLE
      const src = '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="22" viewBox="0 0 56 22">'
        + `<rect x="0.5" y="3.5" width="55" height="15" rx="7.5" fill="${color}" fill-opacity="0.18"/>`
        + `<text x="28" y="14.2" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="9.5" font-weight="700" fill="${color}">${label}</text></svg>`
      return <Svg source={src} alt={label} width={56} height={22} />
    }
    const touchedRows: unknown[] = []
    for (const t of touched) {
      touchedRows.push(
        <Box key={`t-${t.path}`} alignItems="center" justifyContent="space-between">
          <Box alignItems="center" gap={0}>
            {chip(base(t.path), rel(cwd, t.path))}
            <Button plain key={`tb-${t.path}`} label={base(t.path)} onPress={toggle(t.path)} />
            <Text dimColor> {parent(rel(cwd, t.path))}</Text>
          </Box>
          {status(t.kind)}
        </Box>,
      )
      if (preview === t.path) touchedRows.push(await peek(t.path, `tp-${t.path}`))
    }

    const gs = await $.process.run(['git', 'status', '--porcelain', '-b'], { cwd, timeoutMs: 5000 })
    const gsLines = gs.exitCode === 0 ? String(gs.stdout).split('\n').filter(Boolean) : []
    const liveBranch = (gsLines[0] ?? '').replace(/^## /, '').split('...')[0]
    const changed = gs.exitCode === 0
      ? gsLines.slice(1).map(l => ({
          code: l.slice(0, 2).trim() || '?',
          path: l.slice(3).split(' -> ').pop() as string,
        }))
      : []
    const codeColor = (c: string) => (c.startsWith('D') ? '#f87171' : c.startsWith('M') ? YELLOW : '#4ade80')
    const ns = await $.process.run(['git', 'diff', '--numstat', 'HEAD'], { cwd, timeoutMs: 5000 })
    const counts = new Map<string, [number, number]>()
    for (const l of String(ns.stdout).split('\n').filter(Boolean)) {
      const [a, d, ...rest] = l.split('\t')
      counts.set(rest.join('\t'), [Number(a) || 0, Number(d) || 0])
    }
    const delta = (add: number, del: number) => {
      const a = `+${add}`
      const d = `-${del}`
      const w = (a.length + d.length) * 7 + 26
      const src = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="24" viewBox="0 0 ${w} 24">`
        + `<rect x="0.5" y="2.5" width="${w - 1}" height="19" rx="7" fill="#ffffff" fill-opacity="0.08"/>`
        + `<text x="10" y="16" font-family="ui-monospace,Menlo,monospace" font-size="12" font-weight="700" fill="#4ade80">${a}</text>`
        + `<text x="${10 + a.length * 7 + 8}" y="16" font-family="ui-monospace,Menlo,monospace" font-size="12" font-weight="700" fill="#f87171">${d}</text></svg>`
      return <Svg source={src} alt={`${add} added, ${del} removed`} width={w} height={24} />
    }
    const changeRows: unknown[] = []
    let totalAdd = 0
    let totalDel = 0
    const LIMIT = 60
    for (const [i, c] of changed.entries()) {
      let [add, del] = counts.get(c.path) ?? [0, 0]
      if (!counts.has(c.path) && c.code === '?' && i < 300) {
        const body = await $.fs.read(c.path).then(t => String(t), () => '')
        add = body ? body.split('\n').length - (body.endsWith('\n') ? 1 : 0) : 0
      }
      totalAdd += add
      totalDel += del
      if (i >= LIMIT) continue
      changeRows.push(
        <Box key={`c-${c.path}`} alignItems="center" justifyContent="space-between">
          <Box alignItems="center" gap={1}>
            <Text bold color={codeColor(c.code)}>{c.code.padEnd(2, '\u00a0')}</Text>
            <Button plain key={`cb-${c.path}`} label={base(c.path)} onPress={toggle(c.path)} />
            <Text dimColor>{parent(c.path)}</Text>
          </Box>
          {delta(add, del)}
        </Box>,
      )
      if (expandAll || preview === c.path) changeRows.push(await peek(c.path, `cp-${c.path}`))
    }
    if (changed.length > LIMIT) {
      changeRows.push(<Text key="c-more" dimColor>+ {changed.length - LIMIT} more {changed.length - LIMIT === 1 ? 'file' : 'files'} not shown</Text>)
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column" borderStyle="round" borderColor={accent} paddingX={1}>
          <Text bold color={accent}>{busy ? 'RIGHT NOW' : touched.length ? 'DONE' : 'IDLE'}</Text>
          <Text bold>{headline}</Text>
          {busy && <Text dimColor>in {parent(rel(cwd, current.path))}</Text>}
          <Text>
            <Text bold>{liveBranch || branch || 'no git'}</Text>
            <Text dimColor>{'  '}{changed.length ? `${changed.length} uncommitted` : 'clean, nothing changed'}</Text>
          </Text>
          <Text>
            <Text color={PURPLE}>● </Text><Text>Claude read  </Text>
            <Text color={ORANGE}>● </Text><Text>Claude edited  </Text>
            <Text color={YELLOW}>● </Text><Text>Not committed</Text>
          </Text>
        </Box>

        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
          <Box justifyContent="space-between">
            <Text bold dimColor>CLAUDE TOUCHED</Text>
            <Text bold dimColor>{touched.length} {touched.length === 1 ? 'FILE' : 'FILES'}</Text>
          </Box>
          {touched.length === 0 && <Text dimColor>Nothing yet.</Text>}
          {touchedRows as never}
        </Box>

        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
          <Box justifyContent="space-between" alignItems="center">
            <Text bold dimColor>GIT CHANGES</Text>
            <Box alignItems="center" gap={1}>
              {changed.length > 0 && (
                <Button key="expand-all" label={expandAll ? 'Collapse diffs' : 'Expand all diffs'} onPress={() => void update($, expandA, v => !v)} />
              )}
              {delta(totalAdd, totalDel)}
              <Text bold dimColor>{changed.length} {changed.length === 1 ? 'FILE' : 'FILES'}</Text>
            </Box>
          </Box>
          {changed.length === 0 && <Text dimColor>Working tree clean.</Text>}
          {changeRows as never}
        </Box>

        <Input key="find" placeholder="Find a file" value={query}
          onInput={v => void update($, queryA, () => v)} onSubmit={v => void update($, queryA, () => v)} />

        <Box gap={1} flexWrap="wrap">
          <Button key="refresh" label="Refresh" onPress={async () => { await refreshGit($); await update($, tickA, n => n + 1) }} />
          <Button key="collapse" label="Collapse all" onPress={() => void update($, openA, () => [])} />
          <Button key="sizes" label={showSizes ? 'Hide sizes' : 'Show sizes'} onPress={() => void update($, sizesA, v => !v)} />
          <Button key="project" label="Back to project" onPress={() => void update($, openA, () => [])} />
          <Button key="hidden" label={showHidden ? 'Hide hidden files' : 'Show hidden files'} onPress={() => void update($, hiddenA, v => !v)} />
        </Box>

        <Box flexDirection="column">
          <Box justifyContent="space-between">
            <Text bold dimColor>{query ? 'SEARCH RESULTS' : 'ALL FILES'}</Text>
            <Text bold dimColor>{base(cwd).toUpperCase()}</Text>
          </Box>
          {rows as never}
        </Box>
      </Box>
    )
  })
}
