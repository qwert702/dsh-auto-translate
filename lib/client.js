window.__ModuleLoader__.load({
	id: "dsh-auto-translate",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");

		//#region dsh-auto-translate/tail.module.css
		// One style tag, hashed tag id, injected once per page — the same
		// mechanism the harness bundles use for CSS modules.
		const cssId = "@dsh-auto-translate/TurnTranslateTail.module.css";
		const css = ".dsh-at-root{display:flex;flex-direction:column;gap:4px;margin-top:6px}.dsh-at-strip{display:flex;gap:6px;align-items:flex-start;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 10px;font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}.dsh-at-badge{flex:none;margin-top:1px;font-size:10px;line-height:1.6;padding:0 5px;border-radius:4px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.dsh-at-text{min-width:0;white-space:pre-wrap}.dsh-at-error{cursor:pointer;border:1px dashed var(--dsw-alias-border-l2);border-radius:8px;padding:4px 10px;font-size:11px;color:var(--dsw-alias-label-tertiary)}.dsh-at-tools{display:flex;flex-direction:column;gap:2px}.dsh-at-tool{font-size:11px;line-height:1.6;color:var(--dsw-alias-label-tertiary)}";
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
		 * Composite names (e.g. `subagent_report`) resolve by longest
		 * prefix/suffix fallback; unknown tools render their raw name instead of
		 * an invented meaning.
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

		/**
		 * Resolve a tool call's Chinese gloss.
		 * @param name - the tool name from the call block.
		 * @returns the gloss, or null when the tool is unknown.
		 */
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
		/**
		 * Whether the assistant text looks like English prose worth translating.
		 * Heuristic: enough letters, mostly Latin script, no substantial CJK.
		 * @param text - the joined assistant text blocks.
		 * @returns whether a translation should be requested.
		 */
		function isEnglishProse(text) {
			const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
			const latin = (text.match(/[A-Za-z]/g) ?? []).length;
			const total = cjk + latin;
			if (total < 10) return false;
			if (cjk / total > 0.3) return false;
			return latin / total > 0.6;
		}

		/**
		 * Whether the text is mostly code (fenced blocks, indented lines,
		 * brace/statement-heavy lines). Code is not translated.
		 * @param text - the joined assistant text blocks.
		 * @returns whether translation should be skipped.
		 */
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
		/** Module-level translation cache: `${turn}:${seq}` -> translated text. */
		const translationCache = new Map();
		/** Cache size cap — old entries are dropped so a long-lived session does not leak. */
		const TRANSLATION_CACHE_LIMIT = 200;

		/**
		 * Store a translation in the bounded cache.
		 * @param key - the `${turn}:${seq}` cache key.
		 * @param translation - the translated text.
		 */
		function cacheTranslation(key, translation) {
			translationCache.set(key, translation);
			if (translationCache.size > TRANSLATION_CACHE_LIMIT) {
				const oldest = translationCache.keys().next().value;
				if (oldest !== undefined) translationCache.delete(oldest);
			}
		}

		/**
		 * Call the host translation route. The request carries only the text
		 * (plus the conversation's model id as a default hint); the response
		 * carries only the translation — the API key never leaves the server.
		 * @param text - the English text to translate.
		 * @param model - the current conversation model id, if known.
		 * @returns the translated text.
		 */
		async function requestTranslation(text, model) {
			const response = await fetch("/api/auto-translate/translate", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ text, model: model ?? undefined }),
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

		//#region dsh-auto-translate/turn-content.js
		/**
		 * Collect the translation-relevant content of one completed turn from
		 * the conversation snapshot: the joined assistant text, the turn's tool
		 * calls (first occurrence per name), and the conversation model id.
		 * @param snapshot - the current conversation snapshot.
		 * @param turn - the completed turn number.
		 * @returns the collected content.
		 */
		function collectTurnContent(snapshot, turn) {
			const locations = snapshot?.chat?.locations;
			const nodes = snapshot?.chat?.nodes;
			if (locations === undefined || nodes === undefined) return { text: "", tools: [], model: undefined };
			const keys = locations.getTurn(turn) ?? [];
			let text = "";
			let model;
			const tools = [];
			for (const key of keys) {
				const node = nodes.get(key);
				if (node === undefined) continue;
				if (node.kind === "assistant-step") {
					const data = node.data;
					const blocks = data?.blocks;
					if (Array.isArray(blocks)) {
						for (const block of blocks) {
							if (block === undefined) continue;
							if (block.kind === "text" && typeof block.text === "string" && block.text.trim() !== "") {
								if (text !== "") text += "\n";
								text += block.text;
							} else if (block.kind === "tool-call" && block.name) {
								tools.push({ name: block.name, argsRaw: block.argsRaw });
							}
						}
					}
					if (model === undefined) {
						const provenance = data?.finalNode?.provenance;
						if (provenance?.model) model = provenance.model;
						else if (data?.finalNode?.requestConfig?.model) model = data.finalNode.requestConfig.model;
					}
				} else if (node.kind === "tool-call") {
					const root = node.data?.root;
					if (root?.name) tools.push({ name: root.name, argsRaw: root.argsRaw });
				}
			}
			return { text, tools, model };
		}
		//#endregion

		//#region dsh-auto-translate/TurnTranslateTail.js
		/**
		 * The turn-tail contribution: for each completed turn, a Chinese
		 * translation strip below the assistant's English reply plus a small
		 * Chinese gloss line per tool call in the turn. Renders nothing when
		 * the turn carries neither English prose nor tool calls.
		 */
		const TurnTranslateTail = react.memo(function TurnTranslateTail({ matched, useSession }) {
			const key = String(matched.turn) + ":" + String(matched.seq);
			const content = useSession((snapshot) => collectTurnContent(snapshot, matched.turn));
			const [translation, setTranslation] = react.useState(() => translationCache.get(key) ?? null);
			const [failed, setFailed] = react.useState(false);
			const [retryTick, setRetryTick] = react.useState(0);

			const text = content.text.trim();
			const wants = text !== "" && isEnglishProse(text) && !isMostlyCode(text);

			react.useEffect(() => {
				if (!wants) return;
				const hit = translationCache.get(key);
				if (hit !== undefined) {
					setTranslation(hit);
					return;
				}
				let cancelled = false;
				setFailed(false);
				requestTranslation(text, content.model)
					.then((result) => {
						if (cancelled) return;
						cacheTranslation(key, result);
						setTranslation(result);
					})
					.catch(() => {
						if (!cancelled) setFailed(true);
					});
				return () => {
					cancelled = true;
				};
			}, [key, wants, text, content.model, retryTick]);

			const tools = [];
			const seen = new Set();
			for (const tool of content.tools) {
				if (tool.name && !seen.has(tool.name)) {
					seen.add(tool.name);
					tools.push(tool);
				}
			}
			const hasTools = tools.length > 0;
			if (!hasTools && translation === null && !failed) return null;

			const children = [];
			if (translation !== null) {
				children.push(react_jsx_runtime.jsx("div", {
					className: "dsh-at-strip",
					"data-auto-translate": true,
					children: [
						react_jsx_runtime.jsx("span", { className: "dsh-at-badge", children: "译" }, "badge"),
						react_jsx_runtime.jsx("span", { className: "dsh-at-text", children: translation }, "text"),
					],
				}, "translation"));
			}
			if (failed) {
				children.push(react_jsx_runtime.jsx("div", {
					className: "dsh-at-error",
					onClick: () => setRetryTick((value) => value + 1),
					children: "译文获取失败，点击重试",
				}, "error"));
			}
			if (hasTools) {
				children.push(react_jsx_runtime.jsx("div", {
					className: "dsh-at-tools",
					children: tools.map((tool, index) => {
						const gloss = glossOf(tool.name);
						const label = gloss === null ? String(tool.name) + "（自定义工具）" : String(tool.name) + " — " + gloss;
						return react_jsx_runtime.jsx("div", { className: "dsh-at-tool", children: label }, index);
					}),
				}, "tools"));
			}
			return react_jsx_runtime.jsx("div", { className: "dsh-at-root", children });
		});
		//#endregion

		//#region dsh-auto-translate/index.js
		/**
		 * Client plugin body: one chain entry on the completed-turn tail seat.
		 * The seat is additive (chain entries render in priority order beside
		 * the stock entries), so nothing in the conversation UI is replaced.
		 * @param ctx - client root context.
		 */
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				id: "auto-translate",
				priority: 10,
				select: (owner) => ({ turn: owner.turn, seq: owner.seq }),
			}, TurnTranslateTail));
		}
		//#endregion
		exports.TurnTranslateTail = TurnTranslateTail;
		exports.apply = apply;
		exports.inject = inject;
	return module.exports;
	}
});

//# sourceMappingURL=client.js.map
