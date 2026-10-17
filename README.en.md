# dsh-auto-translate

English | [中文](README.md)

Full-pipeline Chinese translation for the **DeepSeek Harness Web GUI**.

> **Compatibility** — this release (0.3.0) targets **harness 0.2.0-rc.2** (client
> contract 0.2.0). For harness 0.1.7-rc.2 and earlier use version 0.2.1.

When the model is thinking (the Think disclosure), writing its final reply, or
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
- **Tool-output summaries** — for every settled tool call, a line
  `tool — 中文含义` plus a `译` summary renders at the turn tail, summarizing
  the tool's text output in Chinese (a summary, not a line-by-line translation
  of raw output). The summary lives at the turn tail instead of inside the card
  because the chat view has no additive seat inside a tool card, and the
  tool-call renderer cannot be shadowed without losing the dedicated tool views
  (bash / web / read …) — see below.
- **Zero context cost** — translation and summary requests are standalone
  provider `/chat/completions` calls made by the node half, fully outside the
  agent loop; the plugin adds no prompts, tools, or messages to any
  conversation and never rewrites a model request.
- **Configurable model** — defaults to the current conversation's model; an
  override can be set in the profile entry config. When the conversation model
  id is unknown to the provider, the host retries once with `deepseek-chat`.

## How it works (shadow rendering, no slot replacement)

The chat view has no additive seat inside a message, so the plugin uses the
ecosystem's **shadow registration** technique: it registers the
`assistant-step` renderer on `conversation.chat.node` at `priority: -100`,
which shadows the harness's `priority: 0` default and owns the in-place
reasoning and reply translations. In 0.2.0 that seat belongs to
`@deepseek-ai/dsh-client-ui-chat`.

The shadow renderer mirrors the 0.2.0 `AssistantNodeView` / `AssistantMarkdown`
contract:

- It rebuilds the structure from public primitives only — `MarkdownText` /
  `DisclosureRow` / `JsonBlock` from `@deepseek-ai/dsh-client-ui-primitives` —
  and takes the framework-synthesized `t` seat from the entry's declared
  `locale: 'chat'`, falling back to Chinese when a key is missing.
- It honours the `groupPart` split (Turn-process renders the same assistant
  node twice, once for `reasoning` and once for `response`) and the
  Turn-process fold: while folded, the inline reasoning block is marked
  `hidden="until-found"` exactly like the official renderer, so in-page find
  expands it.
- It uses the real 0.2.0 data shapes: the three-state
  `status: running | settled | interrupted`, `blocks` (`text` / `reasoning` /
  `image` / `tool-call` / `other`) and `finalNode.providerMetadata.model`.
- Image blocks go through the official message-images seat by calling the
  `renderMessageImages` callback the Chat view hands down (that is
  `conversation.message.images`, filled by
  `@deepseek-ai/dsh-client-ui-attachment`). 0.2.0's ui-attachment no longer
  exports `ImageGallery`, so the plugin no longer renders images itself.

**The `tool-call` node is deliberately NOT shadowed**: its default renderer
owns the sole declaration of the `tool.call.toolview` child slot (slot
declarations are globally unique), so shadowing it either loses the dedicated
tool views (bash / web / read …) or throws a duplicate-declaration error at
startup. Tool summaries therefore ride the additive
`conversation.chat.turnTail` seat — a `list` seat in 0.2.0, whose owner props
are `{ turn: TurnLocation, seq, openFile }` — and read the Chat snapshot
through the `useChat` standard hook (`locations.getTurn` + `nodes.get`),
rendering before the turn's action row.

If a shadow renderer crashes — or meets a node shape it does not know (it
**throws instead of rendering blank**) — the renderer's error boundary
abdicates the entry and the official `priority: 0` renderer takes over
transparently; the message is never lost.

## Configuration (optional)

Configuration uses the harness 0.2.0 profile-entry `config` channel (the
plugin's `Config` export; the `settings.register()` namespace was removed in
0.1.7+). Override the `ui-auto-translate` entry's config in your profile patch
layer `~/.dsh/profiles/<profile>/cordis.patch.yml`:

```yaml
- id: ui-auto-translate
  config:
    enabled: true                # master switch
    model: ''                    # '' = follow the current conversation's model
    apiKeyRef: DEEPSEEK_API_KEY  # credential reference resolved by the harness credentials service
    baseURL: https://api.deepseek.com
    temperature: 0.3             # sampling temperature for translation requests
    maxInputChars: 4000          # input truncation guard
```

All fields default as above; restart the harness after changing them. The API
key stays server-side — it is resolved through the harness credentials service
and never leaves the host.

## Repo layout

- `lib/index.js` — node half: the `Config` export (loader config channel) plus the `POST /api/auto-translate/translate` route (standalone translate/summarize requests, `mode: translate | summarize`, with a model fallback); `inject = ['webServer', 'credentials']`.
- `lib/client.js` — browser half: the `assistant-step` shadow registration (`priority: -100` with the `locale: 'chat'` seat, in-place reasoning/reply translations) plus the additive `conversation.chat.turnTail` entry (tool-output summaries).
- `test/smoke.cjs` — `node test/smoke.cjs`: syntax checks; host (Config export, every route path: bad-request / empty / no-key / ok / summarize / model fallback / config overrides / disabled); client (both seat registrations, label fallback, `collectTurnTools`, and ReactDOMServer renders: reasoning / text / unknown block / `groupPart` split / Turn-process fold / collapsed reasoning / images / streaming / interrupted / malformed-node abdication / tool summary / missing-`useChat` degradation).

## Known limitations

- **Conflicts with dsh-better-markdown** — both shadow `assistant-step` at
  `priority: -100`; installing both throws a duplicate-key error at startup.
  Install one; to coexist, change one side's priority.
- **Images depend on the official seat** — message images render through the
  official `conversation.message.images` seat (ui-attachment). When that plugin
  is not part of the composition, `renderMessageImages` is absent and image
  blocks are **skipped** (the official view omits images under the same
  condition); nothing crashes.
- **Local-path images in Markdown are not resolved** — the official 0.2.0
  `AssistantMarkdown` hands down a `pathImages` resolver that turns local file
  paths into displayable URLs; this plugin does not take that resolver over, so
  images authored as local paths stay inert alt text (absolute `http(s)` images
  render normally).
- **The "work details" presentation policy is not read** — the official
  reasoning row consults that policy to decide whether a settled summary
  preview shows; this plugin's shadow always shows the summary line. The
  difference is limited to that one cosmetic detail.
- **Tool summaries live at the turn tail, not inside cards** — the chat view
  has no additive seat inside a tool card and the `tool-call` renderer cannot
  be shadowed without losing the dedicated tool views, so summaries render at
  the turn tail.
- **Owns the default rendering** — shadowing means the thinking/text block
  presentation is maintained by this plugin; a dsh upgrade that changes the
  internal rendering may need an adaptation (a crash abdicates to the harness
  default, and an unrecognized node shape throws on purpose so abdication
  always happens).
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
- **No settings UI** — configured through the profile entry `config`; no
  settings panel yet.

## License

MIT
