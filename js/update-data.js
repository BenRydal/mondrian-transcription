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
     * Calls update most recent video frame
     * Decides whether to record data based on sampling rate method
     * NOTE: Always record first data point because sampling rate method requires prior point for comparison
     */
    setData() {
        this.updateMovie.drawCurFrame();
        if (curPath.tPos.length === 0 || this.testSampleRate()) {
            this.updatePath.drawCurLineSegment();
            this.updatePath.recordCurPoint();
        }
    }
    /**
     * Compares current movie time to last time point in curPath array
     * NOTE: If mouse is moving, rate is set by comparing to 2 decimal places. 
     * This samples enough data to draw smooth curves
     * NOTE: If mouse is not moving, rate is set to compare whole numbers.
     * This samples about every second and reduces data file size considerably
     */
    testSampleRate() {
        let rate = 0; // decimal value to compare, essentially the rate to sample. Set to 0 when mouse not moving.
        if (mouseX !== pmouseX || mouseY !== pmouseY) rate = 2; // set to 1 when mouse is
        return Number.parseFloat(curPath.tPos[curPath.tPos.length - 1]).toFixed(rate) < Number.parseFloat(movie.time()).toFixed(rate); // return true if movie time value is different last time index of prior recorded point
    }

    reDrawAllData() {
        drawFloorPlanBackground();
        this.updateMovie.drawCurFrame();
        this.updatePath.reDrawAllPaths();
    }

    /**
     * Reset recording for current path by redrawing data, clearing current path, stopping movie
     */
    resetCurRecording() {
        recording = false;
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
        table.addColumn(fileHeaders[0]);
        table.addColumn(fileHeaders[1]);
        table.addColumn(fileHeaders[2]);
        for (let i = 0; i < curPath.xPos.length; i++) {
            let newRow = table.addRow();
            newRow.setNum(fileHeaders[0], curPath.tPos[i]);
            newRow.setNum(fileHeaders[1], curPath.xPos[i]);
            newRow.setNum(fileHeaders[2], curPath.yPos[i]);
        }
        saveTable(table, "Path_" + curFileToOutput + ".csv");
        curFileToOutput++;
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
        dataUpdate.reDrawAllData();
        recording = false;
    }

    /**
     * Organize path and video rewind methods 
     * Rewind video and remove data from curPath equivalent to videoJumpValue, rewDraw all data and curPath
     */
    rewind() {
        // Record point before rewinding to make sure curEndTime is correct in case points were not recording if mouse was not moving
        this.updatePath.drawCurLineSegment();
        this.updatePath.recordCurPoint();
        // TO DO: Add conditional test here based on movie time to clear path/reset video if less that jumpvalue
        // Set time to rewind to base on last time value in list - videoJumpValue
        let rewindToTime = curPath.tPos[curPath.tPos.length - 1] - videoJumpValue;
        this.updatePath.rewind(rewindToTime);
        this.updateMovie.rewind(rewindToTime);
        // If first time recording is being rewound, pause recording and set to false
        if (recording) this.updateMovie.playPauseRecording();
        this.reDrawAllData();
        this.updatePath.drawPath(curPath, curPathColor);
    }

    /**
     * Organize fast forwarding movie and path data
     * NOTE: conditional tests to make sure not at end of video
     */
    fastForward() {
        if (movie.time() < movie.duration() - videoJumpValue) {
            this.updateMovie.fastForward();
            this.updatePath.fastForward();
        }
    }
}

class UpdatePath {

    constructor() {}

    /**
     * Calculates correctly scaled x/y positions from mouse cursor and drawns line segment for current point
     */
    drawCurLineSegment() {
        // Constrain mouse to floor plan display
        let xPos = constrain(mouseX, displayFloorplanXpos, displayFloorplanXpos + displayFloorplanWidth);
        let yPos = constrain(mouseY, displayFloorplanYpos, displayFloorplanYpos + displayFloorplanHeight);
        let pXPos = constrain(pmouseX, displayFloorplanXpos, displayFloorplanXpos + displayFloorplanWidth);
        let pYPos = constrain(pmouseY, displayFloorplanYpos, displayFloorplanYpos + displayFloorplanHeight);
        strokeWeight(pathWeight);
        stroke(curPathColor);
        line(xPos, yPos, pXPos, pYPos);
    }

    /**
     * Calculates correctly scaled x/y positions to actual image file of floor plan uploaded by user
     * and pushes positions and movie time in seconds to curPath arraylists
     */
    recordCurPoint() {
        // Constrain mouse to floor plan display
        let xPos = constrain(mouseX, displayFloorplanXpos, displayFloorplanXpos + displayFloorplanWidth);
        let yPos = constrain(mouseY, displayFloorplanYpos, displayFloorplanYpos + displayFloorplanHeight);
        // Adjust floor plan x/y positions to record to 0, 0 origin/coordinate system
        let fpXPos = xPos - displayFloorplanXpos;
        let fpYPos = yPos - displayFloorplanYpos;
        curPath.xPos.push(fpXPos * (inputFloorPlanWidth / displayFloorplanWidth)); // rescale x,y positions to input floor plan
        curPath.yPos.push(fpYPos * (inputFloorPlanHeight / displayFloorplanHeight));
        curPath.tPos.push(movie.time());
    }

    /**
     * Draw all recorded paths from global paths array
     */
    reDrawAllPaths() {
        for (let i = 0; i < paths.length; i++) this.drawPath(paths[i], colorShades[i % colorShades.length]);
    }

    /**
     * Draws complete and correctly scaled path to floor plan display image
     * @param  {Path} p
     * @param  {color} pathColor
     */
    drawPath(p, pathColor) {
        stroke(pathColor);
        strokeWeight(pathWeight);
        // Must add back in floor plan display x/y pos to scale to display floor plan correctly
        for (let i = 1; i < p.xPos.length; i++) {
            let x = displayFloorplanXpos + (p.xPos[i] / (inputFloorPlanWidth / displayFloorplanWidth));
            let y = displayFloorplanYpos + (p.yPos[i] / (inputFloorPlanHeight / displayFloorplanHeight));
            let px = displayFloorplanXpos + (p.xPos[i - 1] / (inputFloorPlanWidth / displayFloorplanWidth));
            let py = displayFloorplanYpos + (p.yPos[i - 1] / (inputFloorPlanHeight / displayFloorplanHeight));
            line(x, y, px, py); // draw line segment
        }
    }

    /**
     * Clone current path into new Path object and add new Path to paths ArrayList holder
     */
    addPath() {
        let path = new Path();
        path.tPos = Object.assign([], curPath.tPos);
        path.xPos = Object.assign([], curPath.xPos);
        path.yPos = Object.assign([], curPath.yPos);
        paths.push(path);
    }

    /**
     * Clear data in curPath
     */
    clearCurPath() {
        curPath.xPos = [];
        curPath.yPos = [];
        curPath.tPos = [];
    }

    /**
     * Add to points to global curPath arraylits for each second being fast forwarded
     */
    fastForward() {
        // IMPORTANT: get last values from cur lists first before loop
        let xPos = curPath.xPos[curPath.tPos.length - 1];
        let yPos = curPath.yPos[curPath.tPos.length - 1];
        let tPos = curPath.tPos[curPath.tPos.length - 1];
        // add values for each second jumped by VideoJumpvalue, xPos and yPos are same but add i to tPos as time is increasing
        for (let i = 0; i < videoJumpValue; i++) {
            curPath.xPos.push(xPos);
            curPath.yPos.push(yPos);
            curPath.tPos.push(tPos + i);
        }
    }
    /**
     * Remove all points from curPath arraylists that are greater than time parameter
     * @param  {} rewindToTime
     */
    rewind(rewindToTime) {
        // Start at end of x or y list (NOT t) and delete up to newEndTime
        for (let i = curPath.xPos.length - 1; i >= 0; i--) {
            if (curPath.tPos[i] > rewindToTime) {
                curPath.tPos.pop();
                curPath.xPos.pop();
                curPath.yPos.pop();
            } else break;
        }
    }
}

class UpdateMovie {

    constructor() {}
    /**
     * Draw current movie frame image and white background to GUI in video display
     */
    drawCurFrame() {
        fill(255);
        stroke(255);
        rect(displayVideoXpos, displayVideoYpos, displayVideoWidth, displayVideoHeight);
        image(movie, displayVideoXpos, displayVideoYpos, reScaledMovieWidth, reScaledMovieHeight);
    }
    /**
     * Plays/pauses movie and starts/stops recording
     */
    playPauseRecording() {
        if (recording) {
            movie.pause();
            recording = false;
        } else {
            movie.play();
            recording = true;
        }
    }

    stopMovie() {
        movie.stop();
    }

    /**
     * Fast forward video by videoJumpValue in seconds
     */
    fastForward() {
        movie.time(movie.time() + videoJumpValue);
    }

    /**
     * Rewind movie to parameter rewindToTime or 0 if it is too close to start of video
     * Pauses movie
     * @param  {} rewindToTime
     */
    rewind(rewindToTime) {
        if (movie.time() > videoJumpValue) movie.time(rewindToTime);
        else movie.time(0);
    }
}