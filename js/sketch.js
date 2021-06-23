class Sketch {

    constructor() {
        this.recording = false; // Boolean to indicate when recording
        this.showInfo = true; // Boolean to show/hide intro message
        this.infoMsg = "MONDRIAN TRANSCRIPTION SOFTWARE\n\nby Ben Rydal Shapiro & contributors\nbuilt with p5.js & JavaScript\n\nHi there! This tool allows you to transcribe fine-grained movement data from video. To get started, use the top buttons to upload a floor plan image file (PNG or JPG) and a video file (MP4). Then, use the key codes below to interact with the video and use your cursor to draw on the floor plan. As you interact with the video and simultaneously draw on the floor plan, positioning data is recorded as a CSV file organized by time in seconds and x/y pixel positions scaled to the pixel size of your floor plan image file. Use the top right button to save this file anytime and then record another movement path. For more information, see: https://www.benrydal.com/software/this.pSketch-transcription\n\nKEY CODES:  Play/Pause (p), Fast-Forward (f), Rewind (b), Reset (r)";
        this.mediator = null;
        this.font_Lato = null;;
        this.displayFloorplanWidth = null;
        this.displayFloorplanHeight = null;
        this.displayFloorplanXpos = null;
        this.displayFloorplanYpos = null;
        this.displayVideoWidth = null;
        this.displayVideoHeight = null;
        this.displayVideoXpos = null;
        this.displayVideoYpos = null;
        this.mondrian = this.initializeSketch(); // creates drawing surface and keys

    }

    initializeSketch() {
        return new p5((sketch) => {

            sketch.setup = function () {
                sketch.canvas = sketch.createCanvas(window.innerWidth, window.innerHeight);
                this.mediator = new Mediator(sketch, new Path(), null, null);
                this.font_Lato = sketch.loadFont("data/fonts/Lato-Light.ttf");
                this.displayFloorplanWidth = sketch.width / 2;
                this.displayFloorplanHeight = sketch.height;
                this.displayFloorplanXpos = sketch.width / 2;
                this.displayFloorplanYpos = 0;
                this.displayVideoWidth = sketch.width / 2;
                this.displayVideoHeight = sketch.height;
                this.displayVideoXpos = 0;
                this.displayVideoYpos = 0;
            }

            /**
             * Program loop organizes two drawing modes for when data is and is not loaded
             */
            sketch.draw = function () {
                sketch.drawIntroScreen();
                if (sketch.mediator.floorPlanLoaded() && sketch.mediator.videoLoaded()) {
                    if (this.recording) this.mediator.updateRecording(); // records data and updates visualization if in record mode
                    // If info screen showing, redraw current screen first, then drawKeys
                    if (this.showInfo) {
                        this.mediator.updateAllData();
                        this.drawIntroScreen();
                    }
                } else {
                    sketch.drawLoadDataGUI();
                    if (sketch.mediator.floorPlanLoaded()) this.mediator.updateFloorPlan();
                    else if (sketch.mediator.videoLoaded()) this.mediator.updateVideoFrame();
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
                const introTextSize = sketch.width / 75;
                this.rectMode(this.CENTER);
                this.stroke(0);
                this.strokeWeight(1);
                this.fill(255, 180);
                this.rect(this.width / 2, this.height / 2, this.width / 2 + introKeySpacing, this.height / 2 + introKeySpacing);
                this.fill(0);
                this.textFont(this.font_Lato, introTextSize);
                console.log(app.sketch.infoMsg);
                this.text(app.sketch.infoMsg, this.width / 2, this.height / 2, this.width / 2, this.height / 2);
                this.rectMode(this.CORNER);
            }

            /**
             * While wrapped in a P5 instance, this P5 method operates globally on the window (there can't be two of these methods)
            TODO: move to controller? 
            */
            sketch.keyPressed = function () {
                if (this.core.dataIsLoaded(this.floorPlan) && this.core.dataIsLoaded(this.videoPlayer)) app.handleKeyPressed();
            }
        });
    }
}