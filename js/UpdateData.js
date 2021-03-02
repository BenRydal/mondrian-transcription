class UpdateData {

    // constructor() {
    // }

    // Updates visualization and records data or writes file if at end of video
    record() {
        image(movie, width / 2, 0, width / 2, height / 2);
        //if (movie.time() < movieDuration) 
        this.recordPoint();
        // this.writeFile();
    }

    // Record data point and call update/draw line method
    recordPoint() {
        //xPosition.add(int(map(mouseX, 0, floorPlan.width, 0, inputFloorPlanWidth)));
        curPath.xPos.push(mouseX * (inputFloorPlanWidth / windowFloorPlanWidth)); // rescale x,y positions to input floor plan
        curPath.yPos.push(mouseY * (inputFloorPlanHeight / windowFloorPlanHeight));
        curPath.tPos.push(movie.time());
        this.drawLine();
    }

    // Draw the line segment scaled to visual screen
    drawLine() {
        strokeWeight(5);
        stroke(0);
        line(constrain(mouseX, 0, windowFloorPlanWidth), constrain(mouseY, 0, windowFloorPlanHeight), constrain(pmouseX, 0, windowFloorPlanWidth), constrain(pmouseY, 0, windowFloorPlanHeight));
    }

    reDrawAllData() {
        image(floorPlan, 0, 0, windowFloorPlanWidth, windowFloorPlanHeight);
        image(movie, width / 2, 0, width / 2, height / 2);
        // loop through all existing files and draw each one different color
        for (let i = 0; i < paths.length; i++) {
            stroke(colorShades[i % colorShades.length]); // set color
            // loop through path object and draw
            let path = paths[i];
            for (let j = 1; j < path.xPos.length; j++) { // start at 1
                let x = path.xPos[j] / (inputFloorPlanWidth / windowFloorPlanWidth);
                let y = path.yPos[j] / (inputFloorPlanHeight / windowFloorPlanHeight);
                let px = path.xPos[j - 1] / (inputFloorPlanWidth / windowFloorPlanWidth); // prior point
                let py = path.yPos[j - 1] / (inputFloorPlanHeight / windowFloorPlanHeight);
                line(x, y, px, py);
            }
        }
        reSetAllData = false;
    }

    // redrawfloorPlan and loop through all lists to draw complete path
    reDrawCurPath() {
        stroke(0);
        for (let i = 1; i < curPath.xPos.length; i++) {
            let x = curPath.xPos[i] / (inputFloorPlanWidth / windowFloorPlanWidth);
            let y = curPath.yPos[i] / (inputFloorPlanHeight / windowFloorPlanHeight);
            let px = curPath.xPos[i - 1] / (inputFloorPlanWidth / windowFloorPlanWidth); // prior point
            let py = curPath.yPos[i - 1] / (inputFloorPlanHeight / windowFloorPlanHeight);
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

    // Clone current path into new Path object and add to paths ArrayList holder
    addPath() {
        let path = new Path();
        path.tPos = Object.assign([], curPath.tPos);
        path.xPos = Object.assign([], curPath.xPos);
        path.yPos = Object.assign([], curPath.yPos);
        paths.push(path);
    }

    // reset curPath to record next file
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

    // Reset arraylists, recording and redraw floor plan
    reset() {
        movie.stop();
        recording = false;
        this.reDrawAllData();
        curPath.xPos = [];
        curPath.yPos = [];
        curPath.tPos = [];
    }

    rewind() {
        // Only rewind if not at very beginning of video
        let curEndTime = curPath.tPos[curPath.tPos.length-1]; // get time value from last element in list
        print(curEndTime, curPath.tPos.length);
        let newEndTime = curEndTime - videoJumpValue; // subtract videoJumpValue to set newEndTime 
        if (movie.time() > videoJumpValue) movie.time(newEndTime); // rewind video to newEndTime or 0.1 if it is really close to start of video
        else movie.time(0);
        // Start at end of x or y list (NOT t) and delete up to newEndTime
        for (let i = curPath.xPos.length-1; i >= 0; i--) {
            if (curPath.tPos[i] > newEndTime) {
                curPath.tPos.pop();
                curPath.xPos.pop();
                curPath.yPos.pop();
            } else break;
        }
        this.reDrawAllData();
        this.reDrawCurPath();
    }

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