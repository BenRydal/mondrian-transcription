function keyPressed() {
  if (floorPlanLoaded && movieLoaded) {
    if (key == 'p' || key == 'P') {
      dataUpdate.updateMovie.playPauseRecording();
      if (showInfo) handleIntroButton(); // prevent info screen from showing while recording for smooth user interaction
    } else if (key == 'r' || key == 'R') dataUpdate.resetCurRecording();
    else if (key == 'b' || key == 'B') dataUpdate.rewind();
    else if (key == 'f' || key == 'F') dataUpdate.fastForward();
  }
}

/**
 * Sets floor plan, video, and info message sizing/positions
 */
function setGUIWindows() {
  keyTextSize = width / 75;
  // width/heights
  displayFloorplanWidth = width / 2;
  displayFloorplanHeight = height;
  displayVideoWidth = width / 2;
  displayVideoHeight = height;

  // x/y positions
  displayFloorplanXpos = width / 2;
  displayFloorplanYpos = 0;
  displayVideoXpos = 0;
  displayVideoYpos = 0;
}
/**
 * Draws floor plan, video, and key windows
 */
function drawGUIWindows() {
  noStroke();
  // Floor Plan
  fill(225);
  rect(displayFloorplanXpos, displayFloorplanYpos, displayFloorplanWidth, displayFloorplanHeight);
  // Video
  fill(200);
  rect(displayVideoXpos, displayVideoYpos, displayVideoWidth, displayVideoHeight);
}

function drawFloorPlanBackground() {
  fill(255); // draw white screen in case floor plan image has any transparancy
  stroke(255);
  rect(displayFloorplanXpos, displayFloorplanYpos, displayFloorplanWidth, displayFloorplanHeight);
  image(core.floorPlan, displayFloorplanXpos, displayFloorplanYpos, displayFloorplanWidth, displayFloorplanHeight);
}
/**
 * Draws key text
 */
function drawKeys() {
  rectMode(CENTER);
  stroke(0);
  strokeWeight(1);
  fill(255, 180);
  rect(width / 2, height / 2, width / 2 + spacing, height / 2 + spacing);
  fill(0);
  textFont(font_Lato, keyTextSize);
  text(infoMsg, width / 2, height / 2, width / 2, height / 2);
  rectMode(CORNER);
}