class Sketch {

    constructor() {
        this.mondrian = this.initializeSketch(); // creates drawing surface and keys
    }

    initializeSketch() {
        return new p5((sketch) => {

            sketch.setup = function () {
                sketch.canvas = sketch.createCanvas(window.innerWidth, window.innerHeight);
                sketch.mediator = new Mediator(sketch, new Path(), null, null);
                sketch.font_Lato = sketch.loadFont("data/fonts/Lato-Light.ttf");
                sketch.displayFloorplanWidth = sketch.width / 2;
                sketch.displayFloorplanHeight = sketch.height;
                sketch.displayFloorplanXpos = sketch.width / 2;
                sketch.displayFloorplanYpos = 0;
                sketch.displayVideoWidth = sketch.width / 2;
                sketch.displayVideoHeight = sketch.height;
                sketch.displayVideoXpos = 0;
                sketch.displayVideoYpos = 0;
                sketch.recording = false; // Boolean to indicate when recording
                sketch.showInfo = true; // Boolean to show/hide intro message
                sketch.infoMsg = "MONDRIAN TRANSCRIPTION SOFTWARE\n\nby Ben Rydal Shapiro & contributors\nbuilt with p5.js & JavaScript\n\nHi there! This tool allows you to transcribe fine-grained movement data from video. To get started, use the top buttons to upload a floor plan image file (PNG or JPG) and a video file (MP4). Then, use the key codes below to interact with the video and use your cursor to draw on the floor plan. As you interact with the video and simultaneously draw on the floor plan, positioning data is recorded as a CSV file organized by time in seconds and x/y pixel positions scaled to the pixel size of your floor plan image file. Use the top right button to save this file anytime and then record another movement path. For more information, see: https://www.benrydal.com/software/this.pSketch-transcription\n\nKEY CODES:  Play/Pause (p), Fast-Forward (f), Rewind (b), Reset (r)";
            }

            /**
             * Program loop organizes two drawing modes for when data is and is not loaded
             */
            sketch.draw = function () {
                if (sketch.mediator.floorPlanLoaded() && sketch.mediator.videoLoaded()) {
                    if (sketch.recording) sketch.mediator.updateRecording(); // records data and updates visualization if in record mode
                    // If info screen showing, redraw current screen first, then drawKeys
                    if (sketch.showInfo) {
                        sketch.mediator.updateAllData();
                        sketch.drawIntroScreen();
                    }
                } else {
                    sketch.drawLoadDataGUI();
                    if (sketch.mediator.floorPlanLoaded()) sketch.mediator.updateFloorPlan();
                    else if (sketch.mediator.videoLoaded()) sketch.mediator.updateVideoFrame();
                    if (sketch.showInfo) sketch.drawIntroScreen();
                }
            }

            // TODO: consider moving pathWeight into constructing paths
            sketch.drawLineSegment = function (weight, pathColor) {
                // Constrain mouse to floor plan display
                const xPos = this.constrain(this.mouseX, this.displayFloorplanXpos, this.displayFloorplanXpos + this.displayFloorplanWidth);
                const yPos = this.constrain(this.mouseY, this.displayFloorplanYpos, this.displayFloorplanYpos + this.displayFloorplanHeight);
                const pXPos = this.constrain(this.pmouseX, this.displayFloorplanXpos, this.displayFloorplanXpos + this.displayFloorplanWidth);
                const pYPos = this.constrain(this.pmouseY, this.displayFloorplanYpos, this.displayFloorplanYpos + this.displayFloorplanHeight);
                this.strokeWeight(weight);
                this.stroke(pathColor);
                this.line(xPos, yPos, pXPos, pYPos);
            }

            sketch.drawAllPaths = function (pathsList, curPath) {
                for (let i = 0; i < pathsList.length; i++) this.drawPath(pathsList[i]);
                this.drawPath(curPath); // draw current path last
            }

            sketch.drawPath = function (p) {
                this.stroke(p.pColor);
                // TODO: add pathweight to path TEMP!!!
                //this.strokeWeight(core.pathWeight);
                this.strokeWeight(10);
                for (let i = 1; i < p.xPos.length; i++) {
                    this.line(this.mediator.convertXposToDisplay(p.xPos[i]), this.mediator.convertYposToDisplay(p.yPos[i]), this.mediator.convertXposToDisplay(p.xPos[i - 1]), this.mediator.convertYposToDisplay(p.yPos[i - 1]));
                }
            }

            /**
             * Draw current movie frame image and white background to GUI in video display
             */
            sketch.drawVideoFrame = function (vp) {
                this.fill(255);
                this.stroke(255);
                this.rect(this.displayVideoXpos, this.displayVideoYpos, this.displayVideoWidth, this.displayVideoHeight);
                this.image(vp.movieDiv, this.displayVideoXpos, this.displayVideoYpos, vp.reScaledMovieWidth, vp.reScaledMovieHeight);
            }

            sketch.drawFloorPlan = function (floorPlan) {
                this.fill(255); // draw white screen in case floor plan image has any transparency
                this.stroke(255);
                this.rect(this.displayFloorplanXpos, this.displayFloorplanYpos, this.displayFloorplanWidth, this.displayFloorplanHeight);
                this.image(floorPlan, this.displayFloorplanXpos, this.displayFloorplanYpos, this.displayFloorplanWidth, this.displayFloorplanHeight);
            }

            /**
             * Draws floor plan, video, and key windows
             */
            sketch.drawLoadDataGUI = function () {
                this.noStroke();
                this.fill(225);
                this.rect(this.displayFloorplanXpos, this.displayFloorplanYpos, this.displayFloorplanWidth, this.displayFloorplanHeight);
                this.fill(200);
                this.rect(this.displayVideoXpos, this.displayVideoYpos, this.displayVideoWidth, this.displayVideoHeight);
            }

            sketch.drawIntroScreen = function () {
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
             * While wrapped in a P5 instance, this P5 method operates globally on the window (there can't be two of these methods)
             */
            sketch.keyPressed = function () {
                if (sketch.mediator.floorPlanLoaded() && sketch.mediator.videoLoaded()) {
                    // TODO: change to ===
                    if (sketch.key == 'p' || sketch.key == 'P') {
                        sketch.mediator.playPauseRecording();
                        if (sketch.showInfo) app.handleIntroButton(); // prevent info screen from showing while recording for smooth user interaction
                    } else if (sketch.key == 'r' || sketch.key == 'R') sketch.mediator.resetCurRecording();
                    else if (sketch.key == 'b' || sketch.key == 'B') sketch.mediator.rewind();
                    else if (sketch.key == 'f' || sketch.key == 'F') sketch.mediator.fastForward();
                }
            }
        });
    }
}