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
let setData; // holds methods to control interface display and recording/updating data
let loadData; // holds data loading methods
let videoPlayer; // videoPlayer is instantiated/updated when a video file is loaded

/**
 * ADDITIONAL DATA OBJECTS
 */
let movieDiv = null; // movie holds the "Div" created/destroyed when videoPlayer is instantiated
let floorPlan = undefined; // P5 image object to control display and interaction with floor plan image file

/**
 * CONSTANTS
 */
const FILEHEADERS = ["time", "x", "y"]; // Column headers for outputted .CSV movement files
const COLORLIST = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
const PATHWEIGHT = 5; // Integer size of drawn paths
const CURPATHCOLOR = 0; // Color of currently recording path

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
    setData = new SetData();
  }

  /**
   * Program loop. Organizes two drawing modes for when data is and is not loaded
   */
  sketch.draw = function () {
    if (core.floorPlanLoaded && core.movieLoaded) setData.setDrawingScreen();
    else setData.setLoadDataScreen();
  }
  /**
   * P5 method to handle key presses
   * NOTE: While wrapped in a P5 instance, this method operates globally on the window (there can't be two of these methods)
   */
  sketch.keyPressed = function () {
    if (core.floorPlanLoaded && core.movieLoaded) handlers.handleKeyPressed();
  }
});