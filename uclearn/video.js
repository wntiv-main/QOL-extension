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

	const VEREX_SHADER = `
attribute vec2 aVertexPosition;
varying vec2 vTexPos;

void main(void) {
	gl_Position = vec4(aVertexPosition, 0.0, 1.0);
	vTexPos = aVertexPosition * 0.5 + vec2(0.5);
}`;

	const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vTexPos;
uniform sampler2D uSampler;

void main(void) {
    vec4 texColor = texture2D(uSampler, vTexPos);
	float irrelevance = min(texColor.r, min(texColor.g, texColor.b));
	float ir2 = irrelevance * irrelevance;
	texColor.a = 1.0 - ir2 * ir2;
    gl_FragColor = texColor;
}`;

	const canvasCtxs = [];
	let canvasId = 0;

	function initGl(ctx) {
		if(!(ctx instanceof WebGL2RenderingContext)) throw new TypeError();
		const vertexShader = ctx.createShader(ctx.VERTEX_SHADER);
		ctx.shaderSource(vertexShader, VEREX_SHADER);
		ctx.compileShader(vertexShader);
		if(!ctx.getShaderParameter(vertexShader, ctx.COMPILE_STATUS)) {
			throw new Error(`An error occurred compiling vertex: ${ctx.getShaderInfoLog(vertexShader)}`);
		}

		const fragmentShader = ctx.createShader(ctx.FRAGMENT_SHADER);
		ctx.shaderSource(fragmentShader, FRAGMENT_SHADER);
		ctx.compileShader(fragmentShader);
		if(!ctx.getShaderParameter(fragmentShader, ctx.COMPILE_STATUS)) {
			throw new Error(`An error occurred compiling fragment: ${ctx.getShaderInfoLog(fragmentShader)}`);
		}

		const program = ctx.createProgram();
		ctx.attachShader(program, vertexShader);
		ctx.attachShader(program, fragmentShader);
		ctx.linkProgram(program);

		if(!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
			alert(`Unable to initialize the shader program: ${ctx.getProgramInfoLog(program)}`);
		}

		ctx.useProgram(program);

		const locations = {
			aVertexPosition: ctx.getAttribLocation(program, "aVertexPosition"),
			uSampler: ctx.getUniformLocation(program, "uSampler")
		};
		ctx.enableVertexAttribArray(locations.aVertexPosition);

		ctx.clearColor(0, 0, 0, 0);
		ctx.disable(ctx.DEPTH_TEST);

		const vertexPositions = ctx.createBuffer();
		ctx.bindBuffer(ctx.ARRAY_BUFFER, vertexPositions);
		ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
			-1.0, -1.0,
			1.0, -1.0,
			1.0, 1.0,
			-1.0, 1.0,
		]), ctx.STATIC_DRAW);
		ctx.vertexAttribPointer(locations.aVertexPosition, 2, ctx.FLOAT, false, 0, 0);

		const vertices = ctx.createBuffer();
		ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, vertices);
		ctx.bufferData(
			ctx.ELEMENT_ARRAY_BUFFER,
			new Uint16Array([0, 1, 2, 0, 2, 3]), ctx.STATIC_DRAW
		);
		ctx.uniform1i(locations.uSampler, 0);

		const texture = ctx.createTexture();
		ctx.activeTexture(ctx.TEXTURE0);
		ctx.bindTexture(ctx.TEXTURE_2D, texture);
		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);

		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
		ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
	}
	// TODO: use videojs plugin for cross-Tech support
	// const videoPlayListener = vid => {
	// 	if(!(vid instanceof HTMLVideoElement)) return;
	// 	if(!vid.closest(".que")) return;
	// 	let canvas;
	// 	let ctx;
	// 	let match;
	// 	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	// 	if(vid.previousElementSibling instanceof HTMLCanvasElement && (match = vid.previousElementSibling.id.match(/uclearn-video-canvas-(\d+)/))) {
	// 		canvas = vid.previousElementSibling;
	// 		ctx = canvasCtxs[Number.parseInt(match[1])];
	// 	} else {
	// 		canvas = document.createElement("canvas");
	// 		canvas.id = `uclearn-video-canvas-${canvasId++}`;
	// 		canvas.classList.add("uclearn-video-canvas");
	// 		vid.insertAdjacentElement("beforebegin", canvas);
	// 		canvas.width = vid.videoWidth;
	// 		canvas.height = vid.videoHeight;
	// 		ctx = canvas.getContext("webgl2", { alpha: true });
	// 		initGl(ctx);
	// 		canvasCtxs.push(ctx);
	// 	}

	// 	vid.requestVideoFrameCallback(function updateFrame() {
	// 		if(vid.paused || vid.ended) return;
	// 		ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true);
	// 		ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, vid);
	// 		ctx.drawElements(ctx.TRIANGLES, 6, ctx.UNSIGNED_SHORT, 0);

	// 		vid.requestVideoFrameCallback(updateFrame);
	// 	});
	// };

	// window.addEventListener("play", e => videoPlayListener(e.target), { capture: true });
	// window.addEventListener("seek", e => videoPlayListener(e.target), { capture: true });

	function playerRender(player, ctx) {
		ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true);
		ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, player.el_.querySelector("video"));
		ctx.drawElements(ctx.TRIANGLES, 6, ctx.UNSIGNED_SHORT, 0);
	}

	function setupPlayer(player) {
		const id = canvasId++;
		const canvas = document.createElement("canvas");
		canvas.id = `uclearn-video-canvas-${id}`;
		canvas.classList.add("uclearn-video-canvas");
		player.el_.insertAdjacentElement("afterbegin", canvas);
		const ctx = canvas.getContext("webgl2", { alpha: true });
		initGl(ctx);
		canvasCtxs.push(ctx);
		player.on("loadedmetadata", () => {
			canvas.width = player.videoWidth();
			canvas.height = player.videoHeight();
			ctx.viewport(0, 0, canvas.width, canvas.height);
			// playerRender(player, ctx);
		});
		player.on("resize", () => {
			canvas.width = player.videoWidth();
			canvas.height = player.videoHeight();
			ctx.viewport(0, 0, canvas.width, canvas.height);
		});
		// player.on("posterchange", () => {
		// 	const img = new Image();
		// 	img.addEventListener("load", () => playerRender({ el_: { querySelector() { return img; } } }, ctx));
		// 	img.src = player.poster();
		// });
		// player.on("canplay", () => {
		// 	playerRender(player, ctx);
		// });

		function renderLoop() {
			if(player.paused() || player.ended()) return;
			playerRender(player, ctx);
			(player.tech_?.el_?.requestVideoFrameCallback ?? player.requestAnimationFrame)(renderLoop);
		}

		player.on("play", renderLoop);
		player.on("seeking", renderLoop);
	}

	const require = await getRequire();
	const videojs = await new Promise((res) => require(["media_videojs/video-lazy"], res));
	videojs.hook("setup", setupPlayer);
	for(const player of Object.values(videojs.getPlayers())) {
		setupPlayer(player);
	}
})();

// const scriptObserver = new MutationObserver((changes) => {
// 	for(const change of changes) {
// 		if(change.type !== "childList") return;
// 		for(const node of change.addedNodes) {
// 			if(!(node instanceof Element)) continue;
// 			if(node.tagName !== "SCRIPT") continue;
// 			if(!(node instanceof HTMLScriptElement)) continue;
// 			if(node.src) continue;
// 			if(!node.textContent.includes("completion indication")) continue;
// 			// node.textContent = `alert('INJECTED');${node.textContent}`;
// 			// node.type = "text/disabledjs";
// 			node.remove();
// 		}
// 	}
// });
// scriptObserver.observe(document.head, { childList: true });
