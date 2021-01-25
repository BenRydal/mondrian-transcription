class UpdateData {

  // Record data/draw line segment
  void record() {
    //xPosition.add(int(map(mouseX, 0, floorPlan.width, 0, inputFloorPlanWidth)));
    xPosition.add(mouseX * (inputFloorPlanWidth/floorPlan.width)); // rescale x,y positions to input floor plan
    yPosition.add(mouseY * (inputFloorPlanHeight/floorPlan.height));
    tPosition.add(movie.time());
    line(constrain(mouseX, 0, width/2), mouseY, constrain(pmouseX, 0, width/2), pmouseY); // draw the line segment scaled to visual screen
  }

  // redrawfloorPlan and loop through all lists to draw complete path
  void reDraw() {
    image(floorPlan, 0, 0);
    for (int i = 0; i < xPosition.size(); i++) {
      if (i!=0) line(xPosition.get(i), yPosition.get(i), xPosition.get(i-1), yPosition.get(i-1)); // draw line segment
    }
  }

  // Create and write coordinates to output file, increment curFileToOutput for next recording when finished
  void writeFile() {
    PrintWriter output = createWriter(curFileToOutput + ".csv");
    for (int i = 0; i < xPosition.size(); i++) output.println(tPosition.get(i) + "," + xPosition.get(i) + "," + yPosition.get(i));
    output.flush(); // Writes the remaining data to the file
    output.close(); // Finishes the file
    curFileToOutput ++;
    // reset ArrayLists to record next file
    xPosition.clear();
    yPosition.clear();
    tPosition.clear();
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
    image(floorPlan, 0, 0);
    xPosition.clear();
    yPosition.clear();
    tPosition.clear();
  }

  void rewind() {
    // Only rewind if not at very beginning of video
    float curEndTime = tPosition.get(tPosition.size()-1); // get time value from last element in list
    float newEndTime = curEndTime - videoJumpValue; // subtract videoJumpValue to set newEndTime 
    if (movie.time() > videoJumpValue) movie.jump(newEndTime); // rewind video to newEndTime or 0.1 if it is really close to start of video
    else movie.jump(0.1); 
    // Start at end of x or y list (NOT t) and delete up to newEndTime
    for (int i = xPosition.size()-1; i >=0; i--) {
      if (tPosition.get(i) > newEndTime) {
        tPosition.remove(i);
        xPosition.remove(i);
        yPosition.remove(i);
      } else break;
    }
    data.reDraw();
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