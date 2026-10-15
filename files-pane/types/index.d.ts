export type Touch = { path: string; kind: 'read' | 'edited' }
export type Current = { tool: string; path: string } | null
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

declare module 'claude-code' {
  interface PluginState {
    'files-pane': {
      cwd: string
      preview: string
      previewDiff: boolean
      expandAll: boolean
      snapshot: Record<string, string>
      head: string
      touched: Touch[]
      current: Current
      query: string
      open: string[]
      showHidden: boolean
      showSizes: boolean
      branch: string
      changes: number
      tick: number
      usage: Limit[]
    }
  }
}
