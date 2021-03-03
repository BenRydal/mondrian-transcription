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
let font_PlayfairReg, font_PlayfairItalic, font_PlayfairBold, font_Lato;
let movieLoaded = false,
  floorPlanLoaded = false;
let displayFloorplanWidth, displayFloorplanHeight, displayVideoWidth, displayVideoHeight, displayKeysWidth, displayKeysHeight;

let colorShades = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
let spacing = 50; // general spacing variable
let pathWeight = 5;
let curPathColor = 0;

function setup() {
  canvas = createCanvas(window.innerWidth, window.innerHeight, P2D);
  setGUIWindows();
  curPath = new Path();
  dataUpdate = new UpdateData();
  loadFonts();
}

function draw() {
  if (floorPlanLoaded && movieLoaded) setDrawingScreen();
  else setLoadDataScreen();
}

function setLoadDataScreen() {
  drawGUIWindows();
  drawKeys();
}

function setDrawingScreen() {
  if (reSetAllData) dataUpdate.reDrawAllData(); // Runs once after data is initially loaded or file is written
  if (recording) dataUpdate.record(); // records data and updates visualization if in record mode
}