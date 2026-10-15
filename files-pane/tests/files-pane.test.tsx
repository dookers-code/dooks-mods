import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-15T12:00:00Z')
const PROPS = { title: 'Files', isFocused: false, bodyColumns: 80 }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`Claude touched starts over on each prompt on ${surface}`, async ($, on) => {
    mock.clock(on, { now: NOW })
    on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
    on('fs.list', () => ({ value: [] }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    on('command.register', () => ({ value: { command: 'file-pane' } }))
    on('ui.open', () => ({ value: { isPlaced: false } }) as never)
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
}
