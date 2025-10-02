<script lang="ts">
    import P5, { type Sketch } from "p5-svelte";
    import type p5 from "p5";
    import { onMount } from "svelte";
    import { fade } from "svelte/transition";
    import { drawingConfig, getSplitPositionForMode } from "../stores/drawingConfig";
    import { drawingState, createNewPath, handleTimeJump } from "../stores/drawingState";
    import { setupDrawing, drawPaths, timeSampler, indexSampler } from "./features/drawing";
    import { setupVideo } from "./features/video";
    import VideoControls from "../components/video/VideoControls.svelte";
    import { getFittedImageDisplayRect } from "$lib/utils/drawingUtils";

    let containerDiv: HTMLDivElement;
    let width = 800;
    let height = 400;
    let isDraggingSplitter = false;
    let videoElement: p5.Element | null = null;
    let p5Instance: p5;
    let lastVideoTime = 0;
    const colors = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];

    $: videoHtmlElement = videoElement ? (videoElement as any).elt : null;

    function handleSplitterDrag(e: MouseEvent) {
        if (isDraggingSplitter) {
            e.preventDefault();
            e.stopPropagation();

            const rect = containerDiv.getBoundingClientRect();
            const position = ((e.clientX - rect.left) / rect.width) * 100;
            const minVideoWidth = 30;
            const minImageWidth = 30;
            const constrainedPosition = Math.min(Math.max(position, minVideoWidth), 100 - minImageWidth);

            drawingConfig.update((config) => ({
                ...config,
                splitPosition: constrainedPosition,
            }));
        }
    }

    function handleSplitterEnd() {
        isDraggingSplitter = false;
        if (p5Instance) {
            p5Instance.loop();
        }
    }

    onMount(() => {
        window.addEventListener("keydown", (e) => {
            if (!videoHtmlElement) return;

            if (e.key.toLowerCase() === "f") {
                e.preventDefault();
                handleTimeJump(true, videoHtmlElement);
            } else if (e.key.toLowerCase() === "r") {
                e.preventDefault();
                handleTimeJump(false, videoHtmlElement);
            }
        });

        const updateDimensions = () => {
            height = window.innerHeight - 64;
            width = containerDiv.clientWidth;
            if (p5Instance) {
                p5Instance.resizeCanvas(width, height);
            }
        };

        window.addEventListener("resize", updateDimensions);
        updateDimensions();
        return () => window.removeEventListener("resize", updateDimensions);
    });

    const sketch: Sketch = (p5: p5) => {
        p5Instance = p5;
        const { handleMousePressedVideo, handleMousePressedSpeculateMode, handleDrawing } = setupDrawing(p5);

        p5.setup = () => {
            const canvas = p5.createCanvas(width, height);
            canvas.parent(containerDiv);
            p5.strokeCap(p5.ROUND);
            p5.strokeJoin(p5.ROUND);

            if (p5Instance) {
                p5Instance.noLoop();
            }
        };

        p5.draw = () => {
            p5.background(255);
            if ($drawingConfig.isTranscriptionMode) {
                if (videoElement) {
                    const { updateVideoTime, drawVideo, checkVideoEnd } = setupVideo(p5);
                    lastVideoTime = updateVideoTime(videoElement, lastVideoTime);
                    checkVideoEnd(videoElement);
                    drawVideo(p5, videoElement);
                }

                const img = $drawingState.imageElement;
                const imgW = $drawingState.imageWidth;
                const imgH = $drawingState.imageHeight;

                if (img && imgW && imgH) {
                    const r = getFittedImageDisplayRect(p5, getSplitPositionForMode(), imgW, imgH);
                    p5.image(img, r.x, r.y, r.w, r.h);
                }

                handleDrawing();
                drawPaths(p5);
            } else {
                const img = $drawingState.imageElement;
                const imgW = $drawingState.imageWidth;
                const imgH = $drawingState.imageHeight;

                if (img && imgW && imgH) {
                    const r = getFittedImageDisplayRect(p5, getSplitPositionForMode(), imgW, imgH);
                    p5.image(img, r.x, r.y, r.w, r.h);
                }

                handleDrawing();
                drawPaths(p5);
            }
        };

        p5.mousePressed = () => {
            if (!$drawingConfig.isTranscriptionMode) {
                handleMousePressedSpeculateMode();
            } else {
                if (!isDraggingSplitter) {
                    handleMousePressedVideo(videoHtmlElement);
                }
            }
        };
        if (p5Instance) {
            p5Instance.loop();
        }
    };

    export function setVideo(video: HTMLVideoElement) {
        lastVideoTime = 0;

        drawingState.update((state) => ({
            ...state,
            videoTime: 0,
        }));

        if (videoElement) {
            try {
                const videoElt = (videoElement as any).elt;
                if (videoElt) {
                    videoElt.pause();
                    videoElt.currentTime = 0;
                }
                (videoElement as any).remove();
            } catch (e) {
                console.warn("Error cleaning up previous video:", e);
            }
        }

        video.loop = false;

        const { setVideo: setupP5Video } = setupVideo(p5Instance);
        videoElement = setupP5Video(video);

        if (videoElement) {
            (videoElement as any).elt.loop = false;

            if (p5Instance) {
                p5Instance.redraw();
                clearDrawing();
            }
        }

        createNewPath(colors[0]);
    }

    export function setImage(image: HTMLImageElement) {
        p5Instance.loadImage(image.src, (p5Img: p5.Image) => {
            if (!$drawingConfig.isTranscriptionMode) {
                createNewPath(colors[0]);
                if (p5Instance) {
                    // TODO: can this block be removed here and in setVideo?
                    p5Instance.redraw();
                    clearDrawing();
                }
            }
            drawingState.update((state) => ({
                ...state,
                imageWidth: image.width,
                imageHeight: image.height,
                imageElement: p5Img,
            }));
        });
    }

    export function startNewPath() {
        const currentPathCount = $drawingState.paths.length;
        const newColor = colors[currentPathCount % colors.length];
        timeSampler.reset();
        indexSampler.reset();

        if (!$drawingConfig.isTranscriptionMode) {
            createNewPath(newColor);
        } else {
            if (!videoHtmlElement) return;

            videoHtmlElement.currentTime = 0;
            videoHtmlElement.pause();
            createNewPath(newColor);
        }

        drawingState.update((state) => ({
            ...state,
            shouldTrackMouse: false,
            isDrawing: false,
            isVideoPlaying: false, // always false if no video
        }));
    }

    export function exportPath() {
        const paths = $drawingState.paths;
        paths.forEach((path, index) => {
            if (path.points.length === 0) return;

            const csv = path.points.map((p) => `${p.x},${p.y},${p.time}`).join("\n");
            const blob = new Blob([`x,y,time\n${csv}`], { type: "text/csv" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `path-${index + 1}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);
        });
    }

    export function clearDrawing() {
        if (videoHtmlElement) {
            videoHtmlElement.currentTime = 0;
            videoHtmlElement.pause();
        }

        drawingState.update((state) => ({
            ...state,
            paths: [],
            currentPathId: 0,
            shouldTrackMouse: false,
            isDrawing: false,
            isVideoPlaying: false,
        }));

        createNewPath(colors[0]);
    }

    $: if (containerDiv && $drawingConfig) {
        containerDiv.style.setProperty("--split-width", `${$drawingConfig.splitPosition}%`);
    }
</script>

<div bind:this={containerDiv} class="relative w-full h-[calc(100vh-64px)]" on:mousemove={handleSplitterDrag} on:mouseup={handleSplitterEnd} on:mouseleave={handleSplitterEnd} role="application" aria-label="Drawing Canvas">
    <P5 {sketch} />

    {#if $drawingConfig.isTranscriptionMode}
        <div
            class="absolute top-0 bottom-0 w-8 bg-transparent cursor-col-resize hover:bg-black/5"
            style="left: calc({$drawingConfig.splitPosition}% - 16px)"
            on:mousedown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                isDraggingSplitter = true;
            }}
            role="separator"
            aria-label="Resize panels"
            transition:fade={{ duration: 200 }}
        >
            <div class="absolute top-0 bottom-0 w-1 bg-gray-400 hover:bg-blue-500 transition-colors" style="left: 50%" />
        </div>
    {/if}

    {#if videoHtmlElement}
        <VideoControls videoElement={videoHtmlElement} />
    {/if}
</div>
