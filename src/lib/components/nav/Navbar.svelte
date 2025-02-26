<script lang="ts">
    import IconHelp from "~icons/material-symbols/help-outline";
    import IconSettings from "~icons/material-symbols/settings";
    import IconUpload from "~icons/material-symbols/upload";
    import IconDelete from "~icons/material-symbols/delete-outline";
    import IconExport from "~icons/material-symbols/download";
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

    const strokeWeights = [1, 2, 3, 4, 5, 8, 10];
    const pollingRates = [
        { label: "4ms", value: 4 },
        { label: "8ms", value: 8 },
        { label: "16ms", value: 16 },
        { label: "32ms", value: 32 },
        { label: "64ms", value: 64 },
        { label: "100ms", value: 100 },
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
                        <select class="select select-bordered select-sm w-full" value={$drawingConfig.pollingRate} on:change={(e) => drawingConfig.update((c) => ({ ...c, pollingRate: parseInt(e.currentTarget.value) }))}>
                            {#each pollingRates as rate}
                                <option value={rate.value}>{rate.label}</option>
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
    </div>
</div>

<dialog id="help_modal" class="modal">
    <div class="modal-box w-11/12 max-w-3xl">
        <h3 class="font-bold text-2xl mb-4 text-center">Mondrian Transcription Software</h3>
        <p class="py-2">Welcome to Mondrian Transcription! This tool allows you to transcribe fine-grained movement data from video. To get started, use the top buttons to load a floor plan formatted as a PNG/JPG image and video formatted as a MP4 file.</p>
        <p class="py-2">Then, <strong>click</strong> once anywhere on the floor plan to start recording movement data synchronized to the video. As you <strong>move your cursor</strong> over the floor plan, positioning data is recorded. <strong>Play/pause</strong> recording by clicking on the floor plan. Press the <strong>'f' key</strong> to fast forward and the <strong>'r' key</strong> to rewind video and data recording in 5 second intervals. Use the top buttons to <strong>clear/save</strong> your recording data as a CSV file.</p>
        <p class="py-2 text-center">
            <a href="https://youtu.be/mgbNzikyucQ" class="text-blue-500 underline" target="_blank" rel="noopener noreferrer"> Please also watch this demonstration video </a>
        </p>
        <p class="text-sm text-gray-500 mt-4 italic">Mondrian Transcription software is an open-source project built with Svelte, JavaScript and p5.js licensed under the GNU General Public License Version 2.0. It is developed by Ben Rydal Shapiro, Edwin Zhao and contributors with support from the National Science Foundation #1623690 and #2100784.</p>

        <div class="modal-action">
            <a href="https://forms.gle/jfV6zntsvua4k3XdA" target="_blank" class="btn bg-gray-300 text-black">Feedback</a>
            <form method="dialog">
                <button class="btn">Close</button>
            </form>
        </div>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button>close</button>
    </form>
</dialog>
