class UpdateData {
    /**
     * @description draws video image and begins recording using samplerate set globally if mouse has moved
     * NOTE: Recording based on mouse movement and sample rate is simplest way to reduce data file size and 
     * draw smoother curves from outputted positioning data file in visualization tools
     * If mouse moves, always record
     * If mouse hasn't moved, record at sample rate so you still get some points while not moving
     */
    prepareRecording() {
        image(movie, displayVideoXpos, displayVideoYpos, movie.width, movie.height);
        if (mouseX != pmouseX || mouseY != pmouseY) this.organizeRecording();
        else {
            if (frameCount % frameAndSampleWhenStoppedRate == 0) this.organizeRecording();
        }
    }
    
    /**
     * @description Organizes drawing and recording of current point
     */
    organizeRecording() {
        this.drawCurLineSegment();
        this.recordCurPoint();
    }
    /**
     * @description calculates correctly scaled x/y positions from mouse cursor and drawns line segment for current point
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
     * @description Calculates correctly scaled x/y positions to actual image file of floor plan uploaded by user
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
     * @description Redraws movie background and image, floorplan display image, and all recorded paths
     * resets resetAlldata to false
     */
    reDrawAllData() {
        fill(0); // draw black screen background for movie
        stroke(0);
        rect(displayVideoXpos, displayVideoYpos, displayVideoWidth, displayVideoHeight);
        image(movie, displayVideoXpos, displayVideoYpos, movie.width, movie.height);
        image(floorPlan, displayFloorplanXpos, displayFloorplanYpos, displayFloorplanWidth, displayFloorplanHeight);
        // loop through all existing files and draw each one different color
        for (let i = 0; i < paths.length; i++) this.drawPath(paths[i], colorShades[i % colorShades.length]);
        reSetAllData = false;
    }
    
    /**
     * @description Draws complete and correctly scaled path to floor plan display image
     * @param  {Path} p
     * @param  {color} pathColor
     */
    drawPath(p, pathColor) {
        stroke(pathColor);
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
     * @description Create and write coordinates to output file, increment curFileToOutput for next recording when finished
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
        // TO DO: 
        this.addPath();
        this.clearPositionData();
        reSetAllData = true;
        movie.stop();
        recording = false;
    }

    // Clone current path into new Path object and add new Path to paths ArrayList holder
    addPath() {
        let path = new Path();
        path.tPos = Object.assign([], curPath.tPos);
        path.xPos = Object.assign([], curPath.xPos);
        path.yPos = Object.assign([], curPath.yPos);
        paths.push(path);
    }

    // clear data in curPath to record next file
    clearPositionData() {
        curPath.xPos = [];
        curPath.yPos = [];
        curPath.tPos = [];
    }

    playPauseRecording() {
        if (recording) {
            movie.pause();
            recording = false;
        } else {
            movie.play();
            recording = true;
        }
    }

    // Reset arraylists, stop recording and redraw all data
    reset() {
        movie.stop();
        recording = false;
        this.reDrawAllData();
        curPath.xPos = [];
        curPath.yPos = [];
        curPath.tPos = [];
    }

    // Rewind video and remove data from curPath equivalent to videoJumpValue, rewDraw all data and curPath
    rewind() {
        this.organizeRecording(); // record point before rewinding to make sure curEndTime is correct in case points were not recording if mouse was not moving
        // Only rewind if not at very beginning of video
        let curEndTime = curPath.tPos[curPath.tPos.length - 1]; // get time value from last element in list
        let newEndTime = curEndTime - videoJumpValue; // subtract videoJumpValue to set newEndTime 
        if (movie.time() > videoJumpValue) movie.time(newEndTime); // rewind video to newEndTime or 0.1 if it is really close to start of video
        else movie.time(0);
        movie.pause(); // pause movie/stop recording
        recording = false;
        // Start at end of x or y list (NOT t) and delete up to newEndTime
        for (let i = curPath.xPos.length - 1; i >= 0; i--) {
            if (curPath.tPos[i] > newEndTime) {
                curPath.tPos.pop();
                curPath.xPos.pop();
                curPath.yPos.pop();
            } else break;
        }
        this.reDrawAllData();
        this.drawPath(curPath, curPathColor);
    }

    // Fast forward video by videoJumpValue and add xPos, yPos and tPos values to current list
    fastForward() {
        // make sure not at end of video
        if (movie.time() < movie.duration() - videoJumpValue) {
            movie.time(movie.time() + videoJumpValue);
            // movie.time(movie.time() + videoJumpValue);
            // get last values from cur lists
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
    }
}