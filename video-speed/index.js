_VIDEO_SPEED_DOWN_KEY = '[';
_VIDEO_SPEED_UP_KEY = ']';
_VIDEO_SPEED_KEY_CONDITION = e => e.altKey;
_VIDEO_SPEED_LOCAL_STORAGE = "_video_speed_value";

const _VIDEO_SPEED_hiddenMedia = new Set();
const _VIDEO_SPEED_playHandler = e => {
	e.target.playbackRate = Number.parseFloat(localStorage.getItem(_VIDEO_SPEED_LOCAL_STORAGE)) ?? 1;
};
const _VIDEO_SPEED_rateChangeHandler = e => {
	if(e.target.readyState < 2) return;
	localStorage.setItem(_VIDEO_SPEED_LOCAL_STORAGE, e.target.playbackRate);
	const viewer = e.target._videoSpeedDisplay ?? document.createElement('div');
	clearTimeout(e.target._videoSpeedTimeout);
	viewer.classList.add('_video_speed_display');
	if(e.target.parentElement) {
		rect = e.target.getBoundingClientRect();
		viewer.style.top = `${rect.top + rect.height / 2}px`;
		viewer.style.left = `${rect.left + rect.width / 2}px`;
	} else {
		viewer.style.top = "50%";
		viewer.style.left = "50%";
	}
	viewer.textContent = `${e.target.playbackRate.toFixed(1)}x`;
	document.body.appendChild(viewer);
	e.target._videoSpeedDisplay = viewer;
	e.target._videoSpeedTimeout = setTimeout(() => {
		e.target._videoSpeedDisplay = undefined;
		viewer.remove();
	}, 1000);
};

window.Audio = new Proxy(window.Audio, {
	apply(target, thisArg, argArray) {
		result = target.apply(thisArg, argArray);
		_VIDEO_SPEED_hiddenMedia.add(result);
		result.addEventListener("ratechange", _VIDEO_SPEED_rateChangeHandler);
		result.addEventListener("play", _VIDEO_SPEED_playHandler);
		console.log("Caught construction of", result);
		return result;
	}
});
Document.prototype._VIDEO_SPEED_domCreateElement = Document.prototype.createElement;
Document.prototype.createElement = function(el) {
	result = this._VIDEO_SPEED_domCreateElement(el);
	if(/^(audio|video)$/gi.test(el)) {
		_VIDEO_SPEED_hiddenMedia.add(result);
		result.addEventListener("ratechange", _VIDEO_SPEED_rateChangeHandler);
		result.addEventListener("play", _VIDEO_SPEED_playHandler);
		console.log("Caught construction of", result);
	}
	return result;
};

window.addEventListener("play", _VIDEO_SPEED_playHandler, {
	capture: true
});

window.addEventListener("ratechange", _VIDEO_SPEED_rateChangeHandler, {
	capture: true
});

window.addEventListener("keydown", e => {
	if(!_VIDEO_SPEED_KEY_CONDITION(e)
		|| (e.key !== _VIDEO_SPEED_DOWN_KEY && e.key !== _VIDEO_SPEED_UP_KEY)) return;
	const elements = new Set([
		...document.getElementsByTagName("video"),
		...document.getElementsByTagName("audio"),
		..._VIDEO_SPEED_hiddenMedia]);
	for(const el of elements) {
		if(!el.paused || (el.currentTime !== 0 && el.currentTime < el.duration)) {
			let rate = el.playbackRate;
			rate += (e.key === _VIDEO_SPEED_UP_KEY ? 0.1 : -0.1);
			rate = (rate > 16. ? 16. : (rate < 0.1 ? 0.1 : rate));
			el.playbackRate = Math.floor(100 * rate) / 100;
		}
	}
});
