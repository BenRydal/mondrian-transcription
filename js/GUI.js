let movieDisplayLarge = false; // controls dynamic sizing of video, set to false or size small to start

function keyPressed() {
  if (key == 'p' || key == 'P') dataUpdate.updateMovie.playPauseRecording();
  else if (key == 'r' || key == 'R') dataUpdate.resetCurPath();
  else if (key == 'b' || key == 'B') dataUpdate.rewind();
  else if (key == 'f' || key == 'F') dataUpdate.fastForward();
  else if (key == 's' || key == 'S') dataUpdate.writeFile();
  else if (key == 'v' || key == 'V') {
    if (movieDisplayLarge) {
      setDisplayMovieSize(displayVideoWidth, displayVideoHeight);
      movieDisplayLarge = false;
    }
    else {
      setDisplayMovieSize(displayVideoWidth, displayKeysYpos + displayKeysHeight);
      movieDisplayLarge = true;
    }
    drawKeys();
    this.updateMovie.drawCurFrame();
  }
}

/**
 * Sets floor plan, video, and info message sizing/positions
 */
function setGUIWindows() {
  infoTextSize = width / 110;
  keyTextSize = width / 75;
  // width/heights
  displayFloorplanWidth = width / 2;
  displayFloorplanHeight = height;
  displayVideoWidth = width / 2;
  displayVideoHeight = height / 2;
  displayKeysWidth = width / 2;
  displayKeysHeight = height / 2;

  // x/y positions
  displayFloorplanXpos = width / 2;
  displayFloorplanYpos = 0;
  displayVideoXpos = 0;
  displayVideoYpos = 0;
  displayKeysXpos = 0;
  displayKeysYpos = height / 2;
}
/**
 * Draws floor plan, video, and key windows
 */
function drawGUIWindows() {
  noStroke();
  // Floor Plan
  fill(floorPlanBackgroundCol);
  rect(displayFloorplanXpos, displayFloorplanYpos, displayFloorplanWidth, displayFloorplanHeight);
  // Video
  fill(videoBackgroundColor);
  rect(displayVideoXpos, displayVideoYpos, displayVideoWidth, displayVideoHeight);
  // Keys
  fill(keysBackgroundColor);
  rect(displayKeysXpos, displayKeysYpos, displayKeysWidth, displayKeysHeight);
}
/**
 * Draws key text
 */
function drawKeys() {
  stroke(255);
  fill(keysBackgroundColor);
  rect(displayKeysXpos, displayKeysYpos, displayKeysWidth, displayKeysHeight);
  fill(0);
  textFont(font_Lato, keyTextSize);
  text(descMSG, displayKeysXpos + spacing / 2, displayKeysYpos + spacing / 2, displayKeysWidth - spacing, displayKeysHeight - spacing);
  textFont(font_PlayfairItalic, infoTextSize);
  text(infoMsg, 0, height - spacing);
}

// Tests if over rectangle with x, y, and width/height
function overRect(x, y, boxWidth, boxHeight) {
  return mouseX >= x && mouseX <= x + boxWidth && mouseY >= y && mouseY <= y + boxHeight;
}