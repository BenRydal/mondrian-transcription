import type p5 from "p5";
import type { Point } from "../types/sketch";
import { get } from "svelte/store";
import { drawingState, addPointToCurrentPath, toggleDrawing, toggleDrawingNoVideo } from "../../stores/drawingState";
import { drawingConfig, getSplitPositionForMode } from "../../stores/drawingConfig";
import { isInDrawableArea, convertToImageCoordinates } from "../../utils/drawingUtils";
import { getFittedImageDisplayRect } from "../../utils/drawingUtils";
import { TimeBasedSampler, IndexBasedSampler } from "./samplers";

export const timeSampler = new TimeBasedSampler(get(drawingConfig).pollingRate / 1000);
export const indexSampler = new IndexBasedSampler(get(drawingConfig).pollingRate);

export function setupDrawing(p5: p5) {
    drawingConfig.subscribe((config) => {
        timeSampler.setInterval(config.pollingRate / 1000);
        indexSampler.setStep(config.pollingRate); // or whatever mapping you want
    });

    const addCurrentPoint = () => {
        const state = get(drawingState);
        const config = get(drawingConfig);
        if (!state.shouldTrackMouse || !isInDrawableArea(p5, p5.mouseX, p5.mouseY)) return;

        const curPath = state.paths[state.currentPathId - 1];
        if (!curPath) return;

        const curPointArray = curPath.points;
        const coords = convertToImageCoordinates(p5, p5.mouseX, p5.mouseY);

        let time: number;
        let shouldAdd = false;

        if (config.isTranscriptionMode) {
            time = state.videoTime;
            shouldAdd = timeSampler.shouldSample(time);
        } else {
            shouldAdd = indexSampler.shouldSample();
            time = indexSampler.getPseudoTime();
        }

        if (!shouldAdd) return;

        const point: Point = {
            ...coords,
            time,
            pathId: state.currentPathId,
        };

        addPointToCurrentPath(point);
    };

    const handleMousePressedVideo = (videoElement?: HTMLVideoElement) => {
        if (isInDrawableArea(p5, p5.mouseX, p5.mouseY)) {
            const state = get(drawingState);
            const config = get(drawingConfig);

            if (videoElement && videoElement.currentTime >= videoElement.duration - 0.1) {
                return;
            }
            if (!state.shouldTrackMouse) {
                timeSampler.reset();
                indexSampler.reset();
            }
            toggleDrawing(videoElement);
        }
    };

    const handleMousePressedSpeculateMode = () => {
        if (isInDrawableArea(p5, p5.mouseX, p5.mouseY)) {
            toggleDrawingNoVideo();
        }
    };

    const handleDrawing = () => {
        const state = get(drawingState);
        addCurrentPoint();
        if (state.shouldTrackMouse) {
            addCurrentPoint();
        }
    };

    return {
        handleMousePressedVideo,
        handleMousePressedSpeculateMode,
        handleDrawing,
    };
}

export function drawPaths(p5: p5) {
    const state = get(drawingState);
    const config = get(drawingConfig);

    const imgW = state.imageWidth;
    const imgH = state.imageHeight;
    if (!imgW || !imgH) return;

    const r = getFittedImageDisplayRect(p5, getSplitPositionForMode(), imgW, imgH);
    const ENDPOINT_MARKER_SIZE = 15;

    p5.push();
    state.paths.forEach((path) => {
        p5.strokeWeight(config.strokeWeight);
        p5.stroke(path.color);
        p5.noFill();

        const toDisplay = (pt: { x: number; y: number }) => ({
            x: r.x + (pt.x / imgW) * r.w,
            y: r.y + (pt.y / imgH) * r.h,
        });

        if (path.points.length > 1) {
            p5.beginShape();
            path.points.forEach((pt) => {
                const { x, y } = toDisplay(pt);
                p5.vertex(x, y);
            });
            p5.endShape();

            // Pulsing endpoint for the active path
            if (path.pathId === state.currentPathId && !state.shouldTrackMouse) {
                const last = toDisplay(path.points[path.points.length - 1]);

                const pulseScale = (Math.sin(p5.frameCount * 0.05) + 1) * 0.25 + 0.5;

                p5.noStroke();
                for (let i = 4; i > 0; i--) {
                    const alpha = 50 - i * 10;
                    p5.fill(255, 0, 0, alpha);
                    const size = ENDPOINT_MARKER_SIZE * (1.5 + i * 0.5) * pulseScale;
                    p5.circle(last.x, last.y, size);
                }

                p5.fill(255, 0, 0, 200);
                p5.circle(last.x, last.y, ENDPOINT_MARKER_SIZE * pulseScale);

                p5.fill(255);
                p5.circle(last.x, last.y, ENDPOINT_MARKER_SIZE * 0.5 * pulseScale);
            }
        } else if (path.points.length === 1) {
            const { x, y } = toDisplay(path.points[0]);
            p5.point(x, y);
        }
    });

    p5.pop();
}
