// Smoke test for dsh-auto-translate (harness 0.2.0 config + chat-node shadow era):
// 1. node --check on lib/index.js + lib/client.js
// 2. Host half: exports name/inject/Config — the loader config channel that
//    replaced the removed `settings.register()` namespace (no `settings` in
//    inject, no ctx.inject at all); apply() registers the
//    POST /api/auto-translate/translate route; the handler reads the resolved
//    config, resolves the API key through the credentials service and proxies a
//    standalone provider request (defaults / disabled / bad-request / empty /
//    no-api-key / ok / summarize / fallback-model / truncation paths) and
//    apply(ctx, config) overrides drive it.
// 3. Client bundle: the two 0.2.0 seat registrations (chat-owned
//    `conversation.chat.node` shadow for assistant-step at priority -100 with the
//    chat locale seat, plus the additive `conversation.chat.turnTail` list entry),
//    collectTurnTools over a real 0.2.0 ChatSnapshot shape, and SSR renders of the
//    shadow renderer over 0.2.0 AssistantChatData / TurnTailOwnerProps shapes.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const pkg = path.resolve(__dirname, '..');
const bundle = path.join(pkg, 'lib/client.js');
const hostFile = path.join(pkg, 'lib/index.js');

// The host half imports harness packages. When this checkout has no
// node_modules (fresh clone), junction the harness install's node_modules
// from $DSH_HARNESS_NODE_MODULES so the smoke test still runs against a real
// install.
const localNodeModules = path.join(pkg, 'node_modules');
const harnessModules = process.env.DSH_HARNESS_NODE_MODULES ?? 'C:/Users/cbn/.dsh/profiles/node_modules';
if (!fs.existsSync(localNodeModules) && fs.existsSync(harnessModules)) {
  fs.symlinkSync(harnessModules, localNodeModules, 'junction');
}

// --- 1. syntax ---
execFileSync(process.execPath, ['--check', bundle], { stdio: 'inherit' });
execFileSync(process.execPath, ['--check', hostFile], { stdio: 'inherit' });
console.log('OK: node --check passed (client.js + index.js)');

/** A response double capturing status + body. */
function fakeRes() {
  let status = 0;
  let body = '';
  return {
    res: {
      writeHead(s) { status = s; },
      end(b) { body = b; },
    },
    status: () => status,
    body: () => body,
  };
}

/** A request double exposing an async-iterable UTF-8 body. */
function bodyStream(text) {
  const chunks = Buffer.from(text, 'utf8');
  return {
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        next: async () => {
          if (sent) return { done: true };
          sent = true;
          return { done: false, value: chunks };
        },
      };
    },
  };
}

/**
 * Build a host context double: effect() runs inline, webServer collects routes,
 * credentials resolves through the mutable key holder. `inject` is deliberately a
 * throwing trap — 0.2.0 has no settings namespace to inject, and this plugin must
 * not reach for one.
 */
function hostContext(routes, key) {
  return {
    effect(fn) { fn(); },
    inject() { throw new Error('host must not call ctx.inject (the settings service is gone in 0.2.0)'); },
    webServer: {
      register(route) { routes.push(route); return () => {}; },
    },
    credentials: {
      resolve: async (ref) => {
        key.ref = String(ref);
        return key.resolver();
      },
    },
  };
}

// --- 2. host route tests ---
async function hostTests() {
  const host = await import('file:///' + hostFile.replace(/\\/g, '/'));
  if (host.name !== 'dsh-auto-translate-host') throw new Error('bad host name: ' + host.name);
  for (const service of ['webServer', 'credentials']) {
    if (!host.inject.includes(service)) throw new Error('host missing inject: ' + service);
  }
  if (host.inject.includes('settings')) throw new Error('host must not inject the removed settings service');
  if (typeof host.Config?.['~standard']?.validate !== 'function') throw new Error('Config is not a Standard Schema');
  const validated = host.Config['~standard'].validate({});
  if (validated.issues !== undefined) throw new Error('Config rejected an empty entry config: ' + JSON.stringify(validated.issues));
  if (validated.value.apiKeyRef !== 'DEEPSEEK_API_KEY' || validated.value.enabled !== true) {
    throw new Error('Config defaults wrong: ' + JSON.stringify(validated.value));
  }
  if (host.DEFAULTS.baseURL !== 'https://api.deepseek.com' || host.DEFAULTS.maxInputChars !== 4000) {
    throw new Error('composition defaults wrong: ' + JSON.stringify(host.DEFAULTS));
  }
  console.log('OK: host exports name/inject/Config (loader config channel, no settings)');

  const routes = [];
  const key = { ref: '', resolver: async () => undefined };
  host.apply(hostContext(routes, key));
  const route = routes.find((r) => r.path === '/api/auto-translate/translate');
  if (route === undefined) throw new Error('translate route not registered');
  if (route.kind !== 'exact') throw new Error('wrong route kind: ' + JSON.stringify(route));
  console.log('OK: host registers the translate route');

  const originalFetch = global.fetch;
  try {
    // bad JSON -> 400 bad-request
    let f = fakeRes();
    await route.handler(bodyStream('not json'), f.res);
    let parsed = JSON.parse(f.body());
    if (f.status() !== 400 || parsed.ok !== false || parsed.error.code !== 'bad-request') {
      throw new Error('bad-request path wrong: ' + f.status() + ' ' + f.body());
    }
    console.log('OK: host route bad-request path');

    // empty text -> 400 empty
    f = fakeRes();
    await route.handler(bodyStream(JSON.stringify({ text: '   ' })), f.res);
    parsed = JSON.parse(f.body());
    if (f.status() !== 400 || parsed.error.code !== 'empty') {
      throw new Error('empty path wrong: ' + f.status() + ' ' + f.body());
    }
    console.log('OK: host route empty path');

    // no key -> 503 no-api-key
    key.resolver = async () => undefined;
    f = fakeRes();
    await route.handler(bodyStream(JSON.stringify({ text: 'Hello world.' })), f.res);
    parsed = JSON.parse(f.body());
    if (f.status() !== 503 || parsed.ok !== false || parsed.error.code !== 'no-api-key') {
      throw new Error('no-key path wrong: ' + f.status() + ' ' + f.body());
    }
    if (key.ref !== 'DEEPSEEK_API_KEY') throw new Error('bare mount must resolve the default credential ref, got ' + key.ref);
    console.log('OK: host route 503 no-api-key');

    // provider ok, translate mode -> 200, prompt is the translation instruction
    key.resolver = async () => ({ value: 'sk-test', source: 'credentials.yaml' });
    let seenPrompt = '';
    let seenModel = '';
    global.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      seenPrompt = body.messages[0].content;
      seenModel = body.model;
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '你好，世界。' } }] }),
      };
    };
    f = fakeRes();
    await route.handler(bodyStream(JSON.stringify({ text: 'Hello world.', model: 'deepseek-v4-flash' })), f.res);
    parsed = JSON.parse(f.body());
    if (f.status() !== 200 || parsed.ok !== true || parsed.translation !== '你好，世界。' || parsed.model !== 'deepseek-v4-flash') {
      throw new Error('ok path wrong: ' + f.status() + ' ' + f.body());
    }
    if (seenModel !== 'deepseek-v4-flash') throw new Error('conversation model hint not forwarded: ' + seenModel);
    if (!seenPrompt.includes('翻译成简体中文')) throw new Error('translate prompt wrong: ' + seenPrompt);
    if (!seenPrompt.includes('Hello world.')) throw new Error('prompt missing the text');
    console.log('OK: host route 200 translation (translate mode)');

    // summarize mode -> prompt asks for a summary
    f = fakeRes();
    await route.handler(bodyStream(JSON.stringify({ text: 'Command failed with exit code 1', mode: 'summarize' })), f.res);
    parsed = JSON.parse(f.body());
    if (f.status() !== 200 || parsed.ok !== true) throw new Error('summarize path wrong: ' + f.status() + ' ' + f.body());
    if (!seenPrompt.includes('概括')) throw new Error('summarize prompt wrong: ' + seenPrompt);
    console.log('OK: host route summarize mode');

    // provider error on the conversation model -> retry once with the generic model
    const triedModels = [];
    global.fetch = async (url, options) => {
      const model = JSON.parse(options.body).model;
      triedModels.push(model);
      if (model === 'deepseek-v4-flash') {
        return { ok: false, status: 400, text: async () => 'model not found' };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '重试译文。' } }] }),
      };
    };
    f = fakeRes();
    await route.handler(bodyStream(JSON.stringify({ text: 'Retry me.', model: 'deepseek-v4-flash' })), f.res);
    parsed = JSON.parse(f.body());
    if (f.status() !== 200 || parsed.ok !== true || parsed.translation !== '重试译文。' || parsed.model !== 'deepseek-chat') {
      throw new Error('fallback-model path wrong: ' + f.status() + ' ' + f.body());
    }
    if (triedModels.length !== 2 || triedModels[0] !== 'deepseek-v4-flash' || triedModels[1] !== 'deepseek-chat') {
      throw new Error('fallback retry order wrong: ' + JSON.stringify(triedModels));
    }
    console.log('OK: host route retries with the generic chat model on provider error');

    // profile config: disabled short-circuits before any provider call
    const disabledRoutes = [];
    const disabledKey = { ref: '', resolver: async () => ({ value: 'sk-test' }) };
    host.apply(hostContext(disabledRoutes, disabledKey), { enabled: false });
    const disabledRoute = disabledRoutes.find((r) => r.path === '/api/auto-translate/translate');
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '不应发生' } }] }) };
    };
    f = fakeRes();
    await disabledRoute.handler(bodyStream(JSON.stringify({ text: 'Hello world.' })), f.res);
    parsed = JSON.parse(f.body());
    if (f.status() !== 200 || parsed.ok !== false || parsed.error.code !== 'disabled') {
      throw new Error('disabled path wrong: ' + f.status() + ' ' + f.body());
    }
    if (calls !== 0) throw new Error('disabled config must not call the provider');
    console.log('OK: apply(ctx, { enabled: false }) disables the route');

    // profile config: credential ref, model override and input truncation flow through
    const configuredRoutes = [];
    const configuredKey = { ref: '', resolver: async () => ({ value: 'sk-configured' }) };
    host.apply(hostContext(configuredRoutes, configuredKey), {
      model: 'deepseek-configured',
      apiKeyRef: 'MY_TRANSLATE_KEY',
      maxInputChars: 5,
      temperature: 0.1,
    });
    const configuredRoute = configuredRoutes.find((r) => r.path === '/api/auto-translate/translate');
    let configuredBody = null;
    global.fetch = async (url, options) => {
      configuredBody = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '截断译文。' } }] }) };
    };
    f = fakeRes();
    await configuredRoute.handler(bodyStream(JSON.stringify({ text: 'Hello world.', model: 'deepseek-v4-flash' })), f.res);
    parsed = JSON.parse(f.body());
    if (f.status() !== 200 || parsed.ok !== true || parsed.translation !== '截断译文。') {
      throw new Error('configured path wrong: ' + f.status() + ' ' + f.body());
    }
    if (configuredKey.ref !== 'MY_TRANSLATE_KEY') throw new Error('configured apiKeyRef not used: ' + configuredKey.ref);
    if (configuredBody.model !== 'deepseek-configured') throw new Error('configured model override not used: ' + configuredBody.model);
    if (configuredBody.temperature !== 0.1) throw new Error('configured temperature not used: ' + configuredBody.temperature);
    if (!configuredBody.messages[0].content.endsWith('Hello')) throw new Error('maxInputChars truncation not applied: ' + configuredBody.messages[0].content);
    console.log('OK: apply(ctx, config) drives ref/model/temperature/truncation');
  } finally {
    global.fetch = originalFetch;
  }
}

// --- 3. client bundle tests ---
function clientTests() {
  const react = require(path.join(harnessModules, 'react'));
  const jsxRuntime = require(path.join(harnessModules, 'react/jsx-runtime'));
  const primitivesShim = {
    MarkdownText: (props) => react.createElement('div', { 'data-test': 'markdown' }, props.text),
    JsonBlock: (props) => react.createElement('div', { 'data-test': 'json' }, props.label),
    DisclosureRow: ({ title, children, collapsedContent, open }) =>
      react.createElement('div', { 'data-test': 'disclosure' }, title, collapsedContent, open ? children : null),
    IconThinkOutlineRegular: () => react.createElement('span', null, 'T'),
  };

  const loader = {};
  global.window = {
    __ModuleLoader__: {
      load(entry) {
        loader.id = entry.id;
        loader.exports = entry.factory((spec) => {
          if (spec === 'react') return react;
          if (spec === 'react/jsx-runtime') return jsxRuntime;
          if (spec === '@deepseek-ai/dsh-client-ui-primitives') return primitivesShim;
          throw new Error('unexpected require: ' + spec);
        });
      },
    },
  };
  try {
    const source = fs.readFileSync(bundle, 'utf8');
    (0, eval)(source);
  } finally {
    delete global.window;
  }
  if (loader.id !== 'dsh-auto-translate') throw new Error('wrong bundle id: ' + loader.id);
  const client = loader.exports;
  if (client.inject.length !== 1 || client.inject[0] !== 'slots') {
    throw new Error('wrong client inject: ' + JSON.stringify(client.inject));
  }

  // --- seat registrations (0.2.0: both seats belong to ui-chat) ---
  const entries = [];
  const injectedKeys = [];
  const ctx = {
    slots: {
      inject(key, factory) {
        injectedKeys.push(key);
        const dispose = factory();
        if (typeof dispose === 'function') dispose();
        return () => {};
      },
      register(opts, component) {
        entries.push({ opts, component });
        return () => {};
      },
    },
  };
  client.apply(ctx);
  if (injectedKeys.length !== 2 || injectedKeys[0] !== 'conversation.chat.node' || injectedKeys[1] !== 'conversation.chat.turnTail') {
    throw new Error('wrong injected seats: ' + JSON.stringify(injectedKeys));
  }
  const nodeEntries = entries.filter((e) => e.opts.name === 'conversation.chat.node');
  const tailEntries = entries.filter((e) => e.opts.name === 'conversation.chat.turnTail');
  if (nodeEntries.length !== 1) throw new Error('expected one chat.node entry, got ' + nodeEntries.length);
  if (tailEntries.length !== 1) throw new Error('expected one turnTail entry, got ' + tailEntries.length);
  const assistant = nodeEntries[0];
  if (assistant.opts.key !== 'assistant-step') throw new Error('wrong shadow key: ' + assistant.opts.key);
  if (assistant.opts.priority !== -100) throw new Error('shadow priority must be -100: ' + assistant.opts.priority);
  if (assistant.opts.locale !== 'chat') throw new Error('shadow entry must take the chat locale seat: ' + JSON.stringify(assistant.opts));
  if (assistant.component !== client.TranslateAssistantNodeView) throw new Error('shadow component mismatch');
  const tail = tailEntries[0];
  if (tail.opts.id !== 'auto-translate') throw new Error('wrong turnTail id: ' + tail.opts.id);
  if (tail.opts.order !== 10) throw new Error('wrong turnTail order: ' + tail.opts.order);
  if (tail.opts.select !== undefined) throw new Error('turnTail is a 0.2.0 list seat: select must not be declared');
  if (tail.component !== client.TurnTranslateTail) throw new Error('turnTail component mismatch');
  console.log('OK: client shadows assistant-step (priority -100, chat locale) + turnTail list entry');

  // --- MarkdownText labels (required by the 0.2.0 primitive) ---
  const fallbackLabels = client.markdownLabels(undefined);
  if (fallbackLabels.code.copyLabel !== '复制' || fallbackLabels.code.copiedLabel !== '已复制'
    || fallbackLabels.code.toolbarLabels.codeLabel !== '代码块' || fallbackLabels.footnotes !== '脚注') {
    throw new Error('fallback labels wrong: ' + JSON.stringify(fallbackLabels));
  }
  const localeLabels = client.markdownLabels((key, params) => key === 'copy' ? 'Copy' : key === 'copy.failed' ? 'x' : key === 'json.truncated' ? 'cut {total}' : key);
  if (localeLabels.code.copyLabel !== 'Copy') throw new Error('locale label not used: ' + JSON.stringify(localeLabels));
  if (localeLabels.code.copiedLabel !== '已复制') throw new Error('missing locale label must fall back: ' + JSON.stringify(localeLabels));
  console.log('OK: markdown labels resolve through t with a Chinese fallback');

  // --- collectTurnTools over the 0.2.0 ChatSnapshot shape (no `.chat` wrapper) ---
  const chatSnapshot = {
    order: ['k1', 'k2'],
    locations: { getTurn: (turn) => (turn === 1 ? ['k1', 'k2'] : []) },
    nodes: {
      get: (key) => {
        if (key === 'k1') {
          return {
            key,
            kind: 'tool-call',
            data: {
              root: {
                kind: 'tool-result',
                seq: 4,
                time: 40,
                callId: 'call-1',
                call: { name: 'bash', argsRaw: '{"command":"ls"}' },
                callTime: 30,
                content: [{ type: 'text', text: 'hello.txt' }],
                isError: false,
                subCalls: [],
              },
            },
          };
        }
        return {
          key,
          kind: 'assistant-step',
          data: {
            blocks: [
              { kind: 'tool-call', callId: 'call-2', name: 'web_search', argsRaw: '{}' },
              { kind: 'tool-call', callId: 'call-1', name: 'bash', argsRaw: '{}' },
            ],
          },
        };
      },
    },
  };
  const tools = client.collectTurnTools(chatSnapshot, 1);
  const byId = Object.fromEntries(tools.map((t) => [t.callId, t]));
  if (byId['call-1'] === undefined || byId['call-1'].name !== 'bash' || byId['call-1'].output !== 'hello.txt') {
    throw new Error('collectTurnTools call-1 wrong: ' + JSON.stringify(tools));
  }
  if (byId['call-2'] === undefined || byId['call-2'].name !== 'web_search' || byId['call-2'].output !== '') {
    throw new Error('collectTurnTools call-2 wrong: ' + JSON.stringify(tools));
  }
  if (client.collectTurnTools(undefined, 1).length !== 0) throw new Error('collectTurnTools must tolerate a missing snapshot');
  if (client.collectTurnTools({}, 1).length !== 0) throw new Error('collectTurnTools must tolerate an empty snapshot');
  console.log('OK: collectTurnTools pairs tool-call roots with assistant blocks over ChatSnapshot');

  // --- SSR: 0.2.0 AssistantChatData node, settled with reasoning + text + tool + other ---
  const renderer = require(path.join(harnessModules, 'react-dom/server'));
  const disclosure = { expanded: true, setExpanded() {}, toggle() {} };
  const settledNode = {
    key: 'asst:1',
    kind: 'assistant-step',
    target: 'chat',
    anchorSeq: 9,
    visibility: 'visible',
    location: { kind: 'turn', turn: { turn: 1, status: 'closed', steps: [] } },
    data: {
      status: 'settled',
      turn: 1,
      step: 1,
      time: 90,
      blocks: [
        { kind: 'reasoning', text: 'Let me think about this carefully.\nSecret second line.' },
        { kind: 'text', text: 'Here is the answer.' },
        { kind: 'tool-call', callId: 'call-1', name: 'bash', argsRaw: '{}' },
        { kind: 'other', block: { type: 'mystery' } },
      ],
      finalNode: { kind: 'assistant', seq: 9, time: 90, turn: 1, step: 1, providerMetadata: { provider: 'deepseek', model: 'deepseek-v4-flash' } },
    },
  };
  const settledHtml = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: settledNode,
    groupPart: undefined,
    useTurnData: () => ({ closing: { finalNode: { seq: 9 } } }),
    useDisclosure: () => disclosure,
    openFile: undefined,
    loadImage: undefined,
    renderMessageImages: ({ images, align }) => react.createElement('div', { 'data-test': 'images', 'data-count': images.length, 'data-align': align }),
    fileMentions: () => undefined,
    t: undefined,
  }));
  if (!settledHtml.includes('Let me think about this carefully.')) throw new Error('reasoning text not rendered');
  if (!settledHtml.includes('Here is the answer.')) throw new Error('text not rendered');
  if (!settledHtml.includes('Think')) throw new Error('think disclosure missing');
  if (!settledHtml.includes('未知内容块')) throw new Error('unknown block fallback missing');
  if (settledHtml.includes('dsh-at-mstopped')) throw new Error('settled node must not show the stopped marker');
  console.log('OK: assistant-step SSR renders reasoning + text + unknown blocks');

  // --- SSR: groupPart split (Turn-process renders the same node twice) ---
  const responseOnly = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: settledNode,
    groupPart: 'response',
    useTurnData: () => undefined,
    useDisclosure: () => disclosure,
    renderMessageImages: () => null,
    t: undefined,
  }));
  if (!responseOnly.includes('Here is the answer.')) throw new Error('response group lost the text block');
  if (responseOnly.includes('Let me think about this carefully.')) throw new Error('response group must not repeat reasoning');
  const reasoningOnly = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: settledNode,
    groupPart: 'reasoning',
    useTurnData: () => undefined,
    useDisclosure: () => disclosure,
    renderMessageImages: () => null,
    t: undefined,
  }));
  if (!reasoningOnly.includes('Let me think about this carefully.')) throw new Error('reasoning group lost the reasoning block');
  if (reasoningOnly.includes('Here is the answer.')) throw new Error('reasoning group must not repeat the reply');
  console.log('OK: assistant-step SSR honours the groupPart split');

  // --- SSR: folded Turn-process marks the inline reasoning wrapper (official semantics) ---
  const foldedHtml = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: settledNode,
    groupPart: undefined,
    useTurnData: () => undefined,
    useDisclosure: () => disclosure,
    turnProcess: { hasContent: true, spec: { answerStep: 1, inlineReasoning: true }, foldable: true, open: false, setOpen() {} },
    t: undefined,
  }));
  if (!foldedHtml.includes('data-turn-process-inline="true"')) {
    throw new Error('a folded process must mark the inline reasoning wrapper');
  }
  const openedProcessHtml = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: settledNode,
    groupPart: undefined,
    useTurnData: () => undefined,
    useDisclosure: () => disclosure,
    turnProcess: { hasContent: true, spec: { answerStep: 1, inlineReasoning: true }, foldable: true, open: true, setOpen() {} },
    t: undefined,
  }));
  if (openedProcessHtml.includes('data-turn-process-inline')) {
    throw new Error('an open process must not mark the inline reasoning wrapper');
  }
  console.log('OK: inline reasoning follows the Turn-process fold state');

  // --- SSR: collapsed reasoning keeps the body (and its translation) out ---
  const collapsedHtml = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: settledNode,
    groupPart: undefined,
    useTurnData: () => undefined,
    useDisclosure: () => ({ ...disclosure, expanded: false }),
    t: undefined,
  }));
  if (collapsedHtml.includes('Secret second line.')) throw new Error('collapsed reasoning leaked its body');
  if (!collapsedHtml.includes('Let me think about this carefully.')) throw new Error('collapsed summary missing');
  console.log('OK: collapsed reasoning shows only the summary line');

  // --- SSR: reasoning falls back to local disclosure state when the seat hook is absent ---
  const fallbackHtml = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: settledNode,
    groupPart: 'reasoning',
    useTurnData: () => undefined,
    t: undefined,
  }));
  if (!fallbackHtml.includes('Think')) throw new Error('reasoning fallback lost its disclosure row');
  if (fallbackHtml.includes('Secret second line.')) throw new Error('fallback reasoning must start collapsed');
  console.log('OK: reasoning falls back to local disclosure state');

  // --- SSR: image blocks go through the official message-images seat ---
  const imageNode = {
    key: 'asst:image',
    location: { kind: 'turn', turn: { turn: 2, status: 'open', steps: [] } },
    data: {
      status: 'running',
      turn: 2,
      step: 1,
      time: 10,
      blocks: [
        { kind: 'image', attachment: { attachmentId: 'a-1' } },
        { kind: 'image', attachment: { attachmentId: 'a-2' } },
      ],
    },
  };
  const imageHtml = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: imageNode,
    groupPart: undefined,
    useTurnData: () => undefined,
    useDisclosure: () => disclosure,
    renderMessageImages: ({ images, align }) => react.createElement('div', { 'data-test': 'images', 'data-count': images.length, 'data-align': align }),
    t: undefined,
  }));
  if (!imageHtml.includes('data-count="2"') || !imageHtml.includes('data-align="start"')) {
    throw new Error('image group not handed to renderMessageImages: ' + imageHtml);
  }
  const noImagesProvider = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: imageNode,
    groupPart: undefined,
    useTurnData: () => undefined,
    useDisclosure: () => disclosure,
    t: undefined,
  }));
  if (noImagesProvider.includes('data-test="images"')) throw new Error('images must be skipped without the seat renderer');
  console.log('OK: image blocks render through renderMessageImages and degrade cleanly');

  // --- SSR: running step (streaming) must not crash ---
  const runningNode = {
    key: 'asst:2',
    location: { kind: 'step', turn: { turn: 2, status: 'open', steps: [] }, step: { turn: 2, step: 1, status: 'open' } },
    data: { status: 'running', turn: 2, step: 1, time: 20, blocks: [{ kind: 'reasoning', text: 'Thinking about it…' }] },
  };
  const runningHtml = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: runningNode,
    groupPart: undefined,
    useTurnData: () => undefined,
    useDisclosure: () => disclosure,
    t: undefined,
  }));
  if (!runningHtml.includes('Thinking about it…')) throw new Error('streaming reasoning not rendered');
  if (!runningHtml.includes('data-streaming="true"')) throw new Error('streaming marker missing');
  console.log('OK: assistant-step SSR handles the streaming state');

  // --- SSR: interrupted step shows the stopped marker (0.2.0 three-state data) ---
  const interruptedNode = {
    key: 'asst:3',
    location: { kind: 'turn', turn: { turn: 3, status: 'closed', steps: [] } },
    data: { status: 'interrupted', turn: 3, step: 1, time: 30, blocks: [{ kind: 'text', text: 'Partial reply.' }] },
  };
  const interruptedHtml = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: interruptedNode,
    groupPart: undefined,
    useTurnData: () => undefined,
    useDisclosure: () => disclosure,
    t: undefined,
  }));
  if (!interruptedHtml.includes('Partial reply.')) throw new Error('interrupted text not rendered');
  if (!interruptedHtml.includes('已停止')) throw new Error('interrupted step must show the stopped marker');
  console.log('OK: assistant-step SSR marks an interrupted step');

  // --- SSR: an unknown shape throws so the entry abdicates to the official view ---
  let abdicated = false;
  try {
    renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, { node: { key: 'x', data: {} } }));
  } catch (error) {
    abdicated = /交回官方渲染器/.test(String(error && error.message));
  }
  if (!abdicated) throw new Error('a malformed assistant node must throw (abdication), not render blank');
  console.log('OK: malformed nodes abdicate to the official renderer');

  // --- SSR: turnTail tool gloss line (0.2.0 TurnTailOwnerProps: turn location + seq) ---
  const tailHtml = renderer.renderToString(react.createElement(client.TurnTranslateTail, {
    turn: { turn: 1, status: 'closed', steps: [] },
    seq: 5,
    openFile: undefined,
    useChat: (selector) => selector(chatSnapshot),
  }));
  if (!tailHtml.includes('bash — 执行 shell 命令')) throw new Error('tool gloss not rendered: ' + tailHtml);
  if (!tailHtml.includes('data-auto-translate="true"')) throw new Error('tail marker missing');
  if (tailHtml.includes('web_search')) throw new Error('running tool without output must not get a summary line');
  console.log('OK: turnTail SSR renders the tool gloss line');

  // --- SSR: turnTail without the useChat standard hook renders nothing ---
  const originalWarn = console.warn;
  let warned = 0;
  console.warn = () => { warned += 1; };
  try {
    const noHookHtml = renderer.renderToString(react.createElement(client.TurnTranslateTail, { turn: 1, seq: 5 }));
    if (noHookHtml !== '') throw new Error('tail without useChat must render nothing, got: ' + noHookHtml);
  } finally {
    console.warn = originalWarn;
  }
  if (warned !== 1) throw new Error('missing useChat must warn once, warned ' + warned);
  console.log('OK: turnTail degrades without the useChat standard hook');
}

async function main() {
  await hostTests();
  clientTests();
  console.log('all smoke tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
