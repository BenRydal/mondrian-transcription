import { writable } from "svelte/store";
import type p5 from "p5";
import type { Point } from "../p5/types/sketch";

export interface PathData {
  points: Point[];
  color: string;
  pathId: number;
}

export interface DrawingState {
  isVideoPlaying: boolean;
  isDrawing: boolean;
  shouldTrackMouse: boolean;
  paths: PathData[];
  imageWidth: number;
  imageHeight: number;
  videoTime: number;
  imageElement: p5.Image | null;
  currentPathId: number;
}

const initialState: DrawingState = {
  isVideoPlaying: false,
  isDrawing: false,
  shouldTrackMouse: false,
  paths: [],
  imageWidth: 0,
  imageHeight: 0,
  videoTime: 0,
  imageElement: null,
  currentPathId: 0,
};

export const drawingState = writable<DrawingState>(initialState);

export function toggleDrawing(videoElement?: HTMLVideoElement) {
  drawingState.update((state) => {
    const newShouldTrack = !state.shouldTrackMouse;

    if (videoElement) {
      try {
        if (newShouldTrack) {
          const playPromise = videoElement.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.error("Error playing video:", error);
            });
          }
        } else {
          videoElement.pause();
        }
      } catch (error) {
        console.error("Error handling video:", error);
      }
    }

    return {
      ...state,
      shouldTrackMouse: newShouldTrack,
      isDrawing: newShouldTrack,
      isVideoPlaying: newShouldTrack,
    };
  });
}

export function createNewPath(color: string) {
  drawingState.update((state) => {
    const newPathId = state.currentPathId + 1;
    return {
      ...state,
      currentPathId: newPathId,
      paths: [
        ...state.paths,
        {
          points: [],
          color,
          pathId: newPathId,
        },
      ],
    };
  });
}

export function addPointToCurrentPath(point: Point) {
  drawingState.update((state) => {
    if (!state.shouldTrackMouse) return state;

    const currentPathIndex = state.paths.findIndex(
      (p) => p.pathId === state.currentPathId
    );

    if (currentPathIndex === -1) {
      const colors = [
        "#FF0000",
        "#00FF00",
        "#0000FF",
        "#FFFF00",
        "#FF00FF",
        "#00FFFF",
      ];
      const newColor = colors[state.paths.length % colors.length];
      createNewPath(newColor);
      return state;
    }

    const updatedPaths = [...state.paths];
    updatedPaths[currentPathIndex] = {
      ...updatedPaths[currentPathIndex],
      points: [...updatedPaths[currentPathIndex].points, point],
    };

    return {
      ...state,
      paths: updatedPaths,
    };
  });
}
