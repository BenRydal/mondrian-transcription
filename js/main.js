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

/*
TODO: 
4) dataUpdate as official mediator?
5) create movie class/facade?
  */

let dataUpdate; // Instance of UpdateData class to control synchronized method calls for path recording and movie
let core;
let keys;
let handlers;

// CONSTANTS
const FILEHEADERS = ["time", "x", "y"]; // Column headers for outputted .CSV movement files
const INFOMSG = "MONDRIAN TRANSCRIPTION SOFTWARE\n\nby Ben Rydal Shapiro & contributors\nbuilt with p5.js & JavaScript\n\nHi there! This tool allows you to transcribe fine-grained movement data from video. To get started, use the top buttons to upload a floor plan image file (PNG or JPG) and a video file (MP4). Then, use the key codes below to interact with the video and use your cursor to draw on the floor plan. As you interact with the video and simultaneously draw on the floor plan, positioning data is recorded as a CSV file organized by time in seconds and x/y pixel positions scaled to the pixel size of your floor plan image file. Use the top right button to save this file anytime and then record another movement path. For more information, see: https://www.benrydal.com/software/mondrian-transcription\n\nKEY CODES:  Play/Pause (p), Fast-Forward (f), Rewind (b), Reset (r)";
const COLORLIST = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
const PATHWEIGHT = 5; // Integer size of drawn paths
const CURPATHCOLOR = 0; // Color of currently recording path

//*************** VIDEO ***************
let movie; // P5.js media element to display/interact with HTML5 video from file uploaded by user
const videoJumpValue = 5; // Integer value in seconds to ff or rewind
let inputMovieWidth, inputMovieHeight; // Decimal pixel width/ height of inputted video file
let reScaledMovieWidth, reScaledMovieHeight; // Decimal scaled width/height of input video file to fit display container

/**
 * Required p5.js method, sets canvas, GUI and initial drawing requirements
 */
function setup() {
  canvas = createCanvas(window.innerWidth, window.innerHeight, P2D);
  core = new Core();
  keys = new Keys();
  handlers = new Handlers();
  dataUpdate = new UpdateData();
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
  if (core.recording) dataUpdate.setData(); // records data and updates visualization if in record mode
  // If info screen showing, redraw current screen first, then drawKeys
  if (core.showInfo) {
    dataUpdate.reDrawAllData();
    dataUpdate.updatePath.drawPath(core.curPath, CURPATHCOLOR);
    keys.drawIntroScreen();
  }
}

/**
 * Displays image or blank screen indicating movie is loaded
 */
function setLoadDataScreen() {
  keys.drawLoadDataGUI();
  if (core.floorPlanLoaded) keys.drawFloorPlanBackground();
  else if (core.movieLoaded) dataUpdate.updateMovie.drawCurFrame();
  if (core.showInfo) keys.drawIntroScreen();
}

function keyPressed() {
  handlers.handleKeyPressed();
}