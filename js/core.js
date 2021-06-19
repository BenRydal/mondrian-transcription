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
     dataIsLoaded(data) {
         return data != null; // in javascript this tests for both undefined and null values
     }

     /**
      * Create and write coordinates to output file
      * Increment curFileToOutput for next recording when finished and reset paths for next path recording
      */
     writeFile() {
         const FILEHEADERS = ["time", "x", "y"]; // Column headers for outputted .CSV movement files
         let table = new p5.Table();
         table.addColumn(FILEHEADERS[0]);
         table.addColumn(FILEHEADERS[1]);
         table.addColumn(FILEHEADERS[2]);
         for (let i = 0; i < core.curPath.xPos.length; i++) {
             let newRow = table.addRow();
             newRow.setNum(FILEHEADERS[0], core.curPath.tPos[i]);
             newRow.setNum(FILEHEADERS[1], core.curPath.xPos[i]);
             newRow.setNum(FILEHEADERS[2], core.curPath.yPos[i]);
         }
         mondrian.saveTable(table, "Path_" + core.curFileToOutput + ".csv");
         core.curFileToOutput++;
     }
 }