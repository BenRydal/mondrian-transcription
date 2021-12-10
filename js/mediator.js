/**
 * Mediator class coordinates calls from and across 4 other classes and P5 sketch
 */
class Mediator {

    constructor(sketch) {
        this.sk = sketch;
        this.path = new Path(sketch); // holds methods for drawing and recording path objects/data
        this.gui = new GUI(sketch); // holds interface containers and associated mouse over tests
        this.videoPlayer = null; // instance of videoPlayer Class instantiated/updated in loadVideo method
        this.videoIsLoaded = false; // additional boolean used to test if videoLoaded
        this.floorPlan = null; // instance of FloorPlan Class instantiated/updated in loadFloorPlan method
        this.isRecording = false; // indicates recording mode
        this.jumpInSeconds = 5; // seconds value to fast forward and rewind path/video data
        this.isSelectResize = false; // indicates if user is resizing screen using mouse
    }

    /**
     * Handles program flow/method calls based on what data has been loaded
     */
    updateProgram() {
        this.updateCursor();
        if (this.allDataLoaded()) {
            this.videoPlayer.draw(this.gui.getVideoContainer());
            if (this.isRecording) this.updateTranscription();
        } else {
            this.gui.drawWhiteBackground(); // to display centerline properly
            if (this.floorPlanLoaded()) this.floorPlan.drawFloorPlan(this.gui.getFloorPlanContainer());
            else if (this.videoLoaded()) this.videoPlayer.draw(this.gui.getVideoContainer());
        }
        this.gui.drawCenterLine();
    }

    updateCursor() {
        if (this.cursorTest()) this.sk.cursor(this.sk.MOVE);
        else this.sk.cursor(this.sk.ARROW);
    }

    /**
     * Coordinates video and line segment drawing in display. Decides whether to record data point based on sampling rate method
     * NOTE: Always drawing mousePosLine creates smoother user experience when recording/drawing even when not recording actual data points
     */
    updateTranscription() {
        this.path.drawMousePosLine(this.gui.getFloorPlanContainer()); // Don't call this within testSampleRate block
        if (this.sampleData()) this.recordPoint();
    }

    /**
     * Method to sample data in 2 ways
     * (1) if mouse moves compare based on rounding to fixed decimal value for paths
     * (2) if stopped compare based on Math.round method, approximately every 1 second in movie
     */
    sampleData() {
        if (this.path.curPath.pointArray.length === 0) return true; // always return true if first data point
        else if (this.sk.mouseX !== this.sk.pmouseX || this.sk.mouseY !== this.sk.pmouseY) return this.path.round(this.path.getCurEndPoint().tPos) < this.path.round(this.videoPlayer.getCurTime());
        else return Math.round(this.path.getCurEndPoint().tPos) < Math.round(this.videoPlayer.getCurTime());
    }

    /**
     * Add correctly scaled positioning data for point to current path
     */
    recordPoint() {
        const [fpXPos, fpYPos] = this.floorPlan.getPositioningData(this.gui.getFloorPlanContainer());
        this.path.addPointToCurPath(fpXPos, fpYPos, this.videoPlayer.getCurTime());
    }

    drawAllData() {
        this.floorPlan.drawFloorPlan(this.gui.getFloorPlanContainer());
        this.videoPlayer.draw(this.gui.getVideoContainer());
        this.path.drawAllPaths(this.gui.getFloorPlanContainer(), this.floorPlan.getImg());
    }

    resetRecording() {
        if (this.allDataLoaded()) {
            this.stopRecording();
            this.path.clearCurPath();
            this.drawAllData();
        }
    }

    playPauseRecording() {
        if (this.isRecording) {
            this.videoPlayer.pause();
            this.isRecording = false;
            this.updateEndMarker();
        } else if (this.videoPlayer.isBeforeEndTime(0)) {
            this.drawAllData(); // draw all data to erase end marker circle
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
        if (this.videoPlayer.isLessThanStartTime(this.jumpInSeconds)) {
            const rewindToTime = this.path.getCurEndPoint().tPos - this.jumpInSeconds; // set time to rewind to based on last value in list
            this.path.rewind(rewindToTime);
            this.videoPlayer.rewind(rewindToTime);
        } else {
            this.path.rewind(0);
            this.videoPlayer.rewind(0);
        }
        if (this.isRecording) this.playPauseRecording(); // pause recording and video if currently recording
        this.drawAllData();
        this.updateEndMarker();
    }

    /**
     * Coordinates fast forwarding of movie and path data, if movie not right at start or near end
     */
    fastForward() {
        if (this.videoPlayer.isBeforeEndTime(this.jumpInSeconds)) {
            this.videoPlayer.fastForward(this.jumpInSeconds);
            this.path.fastForward(this.jumpInSeconds);
        }
    }

    updateEndMarker() {
        if (this.path.curPath.pointArray.length) this.path.drawEndMarker(this.path.getCurEndPoint(), this.gui.getFloorPlanContainer(), this.floorPlan.getImg());
    }

    loadFloorPlan(fileLocation) {
        if (this.floorPlanLoaded) this.floorPlan = null;
        this.floorPlan = new FloorPlan(this.sk, fileLocation);
    }

    loadVideo(fileLocation) {
        if (this.videoLoaded()) this.videoPlayer.destroy(); // if a video exists, destroy it
        this.videoPlayer = null;
        this.videoIsLoaded = false;
        this.videoPlayer = new VideoPlayer(fileLocation, this.sk, this.gui.getVideoContainer());
    }

    /**
     * Called from VideoPlayer Class, updates all data/views after video is loaded
     */
    newVideoLoaded() {
        console.log("New Video Loaded");
        this.videoIsLoaded = true;
        this.stopRecording(); // necessary to be able to draw starting frame before playing the video
        this.path.clearAllPaths();
        if (this.floorPlanLoaded()) this.floorPlan.drawFloorPlan(this.gui.getFloorPlanContainer()); // clear floor plan drawing area
    }

    newFloorPlanLoaded() {
        this.path.clearAllPaths();
        this.floorPlan.drawFloorPlan(this.gui.getFloorPlanContainer());
        if (this.videoLoaded()) this.stopRecording();
    }

    writeFile() {
        if (this.allDataLoaded() && this.path.curPath.pointArray.length > 0) {
            this.sk.saveTable(this.writeTable(this.path.curPath.pointArray), "transcript", "csv");
            this.path.addCurPathToList();
            this.path.clearCurPath();
            this.stopRecording();
            this.drawAllData();
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

    handleKeyPressed(keyValue) {
        if (this.allDataLoaded()) {
            if (keyValue === 'r' || keyValue === 'R') this.rewind();
            else if (keyValue === 'f' || keyValue === 'F') this.fastForward();
        }
    }

    handleMousePressed() {
        if (this.cursorTest()) this.isSelectResize = true;
        else if (this.gui.overFloorPlan() && this.allDataLoaded()) this.playPauseRecording();
    }

    handleMouseDragged() {
        if (this.isSelectResize) {
            this.gui.resizeByUser();
            this.updateForResize(this.gui.getVideoContainer());
        }
    }

    handleMouseReleased() {
        this.isSelectResize = false;
    }

    resizeByWindow() {
        this.gui.resizeByWindow();
        this.sk.resizeCanvas(window.innerWidth, window.innerHeight);
        this.updateForResize(this.gui.getVideoContainer());
    }

    updateForResize(videoContainer) {
        if (this.videoLoaded()) this.videoPlayer.setScaledDimensions(videoContainer);
        if (this.allDataLoaded()) this.drawAllData();
        this.updateEndMarker();
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
        return this.videoIsLoaded;
    }

    allDataLoaded() {
        return this.floorPlanLoaded() && this.videoLoaded();
    }

    cursorTest() {
        return this.gui.overSelector() && !this.isRecording;
    }
}