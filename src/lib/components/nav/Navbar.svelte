<script lang="ts">
    import IconHelp from "~icons/material-symbols/help-outline";
    import IconSettings from "~icons/material-symbols/settings";
    import IconUpload from "~icons/material-symbols/upload";
    import IconDelete from "~icons/material-symbols/delete-outline";
    import IconExport from "~icons/material-symbols/download";
    import IconPlayArrow from "~icons/material-symbols/play-arrow";
    import IconFastForward from "~icons/material-symbols/fast-forward";
    import IconRewind from "~icons/material-symbols/fast-rewind";
    import IconStylusNote from "~icons/material-symbols/stylus-note";
    import IconPrivacyTip from "~icons/material-symbols/privacy-tip";
    import IconClick from "~icons/material-symbols/touch-app";
    import { onMount } from "svelte";
    import { drawingConfig } from "$lib/stores/drawingConfig";

    export let onImageUpload: (event: Event) => void;
    export let onVideoUpload: (event: Event) => void;
    export let onSavePath: () => void;
    export let onClear: () => void;
    export let onNewPath: () => void;

    onMount(() => {
        openHelpModal();
    });

    const modes = [
        { label: "Transcription Mode", value: true },
        { label: "Speculate Mode", value: false },
    ];
    const strokeWeights = [1, 2, 3, 4, 5, 8, 10];
    const pollingRates = [
        { labelVideo: "4ms", labelSpeculate: "4 steps", value: 4 },
        { labelVideo: "8ms", labelSpeculate: "8 steps", value: 8 },
        { labelVideo: "16ms", labelSpeculate: "16 steps", value: 16 },
        { labelVideo: "32ms", labelSpeculate: "32 steps", value: 32 },
        { labelVideo: "64ms", labelSpeculate: "64 steps", value: 64 },
        { labelVideo: "100ms", labelSpeculate: "100 steps", value: 100 },
    ];

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

<div class="navbar bg-base-100 h-16" on:mousedown={preventDrawing} on:mouseup={preventDrawing} on:mousemove={preventDrawing}>
    <div class="flex-1">
        <a class="btn btn-ghost text-xl" href="https://interactiongeography.org">Mondrian</a>
    </div>
    <div class="flex justify-end items-center gap-2">
        <!-- Help -->
        <button class="btn btn-ghost" on:click={openHelpModal}>
            <IconHelp class="w-5 h-5" />
        </button>

        <!-- Clear All -->
        <button class="btn btn-ghost gap-2" on:click={onClear}>
            <IconDelete class="w-5 h-5" />
            Clear All
        </button>

        <!-- Export All -->
        <button class="btn btn-ghost gap-2" on:click={onSavePath}>
            <IconExport class="w-5 h-5" />
            Export All
        </button>

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
                <select
                    class="select select-bordered select-sm w-full"
                    bind:value={$drawingConfig.isTranscriptionMode}
                    on:change={(e) => {
                        onClear();
                        drawingConfig.update((c) => ({
                            ...c,
                            isTranscriptionMode: e.currentTarget.value === "true",
                        }));
                    }}
                >
                    {#each modes as m}
                        <option value={m.value}>{m.label}</option>
                    {/each}
                </select>
            </label>
        </div>
    </div>
</div>

<dialog id="help_modal" class="modal">
    <div class="modal-box w-11/12 max-w-3xl">
        <h3 class="font-bold text-2xl mb-4 text-center flex items-center justify-center gap-2">
            <IconHelp class="text-xl" /> Mondrian Transcription Software
        </h3>

        <div class="space-y-4 text-base">
            <p>Welcome to <strong>Mondrian Transcription</strong>! This tool allows you to transcribe fine-grained movement data from video. To get started:</p>
            <ul class="space-y-2">
                <li class="flex items-start gap-2">
                    <IconUpload class="text-xl mt-1" />
                    <span>Load a <strong>floor plan</strong> (PNG/JPG) and <strong>video</strong> (MP4) using the top buttons.</span>
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
