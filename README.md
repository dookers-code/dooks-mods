# dooks-mods

Personal Claude Code mods.

| Mod | What it does |
| --- | --- |
| [files-pane](files-pane) | Files pane with a status card, Claude-touched list, git changes with diffs, and a file tree |

## Install

In a terminal Claude Code session:

```
/plugin install files-pane --marketplace dookers-code/dooks-mods
```

Answer `y` to add the marketplace, then pick the user scope. Toggle the pane with `/file-pane`. See [files-pane](files-pane) for requirements, limits and updating.

## Adding a mod

Make a folder for it beside `files-pane/` and add an entry to the `plugins` array in `.claude-plugin/marketplace.json`:

```json
{ "name": "my-mod", "source": "./my-mod" }
```

## License

MIT, see [LICENSE](LICENSE). Third-party logos in `files-pane` are not covered by it.
