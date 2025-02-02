import type p5 from "p5";
import type { Point } from "../types/sketch";
import { get } from "svelte/store";
import {
  drawingState,
  addPointToCurrentPath,
  toggleDrawing,
} from "../../stores/drawingState";
import { drawingConfig } from "../../stores/drawingConfig";
import {
  isInDrawableArea,
  convertToImageCoordinates,
} from "../../utils/drawingUtils";

export function setupDrawing(p5: p5) {
  const addCurrentPoint = () => {
    const state = get(drawingState);
    if (!state.shouldTrackMouse) return;

    if (isInDrawableArea(p5, p5.mouseX, p5.mouseY)) {
      const coords = convertToImageCoordinates(p5, p5.mouseX, p5.mouseY);
      const point: Point = {
        ...coords,
        time: state.videoTime,
        pathId: state.currentPathId,
      };
      addPointToCurrentPath(point);
    }
  };

  const handleMousePressed = (videoElement?: HTMLVideoElement) => {
    if (isInDrawableArea(p5, p5.mouseX, p5.mouseY)) {
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
  const splitX = (p5.width * config.splitPosition) / 100;
  const drawingAreaWidth = p5.width - splitX;
  const drawingAreaHeight = p5.height;

  p5.push();

  state.paths.forEach((path) => {
    p5.strokeWeight(config.strokeWeight);
    p5.stroke(path.color);
    p5.noFill();

    if (path.points.length > 1) {
      p5.beginShape();
      path.points.forEach((point) => {
        const displayX =
          splitX + (point.x * drawingAreaWidth) / state.imageWidth;
        const displayY = (point.y * drawingAreaHeight) / state.imageHeight;
        p5.vertex(displayX, displayY);
      });
      p5.endShape();
    } else if (path.points.length === 1) {
      const point = path.points[0];
      const displayX = splitX + (point.x * drawingAreaWidth) / state.imageWidth;
      const displayY = (point.y * drawingAreaHeight) / state.imageHeight;
      p5.point(displayX, displayY);
    }
  });
  p5.pop();
}
