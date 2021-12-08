 class Path {

     constructor(sketch) {
         this.sk = sketch;
         this.pathsArray = []; // holds user recorded path objects
         this.curPath = this.createPath([], 0, 7); // initialize Path with empty point array, color black (0), path strokeWeight
         this.colorList = ['#6a3d9a', '#ff7f00', '#33a02c', '#1f78b4', '#e31a1c', '#ffff99', '#b15928', '#cab2d6', '#fdbf6f', '#b2df8a', '#a6cee3', '#fb9a99'];
     }

     /**
      * Draws circle for last index in current path being recorded
      */
     drawCurPathEndPoint(floorPlanContainer, floorPlanImg) {
         const point = this.curPathEndPoint;
         this.sk.noStroke();
         this.sk.fill(255, 0, 0);
         const x1 = point.fpXPos * (floorPlanContainer.width / floorPlanImg.width);
         const y1 = point.fpYPos * (floorPlanContainer.height / floorPlanImg.height);
         this.sk.circle(x1 + floorPlanContainer.xPos, y1 + floorPlanContainer.yPos, 25);
     }

     // TODO: rename
     drawLineSegment(floorPlanContainer) {
         // Constrain mouse to floor plan display
         const xPos = this.sk.constrain(this.sk.mouseX, floorPlanContainer.xPos, floorPlanContainer.xPos + floorPlanContainer.width);
         const yPos = this.sk.constrain(this.sk.mouseY, floorPlanContainer.yPos, floorPlanContainer.yPos + floorPlanContainer.height);
         const pXPos = this.sk.constrain(this.sk.pmouseX, floorPlanContainer.xPos, floorPlanContainer.xPos + floorPlanContainer.width);
         const pYPos = this.sk.constrain(this.sk.pmouseY, floorPlanContainer.yPos, floorPlanContainer.yPos + floorPlanContainer.height);
         this.sk.strokeWeight(this.curPath.weight);
         this.sk.stroke(this.curPath.pColor);
         this.sk.line(xPos, yPos, pXPos, pYPos);
     }

     // TODO: refactor these two methods
     drawAllPaths(floorPlanContainer, floorPlanImg) {
         for (const path of this.pathsArray) this.drawPath(path, floorPlanContainer, floorPlanImg); // update all recorded pathsArray
         this.drawPath(this.curPath, floorPlanContainer, floorPlanImg); // update current path last
     }

     drawPath(path, floorPlanContainer, floorPlanImg) {
         this.sk.stroke(path.pColor);
         this.sk.strokeWeight(path.weight);
         for (let i = 1; i < path.pointArray.length; i++) {
             const x1 = path.pointArray[i].fpXPos * (floorPlanContainer.width / floorPlanImg.width);
             const x2 = path.pointArray[i - 1].fpXPos * (floorPlanContainer.width / floorPlanImg.width);
             const y1 = path.pointArray[i].fpYPos * (floorPlanContainer.height / floorPlanImg.height);
             const y2 = path.pointArray[i - 1].fpYPos * (floorPlanContainer.height / floorPlanImg.height);
             this.sk.line(x1 + floorPlanContainer.xPos, y1 + floorPlanContainer.yPos, x2 + floorPlanContainer.xPos, y2 + floorPlanContainer.yPos);
         }
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
         this.pathsArray.push(this.createPath(this.curPath.pointArray, this.colorList[this.pathsArray.length % this.colorList.length], 5));
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
         this.pathsArray = [];
     }

     /**
      * Used to round numbers when saving data and also to compare path/video time to sample data
      * @param  {Number/Float} value
      */
     round(value) {
         return +(value.toFixed(2));
     }

     // RETITLE getter TODO:
     get curPathEndPoint() {
         if (this.curPath.pointArray.length > 0) return this.curPath.pointArray[this.curPath.pointArray.length - 1];
         else return 0;
     }
 }