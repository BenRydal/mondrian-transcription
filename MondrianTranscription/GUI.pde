void keyPressed() {
  // toggle record mode and video play
  if (key == 'p') data.playPauseMovie();
  else if (key == 'r') data.reset();
  else if (key == 'b') data.rewind();
  else if (key == 'f') data.fastForward();
  else if (key == 'w') data.writeFile();
}