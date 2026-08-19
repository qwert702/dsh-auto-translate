// Smoke test for dsh-auto-translate:
// 1. node --check on lib/index.js + lib/client.js
// 2. Host half: apply() registers the POST /api/auto-translate/translate
//    route; the handler reads settings, resolves the API key, proxies a
//    standalone provider request (ok / disabled / bad-request / empty /
//    no-api-key / provider-error-with-fallback-model paths).
// 3. Client bundle: loader registration, the conversation.chat.turnTail chain
//    entry (select returns {turn, seq}), and the component export.
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
  // IncomingMessage body stream: emit chunks then end.
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
  const seenRequests = [];
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

    // provider ok -> 200 translation, body carries only the translation
    keyResolver = async () => ({ value: 'sk-test', source: 'credentials.yaml' });
    global.fetch = async (url, options) => {
      seenRequests.push({ url, options });
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
    const first = seenRequests[0];
    if (!first.url.startsWith('https://api.deepseek.com/chat/completions')) throw new Error('wrong provider url: ' + first.url);
    const sentBody = JSON.parse(first.options.body);
    if (sentBody.model !== 'deepseek-v4-flash') throw new Error('wrong provider model: ' + sentBody.model);
    if (!sentBody.messages[0].content.includes('Hello world.')) throw new Error('prompt missing the text');
    if (sentBody.messages[0].role !== 'user') throw new Error('wrong prompt role');
    console.log('OK: host route 200 translation (model hint passed to provider)');

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

    // settings namespace supplies the model override + credential ref + base URL
    translateConfig = { enabled: true, model: 'deepseek-reasoner', apiKeyRef: 'MY_KEY', baseURL: 'https://custom.example.com', temperature: 0.2, maxInputChars: 4000 };
    global.fetch = async (url, options) => {
      if (url !== 'https://custom.example.com/chat/completions') throw new Error('wrong url: ' + url);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '自定义模型译文。' } }] }),
      };
    };
    f = fakeRes();
    await route.handler(bodyStream(JSON.stringify({ text: 'Custom model.' })), f.res);
    parsed = JSON.parse(f.body());
    if (f.status() !== 200 || parsed.ok !== true || parsed.model !== 'deepseek-reasoner' || parsed.translation !== '自定义模型译文。') {
      throw new Error('settings-override path wrong: ' + f.status() + ' ' + f.body());
    }
    console.log('OK: host route honors the settings namespace override');
  } finally {
    global.fetch = originalFetch;
  }
}

// --- 3. client bundle tests ---
function clientTests() {
  const reactShim = {
    memo: (fn) => fn,
    useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
    useEffect: () => {},
  };
  const jsxShim = { jsx: (type, props) => ({ type, props }) };
  const loader = {};
  global.window = {
    __ModuleLoader__: {
      load(entry) {
        loader.id = entry.id;
        loader.exports = entry.factory((spec) => {
          if (spec === 'react') return reactShim;
          if (spec === 'react/jsx-runtime') return jsxShim;
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

  const entries = [];
  let injectedKey = null;
  const ctx = {
    effect(fn) { fn(); },
    slots: {
      inject(key, factory) {
        injectedKey = key;
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
  if (injectedKey !== 'conversation.chat.turnTail') throw new Error('wrong injected slot key: ' + injectedKey);
  if (entries.length !== 1) throw new Error('expected one chain entry, got ' + entries.length);
  const entry = entries[0];
  if (entry.opts.name !== 'conversation.chat.turnTail') throw new Error('wrong chain name: ' + entry.opts.name);
  const matched = entry.opts.select({ turn: 3, seq: 7, openFile: undefined });
  if (matched.turn !== 3 || matched.seq !== 7) throw new Error('chain select wrong: ' + JSON.stringify(matched));
  if (entry.component !== client.TurnTranslateTail) throw new Error('chain component mismatch');
  console.log('OK: client registers the turnTail chain entry (select -> {turn, seq})');
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
