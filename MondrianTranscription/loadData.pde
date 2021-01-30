void setFloorPlan() {
  floorPlan = loadImage("floorplan.png");
  inputFloorPlanWidth = floorPlan.width; // set values based on pixel size of original img before resizing
  inputFloorPlanHeight = floorPlan.height;
  if (inputFloorPlanWidth > inputFloorPlanHeight) floorPlan.resize(width/2, 0);
  else floorPlan.resize(0, height);
}

void setMovie(String fileName) {
  movie = new Movie(this, fileName);
  movie.play();
  movieDuration = movie.duration();
  movie.stop();
}

void setGUIWindows() {
  windowFloorPlanWidth = width/2;
  windowFloorPlanHeight = height;
  windowVideoWidth = width/2;
  windowVideoHeight = height/2;
  windowKeysWidth = width/2;
  windowKeysHeight = height/2;
  drawGUIWindows();
}

void drawGUIWindows() {
  noStroke();
  // Floor plan display window
  fill(150);
  rect(0, 0, windowFloorPlanWidth, windowFloorPlanHeight);
  // video window
  fill(0);
  rect(windowVideoWidth, 0, windowVideoWidth, windowVideoHeight);
  // Keys Window
  fill(255);
  rect(windowKeysWidth, windowKeysHeight, windowKeysWidth, windowKeysHeight);
}
