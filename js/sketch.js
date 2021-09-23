/*
CREDITS/LICENSE INFORMATION: 
This software is written in JavaScript and p5.js and is licensed under the GNU General Public License Version 2.0. 
See the GNU General Public License included with this software for more details. 
Mondrian Transcription software was originally developed by Ben Rydal Shapiro at Vanderbilt University
as part of his dissertation titled Interaction Geography & the Learning Sciences. 
Copyright (C) 2018 Ben Rydal Shapiro, and contributors. 
To reference or read more about this work please see: 
https://etd.library.vanderbilt.edu/available/etd-03212018-140140/unrestricted/Shapiro_Dissertation.pdf
*/

const mondrian = new p5((sk) => {

    sk.preload = function () {
        sk.font_Lato = sk.loadFont("data/fonts/Lato-Light.ttf");
    }

    sk.setup = function () {
        sk.canvas = sk.createCanvas(window.innerWidth, window.innerHeight);
        sk.infoMsg = "MONDRIAN TRANSCRIPTION SOFTWARE\n\nby Ben Rydal Shapiro & contributors\nbuilt with p5.js & JavaScript\n\nHi there! This is a tool to transcribe fine-grained movement data from video. To get started, use the top buttons to load a floor plan image and a video. Then, click anywhere on the floor plan to start recording movement data synchronized to the video. As you move your cursor over the floor plan, positioning data is recorded. Play/pause recording by clicking on the floor plan. Press ‘f’ to fast forward and ‘r’ to rewind video and data recording in 5 second intervals. Use the top buttons to clear or save your recording data as a CSV file. For more information, see: https://www.benrydal.com/software/mondrian-transcription";
        sk.mediator = new Mediator(sk);
        sk.controller = new Controller(sk.mediator);
        sk.floorPlanContainer = {
            width: sk.width / 2,
            height: sk.height,
            xPos: sk.width / 2,
            yPos: 0
        };
        sk.videoContainer = {
            width: sk.width / 2,
            height: sk.height,
            xPos: 0,
            yPos: 0
        };
    }

    /**
     * Program loop organizes two drawing modes based on whether data is loaded
     */
    sk.draw = function () {
        sk.mediator.updateDrawLoop();
    }

    /**
     * Draws circle for last index in current path being recorded
     */
    sk.drawCurPathEndPoint = function (point) {
        this.noStroke();
        this.fill(255, 0, 0);
        this.circle(point.mouseXPos, point.mouseYPos, 25);
    }

    sk.drawLineSegment = function (curPath) {
        // Constrain mouse to floor plan display
        const xPos = this.constrain(this.mouseX, this.floorPlanContainer.xPos, this.floorPlanContainer.xPos + this.floorPlanContainer.width);
        const yPos = this.constrain(this.mouseY, this.floorPlanContainer.yPos, this.floorPlanContainer.yPos + this.floorPlanContainer.height);
        const pXPos = this.constrain(this.pmouseX, this.floorPlanContainer.xPos, this.floorPlanContainer.xPos + this.floorPlanContainer.width);
        const pYPos = this.constrain(this.pmouseY, this.floorPlanContainer.yPos, this.floorPlanContainer.yPos + this.floorPlanContainer.height);
        this.strokeWeight(curPath.weight);
        this.stroke(curPath.pColor);
        this.line(xPos, yPos, pXPos, pYPos);
    }

    sk.drawPath = function (path) {
        this.stroke(path.pColor);
        this.strokeWeight(path.weight);
        for (let i = 1; i < path.pointArray.length; i++) {
            this.line(path.pointArray[i].mouseXPos, path.pointArray[i].mouseYPos, path.pointArray[i - 1].mouseXPos, path.pointArray[i - 1].mouseYPos);
        }
    }

    /**
     * Draw current movie frame image and white background to GUI in video display
     */
    sk.drawVideoFrame = function (vp, curVideoTime) {
        sk.drawVideoImage(vp);
        sk.drawVideoTimeLabel(curVideoTime);
    }

    sk.drawVideoImage = function (vp) {
        this.fill(255);
        this.stroke(255);
        this.rect(this.videoContainer.xPos, this.videoContainer.yPos, this.videoContainer.width, this.videoContainer.height);
        this.image(vp.movieDiv, this.videoContainer.xPos, this.videoContainer.yPos, vp.scaledWidth, vp.scaledHeight);
    }

    sk.drawVideoTimeLabel = function (curVideoTime) {
        this.fill(0);
        this.noStroke();
        const labelSpacing = 30;
        const minutes = Math.floor(curVideoTime / 60);
        const seconds = Math.floor(curVideoTime - minutes * 60);
        const label = minutes + " minutes  " + seconds + " seconds";
        this.text(label, this.videoContainer.xPos + labelSpacing / 2, this.videoContainer.yPos + labelSpacing);
    }

    sk.drawFloorPlan = function (floorPlan) {
        this.fill(255); // draw white screen in case floor plan image has any transparency
        this.stroke(255);
        this.rect(this.floorPlanContainer.xPos, this.floorPlanContainer.yPos, this.floorPlanContainer.width, this.floorPlanContainer.height);
        this.image(floorPlan, this.floorPlanContainer.xPos, this.floorPlanContainer.yPos, this.floorPlanContainer.width, this.floorPlanContainer.height);
    }

    sk.drawLoadDataBackground = function () {
        this.noStroke();
        this.fill(225);
        this.rect(this.floorPlanContainer.xPos, this.floorPlanContainer.yPos, this.floorPlanContainer.width, this.floorPlanContainer.height);
        this.fill(200);
        this.rect(this.videoContainer.xPos, this.videoContainer.yPos, this.videoContainer.width, this.videoContainer.height);
    }

    sk.drawIntroScreen = function () {
        const introKeySpacing = 50; // Integer, general spacing variable
        const introTextSize = this.width / 75;
        this.rectMode(this.CENTER);
        this.stroke(0);
        this.strokeWeight(1);
        this.fill(255, 180);
        this.rect(this.width / 2, this.height / 2, this.width / 2 + introKeySpacing, this.height / 2 + introKeySpacing);
        this.fill(0);
        this.textFont(this.font_Lato, introTextSize);
        this.text(this.infoMsg, this.width / 2, this.height / 2, this.width / 2, this.height / 2);
        this.rectMode(this.CORNER);
    }

    /**
     * NOTE: First, constrain mouse x/y pos to floor plan display container
     * then, subtract floorPlan container from constrained mouse x/y pos to set to 0,0 origin and scale x/y positions to input floor plan width / height 
     */
    sk.getPositioningData = function (floorPlan) {
        const mouseXPos = (this.constrain(this.mouseX, this.floorPlanContainer.xPos, this.floorPlanContainer.xPos + this.floorPlanContainer.width));
        const mouseYPos = (this.constrain(this.mouseY, this.floorPlanContainer.yPos, this.floorPlanContainer.yPos + this.floorPlanContainer.height));
        const pointXPos = (mouseXPos - this.floorPlanContainer.xPos) * (floorPlan.width / this.floorPlanContainer.width);
        const pointYPos = (mouseYPos - this.floorPlanContainer.yPos) * (floorPlan.height / this.floorPlanContainer.height);
        return [mouseXPos, mouseYPos, pointXPos, pointYPos];
    }

    /**
     * While wrapped in a P5 instance, keyPressed and mousePressed P5 methods operate globally on the window (there can't be two of these methods)
     */
    sk.keyPressed = function () {
        sk.mediator.handleKeyPressed(sk.key);
    }

    sk.mousePressed = function () {
        if (sk.overFloorPlan()) sk.mediator.handleMousePressed();
    }

    sk.overRect = function (x, y, boxWidth, boxHeight) {
        return sk.mouseX >= x && sk.mouseX <= x + boxWidth && sk.mouseY >= y && sk.mouseY <= y + boxHeight;
    }

    sk.overFloorPlan = function () {
        return sk.overRect(this.floorPlanContainer.xPos, this.floorPlanContainer.yPos, this.floorPlanContainer.width, this.floorPlanContainer.height);
    }

    sk.writeTable = function (pointArray) {
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
});