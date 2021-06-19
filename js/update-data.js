class UpdateData {

    /**
     * Mediator class creates UpdatePath and UpdateMovie classes for data coordination
     * and UpdateView class to also update views/drawing methods
     */
    constructor() {
        this.updatePath = new UpdatePath();
        this.updateMovie = new UpdateMovie();
        this.updateView = new UpdateView();
    }

    /**
     * Updates video frame and line segment for drawing paths in interface
     * Decides whether to record data point based on sampling rate method
     */
    setData() {
        this.updateView.drawVideoFrame();
        this.updateView.drawLineSegment(); // Apparently, this should not be called within testSampleRate block
        if (this.testSampleRate()) this.updatePath.addPoint();
    }
    /**
     * Method to sample data in 2 ways
     * (1) if mouse moves sample at rate of 2 decimal points
     * (2) if stopped sample at rate of 0 decimal points, approximately every 1 second in movie
     */
    testSampleRate() {
        if (core.curPath.tPos.length === 0) return true;
        else if (mondrian.mouseX !== mondrian.pmouseX || mondrian.mouseY !== mondrian.pmouseY) return +(core.curPath.tPos[core.curPath.tPos.length - 1].toFixed(2)) < +(movieDiv.time().toFixed(2));
        else return +(core.curPath.tPos[core.curPath.tPos.length - 1].toFixed(0)) < +(movieDiv.time().toFixed(0));
    }

    drawAllData() {
        keys.drawFloorPlanBackground();
        this.updateView.drawVideoFrame();
        this.updateView.drawAllPaths();
    }

    clearPaths() {
        this.updatePath.clearAllPaths();
    }

    reDrawCurVideoFrame() {
        this.updateView.drawVideoFrame();
    }

    newVideoLoaded() {
        this.clearPaths();
        this.reDrawCurVideoFrame(); // after video loaded, draw first frame to display it
        if (core.dataIsLoaded(floorPlan)) keys.drawFloorPlanBackground();
    }

    newFloorPlanLoaded() {
        this.clearPaths();
        keys.drawFloorPlanBackground();
        if (core.dataIsLoaded(videoPlayer)) {
            this.updateMovie.stop();
            this.reDrawCurVideoFrame();
        }
    }

    /**
     * Reset recording for current path by redrawing data, clearing current path, stopping movie
     */
    resetCurRecording() {
        this.updateMovie.stop();
        this.updatePath.clearCurPath();
        this.drawAllData();
    }

    /**
     * Organizes methods to update data and reset screen after file has been written
     * Sets recording to false
     */
    resetAfterWriteFile() {
        this.updatePath.addPath();
        this.updatePath.clearCurPath();
        this.updateMovie.stop();
        this.drawAllData();
    }

    /**
     * Organize rewind video and remove data from core.curPath equivalent to videoPlayer.videoJumpValue, rewDraw all data and core.curPath
     */
    rewind() {
        // Record point before rewinding to make sure curEndTime is correct in case points were not recording if mouse was not moving
        this.updateView.drawLineSegment();
        this.updatePath.addPoint();
        // Set time to rewind to base on last time value in list - videoPlayer.videoJumpValue
        let rewindToTime = core.curPath.tPos[core.curPath.tPos.length - 1] - videoPlayer.videoJumpValue;
        this.updatePath.rewind(rewindToTime);
        this.updateMovie.rewind(rewindToTime);
        if (core.recording) this.playPauseRecording(); // pause recording and video if currently recording
        this.drawAllData();
    }

    /**
     * Organize fast forwarding movie and path data, if movie not right at start or near end
     */
    fastForward() {
        if (movieDiv.time() > 0 && (movieDiv.time() < movieDiv.duration() - videoPlayer.videoJumpValue)) {
            this.updateMovie.fastForward();
            this.updatePath.fastForward();
        }
    }

    playPauseRecording() {
        if (core.recording) {
            this.updateMovie.pause();
            core.recording = false;
        } else {
            this.updateMovie.play();
            core.recording = true;
        }
    }
}

class UpdatePath {

    /**
     * Calculates correctly scaled x/y positions to actual image file of floor plan uploaded by user
     */
    addPoint() {
        // Constrain mouse to floor plan display
        let xPos = mondrian.constrain(mondrian.mouseX, keys.displayFloorplanXpos, keys.displayFloorplanXpos + keys.displayFloorplanWidth);
        let yPos = mondrian.constrain(mondrian.mouseY, keys.displayFloorplanYpos, keys.displayFloorplanYpos + keys.displayFloorplanHeight);
        // Adjust floor plan x/y positions to record to 0, 0 origin/coordinate system
        let fpXPos = xPos - keys.displayFloorplanXpos;
        let fpYPos = yPos - keys.displayFloorplanYpos;
        core.curPath.xPos.push(+(fpXPos * (floorPlan.width / keys.displayFloorplanWidth)).toFixed(2)); // rescale x,y positions to input floor plan
        core.curPath.yPos.push(+(fpYPos * (floorPlan.height / keys.displayFloorplanHeight)).toFixed(2));
        core.curPath.tPos.push(+movieDiv.time().toFixed(2));
    }

    addPath() {
        core.paths.push(core.createPath(core.curPath.xPos, core.curPath.yPos, core.curPath.tPos, core.colorList[core.paths.length % core.colorList.length]));
    }

    /**
     * Add to points to global core.curPath arraylists for each second being fast forwarded
     */
    fastForward() {
        // IMPORTANT: get last values from cur lists first before loop
        const xPos = core.curPath.xPos[core.curPath.tPos.length - 1];
        const yPos = core.curPath.yPos[core.curPath.tPos.length - 1];
        const tPos = core.curPath.tPos[core.curPath.tPos.length - 1];
        // Add values for each second jumped by VideoJumpvalue, xPos and yPos are same but add i to tPos as time is increasing
        // Start at 1 to record tPos properly
        for (let i = 1; i <= videoPlayer.videoJumpValue; i++) {
            core.curPath.xPos.push(xPos);
            core.curPath.yPos.push(yPos);
            core.curPath.tPos.push(+(tPos + i).toFixed(2));
        }
    }
    /**
     * Remove all points from core.curPath arraylists that are greater than time parameter
     * @param  {Float/Number} rewindToTime
     */
    rewind(rewindToTime) {
        // Start at end of x or y list (NOT t) and delete up to newEndTime
        for (let i = core.curPath.xPos.length - 1; i >= 0; i--) {
            if (core.curPath.tPos[i] > rewindToTime) {
                core.curPath.tPos.pop();
                core.curPath.xPos.pop();
                core.curPath.yPos.pop();
            } else break;
        }
    }

    clearCurPath() {
        core.curPath.xPos = [];
        core.curPath.yPos = [];
        core.curPath.tPos = [];
    }

    clearAllPaths() {
        this.clearCurPath();
        core.paths = [];
    }
}

class UpdateMovie {

    stop() {
        movieDiv.stop(); // sets movie time to 0
        core.recording = false;
    }

    play() {
        movieDiv.play();
    }

    pause() {
        movieDiv.pause();
    }

    fastForward() {
        movieDiv.time(movieDiv.time() + videoPlayer.videoJumpValue); // ff by videoJumpValue
    }

    /**
     * Rewind movie to parameter rewindToTime or 0 if it is too close to start of video
     * @param  {Float/Number} rewindToTime
     */
    rewind(rewindToTime) {
        if (movieDiv.time() > videoPlayer.videoJumpValue) movieDiv.time(rewindToTime);
        else movieDiv.time(0);
    }
}

class UpdateView {

    drawLineSegment() {
        // Constrain mouse to floor plan display
        let xPos = mondrian.constrain(mondrian.mouseX, keys.displayFloorplanXpos, keys.displayFloorplanXpos + keys.displayFloorplanWidth);
        let yPos = mondrian.constrain(mondrian.mouseY, keys.displayFloorplanYpos, keys.displayFloorplanYpos + keys.displayFloorplanHeight);
        let pXPos = mondrian.constrain(mondrian.pmouseX, keys.displayFloorplanXpos, keys.displayFloorplanXpos + keys.displayFloorplanWidth);
        let pYPos = mondrian.constrain(mondrian.pmouseY, keys.displayFloorplanYpos, keys.displayFloorplanYpos + keys.displayFloorplanHeight);
        mondrian.strokeWeight(core.pathWeight);
        mondrian.stroke(core.curPath.pColor);
        mondrian.line(xPos, yPos, pXPos, pYPos);
    }

    drawAllPaths() {
        for (let i = 0; i < core.paths.length; i++) this.drawPath(core.paths[i]);
        this.drawPath(core.curPath); // draw current path last
    }

    drawPath(p) {
        mondrian.stroke(p.pColor);
        mondrian.strokeWeight(core.pathWeight);
        // Path won't be processed if empty 
        // Must add back in floor plan display x/y pos to scale to display floor plan correctly
        for (let i = 1; i < p.xPos.length; i++) {
            let x = keys.displayFloorplanXpos + (p.xPos[i] / (floorPlan.width / keys.displayFloorplanWidth));
            let y = keys.displayFloorplanYpos + (p.yPos[i] / (floorPlan.height / keys.displayFloorplanHeight));
            let px = keys.displayFloorplanXpos + (p.xPos[i - 1] / (floorPlan.width / keys.displayFloorplanWidth));
            let py = keys.displayFloorplanYpos + (p.yPos[i - 1] / (floorPlan.height / keys.displayFloorplanHeight));
            mondrian.line(x, y, px, py); // draw line segment
        }
    }

    /**
     * Draw current movie frame image and white background to GUI in video display
     */
    drawVideoFrame() {
        mondrian.fill(255);
        mondrian.stroke(255);
        mondrian.rect(keys.displayVideoXpos, keys.displayVideoYpos, keys.displayVideoWidth, keys.displayVideoHeight);
        mondrian.image(movieDiv, keys.displayVideoXpos, keys.displayVideoYpos, videoPlayer.reScaledMovieWidth, videoPlayer.reScaledMovieHeight);
    }
}