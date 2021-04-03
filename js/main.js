/*
CREDITS/LICENSE INFORMATION: This software is licensed under the GNU General Public License Version 2.0. See the GNU General Public License included with this software for more details. This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. Mondrian Transcription Software originally developed by Ben Rydal Shapiro at Vanderbilt University as part of his dissertation titled Interaction Geography & the Learning Sciences. Copyright (C) 2018 Ben Rydal Shapiro, and contributers. To reference or read more about this work please see: https://etd.library.vanderbilt.edu/available/etd-03212018-140140/unrestricted/Shapiro_Dissertation.pdf
*/

// COLUMN HEADERS FOR FILES
const fileHeaders = ["time", "x", "y"];

// DATA
let paths = []; // holds all recorded path files
let curPath; // current path to record
let dataUpdate; // object that holds methods to update data recording and video
let reSetAllData = true; // controls redrawing of data
let curFileToOutput = 0; // current file number to write to output
// Path is conceptually a person's movement race and has x/y position and time lists 
class Path {
  xPos = [];
  yPos = [];
  tPos = [];
}

// FLOOR PLAN
let floorPlan; // floor plan image file
let inputFloorPlanWidth, inputFloorPlanHeight; // real pixel width and height of floorPlan image file

// VIDEO
let movie; // video file
let movieDuration; // video duration set in loadData from video data
let recording = false; // controls path recording and video playing (always synchronized)
let videoJumpValue = 5; // value in seconds to ff or rewind

// GUI
let font_PlayfairItalic, font_Lato;
let movieLoaded = false,
  floorPlanLoaded = false;
let displayFloorplanWidth, displayFloorplanHeight, displayVideoWidth, displayVideoHeight, displayKeysWidth, displayKeysHeight;
let displayFloorplanXpos, displayFloorplanYpos, displayVideoXpos, displayVideoYpos, displayKeysXpos, displayKeysYpos;
let floorPlanBackgroundCol = 225,
  videoBackgroundColor = 125,
  keysBackgroundColor = 255;
let colorShades = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
let spacing = 50; // general spacing variable
let pathWeight = 5;
let curPathColor = 0; // color for path while drawing

// TITLE
let keyTextSize, infoTextSize;
let infoMsg = "MONDRIAN TRANSCRIPTION\nby Ben Rydal Shapiro & contributers\nbuilt with p5.js";
let descMSG = "Hi there! This tool allows you to transcribe fine-grained positioning data from video files. To get started, use the top buttons to upload a floor plan .png or.jpg image file and a video file (e.g., .mp4). Then, use the key codes below to interact with the video and use your cursor to draw on the floor plan. As you interact with the video and simultaneously draw on the floor plan, positioning data is recorded as a .CSV file organized by time in seconds and x/y pixel positions scaled to the pixel size of your floor plan image file. You can save this .CSV anytime and then draw/record another movement path.\n\nKEY CODES:\nPlay/Pause (p), Fast-Forward (f), Rewind (b), Reset (r), Save File (s)"

function setup() {
  canvas = createCanvas(window.innerWidth, window.innerHeight, P2D);
  frameRate(30);
  setGUIWindows();
  curPath = new Path();
  dataUpdate = new UpdateData();
  loadFonts();
}

function draw() {
  if (floorPlanLoaded && movieLoaded) setDrawingScreen();
  else if (floorPlanLoaded) image(floorPlan, displayFloorplanXpos, displayFloorplanYpos, displayFloorplanWidth, displayFloorplanHeight);
  else if (movieLoaded) {
    fill(0); // draw black screen if movie is loaded in video display
    rect(displayVideoXpos, displayVideoYpos, displayVideoWidth, displayVideoHeight);
  } else setLoadDataScreen();
}

function setLoadDataScreen() {
  drawGUIWindows();
  drawKeys();
}

function setDrawingScreen() {
  if (reSetAllData) dataUpdate.reDrawAllData(); // Runs once after data is initially loaded or file is written
  if (recording) dataUpdate.prepareRecording(); // records data and updates visualization if in record mode
}