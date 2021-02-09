void keyPressed() {
  if (key == 'p') data.playPauseRecording();
  else if (key == 'r') data.reset();
  else if (key == 'b') data.rewind();
  else if (key == 'f') data.fastForward();
  else if (key == 'w') data.writeFile();
  else if (key == 'v') selectInput("Select a file to process:", "movieFileSelected");
  else if (key == 's') selectInput("Select a file to process:", "floorPlanFileSelected");
}

void movieFileSelected(File selection) {
  if (selection == null) println("Window was closed or the user hit cancel.");
  else {
    String fileName = selection.getAbsolutePath();
    if (fileName.endsWith(".mp4") || fileName.endsWith(".mov")) { // If it is a CSV file load data
      setMovie(fileName);
      movieLoaded = true;
      println("User selected " + selection.getAbsolutePath());
    }
  }
}

void floorPlanFileSelected(File selection) {
  if (selection == null)  println("Window was closed or the user hit cancel.");
  else {
    String fileName = selection.getAbsolutePath();
    if (fileName.endsWith(".png") || fileName.endsWith(".jpg")) { // If it is a CSV file load data
      setFloorPlan();
      floorPlanLoaded = true;
      println("User selected " + selection.getAbsolutePath());
    }
  }
}