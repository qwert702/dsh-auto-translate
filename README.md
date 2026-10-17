# dsh-auto-translate

[English](README.en.md) | 中文

模型输出全链路中文翻译插件,面向 **DeepSeek Harness Web GUI**。

> **兼容性**：本版本（0.3.0）适配 **harness 0.2.0-rc.2**（客户端契约 0.2.0）。0.1.7-rc.2 及更早的 harness 请使用 0.2.1 版本。

模型思考时(Think 折叠行内)、最终回复、工具调用输出,凡英文内容都**就地显示中文**——思考过程中实时翻译,不等待回合结束。所有翻译由一条独立的提供方请求完成,**不进入会话上下文**:不占用上下文窗口,也不污染对话历史。

> **一键安装：**
> ```
> dsh plugin add qwert702/dsh-auto-translate
> ```
> 重启 harness（`dsh web`），刷新页面。

## 功能

- **思考过程实时翻译**:模型的 reasoning 思考块(Think 折叠行)展开后,原文下方直接显示中文翻译;模型仍在思考时按防抖节奏滚动更新"进行中"译文,思考完成后用完整文本重翻一次并缓存。
- **最终回复就地翻译**:每条英文文本块下方一行小字译文(带"译"徽标)。中文回复、代码为主的输出不会触发翻译;纯代码输出会被启发式跳过。
- **工具输出中文摘要**:每个已完成的工具调用,在回合尾显示一行 `工具名 — 中文含义` + `译` 摘要,用简体中文概括该工具输出的要点(而非逐句翻译输出数据)。摘要放在回合尾而不是卡片内部,是因为聊天视图没有"工具卡片内"的可加性插槽,而工具调用渲染器无法被影子替换而不丢失 bash / web / read 等专用视图(见下)。
- **翻译不占用上下文**:翻译/摘要请求由 host 半区独立调用提供方 `/chat/completions`,与对话 agent 循环完全隔离;插件本身不向任何会话添加提示词、工具或消息,也不改写模型请求。
- **模型可配置**:默认跟随当前对话使用的模型;可在 profile 配置里覆盖为任意模型(见下)。当前对话模型在提供方不可用时,自动回退重试 `deepseek-chat`。

## 实现方式(影子上色,不替换插槽声明)

聊天视图里"每条消息内部"没有可加性插槽,所以本插件采用生态里的**影子注册**手法:在 `conversation.chat.node` 上以 `priority: -100` 注册 **`assistant-step`** 渲染器(低于内置的 `priority: 0` 而胜出),负责思考块与文本块的就地翻译。0.2.0 里该坐席的属主包是 `@deepseek-ai/dsh-client-ui-chat`。

影子渲染器复刻 0.2.0 官方 `AssistantNodeView` / `AssistantMarkdown` 的渲染约定:

- 只用公开基础件重建结构:`MarkdownText` / `DisclosureRow` / `JsonBlock`(来自 `@deepseek-ai/dsh-client-ui-primitives`),标签文案走条目声明的 `locale: 'chat'` 席位(`t`),缺失时回退中文。
- 遵守 `groupPart` 拆分(Turn-process 会把同一个 assistant 节点按 `reasoning` / `response` 渲染两次),遵守 Turn-process 折叠:折叠时行内思考块按官方语义标记 `hidden="until-found"`,页内查找命中即展开。
- 节点三态 `status: running | settled | interrupted`、`blocks`(`text` / `reasoning` / `image` / `tool-call` / `other`)、`finalNode.providerMetadata.model` 等 0.2.0 数据形状都用真实字段。
- 图片块交给官方消息图片席位:调用 Chat 视图下发的 `renderMessageImages`(即 `conversation.message.images`,由 `@deepseek-ai/dsh-client-ui-attachment` 填充)。0.2.0 的 ui-attachment 不再导出 `ImageGallery`,所以不再自带图片渲染。

**工具调用节点刻意不做影子注册**:`tool-call` 的默认渲染器拥有 `tool.call.toolview` 子槽的唯一声明(插槽声明全局唯一),影子替换它要么丢失 bash / web / read 等专用工具视图,要么在启动时报"槽已声明"错误。因此工具输出摘要挂在 `conversation.chat.turnTail` 可加性坐席上(0.2.0 里它是 `list` 类型,owner props 为 `{ turn: TurnLocation, seq, openFile }`),通过标准钩子 `useChat` 读取 Chat 快照(`locations.getTurn` + `nodes.get`),渲染在回合动作行之前。

若影子渲染器崩溃、或遇到不认识的节点形状(此时**主动抛错而不是渲染空白**),渲染器的错误边界会让该条目 abdicate,内置 `priority: 0` 渲染器随即无感接管,消息不会丢失。

## 配置(可选)

配置走 harness 0.2.0 的 profile 条目 `config`(插件 config schema 即 `Config` 导出;`settings.register()` 命名空间已在 0.1.7+ 移除)。在你的 profile 补丁层 `~/.dsh/profiles/<profile>/cordis.patch.yml` 里覆盖条目 `ui-auto-translate` 的 config:

```yaml
- id: ui-auto-translate
  config:
    enabled: true                # 总开关
    model: ''                    # 空 = 跟随当前对话模型;可填 deepseek-chat / deepseek-reasoner 或自定义
    apiKeyRef: DEEPSEEK_API_KEY  # 凭据引用,在 harness 凭据中配置
    baseURL: https://api.deepseek.com
    temperature: 0.3             # 翻译请求的采样温度
    maxInputChars: 4000          # 超长输入截断,防烧钱
```

不配置即使用以上默认值。改完重启 harness 生效。API key 只存在于服务端,由 harness 凭据服务解析,绝不离开服务器。

## 仓库布局

- `lib/index.js` — 插件 node 半区:`Config` 导出(loader 配置通道)+ `POST /api/auto-translate/translate` 路由(独立翻译/摘要请求,`mode: translate | summarize`,带模型回退);`inject = ['webServer', 'credentials']`。
- `lib/client.js` — 浏览器半区:`assistant-step` 影子注册(`priority: -100` + `locale: 'chat'`,思考/回复就地翻译)+ `conversation.chat.turnTail` 可加性条目(工具输出摘要)。
- `test/smoke.cjs` — `node test/smoke.cjs`:语法检查 + host(Config 导出/路由全路径:坏请求/空文本/无 key/成功/摘要/模型回退/配置覆盖/禁用)+ client(两个坐席注册、标签回退、`collectTurnTools`、ReactDOMServer 渲染:思考/文本/未知块/`groupPart` 拆分/Turn-process 折叠/折叠态/图片/流式/中断/异常节点 abdicate/工具摘要/缺 `useChat` 降级)。

## 已知限制

- **与 dsh-better-markdown 冲突**:两者都以 `priority: -100` 影子注册 `assistant-step`,同时安装会在启动时报"同 key 同 priority"错误。二选一安装;若需共存,改其中一方的 priority。
- **图片依赖官方席位**:消息内图片由官方 `conversation.message.images` 席位(ui-attachment)渲染。若该插件不在组合里,`renderMessageImages` 不存在,此时图片块会被**跳过**(官方视图在同样条件下也是"没有注册就不渲染图片"),不会崩溃。
- **Markdown 里的本地路径图片不解析**:0.2.0 官方 `AssistantMarkdown` 会下发 `pathImages` 解析器把本地路径图片转成可显示 URL;本插件未接管该解析器,因此回复里以本地路径书写的图片仍是 alt 文本(绝对 `http(s)` 图片正常渲染)。
- **不读取"工作细节"呈现策略**:官方思考块会按 presentation 策略决定落定态是否显示摘要预览,本插件的影子思考块始终显示摘要行。差异仅限这一处外观。
- **工具摘要在回合尾,不在卡片内**:聊天视图没有"工具卡片内"的可加性插槽,`tool-call` 渲染器又无法被影子替换而不丢失专用工具视图(见上),所以工具输出摘要渲染在回合尾。
- **接管默认渲染**:影子注册意味着思考块与文本块的渲染由本插件维护,升级 dsh 后若内置渲染结构变化需跟随适配(崩溃时内置渲染器会自动接管兜底;本插件遇到不认识的节点形状会主动抛错以确保接管)。
- **流式译文是"进行中"版本**:思考/回复仍在输出时,译文基于当前已见文本、按防抖节奏更新,内容可能不完整;输出停止后自动用完整文本重翻。
- **工具摘要只处理 text 块**:图片、二进制输出不翻译;超长输出先截断(`maxInputChars`)再概括。
- **语言判断是启发式**:短于 10 个字母的英文、中日韩混排、代码占多数的输出不会翻译;判断逻辑在 `lib/client.js` 的 `isEnglishProse` / `isMostlyCode`。
- **翻译缓存在浏览器内存中**(按消息节点/工具调用标识),刷新页面后同一内容会重新请求。
- **没有设置界面**:通过 profile 条目 `config` 配置,尚无设置 UI 面板。

## License

MIT
