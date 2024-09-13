document.body.style.backgroundImage = `linear-gradient(0deg, #00000080, #00000080), url("${chrome.runtime.getURL("uclearn/background.png")}")`;
for(const el of document.querySelectorAll(".navbar-light")) {
	el.classList.remove("navbar-light");
	el.classList.add("navbar-dark");
}

if(location.pathname.includes("mod/quiz")) {
	const amScript = document.createElement("script");
	amScript.src = chrome.runtime.getURL("uclearn/ASCIIMathTeXImg.js");
	document.body.append(amScript);

	const mathquillScript = document.createElement("script");
	mathquillScript.src = chrome.runtime.getURL("uclearn/mathquill/bootload.js");
	document.body.append(mathquillScript);
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

const videoPlayListener = e => {
	const vid = e.target;
	if(!(vid instanceof HTMLVideoElement)) return;
	if(!vid.closest(".que")) return;
	let canvas;
	let ctx;
	let match;
	// biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
	if(vid.previousElementSibling instanceof HTMLCanvasElement && (match = vid.previousElementSibling.id.match(/uclearn-video-canvas-(\d+)/))) {
		canvas = vid.previousElementSibling;
		ctx = canvasCtxs[Number.parseInt(match[1])];
	} else {
		canvas = document.createElement("canvas");
		canvas.id = `uclearn-video-canvas-${canvasId++}`;
		canvas.classList.add("uclearn-video-canvas");
		vid.insertAdjacentElement("beforebegin", canvas);
		canvas.width = vid.videoWidth;
		canvas.height = vid.videoHeight;
		ctx = canvas.getContext("webgl2", { alpha: true });
		initGl(ctx);
		canvasCtxs.push(ctx);
	}

	vid.requestVideoFrameCallback(function updateFrame() {
		if(vid.paused || vid.ended) return;
		ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true);
		ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, vid);
		ctx.drawElements(ctx.TRIANGLES, 6, ctx.UNSIGNED_SHORT, 0);

		vid.requestVideoFrameCallback(updateFrame);
	});
};

window.addEventListener("play", videoPlayListener, { capture: true });
window.addEventListener("seek", videoPlayListener, { capture: true });

const scriptObserver = new MutationObserver((changes) => {
	for(const change of changes) {
		if(change.type !== "childList") return;
		for(const node of change.addedNodes) {
			if(!(node instanceof Element)) continue;
			if(node.tagName !== "SCRIPT") continue;
			if(!(node instanceof HTMLScriptElement)) continue;
			if(node.src) continue;
			if(node.textContent.trimStart().startsWith("MathJax")) continue;
			// node.type = "text/disabledjs";
			node.remove();
		}
	}
});
scriptObserver.observe(document.head, { childList: true });

const parser = new DOMParser();
window.addEventListener("submit", async e => {
	return;
	if(/^(next|previous|finish)$/i.test(e.submitter.getAttribute("name"))) return;
	e.preventDefault();
	const form = e.target;
	if(!(form instanceof HTMLFormElement)) return;
	const resp = await fetch(form.action, {
		method: "POST",
		body: new FormData(form, e.submitter)
	});
	if(!resp.ok) {
		alert(`Server responded with ${resp.status}: ${resp.statusText}`);
		return;
	}
	const updated = parser.parseFromString(await resp.text(), resp.headers.get("Content-Type").split(';')[0]);
	console.log(e.submitter, updated);
}, { capture: true });
