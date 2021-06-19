class Keys {

    constructor() {
        this.font_Lato = mondrian.loadFont("data/fonts/Lato-Light.ttf");
        this.keySpacing = 50; // Integer, general spacing variable
        this.keyTextSize = mondrian.width / 75;
        this.displayFloorplanWidth = mondrian.width / 2;
        this.displayFloorplanHeight = mondrian.height;
        this.displayFloorplanXpos = mondrian.width / 2;
        this.displayFloorplanYpos = 0;
        this.displayVideoWidth = mondrian.width / 2;
        this.displayVideoHeight = mondrian.height;
        this.displayVideoXpos = 0;
        this.displayVideoYpos = 0;
        this.infoMsg = "MONDRIAN TRANSCRIPTION SOFTWARE\n\nby Ben Rydal Shapiro & contributors\nbuilt with p5.js & JavaScript\n\nHi there! This tool allows you to transcribe fine-grained movement data from video. To get started, use the top buttons to upload a floor plan image file (PNG or JPG) and a video file (MP4). Then, use the key codes below to interact with the video and use your cursor to draw on the floor plan. As you interact with the video and simultaneously draw on the floor plan, positioning data is recorded as a CSV file organized by time in seconds and x/y pixel positions scaled to the pixel size of your floor plan image file. Use the top right button to save this file anytime and then record another movement path. For more information, see: https://www.benrydal.com/software/mondrian-transcription\n\nKEY CODES:  Play/Pause (p), Fast-Forward (f), Rewind (b), Reset (r)";
    }

    /**
     * Draws floor plan, video, and key windows
     */
    drawLoadDataGUI() {
        mondrian.noStroke();
        mondrian.fill(225);
        mondrian.rect(this.displayFloorplanXpos, this.displayFloorplanYpos, this.displayFloorplanWidth, this.displayFloorplanHeight);
        mondrian.fill(200);
        mondrian.rect(this.displayVideoXpos, this.displayVideoYpos, this.displayVideoWidth, this.displayVideoHeight);
    }

    drawIntroScreen() {
        mondrian.rectMode(mondrian.CENTER);
        mondrian.stroke(0);
        mondrian.strokeWeight(1);
        mondrian.fill(255, 180);
        mondrian.rect(mondrian.width / 2, mondrian.height / 2, mondrian.width / 2 + this.keySpacing, mondrian.height / 2 + this.keySpacing);
        mondrian.fill(0);
        mondrian.textFont(this.font_Lato, this.keyTextSize);
        mondrian.text(this.infoMsg, mondrian.width / 2, mondrian.height / 2, mondrian.width / 2, mondrian.height / 2);
        mondrian.rectMode(mondrian.CORNER);
    }
}