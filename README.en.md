# dsh-auto-translate

English | [中文](README.md)

Full-pipeline Chinese translation for the **DeepSeek Harness Web GUI**. When
the model is thinking (the Think disclosure), writing its final reply, or
producing tool output, English content gets a Chinese rendering **in place** —
translated live while the model is still streaming. Every translation is a
standalone provider request that **never enters the session transcript**: no
context window cost, no conversation-history pollution.

> **Install (one command):**
> ```
> dsh plugin add qwert702/dsh-auto-translate
> ```
> Restart the harness (`dsh web`) and refresh the page.

## Features

- **Live reasoning translation** — inside each Think disclosure row, the
  expanded body shows the original thinking text followed by a Chinese
  translation; while the model is still reasoning the translation updates on a
  debounced cadence, and once the step settles the full text is translated
  once and cached.
- **Inline reply translation** — every English text block gets a small
  Chinese line (with a `译` badge) directly beneath it. Chinese replies and
  code-dominated output are skipped heuristically.
- **Tool-output summaries** — below every tool call card, a `译` line
  summarizes the tool's text output in Chinese (a summary, not a line-by-line
  translation of raw output). This renders below both dedicated tool views
  (bash / web / read …) and the fallback card for unknown tools.
- **Tool glosses** — the fallback card's header annotates
  `tool — 中文含义` from a built-in glossary covering the harness's toolset
  (bash / read / write / edit / glob / grep / web_search / todo_write /
  ask_user_question / skill / goal / subagent / workflow / cordis_* ...).
- **Zero context cost** — translation and summary requests are standalone
  provider `/chat/completions` calls made by the node half, fully outside the
  agent loop; the plugin adds no prompts, tools, or messages to any
  conversation and never rewrites a model request.
- **Configurable model** — defaults to the current conversation's model; an
  override can be set in settings. When the conversation model id is unknown
  to the provider, the host retries once with `deepseek-chat`.

## How it works (shadow rendering, no slot replacement)

The chat view has no additive seat inside a message, so the plugin uses the
ecosystem's **shadow registration** technique: it registers `assistant-step`
and `tool-call` renderers on `conversation.chat.node` at `priority: -100`,
which shadows the harness's `priority: 0` defaults. The renderers rebuild the
default presentation from public primitives (`MarkdownText` / `DisclosureRow`
/ `JsonBlock` from `dsh-client-ui-primitives`, `ImageGallery` from
`dsh-client-ui-attachment`) and keep the `tool.call.toolview` sub-slot
dispatch, so dedicated tool views (bash / web / read …) are preserved as-is.
If a shadow renderer crashes it abdicates and the harness default takes over
transparently. This is the same approach as the `dsh-better-markdown` plugin.

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

- `lib/index.js` — node half: settings namespace + `POST /api/auto-translate/translate` route (standalone translate/summarize requests, `mode: translate | summarize`, with a model fallback).
- `lib/client.js` — browser half: two shadow registrations (`assistant-step` and `tool-call` at `priority: -100`) plus the in-place translation components (inside the think row, under text blocks, below tool cards).
- `test/smoke.cjs` — `node test/smoke.cjs`: syntax checks, host route paths (disabled / bad-request / empty / no-key / ok / summarize / model-fallback), client shadow-registration assertions, and ReactDOMServer renders (thinking / text / streaming / tool card).

## Known limitations

- **Conflicts with dsh-better-markdown** — both shadow `assistant-step` at
  `priority: -100`; installing both throws a duplicate-key error at startup.
  Install one; to coexist, change one side's priority.
- **Owns the default rendering** — shadowing means the thinking/text block
  presentation is maintained by this plugin; a dsh upgrade that changes the
  internal rendering may need an adaptation (a crash abdicates to the
  harness default, so nothing breaks silently).
- **Streaming translations are provisional** — while output is still
  streaming, the translation reflects the text seen so far and updates on a
  debounced cadence; when output stops it is re-translated from the full text.
- **Tool summaries cover text blocks only** — images and binary output are
  not translated; long outputs are truncated (`maxInputChars`) first.
- **Heuristics** — replies shorter than ~10 letters, CJK/latin mixed text,
  and code-dominated output are not translated (`isEnglishProse` /
  `isMostlyCode` in `lib/client.js`).
- **Cache** — translations are cached in browser memory per node/call
  identity; a page refresh re-requests the same content.
- **Settings UI** — configured through `settings.yaml`; no settings panel yet.

## License

MIT
