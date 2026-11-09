# claude-mods

Mods for Claude Code (the terminal and the Code tab of the desktop app).

## Mods

| Mod | What it does |
|---|---|
| `pixel-agents` | Side pane with a pixel-art creature for each subagent (model, status, time, tokens, summary), task status dots, and a plan bar above the prompt. `/pixel-agents` reopens the pane. |
| `visual-polish` | Context used/total pill under the prompt, a colored border on your messages, and colored icons per tool type. |

## Install

```bash
claude plugin marketplace add DiogoHSM/claude-mods
claude plugin install pixel-agents@diogo-mods --scope user
claude plugin install visual-polish@diogo-mods --scope user
```

Or, at the Claude Code prompt:

```
/plugin install pixel-agents --marketplace DiogoHSM/claude-mods
/plugin install visual-polish --marketplace DiogoHSM/claude-mods
```

In the desktop app: **+** next to the prompt → **Plugins** → **Add marketplace** with `DiogoHSM/claude-mods` → **Add plugin**.

Mods run where Claude Code runs, so an SSH session needs them installed on the remote machine too.

### Updating

```bash
claude plugin marketplace update diogo-mods
```

Then run `/reload-plugins`.

### Border color per machine

`visual-polish` has a `borderColor` option (default `claude`, the orange). Use a different color on each machine, for example in an SSH session, to see at a glance where you are working:

```bash
echo '{"borderColor":"#3B82F6"}' | claude plugin configure visual-polish@diogo-mods --values-stdin
```

Or inside Claude Code: `/plugin configure visual-polish@diogo-mods`. Accepts theme colors (`claude`, `success`, `warning`, `error`, `suggestion`) or hex.

## Local development

```bash
claude plugin marketplace add ~/Developer/Github/claude-mods
claude plugin install pixel-agents@diogo-mods --scope user
```

After editing a mod, run `/reload-plugins`.

```bash
claude plugin validate pixel-agents
claude plugin test pixel-agents
```
