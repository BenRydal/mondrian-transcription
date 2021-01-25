// fix floor plan scaling
// test run/file writing
// add gui controls with key codes
// develop multiple file display to bottom right of GUI

import processing.video.*;
import java.util.ArrayList;

ArrayList<Integer> xPosition = new ArrayList();  // List for x Positions
ArrayList<Integer> yPosition = new ArrayList();   // List for y Positions
ArrayList<Float> tPosition = new ArrayList();   // List for time values
UpdateData data = new UpdateData(); // holds methods to update data recording and video
int curFileToOutput = 0; // current file number to write to output

// FLOOR PLAN
PImage floorPlan;
int inputFloorPlanWidth;
int inputFloorPlanHeight;

// VIDEO
Movie movie; // video file
float movieDuration; // video duration set in loadData from video data
boolean movieIsPlaying = false;
float videoJumpValue = 5.0; // value in seconds to ff or rewind

void setup() {
  fullScreen(P2D);
  pixelDensity(displayDensity());
  frameRate(30);
  setFloorPlan();
  setGUIWindows();
  setMovie();
  setDrawStyles();
}

void draw() {
  image(movie, width/2, 0, width/2, height/2);
  // draw recording/video controls
  if (movieIsPlaying) {
    if (movie.time() < movieDuration) data.record();
    else {
      data.writeFile();
      movie.stop();
    }
  }
}

void movieEvent(Movie m) {
  m.read();
}