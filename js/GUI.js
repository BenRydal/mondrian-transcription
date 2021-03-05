function keyPressed() {
  if (key == 'p' || key == 'P') dataUpdate.playPauseRecording();
  else if (key == 'r' || key == 'R') dataUpdate.reset();
  else if (key == 'b' || key == 'B') dataUpdate.rewind();
  else if (key == 'f' || key == 'F') dataUpdate.fastForward();
  else if (key == 's' || key == 'S') dataUpdate.writeFile();
}

function setGUIWindows() {
  infoTextSize = width/100;
  keyTextSize = width/75;
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

function drawKeys() {
  fill(0);
  textFont(font_Lato, keyTextSize);
  text(descMSG, displayKeysXpos + spacing/2, displayKeysYpos + spacing/2, displayKeysWidth - spacing, displayKeysHeight - spacing);
  textFont(font_PlayfairItalic, infoTextSize);
  text(infoMsg, 0, height - spacing);
}