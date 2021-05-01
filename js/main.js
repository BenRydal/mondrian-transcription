/*
CREDITS/LICENSE INFORMATION: This software is licensed under the GNU General Public License Version 2.0. 
See the GNU General Public License included with this software for more details. 
This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the 
implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. 
Mondrian Transcription Software originally developed by Ben Rydal Shapiro at Vanderbilt University as part of his 
dissertation titled Interaction Geography & the Learning Sciences. Copyright (C) 2018 Ben Rydal Shapiro, and contributors. 
To reference or read more about this work please see: https://etd.library.vanderbilt.edu/available/etd-03212018-140140/unrestricted/Shapiro_Dissertation.pdf
*/

//*************** RECORDING VARS ***************
let paths = []; // List to hold all path objects created
let curPath; // Path to hold data from current recording
let dataUpdate; // Instance of UpdateData class to control synchronized method calls for path recording and movie
let curFileToOutput = 0; // Integer counter to mark current file number to write to output
let recording = false; // Boolean to indicate when recording
const fileHeaders = ["time", "x", "y"]; // Column headers for outputted .CSV movement files
/**
 * Represents the object being recorded such as person or thing
 * Holds decimal/number lists of x/y pixel positions and time values in seconds/fractions of seconds 
 */
class Path {
  xPos = [];
  yPos = [];
  tPos = [];
}

//*************** FLOOR PLAN ***************
let floorPlan; // P5.js image file that is created from user uploaded PNG/JPG image file
let inputFloorPlanWidth, inputFloorPlanHeight; // Decimal values of width/height of user uploaded image file

//*************** VIDEO ***************
let movie; // P5.js media element to display/interact with HTML5 video from file uploaded by user
const videoJumpValue = 5; // Integer value in seconds to ff or rewind
let inputMovieWidth, inputMovieHeight; // Decimal pixel width/ height of inputted video file
let reScaledMovieWidth, reScaledMovieHeight; // Decimal scaled width/height of input video file to fit display container

//*************** GUI ***************
let font_Lato; // Included font file, see data/fonts 
let movieLoaded = false,
  floorPlanLoaded = false; // Boolean variables to indicated when input data has been loaded
let displayFloorplanWidth, displayFloorplanHeight, displayVideoWidth, displayVideoHeight; // Decimal values that represent floor plan and video containers
let displayFloorplanXpos, displayFloorplanYpos, displayVideoXpos, displayVideoYpos; // Decimal values that represent x/y positions of floor plan and video containers
const colorShades = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
const spacing = 50; // Integer spacing variable
const pathWeight = 5; // Integer size of drawn paths
const curPathColor = 0; // Color of currently recording path
let keyTextSize; // Number indicating size of text, set in setGuiWindows
let showInfo = true; // Boolean to show/hide intro message
// String intro message text
const infoMsg = "MONDRIAN TRANSCRIPTION SOFTWARE\n\nby Ben Rydal Shapiro & contributors\nbuilt with p5.js & JavaScript\n\nHi there! This tool allows you to transcribe fine-grained positioning data from video. To get started, use the top buttons to upload a floor plan image file (PNG or JPG) and a video file (MP4). Then, use the key codes below to interact with the video and use your cursor to draw on the floor plan. As you interact with the video and simultaneously draw on the floor plan, positioning data is recorded as a CSV file organized by time in seconds and x/y pixel positions scaled to the pixel size of your floor plan image file. Use the top right button to save this file anytime and then record another movement path. For more information, see: https://www.benrydal.com/software/mondriantranscription\n\nKEY CODES:  Play/Pause (p), Fast-Forward (f), Rewind (b), Reset (r)";

/**
 * Required p5.js method, sets canvas, GUI and initial drawing requirements
 */
function setup() {
  canvas = createCanvas(window.innerWidth, window.innerHeight, P2D);
  font_Lato = loadFont("data/fonts/Lato-Light.ttf");
  setGUIWindows();
  curPath = new Path(); // set initial path and UpdateData 
  dataUpdate = new UpdateData();
}

/**
 * Required p5.js looping method, here it organizes two drawing modes for when data is and is not loaded
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
  // If info screen showing, redraw current screen first, then drawKeys
  if (showInfo) {
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
  else if (movieLoaded) dataUpdate.updateMovie.drawCurFrame();
  if (showInfo) drawKeys();
}