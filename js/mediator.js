class Mediator {

    constructor(sketch, path, videoPlayer, floorPlan) {
        this.sketch = sketch;
        this.path = path;
        this.videoPlayer = videoPlayer;
        this.floorPlan = floorPlan;
    }

    /**
     * Updates video frame and line segment for drawing paths in interface
     * Decides whether to record data point based on sampling rate method
     */
    updateRecording() {
        this.updateVideoFrame();
        this.sketch.drawLineSegment(this.path.pathWeight, this.path.curPath.pColor); // Apparently, this should not be called within testSampleRate block
        if (this.testSampleRate()) this.path.addPoint(this.getPointDataFromDisplay());
    }
    /**
     * Method to sample data in 2 ways
     * (1) if mouse moves sample at rate of 2 decimal points
     * (2) if stopped sample at rate of 0 decimal points, approximately every 1 second in movie
     */
    testSampleRate() {
        if (this.path.curPath.tPos.length === 0) return true;
        else if (this.sketch.mouseX !== this.sketch.pmouseX || this.sketch.mouseY !== this.sketch.pmouseY) return +(this.path.curPath.tPos[this.path.curPath.tPos.length - 1].toFixed(2)) < +(this.videoPlayer.movieDiv.time().toFixed(2));
        else return +(this.path.curPath.tPos[this.path.curPath.tPos.length - 1].toFixed(0)) < +(this.videoPlayer.movieDiv.time().toFixed(0));
    }

    /**
     * Calculates correctly scaled x/y positions to actual image file of floor plan uploaded by user
     */
    getPointDataFromDisplay() {
        // Constrain mouse to floor plan display and subtract floorPlan display x/y positions to set data to 0, 0 origin/coordinate system
        const x = (this.sketch.constrain(this.sketch.mouseX, this.sketch.displayFloorplanXpos, this.sketch.displayFloorplanXpos + this.sketch.displayFloorplanWidth)) - this.sketch.displayFloorplanXpos;
        const y = (this.sketch.constrain(this.sketch.mouseY, this.sketch.displayFloorplanYpos, this.sketch.displayFloorplanYpos + this.sketch.displayFloorplanHeight)) - this.sketch.displayFloorplanYpos;
        // Scale x,y positions to input floor plan width/height
        const xPos = +(x * (this.floorPlan.width / this.sketch.displayFloorplanWidth)).toFixed(2);
        const yPos = +(y * (this.floorPlan.height / this.sketch.displayFloorplanHeight)).toFixed(2);
        const time = +this.videoPlayer.movieDiv.time().toFixed(2);
        return {
            xPos,
            yPos,
            time
        }
    }

    convertXposToDisplay(xPos) {
        return this.sketch.displayFloorplanXpos + (xPos / (this.floorPlan.width / this.sketch.displayFloorplanWidth));
    }

    convertYposToDisplay(yPos) {
        return this.sketch.displayFloorplanYpos + (yPos / (this.floorPlan.height / this.sketch.displayFloorplanHeight));
    }

    updateAllData() {
        this.updateFloorPlan();
        this.updateVideoFrame();
        this.sketch.drawAllPaths(this.path.paths, this.path.curPath);
    }

    updateFloorPlan() {
        this.sketch.drawFloorPlan(this.floorPlan);
    }

    updateVideoFrame() {
        this.sketch.drawVideoFrame(this.videoPlayer);
    }

    createVideoOnLoad(fileLocation) {
        if (this.videoLoaded()) this.videoPlayer.destroy(); // if a video exists, destroy it
        this.videoPlayer = new VideoPlayer(fileLocation, this.sketch); // create new videoPlayer
    }

    newVideoLoaded() {
        this.path.clearAllPaths();
        this.stopRecording(); // necessary to be able to draw starting frame before playing the video
        this.updateVideoFrame(); // after video loaded, draw first frame to display it
        if (this.floorPlanLoaded()) this.updateFloorPlan();
    }

    newFloorPlanLoaded(img) {
        this.floorPlan = img;
        this.path.clearAllPaths();
        this.updateFloorPlan();
        if (this.videoLoaded()) {
            this.stopRecording();
            this.updateVideoFrame();
        }
    }

    /**
     * Reset recording for current path by redrawing data, clearing current path, stopping movie
     */
    resetCurRecording() {
        this.stopRecording();
        this.path.clearCurPath();
        this.updateAllData();
    }

    /**
     * Organizes methods to update data and reset screen after file has been written
     * Sets recording to false
     */
    resetAfterWriteFile() {
        this.path.curFileToOutput++;
        this.path.addPath();
        this.path.clearCurPath();
        this.stopRecording();
        this.updateAllData();
    }

    /**
     * Organize rewind video and remove data from core.curPath equivalent to videoPlayer.videoJumpValue, rewDraw all data and core.curPath
     */
    rewind() {
        // Record point before rewinding to make sure curEndTime is correct in case points were not recording if mouse was not moving
        //this.updateView.drawLineSegment();
        //this.updatePath.addPoint();
        // Set time to rewind to base on last time value in list - videoPlayer.videoJumpValue
        const rewindToTime = this.path.curPath.tPos[this.path.curPath.tPos.length - 1] - this.videoPlayer.videoJumpValue;
        this.path.rewind(rewindToTime);
        this.videoPlayer.rewind(rewindToTime);
        if (this.sketch.recording) this.playPauseRecording(); // pause recording and video if currently recording
        this.updateAllData();
    }

    /**
     * Organize fast forwarding movie and path data, if movie not right at start or near end
     */
    fastForward() {
        if (this.videoPlayer.movieDiv.time() > 0 && (this.videoPlayer.movieDiv.time() < this.videoPlayer.movieDiv.duration() - this.videoPlayer.videoJumpValue)) {
            this.videoPlayer.fastForward();
            this.path.fastForward(this.videoPlayer.videoJumpValue);
        }
    }

    stopRecording() {
        this.videoPlayer.stop();
        this.sketch.recording = false;
    }

    playPauseRecording() {
        if (this.sketch.recording) {
            this.videoPlayer.pause();
            this.sketch.recording = false;
        } else {
            this.videoPlayer.play();
            this.sketch.recording = true;
        }
    }

    /**
     * Returns false if parameter is undefined or null
     * @param  {Any Type} data
     */
    dataIsLoaded(data) {
        return data != null; // in javascript this tests for both undefined and null values
    }

    floorPlanLoaded() {
        return this.dataIsLoaded(this.floorPlan);
    }

    videoLoaded() {
        return this.dataIsLoaded(this.videoPlayer);
    }

    allDataLoaded() {
        return (this.dataIsLoaded(this.floorPlan) && this.dataIsLoaded(this.videoPlayer));
    }

    /**
     * Create and write coordinates to output file
     * Increment curFileToOutput for next recording when finished and reset paths for next path recording
     */
    writeFile() {
        if (this.floorPlanLoaded() && this.videoLoaded() && this.path.curPath.xPos.length > 0) {
            const FILEHEADERS = ["time", "x", "y"]; // Column headers for outputted .CSV movement files
            let table = new p5.Table();
            table.addColumn(FILEHEADERS[0]);
            table.addColumn(FILEHEADERS[1]);
            table.addColumn(FILEHEADERS[2]);
            for (let i = 0; i < this.path.curPath.xPos.length; i++) {
                let newRow = table.addRow();
                newRow.setNum(FILEHEADERS[0], this.path.curPath.tPos[i]);
                newRow.setNum(FILEHEADERS[1], this.path.curPath.xPos[i]);
                newRow.setNum(FILEHEADERS[2], this.path.curPath.yPos[i]);
            }
            this.sketch.saveTable(table, "Path_" + this.path.curFileToOutput + ".csv");
            this.resetAfterWriteFile();
        }
    }
}