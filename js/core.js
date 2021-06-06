 class Core {

     constructor() {
         this.paths = []; // List to hold all path objects created
         this.curPath = new Path();
         this.curFileToOutput = 0; // Integer counter to mark current file number to write to output
         this.recording = false; // Boolean to indicate when recording
         this.floorPlan; // P5 image file that is created from user uploaded PNG/JPG image file
         this.inputFloorPlanWidth;
         this.inputFloorPlanHeight; // Decimal values of width/height of user uploaded image file
     }
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