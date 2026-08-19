window.__ModuleLoader__.load({
	id: "dsh-auto-translate",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let attachment = require("@deepseek-ai/dsh-client-ui-attachment");

		//#region dsh-auto-translate/styles.js
		// One style tag, hashed tag id, injected once per page — the same
		// mechanism the harness bundles use for CSS modules. All classes are
		// ours (dsh-at- prefix); nothing depends on the harness's hashed class
		// names.
		const cssId = "@dsh-auto-translate/TurnTranslateTail.module.css";
		const css = "" +
			// assistant message body (mirrors AssistantMarkdown's root/body)
			".dsh-at-mroot{color:var(--dsw-alias-label-primary);flex-direction:column;font-size:16px;line-height:28px;display:flex}" +
			".dsh-at-mbody{flex-direction:column;gap:16px;display:flex}" +
			".dsh-at-mstopped{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-tertiary);border-radius:6px;align-self:flex-start;padding:0 6px;font-size:11px;line-height:18px}" +
			// translation strip (badge + text)
			".dsh-at-trans{display:flex;gap:6px;align-items:flex-start;margin-top:6px;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary)}" +
			".dsh-at-trans .dsh-at-badge{flex:none;margin-top:1px;font-size:10px;line-height:1.6;padding:0 5px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}" +
			".dsh-at-trans .dsh-at-text{min-width:0;white-space:pre-wrap}" +
			".dsh-at-retry{cursor:pointer;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;padding:2px 10px;font-size:11px;color:var(--dsw-alias-label-tertiary)}" +
			// reasoning disclosure (mirrors ReasoningRow's visual shape)
			".dsh-at-think{flex-direction:column;display:flex}" +
			".dsh-at-think .dsh-at-trow{position:relative;overflow:hidden}" +
			".dsh-at-think .dsh-at-tlead{flex-shrink:0}" +
			".dsh-at-think .dsh-at-tchev{color:var(--dsw-alias-label-secondary)}" +
			".dsh-at-think .dsh-at-ttitle{font-weight:400}" +
			".dsh-at-think .dsh-at-tsep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}" +
			".dsh-at-think .dsh-at-tsum{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:14px;line-height:24px;overflow:hidden}" +
			".dsh-at-think .dsh-at-tbody{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;margin:4px 0 4px 4px;padding:12px 16px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:22px;white-space:pre-wrap;overflow:auto;max-height:260px}" +
			// turn-tail tool summary list (below the turn, beside the tool cards)
			".dsh-at-tail{flex-direction:column;gap:4px;display:flex}" +
			".dsh-at-tail .dsh-at-toolname{font-size:11px;line-height:1.6;color:var(--dsw-alias-label-tertiary);font-family:var(--dsw-font-code, ui-monospace, monospace)}" +
			"";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(cssId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-auto-translate";
			tag.dataset.pluginCss = cssId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion

		//#region dsh-auto-translate/tool-glossary.js
		/**
		 * Tool-name -> Chinese gloss, covering the harness's built-in toolset.
		 * Composite names resolve by longest prefix/suffix fallback; unknown
		 * tools render their raw name instead of an invented meaning.
		 */
		const TOOL_GLOSSARY = {
			bash: "执行 shell 命令",
			bash_persistent: "持久化 shell 会话",
			bash_sandbox: "在沙箱中执行 shell 命令",
			terminal: "终端操作",
			pwsh: "执行 PowerShell 命令",
			read: "读取文件内容",
			write: "写入文件",
			edit: "编辑文件",
			glob: "按模式匹配文件路径",
			grep: "在文件中搜索文本",
			str_replace_editor: "按字符串替换编辑文件",
			read_image: "读取图片内容",
			web_search: "网络搜索",
			web_fetch: "抓取网页内容",
			search: "搜索",
			todo_write: "更新待办事项",
			ask_user_question: "向用户提问",
			skill: "调用技能",
			goal: "管理目标",
			create_goal: "创建目标",
			get_goal: "查看目标",
			update_goal: "更新目标",
			job_list: "列出后台任务",
			job_kill: "终止后台任务",
			job_output: "查看后台任务输出",
			subagent: "启动子代理",
			dispatch: "派发子代理任务",
			send_message: "发送消息",
			interrupt_agent: "中断子代理",
			report: "子代理汇报结果",
			workflow: "执行工作流",
			cordis_define: "定义插件配置",
			cordis_undefine: "取消插件配置",
			cordis_run: "运行插件命令",
			cordis_stop: "停止插件服务",
			cordis_inspect_list: "列出已安装插件",
			cordis_inspect_query: "查询插件状态",
			cordis_inspect_self: "查看当前插件信息",
		};

		/** Resolve a tool call's Chinese gloss, or null for unknown tools. */
		function glossOf(name) {
			if (typeof name !== "string" || name === "") return null;
			const key = name.trim().toLowerCase();
			const exact = TOOL_GLOSSARY[key];
			if (exact !== undefined) return exact;
			let best = null;
			let bestLen = 0;
			for (const [k, v] of Object.entries(TOOL_GLOSSARY)) {
				if (k.length < 4) continue;
				if (k.length > bestLen && (key.startsWith(k) || key.endsWith(k))) {
					best = v;
					bestLen = k.length;
				}
			}
			return best;
		}
		//#endregion

		//#region dsh-auto-translate/detect.js
		/** Whether the text looks like English prose worth translating. */
		function isEnglishProse(text) {
			const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
			const latin = (text.match(/[A-Za-z]/g) ?? []).length;
			const total = cjk + latin;
			if (total < 10) return false;
			if (cjk / total > 0.3) return false;
			return latin / total > 0.6;
		}

		/** Whether the text is mostly code (fenced blocks, indented lines, statements). */
		function isMostlyCode(text) {
			const lines = text.split("\n").filter((line) => line.trim() !== "");
			if (lines.length < 2) return false;
			let nonProse = 0;
			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.startsWith("```") || trimmed.startsWith("    ") || trimmed.startsWith("\t")) {
					nonProse += 1;
					continue;
				}
				if (/[{};]\s*$/.test(trimmed)) nonProse += 1;
				else if (/^[\w.#$]+\s*\(.*\)\s*\{?$/.test(trimmed)) nonProse += 1;
			}
			return nonProse / lines.length > 0.5;
		}
		//#endregion

		//#region dsh-auto-translate/translate.js
		/**
		 * Translation cache keyed by block identity (`nodeKey:index` /
		 * `call:callId`). Bounded so a long-lived session does not leak.
		 */
		const translationCache = new Map();
		const TRANSLATION_CACHE_LIMIT = 400;

		function cacheTranslation(key, value) {
			translationCache.set(key, value);
			if (translationCache.size > TRANSLATION_CACHE_LIMIT) {
				const oldest = translationCache.keys().next().value;
				if (oldest !== undefined) translationCache.delete(oldest);
			}
		}

		/**
		 * Call the host translation route. `mode: "translate"` renders the text
		 * in Chinese; `mode: "summarize"` produces a concise Chinese summary
		 * (used for tool outputs, which are data rather than prose). The API key
		 * never leaves the server.
		 */
		async function requestTranslation(text, model, mode) {
			const response = await fetch("/api/auto-translate/translate", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ text, model: model ?? undefined, mode: mode ?? "translate" }),
			});
			let data;
			try {
				data = await response.json();
			} catch {
				throw new Error("translate: invalid response");
			}
			if (data?.ok !== true || typeof data.translation !== "string") {
				throw new Error(data?.error?.code ?? "translate: failed");
			}
			return data.translation;
		}
		//#endregion

		//#region dsh-auto-translate/InlineTranslation.js
		/**
		 * One inline translation strip bound to a single text unit (a reasoning
		 * block, a text block, or a tool output). While the source is still
		 * streaming the request is debounced and its result is shown without
		 * being cached; once settled the full text is translated once and
		 * cached. Failures render a retry affordance.
		 * @param props.cacheKey - stable identity for the cache.
		 * @param props.text - the source text.
		 * @param props.model - the current conversation model id, if known.
		 * @param props.mode - 'translate' or 'summarize'.
		 * @param props.running - whether the source is still streaming.
		 */
		const InlineTranslation = react.memo(function InlineTranslation({ cacheKey, text, model, mode, running }) {
			const trimmed = (text ?? "").trim();
			const wants = mode === "summarize"
				? trimmed !== ""
				: trimmed !== "" && isEnglishProse(trimmed) && !isMostlyCode(trimmed);
			const [result, setResult] = react.useState(() => translationCache.get(cacheKey) ?? null);
			const [failed, setFailed] = react.useState(false);
			const [tick, setTick] = react.useState(0);

			react.useEffect(() => {
				if (!wants) return;
				const hit = translationCache.get(cacheKey);
				if (hit !== undefined) {
					setResult(hit);
					return;
				}
				if (running) {
					// Streaming tail: debounce, show a provisional translation,
					// never cache it (the settled pass replaces it).
					let cancelled = false;
					const timer = setTimeout(() => {
						requestTranslation(trimmed, model, mode)
							.then((value) => {
								if (!cancelled) setResult(value);
							})
							.catch(() => {});
					}, 900);
					return () => {
						cancelled = true;
						clearTimeout(timer);
					};
				}
				let cancelled = false;
				setFailed(false);
				requestTranslation(trimmed, model, mode)
					.then((value) => {
						if (cancelled) return;
						cacheTranslation(cacheKey, value);
						setResult(value);
					})
					.catch(() => {
						if (!cancelled) setFailed(true);
					});
				return () => {
					cancelled = true;
				};
			}, [cacheKey, wants, trimmed, model, mode, running, tick]);

			if (result !== null) {
				return react_jsx_runtime.jsx("div", {
					className: "dsh-at-trans",
					"data-auto-translate": true,
					children: [
						react_jsx_runtime.jsx("span", { className: "dsh-at-badge", children: "译" }, "badge"),
						react_jsx_runtime.jsx("span", { className: "dsh-at-text", children: result }, "text"),
					],
				}, cacheKey);
			}
			if (failed) {
				return react_jsx_runtime.jsx("div", {
					className: "dsh-at-retry",
					onClick: () => setTick((value) => value + 1),
					children: "译文获取失败，点击重试",
				}, cacheKey);
			}
			return null;
		});
		//#endregion

		//#region dsh-auto-translate/ThinkRow.js
		/**
		 * Reasoning block rendered as the Think disclosure row — a faithful
		 * re-implementation of the harness's ReasoningRow (which is not
		 * importable), with the Chinese translation rendered inside the
		 * expanded body below the original text.
		 */
		const ThinkRow = react.memo(function ThinkRow({ text, running, cacheKey, model }) {
			const [expanded, setExpanded] = react.useState(false);
			const summary = (() => {
				if (running) {
					const visible = text.trimEnd();
					const newline = visible.lastIndexOf("\n");
					return newline === -1 ? visible : visible.slice(newline + 1);
				}
				const newline = text.indexOf("\n");
				return newline === -1 ? text : text.slice(0, newline);
			})();
			return react_jsx_runtime.jsxs("div", {
				className: "dsh-at-think",
				"data-variant": "think",
				"data-state": running ? "running" : "ok",
				children: [
					react_jsx_runtime.jsx(primitives.DisclosureRow, {
						rowClassName: "dsh-at-trow",
						leadingClassName: "dsh-at-tlead",
						titleClassName: "dsh-at-ttitle",
						chevronClassName: "dsh-at-tchev",
						icon: react_jsx_runtime.jsx(primitives.IconThinkOutline14, { size: 14 }),
						title: "Think",
						open: expanded,
						expandable: true,
						expandOnRowClick: true,
						onToggle: () => {
							setExpanded((value) => !value);
						},
						collapsedContent: react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
							children: [
								react_jsx_runtime.jsx("span", { className: "dsh-at-tsep", "aria-hidden": true }, "sep"),
								react_jsx_runtime.jsx("span", {
									className: "dsh-at-tsum",
									"data-follow-end": running || void 0,
									children: summary,
								}, "sum"),
							],
						}),
						children: react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
							children: [
								react_jsx_runtime.jsx("div", { className: "dsh-at-tbody", children: text }, "body"),
								react_jsx_runtime.jsx(InlineTranslation, {
									cacheKey: cacheKey,
									text: text,
									model: model,
									mode: "translate",
									running: running,
								}, "trans"),
							],
						}),
					}, "disclosure"),
				],
			});
		});
		//#endregion

		//#region dsh-auto-translate/TranslateAssistantNodeView.js
		/**
		 * Shadow renderer for the `assistant-step` keyed seat (priority -100
		 * shadows the harness's priority-0 default — the same technique the
		 * dsh-better-markdown plugin uses). Re-implements the default
		 * AssistantNodeView/AssistantMarkdown block loop from the public
		 * primitives, adding an inline Chinese translation under every text
		 * block and inside every reasoning disclosure.
		 */
		const TranslateAssistantNodeView = react.memo(function TranslateAssistantNodeView({ node, useTurnData, openFile, loadImage, fileMentions }) {
			const data = node.data;
			const turn = node.location.kind === "turn" || node.location.kind === "step" ? node.location.turn : void 0;
			const tail = useTurnData("turn-tail");
			const owner = react.useMemo(() => {
				if (turn?.status !== "closed" || data.finalNode === undefined) return void 0;
				if (tail?.closing?.finalNode.seq !== data.finalNode.seq) return void 0;
				return { turn, seq: data.finalNode.seq, openFile };
			}, [data.finalNode, openFile, tail, turn]);
			const mentions = react.useMemo(() => (owner === undefined ? void 0 : fileMentions(owner)), [fileMentions, owner]);
			const streaming = data.status === "running";
			const interrupted = data.status === "interrupted";
			const model = data.finalNode?.provenance?.model ?? data.finalNode?.requestConfig?.model ?? undefined;

			const imageLoader = loadImage ?? (() => Promise.reject(new Error("image unavailable")));
			const codeLabels = react.useMemo(() => ({ copyLabel: "复制", copiedLabel: "已复制" }), []);
			const blocks = data.blocks ?? [];
			const last = blocks.length - 1;
			if (!(streaming || interrupted === true || blocks.some((block) => block !== undefined && block.kind !== "tool-call"))) return null;

			const rendered = [];
			for (let i = 0; i < blocks.length; i++) {
				const block = blocks[i];
				if (block === undefined) continue;
				switch (block.kind) {
					case "text":
						rendered.push(react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
							children: [
								react_jsx_runtime.jsx(primitives.MarkdownText, {
									text: block.text,
									streaming,
									codeLabels,
									fileMentions: mentions,
								}, "md"),
								react_jsx_runtime.jsx(InlineTranslation, {
									cacheKey: node.key + ":" + i,
									text: block.text,
									model,
									mode: "translate",
									running: streaming && i === last,
								}, "trans"),
							],
						}, i));
						break;
					case "reasoning":
						rendered.push(react_jsx_runtime.jsx(ThinkRow, {
							text: block.text,
							running: streaming && i === last,
							cacheKey: node.key + ":" + i,
							model,
						}, i));
						break;
					case "image": {
						const start = i;
						const group = [block];
						while (i + 1 < blocks.length) {
							const next = blocks[i + 1];
							if (next === undefined || next.kind !== "image") break;
							group.push(next);
							i += 1;
						}
						rendered.push(react_jsx_runtime.jsx(attachment.ImageGallery, {
							images: group,
							load: imageLoader,
							align: "start",
							labels: { aria: "图片", pending: "加载中…", failed: "加载失败" },
						}, start));
						break;
					}
					case "tool-call":
						break;
					default:
						rendered.push(react_jsx_runtime.jsx(primitives.JsonBlock, {
							label: "未知内容块",
							payload: block.block,
							truncatedLabel: (total) => "已截断，共 " + String(total) + " 项",
						}, i));
				}
			}
			return react_jsx_runtime.jsx("div", {
				className: "dsh-at-mroot",
				"data-streaming": streaming || void 0,
				children: react_jsx_runtime.jsxs("div", {
					className: "dsh-at-mbody",
					children: [rendered, interrupted && react_jsx_runtime.jsx("span", { className: "dsh-at-mstopped", children: "已停止" }, "stopped")],
				}),
			});
		});
		//#endregion

		//#region dsh-auto-translate/tool-output.js
		/** Whether a tool call block has settled (has a result). */
		function isSettledTool(block) {
			return block !== undefined && "kind" in block;
		}

		/** Join the text content blocks of a tool result. */
		function toolOutputText(block) {
			if (!isSettledTool(block)) return "";
			const parts = [];
			for (const content of block.content ?? []) {
				if (content?.type === "text" && typeof content.text === "string" && content.text.trim() !== "") {
					parts.push(content.text);
				}
			}
			if (parts.length === 0 && block.isError) {
				const error = block.error;
				if (error !== undefined) return String(error.name) + (error.code !== undefined ? ": " + String(error.code) : "");
			}
			return parts.join("\n");
		}

		/**
		 * Collect the tool calls of one turn from the conversation snapshot.
		 * A tool call is paired from its root `tool-call` node (which carries
		 * the settled output) and the assistant-step blocks (which carry the
		 * call name while running).
		 * @param snapshot - the current conversation snapshot.
		 * @param turn - the completed turn number.
		 * @returns deduplicated tool entries { callId, name, output }.
		 */
		function collectTurnTools(snapshot, turn) {
			const locations = snapshot?.chat?.locations;
			const nodes = snapshot?.chat?.nodes;
			if (locations === undefined || nodes === undefined) return [];
			const keys = locations.getTurn(turn) ?? [];
			const byCallId = new Map();
			for (const key of keys) {
				const node = nodes.get(key);
				if (node === undefined) continue;
				if (node.kind === "tool-call") {
					const root = node.data?.root;
					if (root === undefined) continue;
					const entry = byCallId.get(root.callId) ?? { callId: root.callId, name: "", output: "" };
					if (isSettledTool(root)) {
						entry.name = entry.name || root.call?.name || "";
						entry.output = toolOutputText(root);
					} else {
						entry.name = entry.name || root.name || "";
					}
					byCallId.set(root.callId, entry);
				} else if (node.kind === "assistant-step") {
					const blocks = node.data?.blocks;
					if (!Array.isArray(blocks)) continue;
					for (const block of blocks) {
						if (block === undefined || block.kind !== "tool-call") continue;
						const entry = byCallId.get(block.callId) ?? { callId: block.callId, name: block.name, output: "" };
						entry.name = entry.name || block.name;
						byCallId.set(block.callId, entry);
					}
				}
			}
			return [...byCallId.values()];
		}
		//#endregion

		//#region dsh-auto-translate/TurnTranslateTail.js
		/**
		 * Turn-tail contribution (chain seat, additive): one Chinese summary
		 * line per tool call in the turn, rendered below the turn's tool cards.
		 * The reasoning and reply translations live in the shadowed
		 * assistant-step renderer; this seat only covers tool outputs, because
		 * the chat view has no additive seat inside a tool card and the tool
		 * call renderer cannot be shadowed without losing the dedicated tool
		 * views (bash / web / read …).
		 */
		const TurnTranslateTail = react.memo(function TurnTranslateTail({ matched, useSession }) {
			const key = String(matched.turn) + ":" + String(matched.seq);
			const tools = useSession((snapshot) => collectTurnTools(snapshot, matched.turn));
			const settled = tools.filter((tool) => tool.output !== "");
			if (settled.length === 0) return null;
			return react_jsx_runtime.jsx("div", {
				className: "dsh-at-tail",
				"data-auto-translate": true,
				children: settled.map((tool) => {
					const gloss = glossOf(tool.name);
					const label = gloss === null ? String(tool.name) + "（自定义工具）" : String(tool.name) + " — " + gloss;
					return react_jsx_runtime.jsx("div", {
						className: "dsh-at-tail-item",
						children: [
							react_jsx_runtime.jsx("div", { className: "dsh-at-toolname", children: label }, "name"),
							react_jsx_runtime.jsx(InlineTranslation, {
								cacheKey: "call:" + tool.callId,
								text: tool.output,
								model: undefined,
								mode: "summarize",
								running: false,
							}, "summary"),
						],
					}, tool.callId);
				}),
			});
		});
		//#endregion

		//#region dsh-auto-translate/index.js
		/**
		 * Client plugin body:
		 * 1. A shadow registration on the keyed `conversation.chat.node` seat
		 *    for `assistant-step` at priority -100 (shadowing the harness's
		 *    priority-0 default) — this owns the in-place reasoning and reply
		 *    translations.
		 * 2. A chain entry on the additive `conversation.chat.turnTail` seat —
		 *    tool-output summaries, rendered below the turn's tool cards.
		 * The `tool-call` node itself is deliberately NOT shadowed: its
		 * renderer owns the `tool.call.toolview` child-slot declaration (slot
		 * declarations are globally unique), so shadowing it is impossible
		 * without losing the dedicated tool views.
		 * If a shadow renderer crashes it abdicates and the harness default
		 * takes over automatically.
		 * @param ctx - client root context.
		 */
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "assistant-step",
				priority: -100,
			}, TranslateAssistantNodeView));
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				id: "auto-translate",
				priority: 10,
				select: (owner) => ({ turn: owner.turn, seq: owner.seq }),
			}, TurnTranslateTail));
		}
		//#endregion
		exports.TranslateAssistantNodeView = TranslateAssistantNodeView;
		exports.TurnTranslateTail = TurnTranslateTail;
		exports.InlineTranslation = InlineTranslation;
		exports.ThinkRow = ThinkRow;
		exports.collectTurnTools = collectTurnTools;
		exports.apply = apply;
		exports.inject = inject;
	return module.exports;
	}
});

//# sourceMappingURL=client.js.map
