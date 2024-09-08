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

const { remove_background } = wasm_bindgen;
(async () => {
	await wasm_bindgen(chrome.runtime.getURL("uclearn/video-player/pkg/video_player_bg.wasm"));

	window.addEventListener("play", e => {
		const vid = e.target;
		if(!(vid instanceof HTMLVideoElement)) return;
		let canvas;
		if(!(vid.previousElementSibling instanceof HTMLCanvasElement)) {
			canvas = document.createElement("canvas");
			canvas.classList.add("uclearn-video-canvas");
			vid.insertAdjacentElement("beforebegin", canvas);
			canvas.width = vid.clientWidth;
			canvas.height = vid.clientHeight;
		} else canvas = vid.previousElementSibling;
		// if(!canvas.ctx) canvas.
		const ctx = canvas.getContext("2d", {
			// alpha: true,
			// willReadFrequently: true
		});
		const renderCanvas = new OffscreenCanvas(canvas.width, canvas.height);
		const renderCtx = renderCanvas.getContext("2d", {
			// alpha: true,
			willReadFrequently: true
		});
		vid.requestVideoFrameCallback(function updateFrame() {
			if(vid.paused || vid.ended) return;
			renderCtx.drawImage(vid, 0, 0, renderCanvas.width, renderCanvas.height);
			remove_background(renderCtx, ctx, renderCanvas.width, renderCanvas.height);
			// const frame = renderCtx.getImageData(0, 0, renderCanvas.width, renderCanvas.height);
			// const data = frame.data;
			// for(let i = 0; i < data.length; i += 4) {
			// 	if(data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) {
			// 		data[i + 3] = 0;
			// 		continue;
			// 	}
			// 	if(data[i] < 127 || data[i + 1] < 127 || data[i + 2] < 127) continue;
			// 	data[i + 3] = 255 - Math.min(data[i], data[i + 1], data[i + 2]); // Make transparent
			// 	// if(data[i] >= 250 && data[i + 1] >= 250 && data[i + 2] >= 250) {
			// 	// }
			// }
			// // const newFrame = new ImageData(frame.width, frame.height);
			// // newFrame.data = data;
			// ctx.putImageData(frame, 0, 0);
			vid.requestVideoFrameCallback(updateFrame);
		});
	}, { capture: true });
})();
