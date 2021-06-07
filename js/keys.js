class Keys {

    constructor() {
        this.font_Lato = loadFont("data/fonts/Lato-Light.ttf");
        this.keySpacing = 50; // Integer, general spacing variable
        this.keyTextSize = width / 75;
        this.displayFloorplanWidth = width / 2;
        this.displayFloorplanHeight = height;
        this.displayFloorplanXpos = width / 2;
        this.displayFloorplanYpos = 0;
        this.displayVideoWidth = width / 2;
        this.displayVideoHeight = height;
        this.displayVideoXpos = 0;
        this.displayVideoYpos = 0;
        this.infoMsg = "MONDRIAN TRANSCRIPTION SOFTWARE\n\nby Ben Rydal Shapiro & contributors\nbuilt with p5.js & JavaScript\n\nHi there! This tool allows you to transcribe fine-grained movement data from video. To get started, use the top buttons to upload a floor plan image file (PNG or JPG) and a video file (MP4). Then, use the key codes below to interact with the video and use your cursor to draw on the floor plan. As you interact with the video and simultaneously draw on the floor plan, positioning data is recorded as a CSV file organized by time in seconds and x/y pixel positions scaled to the pixel size of your floor plan image file. Use the top right button to save this file anytime and then record another movement path. For more information, see: https://www.benrydal.com/software/mondrian-transcription\n\nKEY CODES:  Play/Pause (p), Fast-Forward (f), Rewind (b), Reset (r)";
    }

    /**
     * Draws floor plan, video, and key windows
     */
    drawLoadDataGUI() {
        noStroke();
        fill(225);
        rect(this.displayFloorplanXpos, this.displayFloorplanYpos, this.displayFloorplanWidth, this.displayFloorplanHeight);
        fill(200);
        rect(this.displayVideoXpos, this.displayVideoYpos, this.displayVideoWidth, this.displayVideoHeight);
    }

    drawFloorPlanBackground() {
        fill(255); // draw white screen in case floor plan image has any transparancy
        stroke(255);
        rect(this.displayFloorplanXpos, this.displayFloorplanYpos, this.displayFloorplanWidth, this.displayFloorplanHeight);
        image(floorPlan, this.displayFloorplanXpos, this.displayFloorplanYpos, this.displayFloorplanWidth, this.displayFloorplanHeight);
    }
    /**
     * Draws key text
     */
    drawIntroScreen() {
        rectMode(CENTER);
        stroke(0);
        strokeWeight(1);
        fill(255, 180);
        rect(width / 2, height / 2, width / 2 + this.keySpacing, height / 2 + this.keySpacing);
        fill(0);
        textFont(this.font_Lato, this.keyTextSize);
        text(this.infoMsg, width / 2, height / 2, width / 2, height / 2);
        rectMode(CORNER);
    }
}