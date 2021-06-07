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
        text(INFOMSG, width / 2, height / 2, width / 2, height / 2);
        rectMode(CORNER);
    }
}