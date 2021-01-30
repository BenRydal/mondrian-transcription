void drawKeys() {
  textAlign(CENTER);
  fill(255);
  noStroke();
  if (!floorPlanLoaded) text("Load Floor Plan", windowFloorPlanWidth/2, windowFloorPlanHeight/2);
  if (!movieLoaded) text("Load Video", windowVideoWidth + windowVideoWidth/2, windowVideoHeight/2);
  textAlign(LEFT);
  fill(0);
  text("Play/Pause (p), Reset (r), Rewind, (b), FF (f), Write (w), SelectVideo (v), SelectPlan (s)", windowVideoWidth, windowVideoHeight + windowVideoHeight/2);
}
