 class Path {

     constructor() {
         this.paths = []; // List to hold all path objects created
         this.colorList = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
         this.pathWeight = 5; // Integer size of drawn paths
         this.curPath = this.createPath([], [], [], 0); // initialize with empty arrays and color black (0)
         this.curFileToOutput = 0; // Integer counter to mark current file number to write to output
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
      * Calculates correctly scaled x/y positions to actual image file of floor plan uploaded by user
      */
     addPoint(point) {
         this.curPath.xPos.push(point.xPos);
         this.curPath.yPos.push(point.yPos);
         this.curPath.tPos.push(point.time);
     }

     addPath() {
         this.paths.push(this.createPath(this.curPath.xPos, this.curPath.yPos, this.curPath.tPos, this.colorList[this.paths.length % this.colorList.length]));
     }

     /**
      * Add to points to global core.curPath arraylists for each second being fast forwarded
      */
     fastForward(amountInSeconds) {
         // IMPORTANT: get last values from cur lists first before loop
         const xPos = this.curPath.xPos[this.curPath.tPos.length - 1];
         const yPos = this.curPath.yPos[this.curPath.tPos.length - 1];
         const tPos = this.curPath.tPos[this.curPath.tPos.length - 1];
         // Add values for each second jumped by VideoJumpvalue, xPos and yPos are same but add i to tPos as time is increasing
         // Start at 1 to record tPos properly
         for (let i = 1; i <= amountInSeconds; i++) {
             this.curPath.xPos.push(xPos);
             this.curPath.yPos.push(yPos);
             this.curPath.tPos.push(+(tPos + i).toFixed(2));
         }
     }
     /**
      * Remove all points from core.curPath arraylists that are greater than time parameter
      * @param  {Float/Number} rewindToTime
      */
     rewind(rewindToTime) {
         // Start at end of x or y list (NOT t) and delete up to newEndTime
         for (let i = this.curPath.xPos.length - 1; i >= 0; i--) {
             if (this.curPath.tPos[i] > rewindToTime) {
                 this.curPath.tPos.pop();
                 this.curPath.xPos.pop();
                 this.curPath.yPos.pop();
             } else break;
         }
     }

     clearCurPath() {
         this.curPath.xPos = [];
         this.curPath.yPos = [];
         this.curPath.tPos = [];
     }

     clearAllPaths() {
         this.clearCurPath();
         this.paths = [];
     }
 }