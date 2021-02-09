class UpdateData {

  // Updates visualizatio and records data or writes file if at end of video
  void record() {
    image(movie, width/2, 0, width/2, height/2);
    if (movie.time() < movieDuration) data.recordPoint();
    else data.writeFile();
  }

  // Record data point and call update/draw line method
  void recordPoint() {
    //xPosition.add(int(map(mouseX, 0, floorPlan.width, 0, inputFloorPlanWidth)));
    curPath.xPos.add(mouseX * (inputFloorPlanWidth/displayFloorPlanWidth)); // rescale x,y positions to input floor plan
    curPath.yPos.add(mouseY * (inputFloorPlanHeight/displayFloorPlanHeight));
    curPath.tPos.add(movie.time());
    drawLine();
}

  // Draw the line segment scaled to visual screen
  void drawLine() {
    strokeWeight(5);
    stroke(0);
    line(constrain(mouseX, 0, windowFloorPlanWidth), constrain(mouseY, 0, windowFloorPlanHeight), constrain(pmouseX, 0, windowFloorPlanWidth), constrain(pmouseY, 0, windowFloorPlanHeight));
  }

  void reDrawAllData() {
    image(floorPlan, 0, 0);
    image(movie, width/2, 0, width/2, height/2);
    // loop through all existing files and draw each one different color
    for (int i = 0; i < paths.size(); i++) {
      stroke(colorShades[i % colorShades.length]); // set color
      // loop through path object and draw
      Path path = paths.get(i);
      for (int j = 1; j < path.xPos.size(); j++) { // start at 1
        int x = path.xPos.get(j) / (inputFloorPlanWidth/displayFloorPlanWidth);
        int y = path.yPos.get(j) / (inputFloorPlanHeight/displayFloorPlanHeight);
        int px = path.xPos.get(j-1) / (inputFloorPlanWidth/displayFloorPlanWidth); // prior point
        int py = path.yPos.get(j-1) / (inputFloorPlanHeight/displayFloorPlanHeight);
        line(x, y, px, py);
      }
    }
    reSetAllData = false;
  }

  // redrawfloorPlan and loop through all lists to draw complete path
  void reDrawCurPath() {
    stroke(0);
    for (int i = 0; i < curPath.xPos.size(); i++) {
      if (i!=0) line(curPath.xPos.get(i), curPath.yPos.get(i), curPath.xPos.get(i-1), curPath.yPos.get(i-1)); // draw line segment
    }
  }

  // Create and write coordinates to output file, increment curFileToOutput for next recording when finished
  void writeFile() {
    PrintWriter output = createWriter("Path_" + curFileToOutput + ".csv");
    for (int i = 0; i < curPath.xPos.size(); i++) output.println(curPath.tPos.get(i) + "," + curPath.xPos.get(i) + "," + curPath.yPos.get(i));
    output.flush(); // Writes the remaining data to the file
    output.close(); // Finishes the file
    curFileToOutput ++;
    data.addPath();
    data.clearPositionData();
    reSetAllData = true;
    movie.stop();
    recording = false;
  }

  // Clone current path into new Path object and add to paths ArrayList holder
  void addPath() {
    Path path = new Path();
    path.xPos = (ArrayList<Integer>)curPath.xPos.clone();
    path.yPos = (ArrayList<Integer>)curPath.yPos.clone();
    path.tPos = (ArrayList<Float>)curPath.tPos.clone();
    paths.add(path);
  }

  // reset curPath to record next file
  void clearPositionData() {
    curPath.xPos.clear();
    curPath.yPos.clear();
    curPath.tPos.clear();
  }

  void playPauseRecording() {
    if (recording) {
      movie.pause();
      recording = false;
    } else {
      movie.play();
      recording = true;
    }
  }

  // Reset arraylists, recording and redraw floor plan
  void reset() {
    movie.stop();
    recording = false;
    reDrawAllData();
    curPath.xPos.clear();
    curPath.yPos.clear();
    curPath.tPos.clear();
  }

  void rewind() {
    // Only rewind if not at very beginning of video
    float curEndTime = curPath.tPos.get(curPath.tPos.size()-1); // get time value from last element in list
    float newEndTime = curEndTime - videoJumpValue; // subtract videoJumpValue to set newEndTime 
    if (movie.time() > videoJumpValue) movie.jump(newEndTime); // rewind video to newEndTime or 0.1 if it is really close to start of video
    else movie.jump(0.1); 
    // Start at end of x or y list (NOT t) and delete up to newEndTime
    for (int i = curPath.xPos.size()-1; i >=0; i--) {
      if (curPath.tPos.get(i) > newEndTime) {
        curPath.tPos.remove(i);
        curPath.xPos.remove(i);
        curPath.yPos.remove(i);
      } else break;
    }
    data.reDrawAllData();
    data.reDrawCurPath();
  }

  void fastForward() {
    // Only ff if not at very end of video
    if (movie.time() < movieDuration - videoJumpValue) movie.jump(movie.time() + videoJumpValue);
    // add x,y,time values to lists for each second
    // for (int i = 0; i < videoJumpValue; i++) {
    //   xPosition.add(xPosition.get(xPosition.size()-1));
    //   yPosition.add(yPosition.get(yPosition.size()-1));
    //   tPosition.add(tPosition.get(tPosition.size()-1));
    // }
  }
}
