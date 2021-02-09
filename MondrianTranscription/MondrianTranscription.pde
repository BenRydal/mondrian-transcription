import processing.video.*;
import java.util.ArrayList;

ArrayList<Path> paths = new ArrayList<Path>();  // holds all recorded path files
Path curPath = new Path(); // current path to record

// Each recorded path file
class Path {
  ArrayList<Float> xPos = new ArrayList<Float>();
  ArrayList<Float> yPos = new ArrayList<Float>();
  ArrayList<Float> tPos = new ArrayList<Float>();
}

UpdateData data = new UpdateData(); // holds methods to update data recording and video
int curFileToOutput = 0; // current file number to write to output

// FLOOR PLAN
PImage floorPlan;
float inputFloorPlanWidth, inputFloorPlanHeight; // real pixel width and height of floorPlan image file
float displayFloorPlanWidth, displayFloorPlanHeight; // pixel width and height floorPlan is displayed

// VIDEO
Movie movie; // video file
float movieDuration; // video duration set in loadData from video data
boolean recording = false;
float videoJumpValue = 5.0; // value in seconds to ff or rewind

// GUI
boolean movieLoaded = false, floorPlanLoaded = false;
PFont font;
int windowFloorPlanWidth, windowFloorPlanHeight, windowVideoWidth, windowVideoHeight, windowKeysWidth, windowKeysHeight;
boolean reSetAllData = true; 
color [] colorShades = {#ff7f00, #1f78b4, #cab2d6, #33a02c, #fb9a99, #e31a1c, #fdbf6f, #a6cee3, #b2df8a, #6a3d9a, #ffff99, #b15928};

void setup() {
  fullScreen(P2D);
  pixelDensity(displayDensity());
  frameRate(30);
  font = loadFont("data/misc/Helvetica-24.vlw");
  textFont(font);
  textSize(22);
  setGUIWindows();
}

void draw() {
  if (floorPlanLoaded && movieLoaded) setDrawingSpace();
  else {
    drawGUIWindows();
    drawKeys();
  }
}

void setDrawingSpace() {
  if (reSetAllData) data.reDrawAllData();   // Runs once after data is initially loaded or file is written
  if (recording) data.record(); // records data and updates visualization if in record mode
}

void movieEvent(Movie m) {
  m.read();
}