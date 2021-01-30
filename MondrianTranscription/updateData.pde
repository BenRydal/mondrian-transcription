class UpdateData {

  void reDrawAllData() {
    image(floorPlan, 0, 0);
    image(movie, width/2, 0, width/2, height/2);
    // loop through all existing files and draw each one different color
    for (int i = 0; i < paths.size(); i++) {
      stroke(colorShades[i % colorShades.length]); // set color
      // loop through path object and draw
      Path path = paths.get(i);
      for (int j = 1; j < path.xPos.size(); j++) { // start at 1
        int x = path.xPos.get(j) / (inputFloorPlanWidth/floorPlan.width);
        int y = path.yPos.get(j) / (inputFloorPlanHeight/floorPlan.height);
        int px = path.xPos.get(j-1) / (inputFloorPlanWidth/floorPlan.width); // prior point
        int py = path.yPos.get(j-1) / (inputFloorPlanHeight/floorPlan.height);
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

  // Record data/draw line segment
  void record() {
    //xPosition.add(int(map(mouseX, 0, floorPlan.width, 0, inputFloorPlanWidth)));
    curPath.xPos.add(mouseX * (inputFloorPlanWidth/floorPlan.width)); // rescale x,y positions to input floor plan
    curPath.yPos.add(mouseY * (inputFloorPlanHeight/floorPlan.height));
    curPath.tPos.add(movie.time());
    setLineStyle();
    line(constrain(mouseX, 0, width/2), mouseY, constrain(pmouseX, 0, width/2), pmouseY); // draw the line segment scaled to visual screen
  }

  void setLineStyle() {
    strokeWeight(5);
    stroke(0);
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
    movieIsPlaying = false;
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

  void playPauseMovie() {
    if (movieIsPlaying) {
      movie.pause();
      movieIsPlaying = false;
    } else {
      movie.play();
      movieIsPlaying = true;
    }
  }

  // Reset arraylists, movieIsPlaying and redraw floor plan
  void reset() {
    movie.stop();
    movieIsPlaying = false;
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
