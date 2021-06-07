 class Core {

     constructor() {
         this.paths = []; // List to hold all path objects created
         this.curPath = this.createPath([], [], []);
         this.curFileToOutput = 0; // Integer counter to mark current file number to write to output
         this.recording = false; // Boolean to indicate when recording
         this.movieLoaded = false;
         this.floorPlanLoaded = false; // Boolean variables to indicated when input data has been loaded
         this.showInfo = true; // Boolean to show/hide intro message
     }

     /**
      * Factory function that creates a Path object representing object being recorded such as a person or thing
      * Holds decimal / number lists of x / y pixel positions and time values in seconds / fractions of seconds
      * @param  {Array} xPos
      * @param  {Array} yPos
      * @param  {Array} tPos
      */
     createPath(xPos, yPos, tPos) {
         return {
             xPos,
             yPos,
             tPos
         };
     }
 }