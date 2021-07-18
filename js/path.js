 class Path {

     constructor() {
         this.paths = []; // List to hold all path objects created
         this.colorList = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
         this.curPath = this.createPath([], 0, 7); // initialize Path with empty point array, color black (0), path strokeWeight
         this.curFileToOutput = 0; // Integer counter to mark current file number to write to output
     }

     /**
      * Path object represents object being recorded such as a person or artifact
      */
     createPath(pointArray, pColor, weight) {
         return {
             pointArray, // array of point objects
             pColor, // color of path
             weight // strokeweight of path
         };
     }

     /**
      * Point has Float/Number xPos, yPos and tPos
      */
     createPoint(xPos, yPos, tPos) {
         return {
             xPos,
             yPos,
             tPos,
         };
     }

     addPath() {
         this.paths.push(this.createPath(this.curPath.pointArray, this.colorList[this.paths.length % this.colorList.length], 5));
     }

     addPoint(xPos, yPos, time) {
         this.curPath.pointArray.push(this.createPoint(xPos, yPos, time));
     }

     /**
      * Add 1 new data point to curPath lists for amountInSeconds fastForwarded
      * @param  {Integer/Number} amountInSeconds
      */
     fastForward(amountInSeconds) {
         // IMPORTANT: get last values from cur lists first before loop. Uses to set x/yPos and increment tPos
         const point = this.curPath.pointArray[this.curPath.pointArray.length - 1];
         // Add points for amountInSeconds starting at 1 (tPos is only number that changes/increments)
         for (let i = 1; i <= amountInSeconds; i++) {
             this.curPath.pointArray.push(this.createPoint(point.xPos, point.yPos, +(point.tPos + i).toFixed(2)));
         }
     }
     /**
      * Remove all points from curPath Lists greater than rewindToTime parameter
      * @param  {Float/Number} rewindToTime
      */
     rewind(rewindToTime) {
         // IMPORTANT: Start at end of x or y list (NOT t) and delete up to newEndTime
         for (let i = this.curPath.pointArray.length - 1; i >= 0; i--) {
             if (this.curPath.pointArray[i].tPos > rewindToTime) {
                 this.curPath.pointArray.pop();
             } else break;
         }
     }

     clearCurPath() {
         this.curPath.pointArray = [];
     }

     clearAllPaths() {
         this.clearCurPath();
         this.paths = [];
     }

     writeTable() {
         const FILEHEADERS = ["time", "x", "y"]; // Column headers for outputted .CSV movement files
         let table = new p5.Table();
         table.addColumn(FILEHEADERS[0]);
         table.addColumn(FILEHEADERS[1]);
         table.addColumn(FILEHEADERS[2]);
         for (const point of this.curPath.pointArray) {
             let newRow = table.addRow();
             newRow.setNum(FILEHEADERS[0], point.tPos);
             newRow.setNum(FILEHEADERS[1], point.xPos);
             newRow.setNum(FILEHEADERS[2], point.yPos);
         }
         return table;
     }

     get curPathEndPoint() {
         if (this.curPath.pointArray.length > 0) return this.curPath.pointArray[this.curPath.pointArray.length - 1];
         else return 0;
     }
 }