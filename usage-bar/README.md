# usage-bar

Shows your 5-hour and weekly usage limits in a band above the prompt, in `#FF8200`:

```
5h ██░░░░░░░░ 24%  resets 3:40 PM   ·   7d ████░░░░░░ 41%  resets Mon 9:00 AM
```

## Install

```
/plugin install usage-bar --marketplace dookers-code/dooks-mods
```

## Toggle

Run `/usage-bar` to hide or show the band. The choice is remembered across sessions.

## Notes

- The figures are the ones Claude Code receives with each API response, so the band appears after the first reply in a session and updates whenever a window moves a whole point. A response that carries no figures leaves the last reading in place.
- Only shows on a Claude subscription. API-key sessions report no rate limits, so the band stays hidden.
- Mods can't draw in the desktop app's sidebar, so the band sits above the prompt instead.
