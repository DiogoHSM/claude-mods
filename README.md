# claude-mods

Mods pessoais para Claude Code (terminal e aba Code do app desktop).

## Mods

| Mod | O que faz |
|---|---|
| `agentes-pixel` | Painel lateral com pixel art de cada subagent (modelo, status, tempo, tokens, resumo), bolinhas de status das tarefas e barra do plano acima do prompt. `/agentes` reabre o painel. |
| `polimento-visual` | Pill de contexto usado/total abaixo do prompt, borda laranja nas suas mensagens e ícones coloridos por tipo de ferramenta. |

## Instalação

```bash
claude plugin marketplace add DiogoHSM/claude-mods
claude plugin install agentes-pixel@diogo-mods --scope user
claude plugin install polimento-visual@diogo-mods --scope user
```

Ou, no prompt do Claude Code:

```
/plugin install agentes-pixel --marketplace DiogoHSM/claude-mods
/plugin install polimento-visual --marketplace DiogoHSM/claude-mods
```

No app desktop: **+** ao lado do prompt → **Plugins** → **Add marketplace** com `DiogoHSM/claude-mods` → **Add plugin**.

### Desenvolvimento local

```bash
claude plugin marketplace add ~/Developer/Github/claude-mods
claude plugin install agentes-pixel@diogo-mods --scope user
```

Depois de editar um mod, rode `/reload-plugins`.

## Validação

```bash
claude plugin validate agentes-pixel
claude plugin test agentes-pixel
```
