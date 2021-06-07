class UpdateData {

    /**
     * Class to synchronously control both path and movie updates
     * Creates UpdatePath and UpdateMovie classes and organizes coordination for methods called on both 
     */
    constructor() {
        this.updatePath = new UpdatePath();
        this.updateMovie = new UpdateMovie();
    }

    /**
     * Updates video frame and line segment for drawing paths in interface
     * Decides whether to record data point based on sampling rate method
     */
    setData() {
        this.updateMovie.drawCurFrame();
        this.updatePath.drawCurLineSegment(); // Apparantly, this should not be called within testSampleRate block
        if (this.testSampleRate()) this.updatePath.recordCurPoint();
    }
    /**
     * Method to sample data in 2 ways
     * (1) if mouse moves sample at rate of 2 decimal points
     * (2) if stopped sample at rate of 0 decimal points, approximately every 1 second in movie
     * NOTE: Always return true if first point of path
     */
    testSampleRate() {
        if (core.curPath.tPos.length === 0) return true;
        else if (mouseX !== pmouseX || mouseY !== pmouseY) return +(core.curPath.tPos[core.curPath.tPos.length - 1].toFixed(2)) < +(movie.time().toFixed(2));
        else return +(core.curPath.tPos[core.curPath.tPos.length - 1].toFixed(0)) < +(movie.time().toFixed(0));
    }

    reDrawAllData() {
        keys.drawFloorPlanBackground();
        this.updateMovie.drawCurFrame();
        this.updatePath.reDrawAllPaths();
    }

    /**
     * Reset recording for current path by redrawing data, clearing current path, stopping movie
     */
    resetCurRecording() {
        this.updateMovie.stopMovie();
        this.updatePath.clearCurPath();
        this.reDrawAllData();
    }

    /**
     * Create and write coordinates to output file
     * Increment curFileToOutput for next recording when finished and reset paths for next path recording
     */
    writeFile() {
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
        saveTable(table, "Path_" + core.curFileToOutput + ".csv");
        core.curFileToOutput++;
        this.resetAfterWriteFile();
    }

    /**
     * Organizes methods to update data and reset screen after file has been written
     * Sets recording to false
     */
    resetAfterWriteFile() {
        this.updatePath.addPath();
        this.updatePath.clearCurPath();
        this.updateMovie.stopMovie();
        updateData.reDrawAllData();
    }

    /**
     * Organize path and video rewind methods 
     * Rewind video and remove data from core.curPath equivalent to videoPlayer.videoJumpValue, rewDraw all data and core.curPath
     */
    rewind() {
        // Record point before rewinding to make sure curEndTime is correct in case points were not recording if mouse was not moving
        this.updatePath.drawCurLineSegment();
        this.updatePath.recordCurPoint();
        // TO DO: Add conditional test here based on movie time to clear path/reset video if less that jumpvalue
        // Set time to rewind to base on last time value in list - videoPlayer.videoJumpValue
        let rewindToTime = core.curPath.tPos[core.curPath.tPos.length - 1] - videoPlayer.videoJumpValue;
        this.updatePath.rewind(rewindToTime);
        this.updateMovie.rewind(rewindToTime);
        // If first time recording is being rewound, pause recording and set to false
        if (core.recording) this.updateMovie.playPauseRecording();
        this.reDrawAllData();
        this.updatePath.drawPath(core.curPath, CURPATHCOLOR);
    }

    /**
     * Organize fast forwarding movie and path data
     * NOTE: conditional tests to make sure not at end of video
     */
    fastForward() {
        if (movie.time() < movie.duration() - videoPlayer.videoJumpValue) {
            this.updateMovie.fastForward();
            this.updatePath.fastForward();
        }
    }
}

class UpdatePath {

    /**
     * Calculates correctly scaled x/y positions from mouse cursor and drawns line segment for current point
     */
    drawCurLineSegment() {
        // Constrain mouse to floor plan display
        let xPos = constrain(mouseX, keys.displayFloorplanXpos, keys.displayFloorplanXpos + keys.displayFloorplanWidth);
        let yPos = constrain(mouseY, keys.displayFloorplanYpos, keys.displayFloorplanYpos + keys.displayFloorplanHeight);
        let pXPos = constrain(pmouseX, keys.displayFloorplanXpos, keys.displayFloorplanXpos + keys.displayFloorplanWidth);
        let pYPos = constrain(pmouseY, keys.displayFloorplanYpos, keys.displayFloorplanYpos + keys.displayFloorplanHeight);
        strokeWeight(PATHWEIGHT);
        stroke(CURPATHCOLOR);
        line(xPos, yPos, pXPos, pYPos);
    }

    /**
     * Calculates correctly scaled x/y positions to actual image file of floor plan uploaded by user
     * and pushes positions and movie time in seconds to core.curPath arraylists
     */
    recordCurPoint() {
        // Constrain mouse to floor plan display
        let xPos = constrain(mouseX, keys.displayFloorplanXpos, keys.displayFloorplanXpos + keys.displayFloorplanWidth);
        let yPos = constrain(mouseY, keys.displayFloorplanYpos, keys.displayFloorplanYpos + keys.displayFloorplanHeight);
        // Adjust floor plan x/y positions to record to 0, 0 origin/coordinate system
        let fpXPos = xPos - keys.displayFloorplanXpos;
        let fpYPos = yPos - keys.displayFloorplanYpos;
        core.curPath.xPos.push(+(fpXPos * (core.inputFloorPlanWidth / keys.displayFloorplanWidth)).toFixed(2)); // rescale x,y positions to input floor plan
        core.curPath.yPos.push(+(fpYPos * (core.inputFloorPlanHeight / keys.displayFloorplanHeight)).toFixed(2));
        core.curPath.tPos.push(+movie.time().toFixed(2));
    }

    /**
     * Draw all recorded paths from core paths array
     */
    reDrawAllPaths() {
        for (let i = 0; i < core.paths.length; i++) this.drawPath(core.paths[i], COLORLIST[i % COLORLIST.length]);
    }

    /**
     * Draws complete and correctly scaled path to floor plan display image
     * @param  {Path} p
     * @param  {color} pathColor
     */
    drawPath(p, pathColor) {
        stroke(pathColor);
        strokeWeight(PATHWEIGHT);
        // Must add back in floor plan display x/y pos to scale to display floor plan correctly
        for (let i = 1; i < p.xPos.length; i++) {
            let x = keys.displayFloorplanXpos + (p.xPos[i] / (core.inputFloorPlanWidth / keys.displayFloorplanWidth));
            let y = keys.displayFloorplanYpos + (p.yPos[i] / (core.inputFloorPlanHeight / keys.displayFloorplanHeight));
            let px = keys.displayFloorplanXpos + (p.xPos[i - 1] / (core.inputFloorPlanWidth / keys.displayFloorplanWidth));
            let py = keys.displayFloorplanYpos + (p.yPos[i - 1] / (core.inputFloorPlanHeight / keys.displayFloorplanHeight));
            line(x, y, px, py); // draw line segment
        }
    }

    /**
     * Clone curPath and add it to core paths []
     */
    addPath() {
        const p = core.createPath(core.curPath.xPos, core.curPath.yPos, core.curPath.tPos);
        core.paths.push(p);
    }

    /**
     * Clear data in core.curPath
     */
    clearCurPath() {
        core.curPath.xPos = [];
        core.curPath.yPos = [];
        core.curPath.tPos = [];
    }

    /**
     * Add to points to global core.curPath arraylits for each second being fast forwarded
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
     * @param  {} rewindToTime
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
}

class UpdateMovie {

    /**
     * Draw current movie frame image and white background to GUI in video display
     */
    drawCurFrame() {
        fill(255);
        stroke(255);
        rect(keys.displayVideoXpos, keys.displayVideoYpos, keys.displayVideoWidth, keys.displayVideoHeight);
        image(movie, keys.displayVideoXpos, keys.displayVideoYpos, videoPlayer.reScaledMovieWidth, videoPlayer.reScaledMovieHeight);
    }
    /**
     * Plays/pauses movie and starts/stops recording variable
     */
    playPauseRecording() {
        if (core.recording) {
            movie.pause();
            core.recording = false;
        } else {
            movie.play();
            core.recording = true;
        }
    }
    /**
     * Stops movie, which sets time to 0
     * Sets recording to false
     */
    stopMovie() {
        movie.stop();
        core.recording = false;
    }

    /**
     * Fast forward video by videoPlayer.videoJumpValue in seconds
     */
    fastForward() {
        movie.time(movie.time() + videoPlayer.videoJumpValue);
    }

    /**
     * Rewind movie to parameter rewindToTime or 0 if it is too close to start of video
     * @param  {} rewindToTime
     */
    rewind(rewindToTime) {
        if (movie.time() > videoPlayer.videoJumpValue) movie.time(rewindToTime);
        else movie.time(0);
    }
}