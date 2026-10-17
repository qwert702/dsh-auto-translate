window.__ModuleLoader__.load({
	id: "dsh-auto-translate",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let primitives = require("@deepseek-ai/dsh-client-ui-primitives");

		//#region dsh-auto-translate/styles.js
		// One style tag, hashed tag id, injected once per page — the same
		// mechanism the harness bundles use for CSS modules (see
		// dsh-client-modules: every side effect lives inside the factory).
		// All classes are ours (dsh-at- prefix); nothing depends on the
		// harness's hashed class names.
		const cssId = "@dsh-auto-translate/TurnTranslateTail.module.css";
		const css = "" +
			// assistant message body (mirrors AssistantMarkdown's root/body)
			".dsh-at-mroot{color:var(--dsw-alias-label-primary);flex-direction:column;font-size:16px;line-height:28px;display:flex}" +
			".dsh-at-mbody{flex-direction:column;gap:16px;display:flex}" +
			".dsh-at-mbody>[data-turn-process-inline][hidden]{margin-bottom:-16px}" +
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
			".dsh-at-think .dsh-at-tbody{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:12px;margin:4px 0 4px 4px;padding:12px 16px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:22px;overflow:auto;max-height:260px}" +
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

		//#region dsh-auto-translate/labels.js
		/**
		 * 读取一条 chat 命名空间的文案，缺失（或未拿到 t 席位）时回退到中文。
		 * 0.2.0 的 t 走「条目命名空间 → common → 键名」的解析链，缺键不会抛错；
		 * 返回键名本身即视为缺失。
		 */
		function label(t, key, params, fallback) {
			const template = typeof t === "function" ? t(key, params) : undefined;
			let text = typeof template === "string" && template !== "" && template !== key ? template : (fallback ?? key);
			if (params === undefined) return text;
			for (const [name, value] of Object.entries(params)) text = text.replaceAll("{" + name + "}", String(value));
			return text;
		}

		/**
		 * 构造 MarkdownText 的 labels。0.2.0 的 MarkdownText 会直接解引用
		 * `labels.code` / `labels.footnotes`（缺了会崩），所以必须提供；调用方用
		 * useMemo 固定引用，否则会丢掉流式渲染缓存。
		 */
		function markdownLabels(t) {
			return {
				code: {
					copyLabel: label(t, "copy", void 0, "复制"),
					copiedLabel: label(t, "copied", void 0, "已复制"),
					toolbarLabels: {
						codeLabel: label(t, "codeBlock.title", void 0, "代码块"),
						wrapLabel: label(t, "codeBlock.wrap", void 0, "自动换行"),
						unwrapLabel: label(t, "codeBlock.unwrap", void 0, "取消自动换行"),
					},
				},
				footnotes: label(t, "markdown.footnotes", void 0, "脚注"),
			};
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

		//#region dsh-auto-translate/ReasoningRow.js
		/** 首行摘要（0.2.0 官方 ReasoningRow 的落定态摘要）。 */
		function firstLine(text) {
			const newline = text.indexOf("\n");
			return newline === -1 ? text : text.slice(0, newline);
		}

		/** 运行中取最后一个已完成段落的首行（官方流式摘要策略）。 */
		function latestCompletedParagraphFirstLine(text) {
			let summary = "";
			let paragraphStart = 0;
			const separator = /\r?\n(?:[\t ]*\r?\n)+/g;
			while (true) {
				const nextParagraph = separator.exec(text);
				const paragraphEnd = nextParagraph === null ? text.length : nextParagraph.index + nextParagraph[0].indexOf("\n");
				const newline = text.indexOf("\n", paragraphStart);
				if (newline !== -1 && newline <= paragraphEnd) {
					const candidate = text.slice(paragraphStart, newline).trim();
					if (candidate !== "") summary = candidate;
				}
				if (nextParagraph === null) return summary;
				paragraphStart = nextParagraph.index + nextParagraph[0].length;
			}
		}

		/** 折叠态摘要：运行中跟随末尾段落，结束后取首行；去掉粗体标记。 */
		function reasoningSummary(text, running) {
			const source = running ? latestCompletedParagraphFirstLine(text) : firstLine(text);
			return source.replaceAll("**", "");
		}

		/**
		 * 渲染一个思考块：折叠摘要 + 展开态。正文用 MarkdownText（compact 变体，
		 * 和官方思考块排版一致），下方追加中文译文。展开/收起由外层两个形态组件
		 * 提供的 expanded/toggle 驱动，这里只做渲染。
		 */
		const ReasoningBody = react.memo(function ReasoningBody({ text, running, cacheKey, model, t, expanded, toggle }) {
			const labels = react.useMemo(() => markdownLabels(t), [t]);
			const summary = react.useMemo(() => reasoningSummary(text, running), [text, running]);
			const icon = typeof primitives.IconThinkOutlineRegular === "function"
				? react_jsx_runtime.jsx(primitives.IconThinkOutlineRegular, { size: 14 })
				: null;
			const collapsedContent = react.useMemo(() => react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
				children: [
					react_jsx_runtime.jsx("span", { className: "dsh-at-tsep", "aria-hidden": true }, "sep"),
					react_jsx_runtime.jsx("span", {
						className: "dsh-at-tsum",
						"data-streaming": running || void 0,
						children: summary,
					}, "sum"),
				],
			}), [running, summary]);
			const content = expanded
				? react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
					children: [
						react_jsx_runtime.jsx("div", {
							className: "dsh-at-tbody",
							children: react_jsx_runtime.jsx(primitives.MarkdownText, {
								text,
								streaming: running,
								labels,
								variant: "compact",
							}),
						}, "body"),
						react_jsx_runtime.jsx(InlineTranslation, {
							cacheKey,
							text,
							model,
							mode: "translate",
							running,
						}, "trans"),
					],
				})
				: undefined;
			return react_jsx_runtime.jsxs("div", {
				className: "dsh-at-think",
				"data-variant": "think",
				"data-state": running ? "running" : "ok",
				"data-expanded": expanded || void 0,
				children: [
					react_jsx_runtime.jsx(primitives.DisclosureRow, {
						rowClassName: "dsh-at-trow",
						leadingClassName: "dsh-at-tlead",
						titleClassName: "dsh-at-ttitle",
						chevronClassName: "dsh-at-tchev",
						icon,
						title: label(t, "message.think", void 0, "Think"),
						running,
						open: expanded,
						expandable: true,
						expandOnRowClick: true,
						onToggle: toggle,
						collapsedContent,
						children: content,
					}, "disclosure"),
				],
			});
		});

		/**
		 * 优先用坐席给的 useDisclosure（展开态随所属 Turn 复位，和官方思考块一致）；
		 * 坐席未提供时退回组件自身的 useState。两种形态各自是独立组件，保证 Hook
		 * 调用顺序恒定。（这里显式转发字段而不是展开 props：React 18.3 的元素 props
		 * 上挂着一个不可枚举的 key，整体透传会触发 dev 警告。）
		 */
		function ReasoningBlock(props) {
			const forwarded = {
				text: props.text,
				running: props.running,
				cacheKey: props.cacheKey,
				model: props.model,
				useDisclosure: props.useDisclosure,
				t: props.t,
			};
			if (typeof props.useDisclosure === "function") return react_jsx_runtime.jsx(ReasoningWithDisclosure, forwarded);
			return react_jsx_runtime.jsx(ReasoningWithLocalState, forwarded);
		}

		const ReasoningWithDisclosure = react.memo(function ReasoningWithDisclosure(props) {
			const disclosure = props.useDisclosure();
			return react_jsx_runtime.jsx(ReasoningBody, {
				text: props.text,
				running: props.running,
				cacheKey: props.cacheKey,
				model: props.model,
				t: props.t,
				expanded: disclosure.expanded,
				toggle: disclosure.toggle,
			});
		});

		const ReasoningWithLocalState = react.memo(function ReasoningWithLocalState(props) {
			const [expanded, setExpanded] = react.useState(false);
			const toggle = react.useCallback(() => setExpanded((value) => !value), []);
			return react_jsx_runtime.jsx(ReasoningBody, {
				text: props.text,
				running: props.running,
				cacheKey: props.cacheKey,
				model: props.model,
				t: props.t,
				expanded,
				toggle,
			});
		});
		//#endregion

		//#region dsh-auto-translate/TranslateAssistantNodeView.js
		/** 取最终消息的模型 id（0.2.0 在 providerMetadata / requestConfig 上）。 */
		function assistantModel(finalNode) {
			if (finalNode === void 0 || finalNode === null) return undefined;
			const model = finalNode.providerMetadata?.model ?? finalNode.requestConfig?.model ?? finalNode.provenance?.model;
			return typeof model === "string" && model !== "" ? model : undefined;
		}

		/**
		 * 行内思考块在「Turn-process 折叠」时的包装：官方用 hidden="until-found"
		 * 让浏览器页内查找仍能命中并自动展开，这里复刻同一语义（含 beforematch
		 * 与焦点保护）。
		 * @param props.hidden - 当前是否应隐藏。
		 * @param props.reveal - 命中或被聚焦时展开整个 process 折叠区。
		 */
		function ProcessInline({ hidden, reveal, children }) {
			const ref = react.useRef(null);
			// 浏览器里用 layout effect 避免折叠态先闪一帧；SSR（无 document）退回
			// useEffect，React 不会为它在服务端渲染时报警告。
			const useIsoEffect = typeof document === "undefined" ? react.useEffect : react.useLayoutEffect;
			useIsoEffect(() => {
				const element = ref.current;
				if (element === null) return;
				if (hidden && element.contains(element.ownerDocument.activeElement)) {
					reveal();
					return;
				}
				if (hidden) element.setAttribute("hidden", "until-found");
				else element.removeAttribute("hidden");
			}, [hidden, reveal]);
			react.useEffect(() => {
				const element = ref.current;
				if (element === null) return;
				element.addEventListener("beforematch", reveal);
				return () => {
					element.removeEventListener("beforematch", reveal);
				};
			}, [reveal]);
			return react_jsx_runtime.jsx("div", {
				ref,
				"data-turn-process-inline": hidden || void 0,
				children,
			});
		}

		/**
		 * Shadow renderer for the keyed `assistant-step` seat on
		 * `conversation.chat.node` (priority -100 shadows the harness's
		 * priority-0 default). Re-implements the 0.2.0 AssistantNodeView /
		 * AssistantMarkdown block loop from the public primitives, adding an
		 * inline Chinese translation under every text block and inside every
		 * reasoning disclosure.
		 *
		 * Safety: an unrecognizable node shape throws instead of degrading, so
		 * the renderer's error boundary abdicates this entry and the official
		 * AssistantNodeView (priority 0) takes over — the message is never lost.
		 */
		const TranslateAssistantNodeView = react.memo(function TranslateAssistantNodeView(props) {
			const node = props.node;
			if (node === undefined || node === null || typeof node !== "object"
				|| node.data === undefined || node.data === null
				|| !Array.isArray(node.data.blocks)) {
				throw new Error("dsh-auto-translate: 无法识别的 assistant-step 节点，交回官方渲染器");
			}
			return react_jsx_runtime.jsx(TranslateAssistantBody, {
				node,
				groupPart: props.groupPart,
				useTurnData: props.useTurnData,
				useDisclosure: props.useDisclosure,
				turnProcess: props.turnProcess,
				openFile: props.openFile,
				fileMentions: props.fileMentions,
				renderMessageImages: props.renderMessageImages,
				t: props.t,
			});
		});

		/** 对齐 0.2.0 坐席 props 的正文渲染（node / groupPart / 标准钩子 / t）。 */
		const TranslateAssistantBody = react.memo(function TranslateAssistantBody({ node, groupPart, useTurnData, useDisclosure, turnProcess, openFile, fileMentions, renderMessageImages, t }) {
			const data = node.data;
			const location = node.location;
			const turn = location !== undefined && (location.kind === "turn" || location.kind === "step") ? location.turn : undefined;
			const tail = typeof useTurnData === "function" ? useTurnData("turn-tail") : undefined;
			const owner = react.useMemo(() => {
				if (turn === undefined || turn.status !== "closed" || data.finalNode === undefined) return undefined;
				if (tail?.closing?.finalNode?.seq !== data.finalNode.seq) return undefined;
				return { turn, seq: data.finalNode.seq, openFile };
			}, [data.finalNode, openFile, tail, turn]);
			const mentions = react.useMemo(() => (owner === undefined || typeof fileMentions !== "function" ? undefined : fileMentions(owner)), [fileMentions, owner]);
			const labels = react.useMemo(() => markdownLabels(t), [t]);
			const revealProcess = react.useCallback(() => {
				turnProcess?.setOpen(true);
			}, [turnProcess]);
			const reasoningHidden = turnProcess !== undefined && turnProcess.foldable === true
				&& turnProcess.spec?.answerStep === data.step
				&& turnProcess.spec?.inlineReasoning === true
				&& turnProcess.open !== true;
			const streaming = data.status === "running";
			const interrupted = data.status === "interrupted";
			const model = assistantModel(data.finalNode);
			const blocks = data.blocks;
			const last = blocks.length - 1;
			if (!(streaming || interrupted === true || blocks.some((block) => block !== undefined && block.kind !== "tool-call"))) return null;

			const rendered = [];
			for (let i = 0; i < blocks.length; i++) {
				const block = blocks[i];
				if (block === undefined) continue;
				// 0.2.0 的 Turn-process 分组会用 groupPart 把同一 Assistant 拆成
				// "reasoning" / "response" 两次渲染；不遵守就会重复显示内容。
				if (groupPart === "reasoning" && block.kind !== "reasoning") continue;
				if (groupPart === "response" && block.kind === "reasoning") continue;
				switch (block.kind) {
					case "text":
						rendered.push(react_jsx_runtime.jsxs(react_jsx_runtime.Fragment, {
							children: [
								react_jsx_runtime.jsx(primitives.MarkdownText, {
									text: block.text,
									streaming,
									labels,
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
						rendered.push(react_jsx_runtime.jsx(ProcessInline, {
							hidden: reasoningHidden,
							reveal: revealProcess,
							children: react_jsx_runtime.jsx(ReasoningBlock, {
								text: block.text,
								running: streaming && i === last,
								cacheKey: node.key + ":" + i,
								model,
								useDisclosure,
								t,
							}),
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
						// 0.2.0 的图片由属主席位 `conversation.message.images` 渲染：
						// 调用 Chat 视图下发的 renderMessageImages 才是官方路径
						// （ui-attachment 不再导出 ImageGallery）。
						if (typeof renderMessageImages === "function") {
							rendered.push(react_jsx_runtime.jsx(react.Fragment, {
								children: renderMessageImages({
									images: group.map((item) => ({ attachment: item.attachment })),
									align: "start",
								}),
							}, start));
						}
						break;
					}
					case "tool-call":
						break;
					default:
						rendered.push(react_jsx_runtime.jsx(primitives.JsonBlock, {
							label: label(t, "message.unknownBlock", void 0, "未知内容块"),
							payload: block.block,
							truncatedLabel: (total) => label(t, "json.truncated", { total }, "已截断，共 {total} 项"),
						}, i));
				}
			}
			const showStopped = interrupted === true
				&& (groupPart === undefined || groupPart === "response"
					|| !blocks.some((block) => block !== undefined && block.kind !== "reasoning" && block.kind !== "tool-call"));
			return react_jsx_runtime.jsx("div", {
				className: "dsh-at-mroot",
				"data-streaming": streaming || void 0,
				children: react_jsx_runtime.jsxs("div", {
					className: "dsh-at-mbody",
					children: [
						rendered,
						showStopped && react_jsx_runtime.jsx("span", {
							className: "dsh-at-mstopped",
							children: label(t, "message.stopped", void 0, "已停止"),
						}, "stopped"),
					],
				}),
			});
		});
		//#endregion

		//#region dsh-auto-translate/tool-output.js
		/** Whether a tool call block has settled (0.2.0 discriminates by kind). */
		function isSettledTool(block) {
			return block !== undefined && block !== null && block.kind === "tool-result";
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
		 * Collect the tool calls of one turn from the Chat snapshot.
		 * 0.2.0 hands the Chat target through `useChat` and exposes the same
		 * `locations.getTurn` / `nodes.get(key)` readers, so a tool call is
		 * paired from its root `tool-call` node (which carries the settled
		 * output) and the assistant-step blocks (which carry the call name while
		 * running).
		 * @param snapshot - the Chat snapshot (`ChatSnapshot`, not the Session one).
		 * @param turn - the completed turn number.
		 * @returns deduplicated tool entries { callId, name, output }.
		 */
		function collectTurnTools(snapshot, turn) {
			const locations = snapshot?.locations;
			const nodes = snapshot?.nodes;
			if (locations === undefined || nodes === undefined || typeof locations.getTurn !== "function") return [];
			const keys = locations.getTurn(turn) ?? [];
			const byCallId = new Map();
			for (const key of keys) {
				const node = typeof nodes.get === "function" ? nodes.get(key) : undefined;
				if (node === undefined || node === null) continue;
				if (node.kind === "tool-call") {
					const root = node.data?.root;
					if (root === undefined || root === null) continue;
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
		/** 0.2.0 的坐席 owner 传 TurnLocation 对象；更早的形状传数值，两种都认。 */
		function turnNumberOf(turn) {
			if (typeof turn === "number") return turn;
			if (turn !== null && typeof turn === "object" && typeof turn.turn === "number") return turn.turn;
			return undefined;
		}

		let warnedMissingChat = false;

		/**
		 * 缺少 useChat 标准钩子时的诊断（只警告一次）。0.2.0 里 `chat` 标准钩子
		 * 由 ui-chat 通过 uiSession.provide 提供；拿不到就只少一行工具摘要，
		 * 官方 turn-tail 仍然完整渲染。
		 */
		function warnMissingChat() {
			if (warnedMissingChat) return;
			warnedMissingChat = true;
			console.warn("[dsh-auto-translate] 当前组合未提供 useChat 标准钩子，工具摘要行已跳过（官方视图不受影响）");
		}

		/**
		 * Turn-tail contribution (list seat, additive): one Chinese summary line
		 * per settled tool call in the turn, rendered by the official turn-tail
		 * node just above the turn's action row. The reasoning and reply
		 * translations live in the shadowed assistant-step renderer; this seat
		 * only covers tool outputs, because the chat view has no additive seat
		 * inside a tool card and the tool call renderer cannot be shadowed
		 * without losing the dedicated tool views (bash / web / read …).
		 */
		function TurnTranslateTail(props) {
			if (typeof props.useChat !== "function") {
				warnMissingChat();
				return null;
			}
			return react_jsx_runtime.jsx(TurnTranslateTailBody, {
				turn: props.turn,
				seq: props.seq,
				useChat: props.useChat,
			});
		}

		const TurnTranslateTailBody = react.memo(function TurnTranslateTailBody({ turn, seq, useChat }) {
			const turnNumber = turnNumberOf(turn);
			const chat = useChat((snapshot) => snapshot);
			const tools = react.useMemo(() => collectTurnTools(chat, turnNumber), [chat, turnNumber]);
			const settled = react.useMemo(() => tools.filter((tool) => tool.output !== ""), [tools]);
			if (settled.length === 0) return null;
			return react_jsx_runtime.jsx("div", {
				className: "dsh-at-tail",
				"data-auto-translate": true,
				"data-auto-translate-tail": String(turnNumber) + ":" + String(seq),
				children: settled.map((tool) => {
					const gloss = glossOf(tool.name);
					const nameText = gloss === null ? String(tool.name) + "（自定义工具）" : String(tool.name) + " — " + gloss;
					return react_jsx_runtime.jsx("div", {
						className: "dsh-at-tail-item",
						children: [
							react_jsx_runtime.jsx("div", { className: "dsh-at-toolname", children: nameText }, "name"),
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
		/** chat 命名空间：坐席属主包 ui-chat 的词典（locale 席位由框架合成 t）。 */
		const CHAT_NS = "chat";

		/**
		 * Client plugin body:
		 * 1. A shadow registration on the keyed `conversation.chat.node` seat
		 *    for `assistant-step` at priority -100 (shadowing the harness's
		 *    priority-0 default) — this owns the in-place reasoning and reply
		 *    translations. Both seats belong to `@deepseek-ai/dsh-client-ui-chat`
		 *    in 0.2.0.
		 * 2. A list entry on the additive `conversation.chat.turnTail` seat —
		 *    tool-output summaries, rendered below the turn's action row.
		 * The `tool-call` node itself is deliberately NOT shadowed: its
		 * renderer owns the `tool.call.toolview` child-slot declaration (slot
		 * declarations are globally unique), so shadowing it is impossible
		 * without losing the dedicated tool views.
		 * If a shadow renderer crashes (or meets a shape it does not know), it
		 * abdicates and the harness default takes over automatically.
		 * @param ctx - client root context.
		 */
		const inject = ["slots"];
		function apply(ctx) {
			ctx.slots.inject("conversation.chat.node", () => ctx.slots.register({
				name: "conversation.chat.node",
				key: "assistant-step",
				priority: -100,
				locale: CHAT_NS,
			}, TranslateAssistantNodeView));
			ctx.slots.inject("conversation.chat.turnTail", () => ctx.slots.register({
				name: "conversation.chat.turnTail",
				id: "auto-translate",
				order: 10,
			}, TurnTranslateTail));
		}
		//#endregion
		exports.TranslateAssistantNodeView = TranslateAssistantNodeView;
		exports.TurnTranslateTail = TurnTranslateTail;
		exports.InlineTranslation = InlineTranslation;
		exports.ReasoningBlock = ReasoningBlock;
		exports.collectTurnTools = collectTurnTools;
		exports.markdownLabels = markdownLabels;
		exports.apply = apply;
		exports.inject = inject;
	return module.exports;
	}
});

//# sourceMappingURL=client.js.map
