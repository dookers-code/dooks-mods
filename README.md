# dooks-mods

Personal Claude Code mods.

| Mod | What it does |
| --- | --- |
| [files-pane](files-pane) | Files pane with a status card, Claude-touched list, git changes with diffs, and a file tree |

## Install

In a terminal Claude Code session:

```
/plugin install files-pane --marketplace <owner>/dooks-mods
```

Answer `y` to add the marketplace, then pick the user scope.

## Adding a mod

Make a folder for it beside `files-pane/` and add an entry to the `plugins` array in `.claude-plugin/marketplace.json`:

```json
{ "name": "my-mod", "source": "./my-mod" }
```
