//#region lib/index.js
/**
 * Auto-translate plugin, node half. Hosts the standalone translation endpoint
 * the browser half calls: `POST /api/auto-translate/translate` reads its
 * configuration from the harness settings namespace `dsh-auto-translate`
 * (feature switch, model override, credential reference, provider base URL),
 * resolves the API key through the credentials service, and makes an
 * independent provider request.
 *
 * The translation never enters the session transcript: the call is a bare
 * provider chat-completions request carrying only the text to translate, and
 * this plugin adds no prompt content, tools, or messages to any conversation —
 * the conversation's own context is untouched (same discipline as the
 * token-viewer plugin).
 */
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

const name = 'dsh-auto-translate-host'
const inject = ['webServer', 'credentials', 'settings']

/** Settings namespace holding the translation proxy configuration. */
const NS = settingsNamespace('dsh-auto-translate')
/**
 * Schema: the feature switch, the model override (empty = follow the current
 * conversation's model, falling back to the provider's generic chat model),
 * which credential reference resolves the API key, the provider base URL,
 * the translation temperature, and the input truncation guard.
 */
const SCHEMA = z.object({
  enabled: z.boolean().default(true),
  model: z.string().default(''),
  apiKeyRef: z.string().default('DEEPSEEK_API_KEY'),
  baseURL: z.string().default('https://api.deepseek.com'),
  temperature: z.number().default(0.3),
  maxInputChars: z.number().default(4000),
})
/** Composition defaults when the settings namespace is absent. */
const DEFAULTS = {
  enabled: true,
  model: '',
  apiKeyRef: 'DEEPSEEK_API_KEY',
  baseURL: 'https://api.deepseek.com',
  temperature: 0.3,
  maxInputChars: 4000,
}

/** Reject bodies over 256 KiB before buffering. */
const MAX_BODY_BYTES = 256 * 1024
/** Provider model used when no override is set and no conversation model is supplied. */
const FALLBACK_MODEL = 'deepseek-chat'
/** Provider request timeout. */
const REQUEST_TIMEOUT_MS = 30000

/**
 * Buffer the request body as UTF-8 text.
 * @param req - the incoming request stream.
 * @returns the decoded body.
 */
async function readBody(req) {
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Write a JSON response the handler fully owns.
 * @param res - the response.
 * @param status - HTTP status.
 * @param payload - JSON-serializable payload.
 */
function send(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

/**
 * Normalize a model id for the provider chat-completions endpoint. The
 * conversation's model id is passed through verbatim (the provider accepts
 * the harness's own model ids when they exist); only an empty value is
 * replaced with the generic chat model.
 * @param model - the requested model id, or empty.
 * @returns the provider model id.
 */
function normalizeModel(model) {
  const m = (model ?? '').trim()
  return m === '' ? FALLBACK_MODEL : m
}

/**
 * One provider call. The prompt asks for the translation (or, for tool
 * outputs, a concise Chinese summary) alone — no preface, no explanation, no
 * code-fence markers — so the rendered text drops straight into the UI strip.
 * @param baseURL - provider base URL.
 * @param apiKey - resolved API key.
 * @param model - provider model id.
 * @param text - the text to translate (already truncated).
 * @param temperature - sampling temperature.
 * @param mode - 'translate' renders the text in Chinese; 'summarize' produces
 *   a concise Chinese summary (used for tool outputs, which are data).
 * @returns the translated text.
 */
async function callProvider(baseURL, apiKey, model, text, temperature, mode) {
  const instruction = mode === 'summarize'
    ? '请用简体中文概括下面内容的要点，语言精炼，用项目符号列出关键信息；代码、标识符、路径、命令保持原样。只输出概括本身，不要任何解释、前后缀或代码块标记。'
    : '请把下面这段英文翻译成简体中文。只输出译文本身，不要任何解释、前后缀或代码块标记；代码、标识符、路径、命令保持原样。'
  const response = await fetch(`${baseURL.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: `${instruction}\n\n${text}`,
        },
      ],
      temperature,
      max_tokens: 4096,
      stream: false,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`provider http ${response.status}: ${detail.slice(0, 300)}`)
  }
  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.trim() === '') throw new Error('provider returned an empty completion')
  return content.trim()
}

/**
 * Handle `POST /api/auto-translate/translate`. The body carries `text` and an
 * optional `model` hint (the current conversation's model id); the response
 * carries only the translation — never the API key.
 * @param req - the incoming request.
 * @param res - the response.
 * @param ctx - host context carrying the credentials service.
 * @param source - settings resolver for the translation configuration.
 */
async function handleTranslate(req, res, ctx, source) {
  const config = source()
  if (config.enabled !== true) {
    send(res, 200, { ok: false, error: { code: 'disabled', message: 'translation is disabled in the dsh-auto-translate settings' } })
    return
  }
  let body
  try {
    body = JSON.parse(await readBody(req))
  } catch {
    send(res, 400, { ok: false, error: { code: 'bad-request', message: 'request body is not valid JSON' } })
    return
  }
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (text === '') {
    send(res, 400, { ok: false, error: { code: 'empty', message: 'no text to translate' } })
    return
  }
  const truncated = text.length > config.maxInputChars ? text.slice(0, config.maxInputChars) : text
  const resolved = await ctx.credentials.resolve(credentialRef(config.apiKeyRef)).catch(() => undefined)
  const apiKey = (resolved?.value ?? '').trim()
  if (apiKey === '') {
    send(res, 503, {
      ok: false,
      error: { code: 'no-api-key', message: `${config.apiKeyRef} is not configured in the harness credentials` },
    })
    return
  }
  const model = normalizeModel(config.model || body.model)
  const mode = body.mode === 'summarize' ? 'summarize' : 'translate'
  try {
    const translation = await callProvider(config.baseURL, apiKey, model, truncated, config.temperature, mode)
    send(res, 200, { ok: true, translation, model })
  } catch (error) {
    // The conversation model id may not exist on the provider (harness-facing
    // ids like deepseek-v4-flash are not always the wire model name): retry
    // once with the generic chat model before failing.
    if (model !== FALLBACK_MODEL) {
      try {
        const translation = await callProvider(config.baseURL, apiKey, FALLBACK_MODEL, truncated, config.temperature, mode)
        send(res, 200, { ok: true, translation, model: FALLBACK_MODEL })
        return
      } catch {
        // fall through to the failure response below
      }
    }
    send(res, 502, {
      ok: false,
      error: { code: 'provider-error', message: String(error instanceof Error ? error.message : error) },
    })
  }
}

/**
 * Register the settings namespace and the translation route for the browser half.
 * @param ctx - host context carrying the webServer, credentials, and settings services.
 */
function apply(ctx) {
  let source = () => DEFAULTS
  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(NS, SCHEMA)
    source = () => scope.get()
  })
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: '/api/auto-translate/translate',
      handler: (req, res) => handleTranslate(req, res, ctx, source),
    }),
    'dsh-auto-translate: translate route',
  )
}
//#endregion
export { apply, inject, name };
