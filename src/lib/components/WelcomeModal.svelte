<script lang="ts">
	import {
		X,
		Lightbulb,
		CirclePlay,
		ShieldCheck,
		MessageSquare,
		Github,
		MousePointer,
		Pencil,
		Compass,
		Download,
		Upload,
		Keyboard
	} from '@lucide/svelte';

	interface Props {
		onClose: () => void;
		onTryExample?: (() => void) | undefined;
	}

	let { onClose, onTryExample = undefined }: Props = $props();

	let activeTab: 'start' | 'modes' | 'about' = $state('start');

	const tabs = [
		{ id: 'start', label: 'Get Started' },
		{ id: 'modes', label: 'Modes' },
		{ id: 'about', label: 'About' }
	] as const;

	function closeAndRun(fn?: (() => void) | undefined) {
		fn?.();
		onClose();
	}

</script>

<dialog
	id="welcome_modal"
	class="modal"
	aria-labelledby="mondrian-modal-title"
	data-ui-element
>
	<div class="modal-box max-w-4xl max-h-[90vh] p-0 overflow-y-auto">
		<!-- Header -->
		<div class="relative px-8 py-6 overflow-hidden">
			<div
				class="absolute inset-0 bg-cover bg-center"
				style="background-image: url(/cover.gif);"
			></div>
			<div class="absolute inset-0 bg-blue-950/85"></div>
			<div class="relative z-10">
				<div class="flex justify-between items-start">
					<div class="flex-1 pr-8">
						<h1
							id="mondrian-modal-title"
							class="text-3xl font-bold text-white italic mb-2"
						>
							Mondrian Transcription
						</h1>
						<p class="text-blue-100 text-lg">
							Transcribe movement from video into position data
						</p>
					</div>
					<button
						class="btn btn-circle btn-ghost btn-sm text-white hover:bg-white/20 flex-shrink-0"
						onclick={onClose}
						aria-label="Close modal"
					>
						<X size={24} />
					</button>
				</div>
				<div
					class="mt-4 inline-flex items-center gap-2 bg-emerald-400/20 text-emerald-200 rounded-full px-3 py-1 text-sm border border-emerald-400/30"
				>
					<ShieldCheck size={16} />
					<span>100% private — runs entirely in your browser</span>
				</div>
			</div>
		</div>

		<!-- Tabs -->
		<div class="border-b border-gray-200 bg-base-100">
			<div class="flex px-8" role="tablist">
				{#each tabs as tab}
					<button
						role="tab"
						aria-selected={activeTab === tab.id}
						aria-controls="tabpanel-{tab.id}"
						class="px-4 py-3 text-sm font-medium border-b-2 transition-colors {activeTab ===
						tab.id
							? 'border-gray-800 text-gray-800'
							: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
						onclick={() => (activeTab = tab.id)}
					>
						{tab.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Tab Content -->
		<div class="px-8 py-6">
			{#if activeTab === 'start'}
				<!-- Get Started Tab -->
				<div id="tabpanel-start" role="tabpanel">
					<!-- Action Cards -->
					<div class="flex gap-4 mb-6">
						<a
							href="https://youtu.be/mgbNzikyucQ"
							target="_blank"
							rel="noopener noreferrer"
							class="flex-1 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 hover:border-blue-400 transition-all group text-left"
						>
							<div class="flex items-center gap-3">
								<div
									class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors text-blue-600"
								>
									<CirclePlay size={20} />
								</div>
								<div>
									<h3 class="font-semibold text-gray-800 group-hover:text-blue-700">
										Watch Demo Video
									</h3>
									<p class="text-sm text-gray-500">See the tool in action</p>
								</div>
							</div>
						</a>
						{#if onTryExample}
							<button
								onclick={() => closeAndRun(onTryExample)}
								class="flex-1 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 hover:border-amber-400 transition-all group text-left"
							>
								<div class="flex items-center gap-3">
									<div
										class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors text-amber-600"
									>
										<Lightbulb size={20} />
									</div>
									<div>
										<h3 class="font-semibold text-gray-800 group-hover:text-amber-700">
											Try Example Data
										</h3>
										<p class="text-sm text-gray-500">
											Load a classroom floor plan to explore
										</p>
									</div>
								</div>
							</button>
						{/if}
					</div>

					<!-- Quick Start Steps -->
					<h3 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">
						Quick Start
					</h3>
					<div class="space-y-4 mb-6">
						<div class="flex gap-4 items-start">
							<div
								class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 text-sm font-bold"
							>
								1
							</div>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<Upload size={16} class="text-gray-400" />
									<h4 class="font-semibold text-gray-800">Upload your files</h4>
								</div>
								<p class="text-sm text-gray-500 mt-0.5">
									Load a floor plan image and optional video recording
								</p>
							</div>
						</div>

						<div class="flex gap-4 items-start">
							<div
								class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 text-sm font-bold"
							>
								2
							</div>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<MousePointer size={16} class="text-gray-400" />
									<h4 class="font-semibold text-gray-800">
										Click to record movement paths
									</h4>
								</div>
								<p class="text-sm text-gray-500 mt-0.5">
									Click to start tracing, click again to pause. Record multiple paths
									with different colors.
								</p>
							</div>
						</div>

						<div class="flex gap-4 items-start">
							<div
								class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 text-sm font-bold"
							>
								3
							</div>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<Keyboard size={16} class="text-gray-400" />
									<h4 class="font-semibold text-gray-800">
										Use keyboard shortcuts for efficient recording
									</h4>
								</div>
								<p class="text-sm text-gray-500 mt-0.5">
									<kbd class="kbd kbd-sm">F</kbd> forward,
									<kbd class="kbd kbd-sm">R</kbd> rewind through video and recording
								</p>
							</div>
						</div>

						<div class="flex gap-4 items-start">
							<div
								class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 text-sm font-bold"
							>
								4
							</div>
							<div class="flex-1">
								<div class="flex items-center gap-2">
									<Download size={16} class="text-gray-400" />
									<h4 class="font-semibold text-gray-800">
										Export your data as CSV/JSON
									</h4>
								</div>
								<p class="text-sm text-gray-500 mt-0.5">
									Download a ZIP with CSV files for each path and your floor plan image
								</p>
							</div>
						</div>
					</div>

					<!-- Keyboard Shortcuts Reference -->
					<div class="bg-gray-50 rounded-lg p-4">
						<h4 class="text-sm font-medium text-gray-700 mb-2">Keyboard Shortcuts</h4>
						<div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
							<div class="flex items-center gap-2">
								<kbd class="kbd kbd-sm">F</kbd>
								<span class="text-gray-600">Forward</span>
							</div>
							<div class="flex items-center gap-2">
								<kbd class="kbd kbd-sm">R</kbd>
								<span class="text-gray-600">Rewind</span>
							</div>
							<div class="flex items-center gap-2">
								<kbd class="kbd kbd-sm">Space</kbd>
								<span class="text-gray-600">Play / Pause video</span>
							</div>
							<div class="flex items-center gap-2">
								<kbd class="kbd kbd-sm">Click</kbd>
								<span class="text-gray-600">Start / Stop recording</span>
							</div>
						</div>
					</div>
				</div>
			{:else if activeTab === 'modes'}
				<!-- Modes Tab -->
				<div id="tabpanel-modes" role="tabpanel">
					<div class="space-y-4 mb-5">
						<!-- Transcription Mode Card -->
						<div
							class="border border-gray-200 rounded-lg p-5 hover:border-blue-300 transition-colors"
						>
							<div class="flex items-start gap-4">
								<div
									class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600"
								>
									<Pencil size={24} />
								</div>
								<div class="flex-1">
									<h4 class="font-semibold text-gray-800 mb-1">
										Transcription Mode
									</h4>
									<p class="text-sm text-gray-600 mb-2">
										Record movement paths synchronized to video playback. Upload a
										floor plan and a video, then trace paths as the video plays.
										Position data is timestamped to match the video timeline.
									</p>
									<div class="text-xs text-gray-500 space-y-1">
										<p>
											<strong>Best for:</strong> Transcribing observed movement from
											recorded video of classrooms, museums, workplaces, etc.
										</p>
										<p>
											<strong>Requires:</strong> Floor plan image + video file
										</p>
									</div>
								</div>
							</div>
						</div>

						<!-- Speculate Mode Card -->
						<div
							class="border border-gray-200 rounded-lg p-5 hover:border-amber-300 transition-colors"
						>
							<div class="flex items-start gap-4">
								<div
									class="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-600"
								>
									<Compass size={24} />
								</div>
								<div class="flex-1">
									<h4 class="font-semibold text-gray-800 mb-1">Speculate Mode</h4>
									<p class="text-sm text-gray-600 mb-2">
										Draw movement paths directly on a floor plan without video. Click
										to trace paths freehand, then export with a custom time scale
										applied to your data.
									</p>
									<div class="text-xs text-gray-500 space-y-1">
										<p>
											<strong>Best for:</strong> Hypothetical movement, planning
											layouts, exploring "what if" scenarios, or when no video is
											available
										</p>
										<p>
											<strong>Requires:</strong> Floor plan image only
										</p>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Info box -->
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
						<div class="flex items-start gap-3">
							<Compass size={20} class="text-blue-600 flex-shrink-0 mt-0.5" />
							<div>
								<h4 class="font-medium text-blue-800 mb-1">When to use each mode</h4>
								<p class="text-sm text-blue-700">
									Use <strong>Transcription Mode</strong> when you have video footage
									and want timestamped position data. Use
									<strong>Speculate Mode</strong> when you want to sketch movement
									paths on a floor plan without a video — for instance, to plan an
									observation study or explore hypothetical arrangements. You can
									switch modes at any time from the navbar.
								</p>
							</div>
						</div>
					</div>
				</div>
			{:else if activeTab === 'about'}
				<!-- About Tab -->
				<div id="tabpanel-about" role="tabpanel">
					<div class="space-y-5">
						<div>
							<h3 class="font-semibold text-gray-800 mb-2">
								What is Mondrian Transcription?
							</h3>
							<p class="text-sm text-gray-600 leading-relaxed">
								Mondrian Transcription is a browser-based tool for transcribing
								movement from video into spatial position data. Given a floor plan
								image and an optional video recording, you can trace people's
								movement paths and export the resulting position data as CSV files.
								The tool is designed for researchers studying movement in classrooms,
								museums, workplaces, and other spaces.
							</p>
						</div>

						<div>
							<h3 class="font-semibold text-gray-800 mb-2">Privacy</h3>
							<p class="text-sm text-gray-600 leading-relaxed">
								All processing happens entirely in your browser. No data is uploaded
								to any server. Your floor plans, videos, and recorded paths never
								leave your machine. Auto-backup saves your work locally in case of
								errors.
							</p>
						</div>

						<div>
							<h3 class="font-semibold text-gray-800 mb-2">Open Source</h3>
							<p class="text-sm text-gray-600 leading-relaxed">
								Mondrian Transcription is free and open source under the GPL v3
								license. Contributions, issues, and feedback are welcome on
								<a
									href="https://github.com/BenRydal/mondrian"
									target="_blank"
									rel="noopener noreferrer"
									class="text-blue-600 hover:underline">GitHub</a
								>.
							</p>
						</div>

						<div>
							<h3 class="font-semibold text-gray-800 mb-2">Citation</h3>
							<div
								class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600"
							>
								<p>
									Shapiro, B. R., Silvis, D., & Hall, R. (2025). Visualization as
									theory and experience: An Interaction Geography of a biomechanics
									lab. <em>Journal of the Learning Sciences</em>.
									<a
										href="https://doi.org/10.1080/10508406.2025.2537945"
										target="_blank"
										rel="noopener noreferrer"
										class="text-blue-600 hover:underline"
										>https://doi.org/10.1080/10508406.2025.2537945</a
									>
								</p>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="bg-gray-50 px-8 py-4 border-t border-gray-200">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex flex-wrap items-center gap-3">
					<a
						href="https://forms.gle/placeholder"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
					>
						<MessageSquare size={16} />
						Feedback
					</a>
					<a
						href="https://github.com/BenRydal/mondrian"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
					>
						<Github size={16} />
						Open Source
					</a>
				</div>
				<a
					href="https://doi.org/10.1080/10508406.2025.2537945"
					target="_blank"
					rel="noopener noreferrer"
					class="text-sm text-blue-700 hover:underline"
				>
					Shapiro, Silvis, & Hall (2025).
					<em>Visualization as Theory and Experience</em>
				</a>
			</div>
		</div>
	</div>

	<form method="dialog" class="modal-backdrop">
		<button onclick={onClose}>close</button>
	</form>
</dialog>
