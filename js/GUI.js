function drawKeys() {
    fill(0);
    //textFont(font_PlayfairReg, 30);
    textFont(font_Lato, 30);
    text("Play/Pause (p)\nFast-Forward (f)\nRewind (b)\nReset (r)\nWrite (w)", displayVideoWidth + spacing, displayVideoHeight + spacing);
  }

function keyPressed() {
    if (key == 'p') dataUpdate.playPauseRecording();
    else if (key == 'r') dataUpdate.reset();
    else if (key == 'b') dataUpdate.rewind();
    else if (key == 'f') dataUpdate.fastForward();
    else if (key == 'w' && recording) dataUpdate.writeFile();
  }

function setGUIWindows() {
    displayFloorplanWidth = width/2;
    displayFloorplanHeight = height;
    displayVideoWidth = width/2;
    displayVideoHeight = height/2;
    displayKeysWidth = width/2;
    displayKeysHeight = height/2;
    drawGUIWindows();
  }
  
  function drawGUIWindows() {
    noStroke();
    // Floor plan display window
    fill(150);
    rect(0, 0, displayFloorplanWidth, displayFloorplanHeight);
    // video window
    fill(0);
    rect(displayVideoWidth, 0, displayVideoWidth, displayVideoHeight);
    // Keys Window
    fill(255);
    rect(displayKeysWidth, displayKeysHeight, displayKeysWidth, displayKeysHeight);
  }