/*
CREDITS/LICENSE INFORMATION: This software is licensed under the GNU General Public License Version 2.0. 
See the GNU General Public License included with this software for more details. 
This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the 
implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. 
Mondrian Transcription Software originally developed by Ben Rydal Shapiro at Vanderbilt University as part of his 
dissertation titled Interaction Geography & the Learning Sciences. Copyright (C) 2018 Ben Rydal Shapiro, and contributers. 
To reference or read more about this work please see: https://etd.library.vanderbilt.edu/available/etd-03212018-140140/unrestricted/Shapiro_Dissertation.pdf
*/

// DATA
// Represents the object being recorded such as person or thing as lists of x/y pixel positions and time values
class Path {
  xPos = [];
  yPos = [];
  tPos = [];
}
let paths = []; // holds all path objects created
let curPath; // holds currently recorded path object
let dataUpdate; // global object that represents instance of UpdateData class to control synchronized method calls for path and movie methods
let curFileToOutput = 0; // current file number to write to output
const frameAndSampleWhenStoppedRate = 30; // controls both frameRate of program and amount data is sampled when cursor is not moving when recording data
const fileHeaders = ["time", "x", "y"]; // Column headers for outputted .CSV movement files

// FLOOR PLAN
let floorPlan; // floor plan display image file set to user uploaded image file
let inputFloorPlanWidth, inputFloorPlanHeight; // width/height of user uploaded image file

// VIDEO
let movie; // P5.js media element to display/interact with HTML5 video from file uploaded by user
let movieDuration; // Duration of video set in loadData
let recording = false; // controls synchronized path recording and video playing
let videoJumpValue = 5; // value in seconds to ff or rewind
let inputMovieWidth, inputMovieHeight; // pixel width and height of inputted video file to scale size dynamically in program
let reScaledMovieWidth, reScaledMovieHeight; // scaled movie width/height to display container from input video

// GUI
let font_PlayfairItalic, font_Lato;
let movieLoaded = false,
  floorPlanLoaded = false;
let displayFloorplanWidth, displayFloorplanHeight, displayVideoWidth, displayVideoHeight;
let displayFloorplanXpos, displayFloorplanYpos, displayVideoXpos, displayVideoYpos;
let floorPlanBackgroundCol = 225,
  videoBackgroundColor = 200;
let colorShades = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
let spacing = 50; // general spacing variable
let pathWeight = 5;
let curPathColor = 0; // color for path while drawing

// TITLE
let keyTextSize;
let infoMsg = "MONDRIAN TRANSCRIPTION SOFTWARE\n\nby Ben Rydal Shapiro & contributers\nbuilt with p5.js\n\nHi there! This tool allows you to transcribe fine-grained positioning data from video. To get started, use the top buttons to upload a floor plan image file (PNG or JPG) and a video file (MP4). Then, use the key codes below to interact with the video and use your cursor to draw on the floor plan. As you interact with the video and simultaneously draw on the floor plan, positioning data is recorded as a CSV file organized by time in seconds and x/y pixel positions scaled to the pixel size of your floor plan image file. Use the top right button to save this file anytime and then record another movement path. For more information, see: https://www.benrydal.com/software/mondriantranscription\n\nKEY CODES:\nPlay/Pause (p), Fast-Forward (f), Rewind (b), Reset (r)"
let showInfo = true;

/**
 * Required p5.js method, sets canvas, GUI and initial drawing requirements
 */
function setup() {
  canvas = createCanvas(window.innerWidth, window.innerHeight, P2D);
  font_PlayfairItalic = loadFont("data/fonts/PlayfairDisplay-Italic.ttf");
  font_Lato = loadFont("data/fonts/Lato-Light.ttf");
  frameRate(frameAndSampleWhenStoppedRate);
  setGUIWindows();
  curPath = new Path(); // set initial path and UpdateData 
  dataUpdate = new UpdateData();
}

/**
 * Required p5.js method, here it organizes two drawing modes for when data is and is not loaded
 */
function draw() {
  if (floorPlanLoaded && movieLoaded) setDrawingScreen();
  else setLoadDataScreen();
}

/**
 * Organizes methods for recording once all data is loaded
 */
function setDrawingScreen() {
  if (recording) dataUpdate.setData(); // records data and updates visualization if in record mode
  if (showInfo ) {
    // redraw current screen first, then drawKeys
    dataUpdate.reDrawAllData();
    dataUpdate.updatePath.drawPath(curPath, curPathColor);
    drawKeys();
  }
}

/**
 * Displays image or blank screen indicating movie is loaded
 */
function setLoadDataScreen() {
  drawGUIWindows();
  if (floorPlanLoaded) drawFloorPlanBackground();
  else if (movieLoaded) drawMovieBackground();
  if (showInfo) drawKeys();
}