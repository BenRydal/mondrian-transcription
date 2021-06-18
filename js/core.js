 class Core {

     constructor() {
         this.paths = []; // List to hold all path objects created
         this.colorList = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
         this.pathWeight = 5; // Integer size of drawn paths
         this.curPath = this.createPath([], [], [], 0); // initialize with empty arrays and color black (0)
         this.curFileToOutput = 0; // Integer counter to mark current file number to write to output
         this.recording = false; // Boolean to indicate when recording
         this.showInfo = true; // Boolean to show/hide intro message
     }

     /**
      * Factory function that creates a Path object representing object being recorded such as a person or thing
      * Holds decimal / number lists of x / y pixel positions and time values in seconds / fractions of seconds
      * @param  {Array} xPos
      * @param  {Array} yPos
      * @param  {Array} tPos
      */
     createPath(xPos, yPos, tPos, pColor) {
         return {
             xPos,
             yPos,
             tPos,
             pColor
         };
     }
     /**
      * Returns false if parameter is undefined or null
      * @param  {Any Type} data
      */
     dataIsLoaded = function (data) {
         return data != null; // in javascript this tests for both undefined and null values
     }
 }