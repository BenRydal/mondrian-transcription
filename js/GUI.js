// function keyPressed() {
//     if (key == 'f') movie.time(movie.time() + 5); // jumps to time parameter
//     else if (key == 'b') movie.time(movie.time() - 5); // jumps to time parameter
// }

function drawKeys() {
    fill(0);
    text("Play/Pause (p), Reset (r), Rewind, (b), FF (f), Write (w)", windowVideoWidth, windowVideoHeight + windowVideoHeight/2);
  }

function keyPressed() {
    if (key == 'p') dataUpdate.playPauseRecording();
    else if (key == 'r') dataUpdate.reset();
    else if (key == 'b') dataUpdate.rewind();
    else if (key == 'f') dataUpdate.fastForward();
    else if (key == 'w' && recording) dataUpdate.writeFile();
  }

function setGUIWindows() {
    windowFloorPlanWidth = width/2;
    windowFloorPlanHeight = height;
    windowVideoWidth = width/2;
    windowVideoHeight = height/2;
    windowKeysWidth = width/2;
    windowKeysHeight = height/2;
    drawGUIWindows();
  }
  
  function drawGUIWindows() {
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