void setFloorPlan() {
  floorPlan = loadImage("floorplan.png");
  inputFloorPlanWidth = floorPlan.width; // set values based on pixel size of original img before resizing
  inputFloorPlanHeight = floorPlan.height;
  if (inputFloorPlanWidth > inputFloorPlanHeight) floorPlan.resize(width/2, 0);
  else floorPlan.resize(0, height);
  // imageMode(CENTER);
  //image(floorPlan, width/4, height/2);
  image(floorPlan, 0, 0);
}

void setGUIWindows() {
  // Floor plan display window
  noFill();
  strokeWeight(2);
  rect(0, 0, width/2, height);
  // video window
  fill(255);
  rect(width/2, 0, width/2, height/2);
  // Keys Windwo
  fill(150);
  rect(width/2, height/2, width/2, height/2);
}

void setMovie() {
  movie = new Movie(this, "video.mp4");
  movie.play();
  movieDuration = movie.duration();
  movie.stop();
}

void setDrawStyles() {
  strokeWeight(5);
}
