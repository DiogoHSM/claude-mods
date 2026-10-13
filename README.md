# claude-mods

Mods pessoais para Claude Code (terminal e aba Code do app desktop).

## Mods

| Mod | O que faz |
|---|---|
| `task-progress` | Barra de progresso acima do prompt com passo atual, contador (3/7) e cor que vai do vermelho ao verde. `/progresso-demo` simula 7 passos. |

## Instalação

Local:

```bash
claude plugin marketplace add ~/Developer/Github/claude-mods
claude plugin install task-progress@diogo-mods --scope user
```

Depois de editar um mod, rode `/reload-plugins`.

## Validação

```bash
claude plugin validate task-progress
claude plugin test task-progress
```
