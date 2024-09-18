document.body.style.backgroundImage = `linear-gradient(0deg, #00000080, #00000080), url("${chrome.runtime.getURL("uclearn/background.png")}")`;
for(const el of document.querySelectorAll(".navbar-light")) {
	el.classList.remove("navbar-light");
	el.classList.add("navbar-dark");
}

const patchesScript = document.createElement("script");
patchesScript.src = chrome.runtime.getURL("uclearn/patches.js");
patchesScript.dataset.uclearnWasmUrl = chrome.runtime.getURL("uclearn/wasm/pkg/wasm_bg.wasm");
document.body.append(patchesScript);

if(location.pathname.includes("mod/quiz")) {
	const amScript = document.createElement("script");
	amScript.src = chrome.runtime.getURL("uclearn/ASCIIMathTeXImg.js");
	document.body.append(amScript);

	const mathquillScript = document.createElement("script");
	mathquillScript.src = chrome.runtime.getURL("uclearn/mathquill/bootload.js");
	document.body.append(mathquillScript);
}
