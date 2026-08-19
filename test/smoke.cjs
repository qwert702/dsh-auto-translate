// Smoke test for dsh-auto-translate:
// 1. node --check on lib/index.js + lib/client.js
// 2. Host half: apply() registers the POST /api/auto-translate/translate
//    route; the handler reads settings, resolves the API key, proxies a
//    standalone provider request (ok / disabled / bad-request / empty /
//    no-api-key / provider-error-with-fallback-model / summarize-mode paths).
// 3. Client bundle: the two shadow registrations on conversation.chat.node
//    (assistant-step and tool-call at priority -100, the tool-call entry
//    re-declaring the tool.call.toolview child slot), plus SSR renders of the
//    shadow renderers over mock conversation nodes.
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

// --- 2. host route tests ---
async function hostTests() {
  const host = await import('file:///' + hostFile.replace(/\\/g, '/'));
  if (host.name !== 'dsh-auto-translate-host') throw new Error('bad host name: ' + host.name);
  if (!host.inject.includes('webServer')) throw new Error('host missing webServer inject');

  const registeredRoutes = [];
  let keyResolver = async () => undefined;
  let translateConfig = {
    enabled: true,
    model: '',
    apiKeyRef: 'DEEPSEEK_API_KEY',
    baseURL: 'https://api.deepseek.com',
    temperature: 0.3,
    maxInputChars: 4000,
  };
  const ctx = {
    effect(fn) { fn(); },
    inject(services, cb) {
      cb({
        settings: { register: () => ({ get: () => translateConfig }) },
        effect: () => {},
      });
    },
    webServer: {
      register(route) { registeredRoutes.push(route); return () => {}; },
    },
    credentials: {
      resolve: async () => keyResolver(),
    },
  };
  host.apply(ctx);
  const route = registeredRoutes.find((r) => r.path === '/api/auto-translate/translate');
  if (route === undefined) throw new Error('translate route not registered');
  if (route.kind !== 'exact') throw new Error('wrong route kind: ' + JSON.stringify(route));
  console.log('OK: host registers the translate route');

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

  const originalFetch = global.fetch;
  try {
    // disabled -> 200 disabled
    translateConfig.enabled = false;
    let f = fakeRes();
    await route.handler(bodyStream(JSON.stringify({ text: 'Hello world.' })), f.res);
    let parsed = JSON.parse(f.body());
    if (f.status() !== 200 || parsed.ok !== false || parsed.error.code !== 'disabled') {
      throw new Error('disabled path wrong: ' + f.status() + ' ' + f.body());
    }
    console.log('OK: host route disabled path');
    translateConfig.enabled = true;

    // bad JSON -> 400 bad-request
    f = fakeRes();
    await route.handler(bodyStream('not json'), f.res);
    parsed = JSON.parse(f.body());
    if (f.status() !== 400 || parsed.error.code !== 'bad-request') {
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
    keyResolver = async () => undefined;
    f = fakeRes();
    await route.handler(bodyStream(JSON.stringify({ text: 'Hello world.' })), f.res);
    parsed = JSON.parse(f.body());
    if (f.status() !== 503 || parsed.ok !== false || parsed.error.code !== 'no-api-key') {
      throw new Error('no-key path wrong: ' + f.status() + ' ' + f.body());
    }
    console.log('OK: host route 503 no-api-key');

    // provider ok, translate mode -> 200, prompt is the translation instruction
    keyResolver = async () => ({ value: 'sk-test', source: 'credentials.yaml' });
    let seenPrompt = '';
    global.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      seenPrompt = body.messages[0].content;
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
    global.fetch = async (url, options) => {
      const model = JSON.parse(options.body).model;
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
    console.log('OK: host route retries with the generic chat model on provider error');
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
    JsonBlock: () => react.createElement('div', null, 'json'),
    DisclosureRow: ({ title, children, collapsedContent }) =>
      react.createElement('div', null, title, collapsedContent, children),
    IconThinkOutline14: () => react.createElement('span', null, 'T'),
  };
  const attachmentShim = {
    ImageGallery: () => react.createElement('div', null, 'gallery'),
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
          if (spec === '@deepseek-ai/dsh-client-ui-attachment') return attachmentShim;
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

  // registration assertions: two shadow entries on conversation.chat.node
  const entries = [];
  const injectedKeys = [];
  const ctx = {
    effect(fn) { fn(); },
    slots: {
      inject(key, factory) {
        injectedKeys.push(key);
        const registerCall = factory();
        registerCall();
        return () => {};
      },
      register(opts, component) {
        entries.push({ opts, component });
        return () => {};
      },
    },
  };
  client.apply(ctx);
  if (injectedKeys.length !== 2 || injectedKeys.some((k) => k !== 'conversation.chat.node')) {
    throw new Error('wrong injected slot keys: ' + JSON.stringify(injectedKeys));
  }
  if (entries.length !== 2) throw new Error('expected two entries, got ' + entries.length);
  const byKey = Object.fromEntries(entries.map((e) => [e.opts.key, e]));
  const assistant = byKey['assistant-step'];
  const tool = byKey['tool-call'];
  if (assistant === undefined || tool === undefined) {
    throw new Error('missing shadow keys: ' + Object.keys(byKey).join(','));
  }
  if (assistant.opts.priority !== -100 || tool.opts.priority !== -100) {
    throw new Error('shadow priority must be -100: ' + JSON.stringify(entries.map((e) => e.opts.priority)));
  }
  if (assistant.component !== client.TranslateAssistantNodeView) throw new Error('assistant component mismatch');
  if (tool.component !== client.TranslateToolCallTree) throw new Error('tool component mismatch');
  const childSlot = tool.opts.children?.['tool.call.toolview'];
  if (childSlot === undefined || childSlot.kind !== 'keyed' || childSlot.scope !== 'session') {
    throw new Error('tool-call entry must re-declare tool.call.toolview: ' + JSON.stringify(tool.opts.children));
  }
  console.log('OK: client shadows assistant-step + tool-call at priority -100 (toolview child re-declared)');

  // SSR render: settled assistant step with reasoning + text + tool-call blocks
  const renderer = require(path.join(harnessModules, 'react-dom/server'));
  const settledNode = {
    key: 'asst:1',
    location: { kind: 'turn', turn: { status: 'closed' } },
    data: {
      status: 'settled',
      blocks: [
        { kind: 'reasoning', text: 'Let me think about this carefully.' },
        { kind: 'text', text: 'Here is the answer.' },
        { kind: 'tool-call', callId: 'call-1', name: 'bash', argsRaw: '{}' },
      ],
      finalNode: { seq: 9, provenance: { provider: 'deepseek', model: 'deepseek-v4-flash' } },
    },
  };
  const assistantHtml = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: settledNode,
    useTurnData: () => ({ closing: { finalNode: { seq: 9 } } }),
    openFile: undefined,
    loadImage: undefined,
    fileMentions: () => undefined,
  }));
  if (!assistantHtml.includes('Let me think about this carefully.')) throw new Error('reasoning text not rendered');
  if (!assistantHtml.includes('Here is the answer.')) throw new Error('text not rendered');
  if (!assistantHtml.includes('Think')) throw new Error('think disclosure missing');
  console.log('OK: assistant-step SSR renders reasoning + text blocks');

  // SSR render: running assistant step (streaming) must not crash
  const runningNode = {
    key: 'asst:2',
    location: { kind: 'step', turn: { status: 'open' }, step: { status: 'open' } },
    data: { status: 'running', blocks: [{ kind: 'reasoning', text: 'Thinking…' }] },
  };
  const runningHtml = renderer.renderToString(react.createElement(client.TranslateAssistantNodeView, {
    node: runningNode,
    useTurnData: () => undefined,
    openFile: undefined,
    loadImage: undefined,
    fileMentions: () => undefined,
  }));
  if (!runningHtml.includes('Thinking…')) throw new Error('streaming reasoning not rendered');
  console.log('OK: assistant-step SSR handles the streaming state');

  // SSR render: settled tool call tree with a text output
  const toolNode = {
    key: 'tool:1',
    data: {
      root: {
        callId: 'call-1',
        kind: 'tool-result',
        call: { name: 'bash', argsRaw: '{"command":"ls"}' },
        content: [{ type: 'text', text: 'hello.txt' }],
        isError: false,
        subCalls: [],
      },
    },
  };
  const toolHtml = renderer.renderToString(react.createElement(client.TranslateToolCallTree, {
    node: toolNode,
    renderSlot: (key, owner, opts) => (opts?.fallback ?? null),
    selectedCallId: undefined,
    cwd: undefined,
    openFile: undefined,
    inspectCall: () => {},
  }));
  if (!toolHtml.includes('call-1')) throw new Error('tool call id not rendered');
  if (!toolHtml.includes('hello.txt')) throw new Error('tool output text not rendered');
  if (!toolHtml.includes('执行 shell 命令')) throw new Error('tool gloss not rendered');
  console.log('OK: tool-call SSR renders the simplified card with gloss + output');
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
