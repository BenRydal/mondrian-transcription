/*
CREDITS/LICENSE INFORMATION: 
This software is written in JavaScript and p5.js and is licensed under the GNU General Public License Version 2.0. 
See the GNU General Public License included with this software for more details. 
Mondrian Transcription software was originally developed by Ben Rydal Shapiro at Vanderbilt University
as part of his dissertation titled Interaction Geography & the Learning Sciences. 
Copyright (C) 2018 Ben Rydal Shapiro, and contributors. 
To reference or read more about this work please see: 
https://etd.library.vanderbilt.edu/available/etd-03212018-140140/unrestricted/Shapiro_Dissertation.pdf
*/

/**
 * CLASSES/MODULES each is treated as a singleton with respective .js file/module
 */
let core; // holds primary data and factory functions
let keys; // holds data and methods controlling GUI display
let handlers; // holds methods controlling user event handling
let updateData; // Mediator Class to control synchronized method calls for path recording and movie
let loadData; // holds data loading methods
let videoPlayer; // videoPlayer is instantiated/updated when a video file is loaded

let floorPlan = null; // P5 image object to control display and interaction with floor plan image file

/**
 * P5 INSTANCE FOR DRAWING
 */
let mondrian = new p5((sketch) => {

  sketch.setup = function () {
    sketch.canvas = sketch.createCanvas(window.innerWidth, window.innerHeight);
    core = new Core();
    keys = new Keys();
    handlers = new Handlers();
    updateData = new UpdateData();
    loadData = new LoadData();
  }

  /**
   * Program loop organizes two drawing modes for when data is and is not loaded
   */
  sketch.draw = function () {
    if (core.dataIsLoaded(floorPlan) && core.dataIsLoaded(videoPlayer)) {
      if (core.recording) updateData.updateRecording(); // records data and updates visualization if in record mode
      // If info screen showing, redraw current screen first, then drawKeys
      if (core.showInfo) {
        updateData.drawAllData();
        keys.drawIntroScreen();
      }
    } else {
      keys.drawLoadDataGUI();
      if (core.dataIsLoaded(floorPlan)) updateData.drawFloorPlan();
      else if (core.dataIsLoaded(videoPlayer)) updateData.drawVideoFrame();
      if (core.showInfo) keys.drawIntroScreen();
    }
  }

  /**
   * While wrapped in a P5 instance, this P5 method operates globally on the window (there can't be two of these methods)
   */
  sketch.keyPressed = function () {
    if (core.dataIsLoaded(floorPlan) && core.dataIsLoaded(videoPlayer)) handlers.handleKeyPressed();
  }
});