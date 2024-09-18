(async () => {
	async function getRequire() {
		return window.require
			?? await window.__uclearn_require
			// biome-ignore lint/suspicious/noAssignInExpressions: shhh
			?? await (window.__uclearn_require = new Promise(res => {
				let _require;
				Object.defineProperty(window, "require", {
					get() {
						return _require;
					},
					set(value) {
						_require = value;
						if(_require instanceof Function)
							res(_require);
					}
				});
			}));
	}

	const hirschberg = (() => {
		const COST = 2;
		const SCOST = 1;
		function _NeedlemanWunsch(A, B, eq) {
			const F = [];
			for(let i = 0; i < B.length + 1; i++) {
				F.push(new Array(A.length + 1));
			}
			for(let i = 0; i < A.length + 1; i++) {
				F[0][i] = COST * i;
			}
			for(let j = 0; j < B.length + 1; j++) {
				F[j][0] = COST * j;
			}
			for(let i = 0; i < A.length; i++) {
				for(let j = 0; j < B.length; j++) {
					const Match = F[j][i] + SCOST * (!eq(A[i], B[j]) ? 1 : 0);
					const Delete = F[j + 1][i] + COST;
					const Insert = F[j][i + 1] + COST;
					F[j + 1][i + 1] = Math.min(Match, Insert, Delete);
				}
			}
			const AlignmentA = [];
			const AlignmentB = [];
			let i = A.length;
			let j = B.length;
			while(i > 0 || j > 0) {
				if(
					i > 0 &&
					j > 0 &&
					F[j][i] ===
					F[j - 1][i - 1] + SCOST * (!eq(A[i - 1], B[j - 1]) ? 1 : 0)
				) {
					AlignmentA.push(A[i - 1]);
					AlignmentB.push(B[j - 1]);
					i -= 1;
					j -= 1;
				} else if(i > 0 && F[j][i] === F[j][i - 1] + COST) {
					AlignmentA.push(A[i - 1]);
					AlignmentB.push(null);
					i -= 1;
				} else {
					AlignmentA.push(null);
					AlignmentB.push(B[j - 1]);
					j -= 1;
				}
			}
			return [AlignmentA.reverse(), AlignmentB.reverse()];
		}

		function* range(start, end, step = 1) {
			let min = start;
			let max;
			if(end === undefined) {
				min = 0;
				max = start;
			} else max = end;
			for(let i = min; step > 0 ? i < max : i > max; i += step) {
				yield i;
			}
		}

		function _NWScore(X, Y, eq) {
			let Score0 = [...range(Y.length)];
			const Score1 = new Array(Y.length + 1);
			for(const Xi of X) {
				Score1[0] = Score0[0] + COST; // Del(Xi)
				for(let j = 0; j < Y.length; j++) {
					const scoreSub = Score0[j] + (!eq(Xi, Y[j]) ? SCOST : 0); // Sub(Xi, Yj)
					const scoreDel = Score0[j + 1] + COST; // Del(Xi);
					const scoreIns = Score1[j] + COST; // Ins(Yj);
					Score1[j + 1] = Math.min(scoreSub, scoreDel, scoreIns);
				}
				// Copy Score[1] to Score[0];
				Score0 = [...Score1];
			}
			return Score0;
		}

		// https://en.wikipedia.org/wiki/Hirschberg%27s_algorithm
		function _Hirschberg(X, Y, _equal = (a, b) => a === b) {
			let Z = [];
			let W = [];
			if(X.length === 0) {
				for(const Yi of Y) {
					Z.push(null);
					W.push(Yi);
				}
			} else if(Y.length === 0) {
				for(const Xi of X) {
					Z.push(Xi);
					W.push(null);
				}
			} else if(X.length === 1 || Y.length === 1) {
				const [z, w] = _NeedlemanWunsch(X, Y, _equal);
				Z = z;
				W = w;
			} else {
				const xmid = Math.floor(X.length / 2);
				const ScoreL = _NWScore(X.slice(0, xmid), Y, _equal);
				const ScoreR = _NWScore(
					X.slice(xmid).reverse(),
					[...Y].reverse(),
					_equal,
				).reverse();
				let ymid = 0;
				let ymid_val = 9e99;
				for(let i = 0; i < Math.min(ScoreL.length, ScoreR.length); i++) {
					if(ScoreL[i] + ScoreR[i] < ymid_val) {
						ymid_val = ScoreL[i] + ScoreR[i];
						ymid = i;
					}
				}
				const [left_z, left_w] = _Hirschberg(
					X.slice(0, xmid),
					Y.slice(0, ymid),
					_equal
				);
				const [right_z, right_w] = _Hirschberg(X.slice(xmid), Y.slice(ymid), _equal);
				Z = left_z.concat(right_z);
				W = left_w.concat(right_w);
			}
			return [Z, W];
		}
		return _Hirschberg;
	})();

	function compareClasses(classListA, classListB) {
		if(!(classListA instanceof DOMTokenList && classListB instanceof DOMTokenList))
			return;
		if(classListA.length !== classListB.length) return false;
		for(const item of classListA) {
			if(!classListB.contains(item)) return false;
		}
		return true;
	}

	function similarClasses(classListA, classListB) {
		if(!(classListA instanceof DOMTokenList && classListB instanceof DOMTokenList))
			return;
		if(!classListA.length) return true;
		for(const cls of classListA) {
			if(classListB.contains(cls)) return true;
		}
		return false;
	}

	function compareChildren(a, b) {
		if(a instanceof Text && b instanceof Text) return a.data === b.data;
		if(a instanceof HTMLElement && b instanceof HTMLElement) {
			if(
				a.tagName === b.tagName &&
				(a.id === b.id || a.id.startsWith("yui") || b.id.startsWith("yui")
					|| (a.id.startsWith("url_select_") && b.id.startsWith("url_select_"))) &&
				similarClasses(a.classList, b.classList)
			) return true;
			if(a.classList.contains("video-js") && b.classList.contains("video-js")) {
				const aSrcs = a.player ? a.player.currentSources() : videojs.getComponent("Player").getTagSettings(a).sources;
				const bSrcs = b.player ? b.player.currentSources() : videojs.getComponent("Player").getTagSettings(b).sources;
				for(const aSrc of aSrcs) {
					for(const bSrc of bSrcs) {
						if(aSrc.src === bSrc.src) return true;
					}
				}
			}
		}
		if(Array.isArray(a) && b instanceof HTMLElement && b.classList.contains(MATH_CLS)) {
			return a[2].textContent === b.textContent;
		}
		return false;
	}

	function asyncTimeout(delay) {
		return new Promise(resolve => setTimeout(resolve, delay));
	}

	const require = await getRequire();
	const videojs = await new Promise(res => require(["media_videojs/video-lazy"], res));

	async function mathJaxReady() {
		if(!window.MathJax) {
			let _MathJax;
			const MathJax = await new Promise((res) =>
				Object.defineProperty(window, "MathJax", {
					get() {
						return _MathJax;
					},
					set(value) {
						res(value);
						_MathJax = value;
					},
				}));
			if(!MathJax.Hub) {
				let _MathJax_Hub;
				await new Promise((res) =>
					Object.defineProperty(MathJax, "Hub", {
						get() {
							return _MathJax_Hub;
						},
						set(value) {
							res(value);
							_MathJax_Hub = value;
						},
					}));
			}
		}
		// MathJax hub ready
		await new Promise(res => window.MathJax.Hub.Register.StartupHook(res));
		return window.MathJax;
	}

	const MATH_CLS = "__qol_temp_mathjax";
	let lastForkTime = null;
	let matrixInputCallback = null;
	async function hydrate(dom, updated, first = true) {
		if(!(dom instanceof HTMLElement && updated instanceof HTMLElement)) return;
		if(first) lastForkTime = performance.now();
		else if(performance.now() > lastForkTime + 16) {
			await asyncTimeout(0);
			lastForkTime = performance.now();
		}
		// Update current node
		if(!compareClasses(dom.classList, updated.classList)) {
			dom.className = updated.classList;
		}
		if(updated.id && dom.id !== updated.id) dom.id = updated.id;
		for(const attr of dom.attributes) {
			if(attr.name === "id" || attr.name === "class") continue;
			if(!updated.hasAttribute(attr.name)) dom.removeAttribute(attr.name);
		}
		for(const attr of updated.attributes) {
			if(attr.name === "id" || attr.name === "class") continue;
			dom.setAttribute(attr.name, attr.value);
		}
		// Update children
		if(dom.innerHTML === updated.innerHTML) return;
		const currentChildren = [...dom.childNodes];
		for(const scriptEl of dom.querySelectorAll(':scope .MathJax_Preview + .MathJax + script[type^="math/"]')) {
			if(!currentChildren.includes(scriptEl)) continue;
			const arr = [];
			arr.push(...currentChildren.splice(currentChildren.indexOf(scriptEl) - 2, 3, arr));
		}
		const [diffLeft, diffRight] = hirschberg(
			currentChildren.filter(x => !(x instanceof Comment)),
			[...updated.childNodes].flatMap(el => {
				if(el instanceof Text && el.parentElement.closest(".filter_mathjaxloader_equation")) {
					const math = /\$(.*?)\$|\\\((.*?)\\\)/g;
					return el.data
						.split(math)
						.filter(x => x !== undefined)
						.map((str, i) => {
							if(i % 2) {
								const el = updated.ownerDocument.createElement("span");
								el.classList.add(MATH_CLS);
								el.textContent = str;
								return el;
							}
							return updated.ownerDocument.createTextNode(str);
						})
						.filter(x => !(x instanceof Text) || x.data);
				}
				return [el];
			}).filter(x => !(x instanceof Comment)),
			compareChildren,
		);
		// console.log(diffLeft, diffRight);
		let lastElement = null;
		for(let i = 0; i < diffLeft.length; i++) {
			const left = diffLeft[i];
			const right = diffRight[i];
			if(left instanceof Text && right instanceof Text) {
				if(left.data !== right.data) left.data = right.data;
				continue;
			}
			const replaced =
				left != null &&
				right != null &&
				!compareChildren(left, right);
			if(replaced && Array.isArray(left)) {
				console.log(left[2].textContent, "=>", right);
			}
			if(right == null || replaced) {
				// console.log("Removed", left);
				if(Array.isArray(left)) {
					for(const el of left) {
						el.style.filter = "contrast(0.1) sepia(1) saturate(16) hue-rotate(317deg) contrast(10)";
					}
				}
				if(left instanceof HTMLElement && left.classList.contains("__qol-uclearn-mathquillField")) continue;
				// Remove
				try {
					left.style.filter = "contrast(0.1) sepia(1) saturate(16) hue-rotate(317deg) contrast(10)";
				} catch(e) { }
			}
			if(left == null || replaced) {
				// Insert
				// if(right.tagName === "SCRIPT") continue;
				const newNode = right instanceof HTMLElement && right.classList.contains(MATH_CLS) ?
					dom.ownerDocument.createTextNode(`\\(${right.textContent}\\)`) : dom.ownerDocument.importNode(right, true);
				// console.log("Inserted", newNode, "between", lastElement, "and", lastElement?.nextSibling);
				if(!lastElement) {
					dom.prepend(newNode);
				} else {
					dom.insertBefore(newNode, lastElement.nextSibling);
				}
				if(newNode instanceof HTMLElement) {
					let math;
					if(newNode.classList.contains("filter_mathjaxloader_equation")) math = [newNode];
					else math = newNode.getElementsByClassName("filter_mathjaxloader_equation");
					for(const m of math) {
						window.MathJax.Hub.Queue(["Typeset", MathJax.Hub, m]);
					}
					let videos;
					if(newNode instanceof HTMLVideoElement && newNode.classList.contains("video-js") && (newNode.hasAttribute("data-setup") || newNode.hasAttribute("data-setup-lazy"))) videos = [newNode];
					else videos = newNode.querySelectorAll("video.video-js");
					for(const video of videos) {
						// console.log(video, JSON.parse(video.getAttribute("data-setup") ?? video.getAttribute("data-setup-lazy") ?? '{}'));
						videojs(video, JSON.parse(video.getAttribute("data-setup") ?? video.getAttribute("data-setup-lazy") ?? '{}'));
					}
					let inputs;
					if(newNode.tagName === "INPUT") inputs = [newNode];
					else inputs = newNode.getElementsByTagName("input");
					for(const input of inputs) {
						if(!input.matches(".que.stack input:is(.algebraic, .numerical), .que.stack .matrixtable input")) continue;
						if(input.closest('[hidden]')) continue;
						window.__qol_mathquill_bootstrap.initField(input);
					}
					let matrixInputs;
					if(newNode.classList.contains("matrixsquarebrackets")
						|| newNode.classList.contains("matrixroundbrackets")
						|| newNode.classList.contains("matrixbarbrackets")) matrixInputs = [newNode];
					else matrixInputs = [...newNode.querySelectorAll(":scope :is(.matrixsquarebrackets, .matrixroundbrackets, .matrixbarbrackets)")];
					mathJaxReady().then(MathJax => {
						if(!matrixInputCallback)
							matrixInputCallback = new Function(
								"matrixInputs",
								`${MathJax.Hub.Startup.signal.hooks.End.hooks[0].hook.toString().match(/^(\s*)(?<handler>matrixInputs\.forEach\(.*?{(?:.|\n)*?^\1}\).*?)$/gm)}`,
							);
						matrixInputCallback(matrixInputs);
					});
				}
				lastElement = newNode;
			}
			if(left != null && right != null && !replaced) {
				if(left instanceof HTMLElement && left.tagName === "SCRIPT") continue;
				if(left instanceof HTMLElement && left.classList.contains("questionflag")) continue;
				if(left instanceof HTMLElement && left.classList.contains("video-js")) continue;
				// Update existing
				// console.log("Updating", left);
				await hydrate(left, right, false);
				if(left instanceof HTMLElement && left.classList.contains("filter_mathjaxloader_equation")) {
					// console.log("Typesetting", left);
					window.MathJax.Hub.Queue(["Typeset", MathJax.Hub, left]);
				}
				lastElement = left;
			}
		}
	}

	const parser = new DOMParser();
	window.addEventListener(
		"submit",
		async (e) => {
			if(/^()$/i.test(e.submitter.getAttribute("name")))
				return;
			e.preventDefault();
			const form = e.target;
			if(!(form instanceof HTMLFormElement)) return;
			const resp = await fetch(form.action, {
				method: "POST",
				body: new FormData(form, e.submitter),
			});
			if(!resp.ok) {
				alert(`Server responded with ${resp.status}: ${resp.statusText}`);
				console.log(resp);
				return;
			}
			const updated = parser.parseFromString(
				await resp.text(),
				resp.headers.get("Content-Type").split(";")[0],
			);
			console.log(e.submitter, updated);
			const startTime = performance.now();
			await hydrate(document.getElementById("page"), updated.getElementById("page"));
			console.log(`Hydration occured in ${(performance.now() - startTime) / 1000}s`);
			history.pushState({}, "", resp.url);
		},
		{ capture: true },
	);
})();
