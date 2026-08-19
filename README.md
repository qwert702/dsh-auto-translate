# dsh-auto-translate

Auto-translate for the **DeepSeek Harness Web GUI**. When the assistant's reply
is in English, a Chinese translation appears below the turn; each tool call in
the turn gets a one-line Chinese gloss. The translation is a standalone
provider request that **never enters the session transcript** — no context
window cost, no conversation-history pollution.

> **Install (one command):**
> ```
> dsh plugin add qwert702/dsh-auto-translate
> ```
> Restart the harness (`dsh web`) and refresh the page.

## Features

- **English reply auto-translation** — for each completed turn, when the
  closing assistant text reads as English (Latin-heavy, no substantial CJK), a
  Chinese translation strip (with a `译` badge) renders below the turn.
  Chinese replies and code-dominated output are skipped heuristically.
- **Tool-call glosses** — each tool call in the turn (deduplicated by name,
  first occurrence order) gets a small line `tool — 中文含义` below the turn,
  resolved from a built-in glossary covering the harness's toolset
  (bash / read / write / edit / glob / grep / web_search / todo_write /
  ask_user_question / skill / goal / subagent / workflow / cordis_* ...).
  Unknown tools are labeled `自定义工具` instead of inventing a meaning.
- **Zero context cost** — the translation is an independent provider
  `/chat/completions` call made by the node half, fully outside the agent
  loop; the plugin adds no prompts, tools, or messages to any conversation.
- **Configurable model** — defaults to the current conversation's model; an
  override can be set in settings. When the conversation model id is unknown
  to the provider, the host retries once with `deepseek-chat`.

## Settings (optional)

Add a `dsh-auto-translate` namespace to `~/.dsh/settings.yaml`:

```yaml
dsh-auto-translate:
  enabled: true          # master switch
  model: ''              # '' = follow the current conversation's model; or e.g. deepseek-chat / deepseek-reasoner
  apiKeyRef: DEEPSEEK_API_KEY   # credential reference resolved by the harness credentials service
  baseURL: https://api.deepseek.com
  temperature: 0.3       # sampling temperature for translation requests
  maxInputChars: 4000    # input truncation guard
```

All fields default as above. The API key stays server-side — it is resolved
through the harness credentials service and never leaves the host.

## Repo layout

- `lib/index.js` — node half: settings namespace + `POST /api/auto-translate/translate` route (standalone translation request with a model fallback).
- `lib/client.js` — browser half: a chain entry on the additive
  `conversation.chat.turnTail` seat (nothing in the stock UI is replaced).
- `test/smoke.cjs` — `node test/smoke.cjs`: syntax checks, host route paths
  (disabled / bad-request / empty / no-key / ok / model-fallback / settings
  override), and the client chain registration.

## Known limitations

- **Placement** — the chat view has no additive seat directly below each tool
  call, so the tool glosses and the translation strip render together at the
  end of the turn (the only additive position), before the turn's icon actions.
- **Heuristics** — replies shorter than ~10 letters, CJK/latin mixed text, and
  code-dominated output are not translated (`isEnglishProse` / `isMostlyCode`
  in `lib/client.js`).
- **Cache** — translations are cached in browser memory per turn; a page
  refresh re-requests the same turn.
- **Settings UI** — configured through `settings.yaml`; no settings panel yet.

## License

MIT
