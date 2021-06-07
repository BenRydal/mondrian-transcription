 class Core {

     constructor() {
         this.paths = []; // List to hold all path objects created
         this.curPath = new Path();
         this.curFileToOutput = 0; // Integer counter to mark current file number to write to output
         this.recording = false; // Boolean to indicate when recording
         this.floorPlan = undefined; // P5 image file that is created from user uploaded PNG/JPG image file
         this.inputFloorPlanWidth = undefined;
         this.inputFloorPlanHeight = undefined; // Decimal values of width/height of user uploaded image file
         // MODES
         this.movieLoaded = false;
         this.floorPlanLoaded = false; // Boolean variables to indicated when input data has been loaded
         this.showInfo = true; // Boolean to show/hide intro message
     }
 }

 /**
  * Factory function that creates a Path object
  * @param  {char} name // name of speaker
  * @param  {color} color // color of speaker
  * @param  {boolean} show // if speaker is showing in GUI
  */
 createPath(xPos, yPos, tPos) {
     return {
         xPos,
         yPos,
         tPos
     };
 }

 /**
  * Represents the object being recorded such as person or thing
  * Holds decimal/number lists of x/y pixel positions and time values in seconds/fractions of seconds 
  */
 class Path {
     xPos = [];
     yPos = [];
     tPos = [];
 }

 //  this.core.curPath = { // Holds data about current object being recorded
 //      xPos: [], // Number lists of x / y pixel positions and time values in seconds
 //      yPos: [],
 //      tPos: []
 //  };