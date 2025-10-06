<script lang="ts">
    import IconHelp from "~icons/material-symbols/help-outline";
    import IconSettings from "~icons/material-symbols/settings";
    import IconUpload from "~icons/material-symbols/upload";
    import IconDelete from "~icons/material-symbols/delete-outline";
    import IconDeleteAll from "~icons/material-symbols/delete-sweep-outline";
    import IconExport from "~icons/material-symbols/download";
    import IconPlayArrow from "~icons/material-symbols/play-arrow";
    import IconFastForward from "~icons/material-symbols/fast-forward";
    import IconRewind from "~icons/material-symbols/fast-rewind";
    import IconImage from "~icons/material-symbols/image";
    import IconStylusNote from "~icons/material-symbols/stylus-note";
    import IconPrivacyTip from "~icons/material-symbols/privacy-tip";
    import IconClick from "~icons/material-symbols/touch-app";
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import { drawingConfig } from "$lib/stores/drawingConfig";

    export let onImageUpload: (event: Event) => void;
    export let onVideoUpload: (event: Event) => void;
    export let onSavePath: () => void;
    export let onClear: () => void;
    export let onClearCurrent: () => void;
    export let onNewPath: () => void;
    export let onSelectExample: (data: string) => void;

    let showModal = false;
    // Use strings for safe comparison with option values
    let pendingValue = get(drawingConfig).isTranscriptionMode ? "true" : "false";
    let originalValue = pendingValue;

    // Define modes as strings
    const modes = [
        { label: "Transcription Mode", value: "true" },
        { label: "Speculate Mode", value: "false" },
    ];

    let showScaleModal = false;
    let minutes = 0;
    let seconds = 10; // default

    $: scaleSeconds = minutes * 60 + seconds;

    onMount(() => {
        openHelpModal();
    });

    const strokeWeights = [1, 2, 3, 4, 5, 8, 10];
    const pollingRates = [
        { labelVideo: "4ms", labelSpeculate: "4 steps", value: 4 },
        { labelVideo: "8ms", labelSpeculate: "8 steps", value: 8 },
        { labelVideo: "16ms", labelSpeculate: "16 steps", value: 16 },
        { labelVideo: "32ms", labelSpeculate: "32 steps", value: 32 },
        { labelVideo: "64ms", labelSpeculate: "64 steps", value: 64 },
        { labelVideo: "100ms", labelSpeculate: "100 steps", value: 100 },
    ];

    const examples = [
        { id: "classroom", label: "Classroom Space" },
        { id: "museum", label: "Museum Gallery" },
        { id: "basketball", label: "Basketball Court" },
    ];

    function handleExport() {
        if ($drawingConfig.isTranscriptionMode) {
            onSavePath();
        } else {
            showScaleModal = true; // ask for scaling
        }
    }

    function confirmScale() {
        drawingConfig.update((c) => ({
            ...c,
            speculateScale: scaleSeconds,
        }));
        onSavePath();
        showScaleModal = false;
    }

    function cancelScale() {
        showScaleModal = false;
    }

    function handleModeChange(e) {
        pendingValue = e.currentTarget.value;
        showModal = true;
    }

    function confirmSwitch() {
        // Clear existing data
        onClear();

        // Update store
        drawingConfig.update((c) => ({
            ...c,
            isTranscriptionMode: pendingValue === "true",
        }));

        originalValue = pendingValue;
        showModal = false;
    }

    function cancelSwitch() {
        // Revert select UI back to original
        pendingValue = originalValue;
        showModal = false;
    }

    function handleFileUpload(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        if (file.type.startsWith("video/")) {
            onVideoUpload(event);
        } else if (file.type.startsWith("image/")) {
            onImageUpload(event);
        } else {
            alert("Please upload a video or image file");
        }

        (event.target as HTMLInputElement).value = "";
    }

    function preventDrawing(e: MouseEvent) {
        e.stopPropagation();
    }

    function openHelpModal() {
        const modal = document.getElementById("help_modal");
        if (modal instanceof HTMLDialogElement) {
            modal.showModal();
        }
    }
</script>

<div class="navbar bg-base-100 h-16" role="presentation" on:mousedown={preventDrawing} on:mouseup={preventDrawing} on:mousemove={preventDrawing}>
    <div class="flex-1">
        <a class="btn btn-ghost text-xl" href="https://interactiongeography.org">Mondrian</a>
    </div>
    <div class="flex justify-end items-center gap-2">
        <!-- Help -->
        <button class="btn btn-ghost" on:click={openHelpModal}>
            <IconHelp class="w-5 h-5" />
        </button>

        <!-- Clear Buttons -->
        <div class="flex gap-2">
            <!-- Clear current path -->
            <button class="btn btn-ghost gap-2" on:click={onClearCurrent} title="Clear current path">
                <IconDelete class="w-5 h-5" />
                Clear
            </button>

            <!-- Clear all paths -->
            <button class="btn btn-ghost gap-2" on:click={onClear} title="Clear all paths">
                <IconDeleteAll class="w-5 h-5" />
                Clear All
            </button>
        </div>

        <!-- Export Data -->
        <button class="btn" on:click={handleExport}>Export Data</button>

        {#if showScaleModal}
            <div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div class="bg-white rounded-lg shadow-lg p-6 w-80">
                    <h2 class="text-lg font-semibold mb-4">Set Time Scale</h2>
                    <p class="mb-4 text-sm">
                        In <strong>Speculate Mode</strong>, recorded data is stretched over a chosen duration. Enter total time below:
                    </p>

                    <div class="flex gap-2 mb-2">
                        <div class="flex-1">
                            <label class="block text-xs font-medium mb-1">Minutes</label>
                            <input type="number" min="0" class="input input-bordered w-full" bind:value={minutes} />
                        </div>
                        <div class="flex-1">
                            <label class="block text-xs font-medium mb-1">Seconds</label>
                            <input type="number" min="0" max="59" class="input input-bordered w-full" bind:value={seconds} />
                        </div>
                    </div>

                    <p class="text-sm text-gray-600 mb-4">
                        Total duration: <strong>{scaleSeconds} seconds</strong>
                    </p>

                    {#if scaleSeconds <= 0}
                        <p class="text-red-600 text-xs mb-2">Please enter a duration greater than 0 seconds.</p>
                    {/if}

                    <div class="flex justify-end gap-2">
                        <button class="btn btn-sm" on:click={cancelScale}>Cancel</button>
                        <button class="btn btn-sm btn-primary" on:click={confirmScale} disabled={scaleSeconds <= 0}> Save with Scaling </button>
                    </div>
                </div>
            </div>
        {/if}

        <!-- File Upload -->
        <label class="btn btn-ghost gap-2">
            <IconUpload class="w-5 h-5" />
            Upload File
            <input type="file" class="hidden" accept="video/*,image/*" on:change={handleFileUpload} />
        </label>

        <!-- New Path -->
        <button class="btn btn-primary gap-2" on:click={onNewPath}> New Path </button>

        <!-- Settings Dropdown -->
        <div class="dropdown dropdown-end" on:click={preventDrawing}>
            <div tabindex="0" role="button" class="btn btn-ghost">
                <IconSettings class="w-5 h-5" />
            </div>
            <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[1] w-80 p-4 shadow mt-4">
                <li>
                    <label class="label cursor-pointer flex-col items-start gap-2">
                        <span class="label-text w-full">Point Capture Interval</span>
                        <select
                            class="select select-bordered select-sm w-full"
                            value={$drawingConfig.pollingRate}
                            on:change={(e) =>
                                drawingConfig.update((c) => ({
                                    ...c,
                                    pollingRate: parseInt(e.currentTarget.value),
                                }))}
                        >
                            {#each pollingRates as rate}
                                <option value={rate.value}>
                                    {#if $drawingConfig.isTranscriptionMode}
                                        {rate.labelVideo}
                                    {:else}
                                        {rate.labelSpeculate}
                                    {/if}
                                </option>
                            {/each}
                        </select>
                    </label>
                </li>
                <li>
                    <label class="label cursor-pointer flex-col items-start gap-2">
                        <span class="label-text w-full">Stroke Weight</span>
                        <select class="select select-bordered select-sm w-full" value={$drawingConfig.strokeWeight} on:change={(e) => drawingConfig.update((c) => ({ ...c, strokeWeight: parseInt(e.currentTarget.value) }))}>
                            {#each strokeWeights as weight}
                                <option value={weight}>{weight}px</option>
                            {/each}
                        </select>
                    </label>
                </li>
            </ul>
        </div>
        <div>
            <label class="label cursor-pointer flex-col items-start gap-2">
                <select id="mode-select" class="select select-bordered select-sm w-full" bind:value={pendingValue} on:change={handleModeChange}>
                    {#each modes as m}
                        <option value={m.value}>{m.label}</option>
                    {/each}
                </select>
            </label>
        </div>

        <!-- Sample Data for Speculate Mode -->
        {#if !$drawingConfig.isTranscriptionMode}
            <!-- Example Data Dropdown -->
            <div class="dropdown dropdown-end">
                <div tabindex="0" role="button" class="btn bg-black text-white flex items-center gap-2">
                    <IconImage class="w-5 h-5" />
                    <span>Example Data</span>
                </div>

                <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box z-[100] w-72 p-3 shadow-lg mt-2 border border-gray-200">
                    {#each examples as example}
                        <li class="mb-1">
                            <button class="btn btn-sm btn-outline w-full text-left text-gray-800 border-gray-300 hover:bg-gray-100 transition" on:click={() => onSelectExample(example.id)}>
                                {example.label}
                            </button>
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}

        <!-- Modal -->
        {#if showModal}
            <div class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div class="bg-white rounded-lg shadow-lg p-6 w-80">
                    <h2 class="text-lg font-semibold mb-4">Switch Mode?</h2>
                    <p class="mb-6 text-sm">Switching modes will erase all recorded data. Do you want to continue?</p>
                    <div class="flex justify-end gap-2">
                        <button class="btn btn-sm" on:click={cancelSwitch}>Cancel</button>
                        <button class="btn btn-sm btn-error" on:click={confirmSwitch}>Switch</button>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<dialog id="help_modal" class="modal">
    <div class="modal-box w-11/12 max-w-3xl">
        <h3 class="font-bold text-2xl mb-4 text-center flex items-center justify-center gap-2">
            <IconHelp class="text-xl" /> Mondrian Transcription Software
        </h3>

        <div class="space-y-4 text-base">
            <p>Welcome to <strong>Mondrian Transcription</strong>! This tool allows you to <em>transcribe </em> movement data from video or <em>speculate</em> about how movement could occur over space and time. To get started:</p>
            <ul class="space-y-2">
                <li class="flex items-start gap-2">
                    <IconUpload class="text-xl mt-1" />
                    <span>Load a <strong>floor plan or image</strong> (PNG/JPG) and <strong>video</strong> (MP4) using the top buttons.<br /><em>* If using Speculate Mode you only need a floor plan/image</em></span>
                </li>
                <li class="flex items-start gap-2">
                    <IconClick class="text-xl mt-1" />
                    <span><strong>Click</strong> once on the floor plan to start recording movement data synchronized to video.</span>
                </li>
                <li class="flex items-start gap-2">
                    <IconStylusNote class="text-xl mt-1" />
                    <span>As you <strong>move your cursor</strong>, positioning data is recorded.</span>
                </li>
                <li class="flex items-start gap-2">
                    <IconClick class="text-xl mt-1" />
                    <span><strong>Click</strong> again on the floor plan to play/pause recording.</span>
                </li>
                <li class="flex items-start gap-2">
                    <IconFastForward class="text-xl mt-1" />
                    <span>Press <kbd class="border px-1 rounded">f</kbd> on your keyboard to fast forward video and recording 5 seconds.</span>
                </li>
                <li class="flex items-start gap-2">
                    <IconRewind class="text-xl mt-1" />
                    <span>Press <kbd class="border px-1 rounded">r</kbd> on your keyboard to rewind video and recording 5 seconds.</span>
                </li>
                <li class="flex items-start gap-2">
                    <IconExport class="text-xl mt-1" />
                    <span> <strong>Save</strong> your recorded data as a CSV file or <IconDelete class="inline-block text-xl" /> <strong>clear</strong> your data to start over.</span>
                </li>
            </ul>

            <p class="text-green-600 font-medium flex items-center gap-2">
                <IconPrivacyTip class="text-xl" />
                All your data stays local on your device. Nothing is uploaded or stored externally.
            </p>

            <p class="text-center">
                <a href="https://youtu.be/mgbNzikyucQ" target="_blank" rel="noopener noreferrer" class="inline-block px-4 py-2 bg-gray-300 text-black rounded-lg shadow hover:bg-gray-400 transition">
                    <IconPlayArrow class="inline-block mr-2 text-lg" /> Watch Demonstration Video
                </a>
            </p>
        </div>

        <div class="text-sm text-gray-500 mt-6 italic space-y-2">
            <p>
                Mondrian Transcription is an
                <a href="https://github.com/BenRydal/mondrian-transcription" class="text-blue-500 underline" target="_blank"> open-source project </a>
                built with Svelte, JavaScript, and p5.js licensed under the GNU General Public License Version 3.0. It is developed by Ben Rydal Shapiro, Edwin Zhao, and contributors, with support from the National Science Foundation (#1623690, #2100784). If using Mondrian Transcription in your work, kindly reference: Shapiro, B.R., Hall, R. and Owens, D. (2017). Developing & Using Interaction Geography in a Museum. International Journal of Computer-Supported Collaborative Learning, 12(4), 377-399.
                <a href="https://par.nsf.gov/servlets/purl/10074100" class="text-blue-500 underline" target="_blank">https://doi.org/10.1007/s11412-017-9264-8</a>
            </p>
        </div>

        <div class="modal-action mt-6">
            <a href="https://forms.gle/jfV6zntsvua4k3XdA" target="_blank" class="btn bg-gray-300 text-black"> Feedback </a>
            <form method="dialog">
                <button class="btn btn-primary">Close</button>
            </form>
        </div>
    </div>

    <form method="dialog" class="modal-backdrop">
        <button>close</button>
    </form>
</dialog>
