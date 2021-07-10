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

    sk.setup = function () {
        sk.canvas = sk.createCanvas(window.innerWidth, window.innerHeight);
        sk.font_Lato = sk.loadFont("data/fonts/Lato-Light.ttf");
        sk.infoMsg = "MONDRIAN TRANSCRIPTION SOFTWARE\n\nby Ben Rydal Shapiro & contributors\nbuilt with p5.js & JavaScript\n\nHi there! This tool allows you to transcribe fine-grained movement data from video. To get started, use the top buttons to upload a floor plan image file (PNG or JPG) and a video file (MP4). Then, click anywhere on the floorplan to start recording movement data synchronized to the video—as you use your cursor to draw on the floor plan, positioning data is recorded as a CSV file organized by time in seconds and x/y pixel positions scaled to the pixel size of your floor plan image file. Play/pause recording by clicking on the floorplan. On your keyboard press ‘f’ to fast forward and ‘r’ to rewind the video and data recording in 5 second intervals. Use the top buttons to clear your current recording and restart the video or save your recording and record another movement path. For more information, see: https://www.benrydal.com/software/mondrian-transcription";
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
        if (sk.mediator.allDataLoaded()) {
            if (sk.mediator.getIsRecording()) sk.mediator.updateRecording(); // records data and updates visualization if in record mode
            // If info screen showing, redraw current screen first, then drawKeys
            if (sk.mediator.getIsInfoShowing()) {
                sk.mediator.updateAllData();
                sk.drawIntroScreen();
            }
        } else {
            sk.drawLoadDataGUI();
            if (sk.mediator.floorPlanLoaded()) sk.mediator.updateFloorPlan();
            else if (sk.mediator.videoLoaded()) sk.mediator.updateVideoFrame();
            if (sk.mediator.getIsInfoShowing()) sk.drawIntroScreen();
        }
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

    sk.drawAllPaths = function (pathsList, curPath) {
        for (const path of pathsList) this.drawPath(path);
        this.drawPath(curPath); // draw current path last
    }

    sk.drawPath = function (p) {
        this.stroke(p.pColor);
        this.strokeWeight(p.weight);
        for (let i = 1; i < p.xPos.length; i++) {
            this.line(this.scaleXposToDisplay(p.xPos[i]), this.scaleYposToDisplay(p.yPos[i]), this.scaleXposToDisplay(p.xPos[i - 1]), this.scaleYposToDisplay(p.yPos[i - 1]));
        }
    }

    sk.scaleXposToDisplay = function (xPos) {
        return this.floorPlanContainer.xPos + (xPos / (sk.mediator.getFloorPlanWidth() / this.floorPlanContainer.width));
    }

    sk.scaleYposToDisplay = function (yPos) {
        return this.floorPlanContainer.yPos + (yPos / (sk.mediator.getFloorPlanHeight() / this.floorPlanContainer.height));
    }

    /**
     * Draw current movie frame image and white background to GUI in video display
     */
    sk.drawVideoFrame = function (vp) {
        this.fill(255);
        this.stroke(255);
        this.rect(this.videoContainer.xPos, this.videoContainer.yPos, this.videoContainer.width, this.videoContainer.height);
        this.image(vp.movieDiv, this.videoContainer.xPos, this.videoContainer.yPos, vp.reScaledMovieWidth, vp.reScaledMovieHeight);
    }

    sk.drawFloorPlan = function (floorPlan) {
        this.fill(255); // draw white screen in case floor plan image has any transparency
        this.stroke(255);
        this.rect(this.floorPlanContainer.xPos, this.floorPlanContainer.yPos, this.floorPlanContainer.width, this.floorPlanContainer.height);
        this.image(floorPlan, this.floorPlanContainer.xPos, this.floorPlanContainer.yPos, this.floorPlanContainer.width, this.floorPlanContainer.height);
    }

    /**
     * Draws floor plan, video, and key windows
     */
    sk.drawLoadDataGUI = function () {
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
     * Returns scaled mouse x/y position to input floorPlan image file
     */
    sk.getScaledMousePos = function (floorPlan) {
        // Constrain mouse to floor plan display and subtract floorPlan display x/y positions to set data to 0, 0 origin/coordinate system
        const x = (this.constrain(this.mouseX, this.floorPlanContainer.xPos, this.floorPlanContainer.xPos + this.floorPlanContainer.width)) - this.floorPlanContainer.xPos;
        const y = (this.constrain(this.mouseY, this.floorPlanContainer.yPos, this.floorPlanContainer.yPos + this.floorPlanContainer.height)) - this.floorPlanContainer.yPos;
        // Scale x,y positions to input floor plan width/height
        const xPos = +(x * (floorPlan.width / this.floorPlanContainer.width)).toFixed(2);
        const yPos = +(y * (floorPlan.height / this.floorPlanContainer.height)).toFixed(2);
        return [xPos, yPos];
    }

    /**
     * While wrapped in a P5 instance, this P5 method operates globally on the window (there can't be two of these methods)
     */
    sk.keyPressed = function () {
        if (sk.mediator.allDataLoaded()) {
            if (sk.key === 'r' || sk.key === 'R') sk.mediator.rewind();
            else if (sk.key === 'f' || sk.key === 'F') sk.mediator.fastForward();
        }
    }

    sk.mousePressed = function () {
        if (sk.mediator.allDataLoaded() && sk.overRect(this.floorPlanContainer.xPos, this.floorPlanContainer.yPos, this.floorPlanContainer.width, this.floorPlanContainer.height)) {
            sk.mediator.playPauseRecording();
            if (sk.mediator.getIsInfoShowing()) sk.mediator.updateIntro(); // prevent info screen from showing while recording for smooth user interaction
        }
    }

    sk.overRect = function (x, y, boxWidth, boxHeight) {
        return sk.mouseX >= x && sk.mouseX <= x + boxWidth && sk.mouseY >= y && sk.mouseY <= y + boxHeight;
    }
});