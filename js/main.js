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
 * CLASSES/MODULES
 * Each class is currently treated as a singleton with respective .js file/module
 */
let core; // holds primary data and factory functions 
let keys; // holds data and methods controlling GUI display
let handlers; // holds methods controlling user event handling
let updateData; // Mediator Class to control synchronized method calls for path recording and movie
let loadData; // holds data loading methods
let videoPlayer; // videoPlayer is instantiated/updated when a video file is loaded

/**
 * PROGRAM OBJECTS
 */
let movie = null; // movie holds the "Div" created/destroyed when videoPlayer is instantiated
let floorPlan; // P5 image object to control display and interaction with floor plan image file

/**
 * CONSTANTS
 */
const FILEHEADERS = ["time", "x", "y"]; // Column headers for outputted .CSV movement files
const INFOMSG = "MONDRIAN TRANSCRIPTION SOFTWARE\n\nby Ben Rydal Shapiro & contributors\nbuilt with p5.js & JavaScript\n\nHi there! This tool allows you to transcribe fine-grained movement data from video. To get started, use the top buttons to upload a floor plan image file (PNG or JPG) and a video file (MP4). Then, use the key codes below to interact with the video and use your cursor to draw on the floor plan. As you interact with the video and simultaneously draw on the floor plan, positioning data is recorded as a CSV file organized by time in seconds and x/y pixel positions scaled to the pixel size of your floor plan image file. Use the top right button to save this file anytime and then record another movement path. For more information, see: https://www.benrydal.com/software/mondrian-transcription\n\nKEY CODES:  Play/Pause (p), Fast-Forward (f), Rewind (b), Reset (r)";
const COLORLIST = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
const PATHWEIGHT = 5; // Integer size of drawn paths
const CURPATHCOLOR = 0; // Color of currently recording path

/**
 * Required p5.js method, sets canvas, GUI and initial drawing requirements
 */
function setup() {
  canvas = createCanvas(window.innerWidth, window.innerHeight, P2D);
  core = new Core();
  keys = new Keys();
  handlers = new Handlers();
  updateData = new UpdateData();
  loadData = new LoadData();
}

/**
 * Required p5.js looping method, here it organizes two drawing modes for when data is and is not loaded
 */
function draw() {
  if (core.floorPlanLoaded && core.movieLoaded) setDrawingScreen();
  else setLoadDataScreen();
}

/**
 * Organizes methods for recording once all data is loaded
 */
function setDrawingScreen() {
  if (core.recording) updateData.setData(); // records data and updates visualization if in record mode
  // If info screen showing, redraw current screen first, then drawKeys
  if (core.showInfo) {
    updateData.reDrawAllData();
    updateData.updatePath.drawPath(core.curPath, CURPATHCOLOR);
    keys.drawIntroScreen();
  }
}

/**
 * Displays image or blank screen indicating movie is loaded
 */
function setLoadDataScreen() {
  keys.drawLoadDataGUI();
  if (core.floorPlanLoaded) keys.drawFloorPlanBackground();
  else if (core.movieLoaded) updateData.updateMovie.drawCurFrame();
  if (core.showInfo) keys.drawIntroScreen();
}

function keyPressed() {
  if (core.floorPlanLoaded && core.movieLoaded) handlers.handleKeyPressed();
}

/**
 * Returns false if parameter is undefined or null
 * @param  {Any Type} data
 */
function dataIsLoaded(data) {
  return data != null; // in javascript this tests for both undefined and null values
}