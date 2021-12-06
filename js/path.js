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
             pColor, // path color
             weight // path strokeWeight
         };
     }

     /**
      * Point has Float/Number scaled x/y positions to floor plan image file and time position derived from video
      */
     createPoint(fpXPos, fpYPos, tPos) {
         return {
             fpXPos,
             fpYPos,
             tPos,
         };
     }

     addCurPathToList() {
         this.paths.push(this.createPath(this.curPath.pointArray, this.colorList[this.paths.length % this.colorList.length], 5));
     }
     /**
      * NOTE: Make sure to round all values
      */
     addPointToCurPath(fpXPos, fpYPos, time) {
         this.curPath.pointArray.push(this.createPoint(this.round(fpXPos), this.round(fpYPos), this.round(time)));
     }

     /**
      * Add 1 new data point to curPath lists for amountInSeconds fastForwarded
      * @param  {Integer/Number} amountInSeconds
      */
     fastForward(amountInSeconds) {
         const point = this.curPathEndPoint; // IMPORTANT: get last value before loop
         for (let i = 1; i <= amountInSeconds; i++) { // only tPos is different with each added point
             this.curPath.pointArray.push(this.createPoint(point.fpXPos, point.fpYPos, this.round(point.tPos + i)));
         }
     }

     /**
      * Remove all points from curPath Lists greater than rewindToTime parameter
      * @param  {Float/Number} rewindToTime
      */
     rewind(rewindToTime) {
         // IMPORTANT: Start at end of x or y list (NOT t) and delete up to newEndTime
         for (let i = this.curPath.pointArray.length - 1; i >= 0; i--) {
             if (this.curPath.pointArray[i].tPos >= rewindToTime) {
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

     /**
      * Used to round numbers when saving data and also to compare path/video time to sample data
      * @param  {Number/Float} value
      */
     round(value) {
         return +(value.toFixed(2));
     }

     get curPathEndPoint() {
         if (this.curPath.pointArray.length > 0) return this.curPath.pointArray[this.curPath.pointArray.length - 1];
         else return 0;
     }
 }