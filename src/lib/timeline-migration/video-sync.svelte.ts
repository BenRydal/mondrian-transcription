import type { TimelineStore } from 'svelte-interactive-timeline';

export interface VideoSyncOptions {
	seekThreshold?: number; // Min drift before seeking (default: 0.1s)
	pauseOnScrub?: boolean; // Pause video during playhead drag (default: true)
}

export function createVideoSync(store: TimelineStore, options?: VideoSyncOptions) {
	const seekThreshold = options?.seekThreshold ?? 0.1;
	const pauseOnScrub = options?.pauseOnScrub ?? true;

	let videoElement: HTMLVideoElement | null = null;
	let isVideoSource = false;
	let isTimelineSource = false;
	let wasPlayingBeforeScrub = false;

	function onTimeUpdate() {
		if (!videoElement || isTimelineSource) return;
		isVideoSource = true;
		store.setCurrentTime(videoElement.currentTime);
		isVideoSource = false;
	}

	function onLoadedMetadata() {
		if (!videoElement || isNaN(videoElement.duration)) return;
		store.initialize(videoElement.duration, 0);
	}

	function onDurationChange() {
		if (!videoElement || isNaN(videoElement.duration)) return;
		// Re-initialize if duration changes
		if (videoElement.duration > store.dataEnd) {
			store.initialize(videoElement.duration, 0);
		}
	}

	/** Call from Timeline's onTimeChange callback */
	function seekVideo(time: number) {
		if (!videoElement || isVideoSource) return;
		const drift = Math.abs(videoElement.currentTime - time);
		if (drift > seekThreshold) {
			isTimelineSource = true;
			videoElement.currentTime = time;
			isTimelineSource = false;
		}
	}

	/** Call from Timeline's onPlayheadDragStart callback */
	function onPlayheadDragStart() {
		if (!videoElement) return;
		wasPlayingBeforeScrub = !videoElement.paused;
		if (pauseOnScrub && wasPlayingBeforeScrub) {
			videoElement.pause();
		}
	}

	/** Call from Timeline's onPlayheadDragEnd callback */
	function onPlayheadDragEnd() {
		if (!videoElement) return;
		if (pauseOnScrub && wasPlayingBeforeScrub) {
			videoElement.play();
			wasPlayingBeforeScrub = false;
		}
	}

	function attach(video: HTMLVideoElement) {
		detach();
		videoElement = video;

		if (video.duration && !isNaN(video.duration)) {
			store.initialize(video.duration, 0);
		}

		video.addEventListener('timeupdate', onTimeUpdate);
		video.addEventListener('loadedmetadata', onLoadedMetadata);
		video.addEventListener('durationchange', onDurationChange);
	}

	function detach() {
		if (!videoElement) return;
		videoElement.removeEventListener('timeupdate', onTimeUpdate);
		videoElement.removeEventListener('loadedmetadata', onLoadedMetadata);
		videoElement.removeEventListener('durationchange', onDurationChange);
		videoElement = null;
	}

	function destroy() {
		detach();
	}

	return {
		attach,
		detach,
		destroy,
		seekVideo,
		onPlayheadDragStart,
		onPlayheadDragEnd
	};
}

export type VideoSync = ReturnType<typeof createVideoSync>;
