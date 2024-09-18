(async () => {
	const WASM_URL = document.currentScript.dataset.uclearnWasmUrl;
	const DEBUG = true;

	const patch = (method, transformer, locals = {}) => {
		let newContent = transformer(method.toString());
		window.__uclearn_hooks._debug_values.push(locals);
		if(DEBUG) newContent = newContent.replace('{', `{console.log("Called", ${JSON.stringify(method.name)}, window.__uclearn_hooks._debug_values[${window.__uclearn_hooks._debug_values.length - 1}]);`);
		if(!/^[^{]*=>/.test(newContent)) newContent = newContent.replace(/^(\s*(?:async\s+)?)(?=\w+)(?!function)/, "$1function ");
		return new Function(...Object.keys(locals), `return ${newContent};`)(...Object.values(locals));
	};
	const patchObj = (obj, method, transformer, locals = {}) => {
		// biome-ignore lint/suspicious/noAssignInExpressions: no u
		return obj[method] = patch(obj[method], transformer, locals);
	};
	const postModuleHook = (module, hook, locals = {}) => {
		const hookContents = `(module => (${hook.toString()
			.replace(/\bpatchObj\b/, `(patchObj = ${patchObj.toString()})`)
			.replace(/\bpatch\b/, `(patch = ${patch.toString()})`)
			.replaceAll("new Function", "((...args) => (__content=args.pop(),eval(`(${args.join(',')}) => {${__content}}`)))")})(module) ?? module)`;
		return patch(
			module,
			src => src.replace(/return(?!(?:.|\n)*return)/, `return eval(${JSON.stringify(hookContents)})(`)
				.replace(/;?\s*\}(?!(?:.|\n)*\})/, ");}"),
			locals
		);
	};

	const courseIconsCode = () => {
		// Boost Union JS to change the completion indication if enabled.
		if(document.body.classList.contains('hascourseindexcmicons')) {
			// Completion indication should be encoded in cm icon.
			if(document.body.classList.contains('hascourseindexcplicon')) {
				// courseindex-cmicon-cpl-sol
				// courseindex-cmicon-cpl-icon
				// courseindex-cmicon-cpl-eol

				// Completion indication not shown at start of line anymore.
				for(const el of document.querySelectorAll('.courseindex-item span.completioninfo.courseindex-cmicon-cpl-sol')) {
					el.dataset.for = '_';
				}

				// The completion indication within the icon is now the active one.
				for(const el of document.querySelectorAll('.courseindex-item span.completioninfo.courseindex-cmicon-cpl-icon')) {
					el.dataset.for = 'cm_completion';
				}

				// Changes to this completion indication will be observed.
				const observer = new MutationObserver((mutations) => {
					for(const mutation of mutations) {
						const target = mutation.target;
						if(!(target instanceof HTMLElement) || target.closest('[id^="courseindex-cmicon-observ-"]')) continue;
						const node = target.childNodes[3];
						if(node.id.startsWith('courseindex-cmicon-cplid-')) {
							const cplel = document.getElementById(node.id);
							// Set the completion color for the icon based on the completion status.
							switch(node.dataset.value) {
								case 'NaN':
									break;
								case '0':
									cplel.closest('.courseindex-cmicon-container').classList.add('courseindex-cmicon-cpl-incomplete');
									break;
								case '1':
									cplel.closest('.courseindex-cmicon-container').classList.add('courseindex-cmicon-cpl-complete');
									break;
								case '3':
									cplel.closest('.courseindex-cmicon-container').classList.add('courseindex-cmicon-cpl-fail');
									break;
							}
						}
					};
				});
				observer.observe(document.getElementById('courseindex'), { attributes: true, childList: true });

				// Or completion indication should be shown at the end of the line.
			} else if(document.body.classList.contains('hascourseindexcpleol')) {
				// Completion indication not shown at start of line anymore.
				for(const el of document.querySelectorAll('.courseindex-item span.completioninfo.courseindex-cmicon-cpl-sol')) {
					el.dataset.for = '_';
				}

				// The completion indication at the end of the line is now the active one.
				for(const el of document.querySelectorAll('.courseindex-item span.completioninfo.courseindex-cmicon-cpl-eol')) {
					el.dataset.for = 'cm_completion';
				}
			}
		}
	};

	const DB_NAME = "uclearn";
	const dbReq = indexedDB.open(DB_NAME, 1);
	let cacheDb;
	const DB_COURSEINDEXCACHE_STORE = "courseIndex";
	const DB_COURSE_PATH = "courseId";
	const DB_HTML_PATH = "html";
	const DB_JS_PATH = "js";
	const DB_COURSE_INDEX = "courseIndex";

	dbReq.addEventListener("upgradeneeded", e => {
		const db = dbReq.result;
		if(e.oldVersion < 1) {
			const store = db.createObjectStore(DB_COURSEINDEXCACHE_STORE, { keyPath: DB_COURSE_PATH });
		}
	});

	dbReq.addEventListener("success", () => {
		cacheDb = dbReq.result;
		cacheDb.addEventListener("versionchange", () => {
			cacheDb.close();
			alert("Please reload this page for the latest version.");
		});
	});

	const { optimise_js } = wasm_bindgen;
	await wasm_bindgen(WASM_URL);

	window.__uclearn_hooks = {
		_debug_values: [],
		async storageGet(course, key) {
			if(!(cacheDb instanceof IDBDatabase)) return;
			const tx = cacheDb.transaction(key, "readonly");
			const store = tx.objectStore(key);
			return DEBUG ? {} : await new Promise((res, rej) => {
				const req = store.get(course.reactive.courseId);
				req.addEventListener("success", () => res(req.result));
				req.addEventListener("error", rej);
			}) ?? {};
		},
		async storageSet(course, key, value) {
			if(!(cacheDb instanceof IDBDatabase)) return;
			const tx = cacheDb.transaction(key, "readwrite");
			const store = tx.objectStore(key);
			return await new Promise((res, rej) => {
				const req = store.put({
					[DB_COURSE_PATH]: course.reactive.courseId,
					[DB_HTML_PATH]: value.html,
					[DB_JS_PATH]: value.js,
				});
				req.addEventListener("success", res);
				req.addEventListener("error", rej);
			});
		},
		async storageSetHtmlJs(course, key, { html, js }) {
			return this.storageSet(course, key, {
				html: html.replaceAll(/\s+/g, " "),
				js: this.optimiseJs(js)
			});
		},
		optimiseJs: optimise_js/* (js) {
			console.time("icons");
			const iconsJs = `(${courseIconsCode.toString()})();`;
			console.timeEnd("icons");
			console.time("rest");
			const restJs = js.replaceAll(/^(\s*)if.*hascourseindexcmicons(?:.|\n)*?^\1}\s*;?/gm, "");
			console.timeEnd("rest");
			const finalDeps = [];
			let contents = "";
			let count = 0;
			console.time("requires");
			for(const match of restJs.matchAll(/^(\s*)require\((?<deps>.*?),\s*function\s*\((?<args>.*)\)\s*{(?<content>(?:.|\n)*?)^\1}\)/gm)) {
				const args = match.groups.args.split(",").map(arg => arg.trim());
				let deps = JSON.parse(match.groups.deps.replaceAll("'", '"'));
				if(typeof deps === "string") deps = [deps];
				let content = match.groups.content;
				for(let i = 0; i < Math.min(args.length, deps.length); i++) {
					let argId;
					if(finalDeps.includes(deps[i])) {
						argId = finalDeps.indexOf(deps[i]);
					} else {
						argId = finalDeps.length;
						finalDeps.push(deps[i]);
					}
					content = content.replaceAll(new RegExp(`\\b${args[i]}\\b`, "g"), `__${argId}`);
				}
				contents += content;
				if(++count > 16) {
					count = 0;
					contents += ";await new Promise(r => setTimeout(r, 0));";
				}
			}
			const requireJs = `require(${JSON.stringify(finalDeps)}, async (${finalDeps.map((el, i) => `__${i}`).join(",")}) => {${contents}});`;
			console.timeEnd("requires");
			console.time("excess");
			const excessJs = restJs
				.replaceAll(/^(\s*)require(?:.|\n)*?^\1}\s*\)\s*;?/gm, "")
				.replaceAll(/^[\s\n;]* /gm, "");
			console.timeEnd("excess");
			return `const __start = performance.now();${iconsJs}${requireJs}${excessJs
				};console.log("courseindex took", performance.now() - __start);`.replaceAll(/\s*\/\/.*$/gm, "");
		} */,
		optimizeReplaceNode(_templates, el, reHtml, reJs) {
			return _templates.default.replaceNode(el, reHtml, this.optimiseJs(reJs));
		}
	};
	window.define = new Proxy(window.define, {
		apply(target, thisArg, argArray) {
			let [name, deps, module, ...args] = argArray;
			if(!module) {
				module = deps;
				deps = [];
			}
			switch(name) {
				case "core_courseformat/local/courseindex/placeholder":
					module = postModuleHook(module, mod => {
						patchObj(
							mod.prototype,
							"stateReady",
							(src) => src.replaceAll(
								"this.loadStaticContent(",
								"await this.loadStaticContent(",
							),
						);
						patchObj(
							mod.prototype,
							"loadStaticContent",
							(src) => `async ${src.replaceAll(
								"this.reactive.getStorageValue(",
								"await window.__uclearn_hooks.storageGet(this,",
							)}`,
						);
						patchObj(
							mod.prototype,
							"loadTemplateContent",
							(src) =>
								src.replaceAll(
									"this.reactive.setStorageValue(",
									"await window.__uclearn_hooks.storageSetHtmlJs(this,",
								).replaceAll(
									"_templates.default.replaceNode(",
									"window.__uclearn_hooks.optimizeReplaceNode(_templates,"
								),
						);
						return mod;
					}, { DEBUG });
					break;
			}
			// console.log("DEFINE", name, "AS", module, "USING", deps, ...args);
			return target.call(thisArg, name, deps, module, ...args);
		}
	});
})();
