import type p5 from "p5";
import { get } from "svelte/store";
import { drawingConfig } from "../stores/drawingConfig";

export function isInDrawableArea(p5: p5, x: number, y: number): boolean {
  const config = get(drawingConfig);
  const splitX = (p5.width * config.splitPosition) / 100;

  return x > splitX && x < p5.width && y > 0 && y < p5.height;
}

export function convertToImageCoordinates(p5: p5, x: number, y: number) {
  const config = get(drawingConfig);
  const splitX = (p5.width * config.splitPosition) / 100;

  const relativeX = x - splitX;
  const relativeY = y;

  return {
    x: relativeX,
    y: relativeY,
  };
}
