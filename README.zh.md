# dsh-auto-translate

英文自动翻译 + 工具调用中文注释插件,面向 **DeepSeek Harness Web GUI**。

当模型的回复是英文时,在回合下方自动显示一行**中文翻译**;回合里的每次工具调用,附带一行小字说明该工具的**中文含义**。翻译由一条独立的提供方请求完成,**不进入会话上下文**——不占用上下文窗口,也不污染对话历史。

> **一键安装：**
> ```
> dsh plugin add qwert702/dsh-auto-translate
> ```
> 重启 harness（`dsh web`），刷新页面。

## 功能

- **英文回复自动翻译**:回合完成后,若结尾助手的文本判定为英文(拉丁字母为主、无大量 CJK),自动请求翻译并在回合下方以浅色条展示(带"译"徽标)。中文回复、代码为主的输出不会触发翻译;纯代码输出会被启发式跳过。
- **工具调用中文注释**:回合内每个工具调用按首次出现的顺序去重,下方列出 `工具名 — 中文含义` 小字(内置工具词典,覆盖 bash / read / write / edit / glob / grep / web_search / todo_write / ask_user_question / skill / goal / subagent / workflow / cordis_* 等);未收录的自定义工具显示"自定义工具"。
- **翻译不占用上下文**:翻译请求由 host 半区独立调用提供方 `/chat/completions`,与对话 agent 循环完全隔离;插件本身不向任何会话添加提示词、工具或消息。
- **模型可配置**:默认跟随当前对话使用的模型;可在设置里覆盖为任意模型(见下)。当前对话模型在提供方不可用时,自动回退重试 `deepseek-chat`。

## 设置(可选)

在 `~/.dsh/settings.yaml` 添加命名空间 `dsh-auto-translate`:

```yaml
dsh-auto-translate:
  enabled: true          # 总开关
  model: ''              # 空 = 跟随当前对话模型;可填 deepseek-chat / deepseek-reasoner 或自定义
  apiKeyRef: DEEPSEEK_API_KEY   # 凭据引用,在 harness 凭据中配置
  baseURL: https://api.deepseek.com
  temperature: 0.3       # 翻译请求的采样温度
  maxInputChars: 4000    # 超长输入截断,防烧钱
```

不配置即使用以上默认值。API key 只存在于服务端,由 harness 凭据服务解析,绝不离开服务器。

## 仓库布局

- `lib/index.js` — 插件 node 半区:settings 命名空间 + `POST /api/auto-translate/translate` 路由(独立翻译请求,带模型回退)。
- `lib/client.js` — 浏览器半区:挂在 `conversation.chat.turnTail` **链式插槽**(additive,不替换任何默认渲染)的回合尾翻译条组件。
- `test/smoke.cjs` — `node test/smoke.cjs`:语法检查 + host 路由全路径(禁用/坏请求/空文本/无 key/成功/模型回退/设置覆盖)+ client 链式注册验证。

## 已知限制

- **展示位置**:dsh 聊天视图没有"单条工具调用下方"的可加性插槽,工具注释与翻译条一起展示在回合末尾(链式插槽的唯一可加位置),位于该回合图标操作行之前。
- **语言判断是启发式**:短于 10 个字母的英文、中日韩混排、代码占多数的输出不会翻译;判断逻辑在 `lib/client.js` 的 `isEnglishProse` / `isMostlyCode`。
- **翻译缓存**在浏览器内存中(按回合序号),刷新页面后同一回合会重新请求。
- **设置界面**:目前通过 `settings.yaml` 配置,尚无设置 UI 面板。

## License

MIT
