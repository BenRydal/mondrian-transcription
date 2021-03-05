function drawKeys() {
  fill(0);
  //textFont(font_PlayfairReg, 30);
  textFont(font_Lato, 30);
  text("Play/Pause (p)\nFast-Forward (f)\nRewind (b)\nReset (r)\nWrite (w)", displayKeysXpos + spacing, displayKeysYpos + spacing);
}

function keyPressed() {
  if (key == 'p') dataUpdate.playPauseRecording();
  else if (key == 'r') dataUpdate.reset();
  else if (key == 'b') dataUpdate.rewind();
  else if (key == 'f') dataUpdate.fastForward();
  else if (key == 'w' && recording) dataUpdate.writeFile();
}

function setGUIWindows() {
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
  // Draw GUI
  drawGUIWindows();
}

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