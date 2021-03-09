class UpdateData {

    // Updates/draws video image and calls method to record data
    prepareRecording() {
        image(movie, displayVideoXpos, displayVideoYpos, displayVideoWidth, displayVideoHeight);
        this.organizeRecording();
    }

    // Sets/sends correct x/y positions for drawing cur line segment to draw and record methods
    organizeRecording() {
        // Constrain mouse to floor plan display
        let xPos = constrain(mouseX, displayFloorplanXpos, displayFloorplanXpos + displayFloorplanWidth);
        let yPos = constrain(mouseY, displayFloorplanYpos, displayFloorplanYpos + displayFloorplanHeight);
        let pXPos = constrain(pmouseX, displayFloorplanXpos, displayFloorplanXpos + displayFloorplanWidth);
        let pYPos = constrain(pmouseY, displayFloorplanYpos, displayFloorplanYpos + displayFloorplanHeight);
        // Adjust floor plan x/y positions to record to 0, 0 origin/coordinate system
        let fpXPos = xPos - displayFloorplanXpos;
        let fpYPos = yPos - displayFloorplanYpos;
        // sned to draw/record methods
        this.drawCurLineSegment(xPos, yPos, pXPos, pYPos);
        this.recordCurPoint(fpXPos, fpYPos, movie.time());
    }

    // Draw current line segment scaled to display Floor Plan
    drawCurLineSegment(xPos, yPos, pXPos, pYPos) {
        strokeWeight(pathWeight);
        stroke(curPathColor);
        line(xPos, yPos, pXPos, pYPos);
    }

    // Record current data point
    recordCurPoint(fpXPos, fpYPos, mTime) {
        curPath.xPos.push(fpXPos * (inputFloorPlanWidth / displayFloorplanWidth)); // rescale x,y positions to input floor plan
        curPath.yPos.push(fpYPos * (inputFloorPlanHeight / displayFloorplanHeight));
        curPath.tPos.push(mTime);
    }

    // Redraws floor plan, movie, and all recorded paths
    reDrawAllData() {
        image(floorPlan, displayFloorplanXpos, displayFloorplanYpos, displayFloorplanWidth, displayFloorplanHeight);
        image(movie, displayVideoXpos, displayVideoYpos, displayVideoWidth, displayVideoHeight);
        // loop through all existing files and draw each one different color
        for (let i = 0; i < paths.length; i++) this.drawPath(paths[i], colorShades[i % colorShades.length]);
        reSetAllData = false;
    }

    // Takes path object and color, draws complete, correctly scaled path to floor plan image
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

    // Create and write coordinates to output file, increment curFileToOutput for next recording when finished
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

    // Remove data from curPath equivalent to videoJumpValue, rewDraw all data and curPath
    rewind() {
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

    // Fast forward video by videoJumpValue
    fastForward() {
        // Only ff if not at very end of video
        // if (movie.time() < movieDuration - videoJumpValue) movie.time(movie.time() + videoJumpValue);
        movie.time(movie.time() + videoJumpValue);
        // add x,y,time values to lists for each second
        // for (int i = 0; i < videoJumpValue; i++) {
        //   xPosition.add(xPosition.get(xPosition.size()-1));
        //   yPosition.add(yPosition.get(yPosition.size()-1));
        //   tPosition.add(tPosition.get(tPosition.size()-1));
        // }
    }
}