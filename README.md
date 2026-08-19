# dsh-auto-translate

[English](README.en.md) | 中文

模型输出全链路中文翻译插件,面向 **DeepSeek Harness Web GUI**。

模型思考时(Think 折叠行内)、最终回复、工具调用输出,凡英文内容都**就地显示中文**——思考过程中实时翻译,不等待回合结束。所有翻译由一条独立的提供方请求完成,**不进入会话上下文**:不占用上下文窗口,也不污染对话历史。

> **一键安装：**
> ```
> dsh plugin add qwert702/dsh-auto-translate
> ```
> 重启 harness（`dsh web`），刷新页面。

## 功能

- **思考过程实时翻译**:模型的 reasoning 思考块(Think 折叠行)展开后,原文下方直接显示中文翻译;模型仍在思考时按防抖节奏滚动更新"进行中"译文,思考完成后用完整文本重翻一次并缓存。
- **最终回复就地翻译**:每条英文文本块下方一行小字译文(带"译"徽标)。中文回复、代码为主的输出不会触发翻译;纯代码输出会被启发式跳过。
- **工具输出中文摘要**:每个已完成的工具调用,在回合尾工具卡片序列之后显示一行 `工具名 — 中文含义` + `译` 摘要,用简体中文概括该工具输出的要点(而非逐句翻译输出数据)。摘要放在回合尾而不是卡片内部,是因为聊天视图没有"工具卡片内"的可加性插槽,而工具调用渲染器无法被影子替换而不丢失 bash / web / read 等专用视图(见下)。
- **翻译不占用上下文**:翻译/摘要请求由 host 半区独立调用提供方 `/chat/completions`,与对话 agent 循环完全隔离;插件本身不向任何会话添加提示词、工具或消息,也不改写模型请求。
- **模型可配置**:默认跟随当前对话使用的模型;可在设置里覆盖为任意模型(见下)。当前对话模型在提供方不可用时,自动回退重试 `deepseek-chat`。

## 实现方式(影子上色,不替换插槽声明)

聊天视图里"每条消息内部"没有可加性插槽,所以本插件在 `conversation.chat.node` 上以 `priority: -100` 影子注册 **`assistant-step`** 渲染器(低于内置的 `priority: 0` 而胜出),负责思考块与文本块的就地翻译。渲染器从公开基础件(`dsh-client-ui-primitives` 的 `MarkdownText` / `DisclosureRow` / `JsonBlock`,`dsh-client-ui-attachment` 的 `ImageGallery`)重新实现了默认渲染结构,与 `dsh-better-markdown` 是同一技术路线。

**工具调用节点刻意不做影子注册**:`tool-call` 的默认渲染器拥有 `tool.call.toolview` 子槽的唯一声明(插槽声明全局唯一),影子替换它要么丢失 bash / web / read 等专用工具视图,要么在启动时报"槽已声明"错误。因此工具输出摘要挂在 `conversation.chat.turnTail` **链式插槽**(additive,不替换任何渲染),渲染在回合尾工具卡片序列之后。

若影子渲染器崩溃会自动退位,内置渲染器无感接管。

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

- `lib/index.js` — 插件 node 半区:settings 命名空间 + `POST /api/auto-translate/translate` 路由(独立翻译/摘要请求,`mode: translate | summarize`,带模型回退)。
- `lib/client.js` — 浏览器半区:`assistant-step` 影子注册(`priority: -100`,思考/回复就地翻译)+ `conversation.chat.turnTail` 链式条目(工具输出摘要)。
- `test/smoke.cjs` — `node test/smoke.cjs`:语法检查 + host 路由全路径(禁用/坏请求/空文本/无 key/成功/摘要模式/模型回退)+ client 注册断言 + ReactDOMServer 渲染测试(思考/文本/流式/工具摘要)。

## 已知限制

- **与 dsh-better-markdown 冲突**:两者都以 `priority: -100` 影子注册 `assistant-step`,同时安装会在启动时报"同 key 同 priority"错误。二选一安装;若需共存,改其中一方的 priority。
- **工具摘要在回合尾,不在卡片内**:聊天视图没有"工具卡片内"的可加性插槽,`tool-call` 渲染器又无法被影子替换而不丢失专用工具视图(见上),所以工具输出摘要渲染在回合尾工具卡片序列之后。
- **接管默认渲染**:影子注册意味着思考块与文本块的渲染由本插件维护,升级 dsh 后若内置渲染结构变化需跟随适配(崩溃时内置渲染器会自动接管兜底)。
- **流式译文是"进行中"版本**:思考/回复仍在输出时,译文基于当前已见文本、按防抖节奏更新,内容可能不完整;输出停止后自动用完整文本重翻。
- **工具摘要只处理 text 块**:图片、二进制输出不翻译;超长输出先截断(`maxInputChars`)再概括。
- **语言判断是启发式**:短于 10 个字母的英文、中日韩混排、代码占多数的输出不会翻译;判断逻辑在 `lib/client.js` 的 `isEnglishProse` / `isMostlyCode`。
- **翻译缓存**在浏览器内存中(按消息节点/工具调用标识),刷新页面后同一内容会重新请求。
- **设置界面**:目前通过 `settings.yaml` 配置,尚无设置 UI 面板。

## License

MIT
