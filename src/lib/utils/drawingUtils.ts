// src/utils/drawUtils.ts
import type p5 from "p5";
import { get } from "svelte/store";
import { drawingConfig, getSplitPositionForMode } from "../stores/drawingConfig";
import { drawingState } from "../stores/drawingState";

type Rect = { x: number; y: number; w: number; h: number };

/**
 * Compute the exact rect where the image is drawn on the right panel
 * (aspect-fit / "contain", centered).
 */
export function getFittedImageDisplayRect(p5: p5, splitPosPct: number, imgW: number, imgH: number): Rect {
    const splitX = (p5.width * splitPosPct) / 100;
    const panelW = p5.width - splitX;
    const panelH = p5.height;

    const imgAspect = imgW / imgH;
    const panelAspect = panelW / panelH;

    if (imgAspect > panelAspect) {
        // width-limited
        const w = panelW;
        const h = w / imgAspect;
        return { x: splitX, y: (panelH - h) / 2, w, h };
    } else {
        // height-limited
        const h = panelH;
        const w = h * imgAspect;
        return { x: splitX + (panelW - w) / 2, y: 0, w, h };
    }
}

export function isInDrawableArea(p5: p5, x: number, y: number): boolean {
    const config = get(drawingConfig);
    const splitX = (p5.width * getSplitPositionForMode()) / 100;
    return x > splitX && x < p5.width && y > 0 && y < p5.height;
}

/**
 * Convert screen coords -> image pixel coords using the same rect as draw().
 * Returns values clamped to image bounds.
 */
export function convertToImageCoordinates(p5: p5, x: number, y: number) {
    const config = get(drawingConfig);
    const state = get(drawingState);

    const imgW = state.imageWidth;
    const imgH = state.imageHeight;
    if (!imgW || !imgH) return { x: 0, y: 0 };

    const r = getFittedImageDisplayRect(p5, getSplitPositionForMode(), imgW, imgH);

    const nx = (x - r.x) / r.w;
    const ny = (y - r.y) / r.h;

    // Clamp normalized to [0,1] so clicks in letterbox map to edges
    const clamp = (v: number) => Math.min(1, Math.max(0, v));

    return {
        x: clamp(nx) * imgW,
        y: clamp(ny) * imgH,
    };
}
