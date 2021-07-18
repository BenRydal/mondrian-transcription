/*
Mediator class coordinates calls to 4 other classes including P5 sk
Contains methods for procedural updates, testing data, getters/setters, and loading data (called from Controller)
*/
class Mediator {

    constructor(sketch) {
        this.sk = sketch;
        this.path = new Path();
        this.videoPlayer = null;
        this.floorPlan = null;
        this.isRecording = false; // Boolean to indicate recording
        this.isInfoShowing = true; // Boolean to show/hide intro message
    }

    // ** ** ** ** UPDATE METHODS ** ** ** **
    /**
     * Coordinates video and line segment drawing in display. Decides whether to record data point based on sampling rate method
     */
    updateRecording() {
        this.updateVideoFrame();
        this.sk.drawLineSegment(this.path.curPath); // Apparently, this should not be called within testSampleRate block
        if (this.testSampleRate()) this.updateCurPath();
    }

    /**
     * Method to sample data in 2 ways
     * (1) if mouse moves sample at rate of 2 decimal points
     * (2) if stopped sample at rate of 0 decimal points, approximately every 1 second in movie
     */
    testSampleRate() {
        if (this.path.curPath.pointArray.length === 0) return true; // always return true if first data point
        else if (this.sk.mouseX !== this.sk.pmouseX || this.sk.mouseY !== this.sk.pmouseY) return this.sampleAtRate(2);
        else return this.sampleAtRate(0);
    }

    sampleAtRate(rate) {
        return +(this.path.curPathEndPoint.tPos.toFixed(rate)) < +(this.videoPlayer.movieDiv.time().toFixed(rate));
    }

    /**
     * Adds properly scaled data point from input floorPlan to current path
     */
    updateCurPath() {
        const [xPos, yPos] = this.sk.getScaledMousePos(this.floorPlan);
        const time = +this.videoPlayer.movieDiv.time().toFixed(2);
        this.path.addPoint(xPos, yPos, time);
    }

    updateIntro() {
        if (this.sketchIsInfoShowing && this.allDataLoaded()) this.updateAllData();
        if (this.sketchIsInfoShowing) this.sketchIsInfoShowing = false;
        else this.sketchIsInfoShowing = true;
    }

    updateAllData() {
        this.updateFloorPlan();
        this.updateVideoFrame();
        for (const path of this.path.paths) this.sk.drawPath(path); // update all recorded paths
        this.sk.drawPath(this.path.curPath); // update current path last
    }

    updateFloorPlan() {
        this.sk.drawFloorPlan(this.floorPlan);
    }

    updateVideoFrame() {
        this.sk.drawVideoFrame(this.videoPlayer);
        this.sk.drawVideoTimeLabel(this.videoPlayer.movieDiv.time());
    }

    resetCurRecording() {
        if (this.allDataLoaded()) {
            this.stopRecording();
            this.path.clearCurPath();
            this.updateAllData();
        }
    }

    /**
     * Coordinates rewinding of video and erasing of curPath data and updating display
     */
    rewind() {
        // Set time to rewind to base on last time value in list - videoPlayer.videoJumpValue
        const rewindToTime = this.path.curPathEndPoint.tPos - this.videoPlayer.videoJumpValue;
        this.path.rewind(rewindToTime);
        this.videoPlayer.rewind(rewindToTime);
        if (this.sketchIsRecording) this.playPauseRecording(); // pause recording and video if currently recording
        this.updateAllData();
        if (this.path.curPath.pointArray.length > 0) this.sk.drawCurPathBug(this.path.curPathEndPoint.xPos, this.path.curPathEndPoint.yPos);
    }

    /**
     * Coordinates fast forwarding of movie and path data, if movie not right at start or near end
     */
    fastForward() {
        if (this.testVideoTimeForFastForward()) {
            this.videoPlayer.fastForward();
            this.path.fastForward(this.videoPlayer.videoJumpValue);
        }
    }

    stopRecording() {
        this.videoPlayer.stop();
        this.sketchIsRecording = false;
    }

    playPauseRecording() {
        if (this.sketchIsRecording) {
            this.videoPlayer.pause();
            this.sketchIsRecording = false;
            if (this.path.curPath.pointArray.length > 0) this.sk.drawCurPathBug(this.path.curPathEndPoint.xPos, this.path.curPathEndPoint.yPos);
        } else if (this.testVideoTimeForRecording()) {
            this.updateAllData(); // update all data to erase curPathBug
            this.videoPlayer.play();
            this.sketchIsRecording = true;
        }
    }

    // ** ** ** ** DATA LOADING METHODS ** ** ** **

    loadVideo(fileLocation) {
        if (this.videoLoaded()) this.videoPlayer.destroy(); // if a video exists, destroy it
        this.videoPlayer = new VideoPlayer(fileLocation, this.sk); // create new videoPlayer
    }
    /**
     * Tests if new video has a duration (additional formatting test) and updates all data/views if so or destroys video and alerts user if not
     */
    newVideoLoaded() {
        console.log("New Video Loaded");
        this.path.clearAllPaths();
        this.stopRecording(); // necessary to be able to draw starting frame before playing the video
        this.updateVideoFrame(); // after video loaded, draw first frame to display it
        if (this.floorPlanLoaded()) this.updateFloorPlan();
    }

    loadFloorPlan(fileLocation) {
        this.sk.loadImage(fileLocation, (img) => {
            this.newFloorPlanLoaded(img);
            URL.revokeObjectURL(fileLocation);
        }, e => {
            alert("Error loading floor plan image file. Please make sure it is correctly formatted as a PNG or JPG image file.")
            console.log(e);
        });
    }

    newFloorPlanLoaded(img) {
        console.log("New Floor Plan Loaded");
        this.floorPlan = img;
        this.path.clearAllPaths();
        this.updateFloorPlan();
        if (this.videoLoaded()) {
            this.stopRecording();
            this.updateVideoFrame();
        }
    }

    writeFile() {
        if (this.allDataLoaded() && this.path.curPath.pointArray.length > 0) {
            this.sk.saveTable(this.path.writeTable(), "Path_" + this.path.curFileToOutput, "csv");
            this.path.curFileToOutput++;
            this.path.addPath();
            this.path.clearCurPath();
            this.stopRecording();
            this.updateAllData();
        }
    }

    // ** ** ** ** TEST DATA METHODS ** ** ** **

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
        return this.dataIsLoaded(this.videoPlayer);
    }

    allDataLoaded() {
        return this.dataIsLoaded(this.floorPlan) && this.dataIsLoaded(this.videoPlayer);
    }

    testVideoTimeForRecording() {
        return this.videoPlayer.movieDiv.time() < this.videoPlayer.movieDiv.duration();
    }

    testVideoTimeForFastForward() {
        return this.videoPlayer.movieDiv.time() > 0 && (this.videoPlayer.movieDiv.time() < this.videoPlayer.movieDiv.duration() - this.videoPlayer.videoJumpValue);
    }

    // ** ** ** ** GETTERS/SETTERS ** ** ** **

    get floorPlanWidth() {
        return this.floorPlan.width;
    }

    get floorPlanHeight() {
        return this.floorPlan.height;
    }

    get sketchIsRecording() {
        return this.isRecording;
    }

    set sketchIsRecording(value) {
        this.isRecording = value;
    }

    get sketchIsInfoShowing() {
        return this.isInfoShowing;
    }

    set sketchIsInfoShowing(value) {
        this.isInfoShowing = value;
    }
}