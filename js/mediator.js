/**
 * Mediator class coordinates calls to 4 other classes including P5 sk
 */
class Mediator {

    constructor(sketch) {
        this.sk = sketch;
        this.path = new Path();
        this.videoPlayer = null;
        this.floorPlan = null;
        this.isRecording = false; // indicates recording mode
        this.isInfoShowing = true; // indicates if intro message showing
        this.jumpInSeconds = 5; // seconds value to fast forward and rewind path/video data
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
            if (this.isInfoShowing) this.updateIntro(); // prevent info screen from showing while recording for smooth user interaction
        }
    }

    updateDrawLoop() {
        if (this.allDataLoaded()) {
            if (this.isRecording) this.updateRecording();
            if (this.isInfoShowing) {
                this.updateAllData(); // redraw all data first, then the info screen
                this.sk.drawIntroScreen();
            }
        } else {
            this.sk.drawLoadDataBackground();
            if (this.isInfoShowing) this.updateLoadDataScreen();
        }
    }

    updateLoadDataScreen() {
        if (this.floorPlanLoaded()) this.sk.drawFloorPlan(this.floorPlan);
        else if (this.videoLoaded()) this.sk.drawVideoFrame(this.videoPlayer, this.videoPlayer.curTime);
        if (this.isInfoShowing) this.sk.drawIntroScreen();
    }

    /**
     * Coordinates video and line segment drawing in display. Decides whether to record data point based on sampling rate method
     */
    updateRecording() {
        this.sk.drawVideoFrame(this.videoPlayer, this.videoPlayer.curTime);
        this.sk.drawLineSegment(this.path.curPath); // Don't call this within testSampleRate block
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
        return +(this.path.curPathEndPoint.tPos.toFixed(rate)) < +(this.videoPlayer.curTime.toFixed(rate));
    }

    /**
     * Add correctly scaled positioning data to current path
     */
    updateCurPath() {
        const [mouseXPos, mouseYPos, pointXPos, pointYPos] = this.sk.getPositioningData(this.floorPlan);
        const time = +this.videoPlayer.curTime.toFixed(2);
        this.path.addPointToCurPath(mouseXPos, mouseYPos, pointXPos, pointYPos, time);
    }

    updateIntro() {
        if (this.isInfoShowing && this.allDataLoaded()) this.updateAllData();
        if (this.isInfoShowing) this.isInfoShowing = false;
        else this.isInfoShowing = true;
    }

    updateAllData() {
        this.sk.drawFloorPlan(this.floorPlan);
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
            if (this.path.curPath.pointArray.length > 0) this.sk.drawCurPathBug(this.path.curPathEndPoint);
        } else if (this.testVideoTimeForRecording()) {
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
     * Coordinates rewinding of video and erasing of curPath data and updating display
     */
    rewind() {
        const rewindToTime = this.path.curPathEndPoint.tPos - this.jumpInSeconds; // set time to rewind to based on last value in list
        this.path.rewind(rewindToTime);
        if (this.testVideoForRewind()) this.videoPlayer.rewind(rewindToTime);
        else this.videoPlayer.rewind(0);
        if (this.isRecording) this.playPauseRecording(); // pause recording and video if currently recording
        this.updateAllData();
        if (this.path.curPath.pointArray.length > 0) this.sk.drawCurPathBug(this.path.curPathEndPoint);
    }

    /**
     * Coordinates fast forwarding of movie and path data, if movie not right at start or near end
     */
    fastForward() {
        if (this.testVideoTimeForFastForward()) {
            this.videoPlayer.fastForward(this.jumpInSeconds);
            this.path.fastForward(this.jumpInSeconds);
        }
    }

    loadVideo(fileLocation) {
        if (this.videoLoaded()) this.videoPlayer.destroy(); // if a video exists, destroy it
        this.videoPlayer = new VideoPlayer(fileLocation, this.sk); // create new videoPlayer
    }

    /**
     * Called from VideoPlayer Class, updates all data/views after video is loaded
     */
    newVideoLoaded() {
        console.log("New Video Loaded");
        this.path.clearAllPaths();
        this.stopRecording(); // necessary to be able to draw starting frame before playing the video
        this.sk.drawVideoFrame(this.videoPlayer, this.videoPlayer.curTime); // after video loaded, draw first frame to display it
        if (this.floorPlanLoaded()) this.sk.drawFloorPlan(this.floorPlan);
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
        this.sk.drawFloorPlan(this.floorPlan);
        if (this.videoLoaded()) {
            this.stopRecording();
            this.sk.drawVideoFrame(this.videoPlayer, this.videoPlayer.curTime);
        }
    }

    writeFile() {
        if (this.allDataLoaded() && this.path.curPath.pointArray.length > 0) {
            this.sk.saveTable(this.sk.writeTable(this.path.curPath.pointArray), "Path_" + this.path.curFileToOutput, "csv");
            this.path.curFileToOutput++;
            this.path.addPath();
            this.path.clearCurPath();
            this.stopRecording();
            this.updateAllData();
        }
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
        return this.dataIsLoaded(this.videoPlayer);
    }

    allDataLoaded() {
        return this.dataIsLoaded(this.floorPlan) && this.dataIsLoaded(this.videoPlayer);
    }

    testVideoTimeForRecording() {
        return this.videoPlayer.curTime < this.videoPlayer.duration;
    }

    testVideoTimeForFastForward() {
        return this.videoPlayer.curTime > 0 && (this.videoPlayer.curTime < this.videoPlayer.duration - this.jumpInSeconds);
    }

    testVideoForRewind() {
        return this.videoPlayer.curTime > this.jumpInSeconds;
    }
}