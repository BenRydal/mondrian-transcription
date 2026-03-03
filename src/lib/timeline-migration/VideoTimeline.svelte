<script lang="ts">
	import { onMount } from 'svelte';
	import { Timeline, createTimelineStore, formatTime } from 'svelte-interactive-timeline';
	import { createVideoSync } from './video-sync.svelte';
	import {
		handleForwardTranscription,
		handleRewindTranscription
	} from '../stores/drawingState';
	import IconRewind from '~icons/material-symbols/fast-rewind';
	import IconForward from '~icons/material-symbols/fast-forward';

	interface Props {
		videoElement: HTMLVideoElement;
	}

	let { videoElement }: Props = $props();

	const store = createTimelineStore();
	const sync = createVideoSync(store);

	// Reactive: attach when videoElement changes
	$effect(() => {
		if (videoElement) {
			sync.attach(videoElement);
			return () => sync.detach();
		}
	});

	function handleTimeChange(time: number) {
		sync.seekVideo(time);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!videoElement) return;
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			videoElement.currentTime = Math.max(0, videoElement.currentTime - 5);
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			videoElement.currentTime = Math.min(videoElement.duration, videoElement.currentTime + 5);
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="video-timeline p-2 rounded-b-lg" data-ui-element>
	<div class="w-full flex items-center gap-2">
		<button
			class="btn btn-ghost btn-sm btn-circle"
			onclick={() => handleRewindTranscription(videoElement)}
			aria-label="Rewind 5 seconds"
			title="Rewind 5s (R)"
		>
			<IconRewind class="h-5 w-5" />
		</button>

		<div class="flex-1">
			<Timeline
				{store}
				height={32}
				showControls={false}
				embedded={true}
				onTimeChange={handleTimeChange}
				onPlayheadDragStart={sync.onPlayheadDragStart}
				onPlayheadDragEnd={sync.onPlayheadDragEnd}
			/>
		</div>

		<button
			class="btn btn-ghost btn-sm btn-circle"
			onclick={() => handleForwardTranscription(videoElement)}
			aria-label="Forward 5 seconds"
			title="Forward 5s (F)"
		>
			<IconForward class="h-5 w-5" />
		</button>
	</div>

	<div class="flex justify-between items-center mt-1 text-sm font-mono">
		<span>{formatTime(store.currentTime, 'ms')}</span>
		<span>{formatTime(store.dataEnd, 'ms')}</span>
	</div>
</div>

<style>
	.video-timeline {
		position: absolute;
		bottom: 0;
		left: 0;
		z-index: 10;
		width: var(--split-width);
	}
</style>
