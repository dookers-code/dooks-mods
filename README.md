# dooks-mods

Personal Claude Code mods.

| Mod | What it does | Toggle |
| --- | --- | --- |
| [files-pane](files-pane) | Files pane with a status card, the files Claude touched for your latest prompt, git changes with diffs, and a file tree | `/file-pane` |
| [usage-bar](usage-bar) | Your 5-hour session and weekly usage limits above the prompt, with the time left until each resets | `/usage-bar` |

## Install

Run these in any terminal, then restart Claude Code. The mods load in both the terminal and the desktop app.

Add the marketplace once:

```bash
claude plugin marketplace add dookers-code/dooks-mods
```

Then install the mods you want:

```bash
claude plugin install files-pane@dooks-mods
```

```bash
claude plugin install usage-bar@dooks-mods
```

## Update

```bash
claude plugin marketplace update dooks-mods
```

```bash
claude plugin update files-pane@dooks-mods
```

```bash
claude plugin update usage-bar@dooks-mods
```

Restart Claude Code after updating.

## Remove

```bash
claude plugin uninstall files-pane@dooks-mods
```

```bash
claude plugin uninstall usage-bar@dooks-mods
```

## License

MIT, see [LICENSE](LICENSE). Third-party logos in `files-pane` are not covered by it.
