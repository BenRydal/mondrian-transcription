import type p5 from "p5";
import type { Point } from "../types/sketch";
import { get } from "svelte/store";
import { drawingState, addPointToCurrentPath, toggleDrawing } from "../../stores/drawingState";
import { drawingConfig } from "../../stores/drawingConfig";
import { isInDrawableArea, convertToImageCoordinates } from "../../utils/drawingUtils";
import { getFittedImageDisplayRect } from "../../utils/drawingUtils";

class TimeBasedSampler {
    private lastSampleTime: number = 0;

    constructor(private sampleInterval: number) {}

    shouldSample(currentTime: number): boolean {
        if (currentTime - this.lastSampleTime >= this.sampleInterval) {
            this.lastSampleTime = currentTime;
            return true;
        }
        return false;
    }

    reset() {
        this.lastSampleTime = 0;
    }
}

export function setupDrawing(p5: p5) {
    const sampler = new TimeBasedSampler(get(drawingConfig).pollingRate / 1000);

    drawingConfig.subscribe((config) => {
        sampler.reset();
    });

    const addCurrentPoint = () => {
        const state = get(drawingState);
        if (!state.shouldTrackMouse) return;

        if (isInDrawableArea(p5, p5.mouseX, p5.mouseY)) {
            if (sampler.shouldSample(state.videoTime)) {
                const coords = convertToImageCoordinates(p5, p5.mouseX, p5.mouseY);
                const point: Point = {
                    ...coords,
                    time: state.videoTime,
                    pathId: state.currentPathId,
                };
                addPointToCurrentPath(point);
            }
        }
    };

    const handleMousePressed = (videoElement?: HTMLVideoElement) => {
        if (isInDrawableArea(p5, p5.mouseX, p5.mouseY)) {
            const state = get(drawingState);

            if (videoElement && videoElement.currentTime >= videoElement.duration - 0.1) {
                return;
            }

            if (!state.shouldTrackMouse) {
                sampler.reset();
            }

            toggleDrawing(videoElement);
        }
    };

    const handleDrawing = () => {
        const state = get(drawingState);
        if (state.shouldTrackMouse) {
            addCurrentPoint();
        }
    };

    return {
        handleMousePressed,
        handleDrawing,
    };
}

export function drawPaths(p5: p5) {
    const state = get(drawingState);
    const config = get(drawingConfig);

    const imgW = state.imageWidth;
    const imgH = state.imageHeight;
    if (!imgW || !imgH) return;

    // Same rect used for p5.image(...)
    const r = getFittedImageDisplayRect(p5, config.splitPosition, imgW, imgH);

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
