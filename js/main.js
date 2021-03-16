// DATA
let paths = []; // holds all recorded path files
let curPath; // current path to record

// Path object has x/y position and time lists (each recorded file)
class Path {
  xPos = [];
  yPos = [];
  tPos = [];
}

let dataUpdate; // holds methods to update data recording and video
let reSetAllData = true;
let curFileToOutput = 0; // current file number to write to output
const fileHeaders = ["time", "x", "y"];

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
let curPathColor = 0;

// TITLE
let keyTextSize, infoTextSize;
let infoMsg = "MONDRIAN TRANSCRIPTION\nby Ben Rydal Shapiro & contributers\nbuilt with p5.js";
let descMSG = "Hi there! This is a beta version of Mondrian Transcription, a method to transcribe movement from video. To get started, use the top buttons to upload a floor plan image file and a video file. Then, use the key codes below to interact with the video and use your cursor to draw on the floor plan. As you interact with the video and simultaneously draw on the floor plan, movement is recorded as a .CSV file organized by time in seconds and x/y pixel positions scaled to the size of your floor plan image. You can save and download this .CSV anytime and then draw/record another movement path.\n\nPLAY/PAUSE (p)\nFAST-FORWARD (f)\nREWIND (b)\nRESET (r)\nSAVE MOVEMENT FILE (s)"

function setup() {
  canvas = createCanvas(window.innerWidth, window.innerHeight, P2D);
  frameRate(30);
  //pixelDensity(displayDensity());
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