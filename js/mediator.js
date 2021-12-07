/**
 * Mediator class coordinates calls to 4 other classes including P5 sk
 */
class Mediator {

    constructor(sketch) {
        this.sk = sketch;
        this.path = new Path();
        this.videoPlayer = null; // holds videoPlayer object instantiated/updated in loadVideo method
        this.floorPlan = null;
        this.isRecording = false; // indicates recording mode
        this.jumpInSeconds = 5; // seconds value to fast forward and rewind path/video data
    }

    // TODO: need to add conditionals for no video loaded yet AND updatealldata/path data
    updateForResize(videoContainer) {
        if (this.videoLoaded()) this.videoPlayer.setScaledValues(videoContainer);
        if (this.allDataLoaded()) this.updateAllData();
        if (this.arrayIsLoaded(this.path.curPath.pointArray)) this.sk.drawCurPathEndPoint(this.path.curPathEndPoint);
    }

    handleKeyPressed(keyValue) {
        if (this.allDataLoaded()) {
            if (keyValue === 'r' || keyValue === 'R') this.rewind();
            else if (keyValue === 'f' || keyValue === 'F') this.fastForward();
        }
    }

    handleMousePressed() {
        if (this.allDataLoaded()) {
            this.playPauseRecording();
        }
    }

    /**
     * Handles program flow/method calls based on what data has been loaded
     */
    updateDrawLoop() {
        if (this.allDataLoaded()) {
            this.sk.drawVideoFrame(this.videoPlayer, this.videoPlayer.curTime);
            if (this.isRecording) this.updateTranscription();
        } else {
            if (this.floorPlanLoaded()) this.sk.drawFloorPlan(this.floorPlan.img);
            else if (this.videoLoaded()) this.sk.drawVideoFrame(this.videoPlayer, this.videoPlayer.curTime);
        }
        this.sk.drawCenterLine();
    }

    /**
     * Coordinates video and line segment drawing in display. Decides whether to record data point based on sampling rate method
     */
    updateTranscription() {
        this.sk.drawLineSegment(this.path.curPath); // Don't call this within testSampleRate block
        if (this.sampleData()) this.updateCurPath();
    }

    /**
     * Method to sample data in 2 ways
     * (1) if mouse moves compare based on rounding decimal value for paths
     * (2) if stopped compare based on Math.round method, approximately every 1 second in movie
     */
    sampleData() {
        if (this.path.curPath.pointArray.length === 0) return true; // always return true if first data point
        else if (this.sk.mouseX !== this.sk.pmouseX || this.sk.mouseY !== this.sk.pmouseY) return this.path.round(this.path.curPathEndPoint.tPos) < this.path.round(this.videoPlayer.curTime);
        else return Math.round(this.path.curPathEndPoint.tPos) < Math.round(this.videoPlayer.curTime);
    }

    /**
     * Add correctly scaled positioning data to current path
     */
    updateCurPath() {
        const [fpXPos, fpYPos] = this.sk.getPositioningData(this.floorPlan.img);
        const time = this.videoPlayer.curTime;
        this.path.addPointToCurPath(fpXPos, fpYPos, time);
    }

    updateAllData() {
        this.sk.drawFloorPlan(this.floorPlan.img);
        this.sk.drawVideoFrame(this.videoPlayer, this.videoPlayer.curTime);
        for (const path of this.path.paths) this.sk.drawPath(path); // update all recorded paths
        this.sk.drawPath(this.path.curPath); // update current path last
    }

    resetCurRecording() {
        if (this.allDataLoaded()) {
            this.stopRecording();
            this.path.clearCurPath();
            this.updateAllData();
        }
    }

    playPauseRecording() {
        if (this.isRecording) {
            this.videoPlayer.pause();
            this.isRecording = false;
            if (this.arrayIsLoaded(this.path.curPath.pointArray)) this.sk.drawCurPathEndPoint(this.path.curPathEndPoint);
        } else if (this.videoPlayer.notEnded(0)) {
            this.updateAllData(); // update all data to erase curPathBug
            this.videoPlayer.play();
            this.isRecording = true;
        }
    }

    stopRecording() {
        this.videoPlayer.stop();
        this.isRecording = false;
    }

    /**
     * Coordinates rewinding of video, erasing of curPath data and updating display
     */
    rewind() {
        if (this.videoPlayer.notBeginning(this.jumpInSeconds)) {
            const rewindToTime = this.path.curPathEndPoint.tPos - this.jumpInSeconds; // set time to rewind to based on last value in list
            this.path.rewind(rewindToTime);
            this.videoPlayer.rewind(rewindToTime);
        } else {
            this.path.rewind(0);
            this.videoPlayer.rewind(0);
        }
        if (this.isRecording) this.playPauseRecording(); // pause recording and video if currently recording
        this.updateAllData();
        if (this.arrayIsLoaded(this.path.curPath.pointArray)) this.sk.drawCurPathEndPoint(this.path.curPathEndPoint);
    }

    /**
     * Coordinates fast forwarding of movie and path data, if movie not right at start or near end
     */
    fastForward() {
        if (this.videoPlayer.notEnded(this.jumpInSeconds)) {
            this.videoPlayer.fastForward(this.jumpInSeconds);
            this.path.fastForward(this.jumpInSeconds);
        }
    }

    loadFloorPlan(fileLocation) {
        if (this.floorPlanLoaded) this.floorPlan = null;
        this.floorPlan = new FloorPlan(this.sk, fileLocation);
    }

    loadVideo(fileLocation) {
        if (this.videoLoaded()) {
            this.videoPlayer.destroy(); // if a video exists, destroy it
            this.videoPlayer = null;
        }
        this.videoPlayer = new VideoPlayer(fileLocation, this.sk);
    }

    /**
     * Called from VideoPlayer Class, updates all data/views after video is loaded
     */
    newVideoLoaded() {
        console.log("New Video Loaded");
        this.stopRecording(); // necessary to be able to draw starting frame before playing the video
        this.path.clearAllPaths();
        if (this.floorPlanLoaded()) this.sk.drawFloorPlan(this.floorPlan.img); // clear floor plan drawing area
    }

    newFloorPlanLoaded() {
        this.path.clearAllPaths();
        this.sk.drawFloorPlan(this.floorPlan.img);
        if (this.videoLoaded()) this.stopRecording();
    }

    writeFile() {
        if (this.allDataLoaded() && this.path.curPath.pointArray.length > 0) {
            this.sk.saveTable(this.writeTable(this.path.curPath.pointArray), "Path_" + this.path.curFileToOutput, "csv");
            this.path.curFileToOutput++;
            this.path.addCurPathToList();
            this.path.clearCurPath();
            this.stopRecording();
            this.updateAllData();
        }
    }

    writeTable = function (pointArray) {
        const headers = ["time", "x", "y"]; // Column headers for outputted .CSV movement files
        let table = new p5.Table();
        table.addColumn(headers[0]);
        table.addColumn(headers[1]);
        table.addColumn(headers[2]);
        for (const point of pointArray) {
            let newRow = table.addRow();
            newRow.setNum(headers[0], point.tPos);
            newRow.setNum(headers[1], point.fpXPos);
            newRow.setNum(headers[2], point.fpYPos);
        }
        return table;
    }

    /**
     * @param  {Any Type} data
     */
    dataIsLoaded(data) {
        return data != null; // in javascript this tests for both undefined and null values
    }

    floorPlanLoaded() {
        return this.dataIsLoaded(this.floorPlan);
    }

    videoLoaded() {
        return this.dataIsLoaded(this.videoPlayer) && this.dataIsLoaded(this.videoPlayer.movieDiv);
    }

    allDataLoaded() {
        return this.floorPlanLoaded() && this.videoLoaded();
    }

    /**
     * @param  {Any Type} data
     */
    arrayIsLoaded = function (data) {
        return Array.isArray(data) && data.length;
    }
}