class Controller {

    constructor(pSketch) {
        this.pSketch = pSketch;
    }

    // TODO: change to ===
    handleKeyPressed() {
        if (this.pSketch.key == 'p' || this.pSketch.key == 'P') {
            this.pSketch.updateData.playPauseRecording();
            if (this.pSketch.core.showInfo) this.handleIntroButton(); // prevent info screen from showing while recording for smooth user interaction
        } else if (this.pSketch.key == 'r' || this.pSketch.key == 'R') this.pSketch.updateData.resetCurRecording();
        else if (this.pSketch.key == 'b' || this.pSketch.key == 'B') this.pSketch.updateData.rewind();
        else if (this.pSketch.key == 'f' || this.pSketch.key == 'F') this.pSketch.updateData.fastForward();
    }

    /**
     * Shows/hides info screen and redraws data if needed
     */
    handleIntroButton() {
        if (this.pSketch.core.showInfo && this.pSketch.core.dataIsLoaded(this.pSketch.floorPlan) && this.pSketch.core.dataIsLoaded(this.pSketch.videoPlayer)) {
            this.pSketch.updateData.drawAllData();
        }
        this.pSketch.core.showInfo = !this.pSketch.core.showInfo;
    }

    handleSaveButton() {
        if (this.pSketch.core.dataIsLoaded(this.pSketch.floorPlan) && this.pSketch.core.dataIsLoaded(this.pSketch.videoPlayer) && this.pSketch.core.curPath.xPos.length > 0) {
            this.pSketch.core.writeFile();
            this.pSketch.updateData.resetAfterWriteFile();
        }
    }

    /**
     * Handles asynchronous loading and error handling of floor plan image file
     * @param  {File} input
     */
    loadFloorPlan(input) {
        let file = input.files[0];
        input.value = ''; // reset input value so you can load same file again in browser
        let fileLocation = URL.createObjectURL(file);
        this.pSketch.loadImage(fileLocation, (img) => {
            URL.revokeObjectURL(img.src);
            this.pSketch.floorPlan = img;
            this.pSketch.updateData.newFloorPlanLoaded();
            console.log("Floor Plan Loaded");
        }, e => {
            alert("Error loading floor plan image file. Please make sure it is correctly formatted as a PNG or JPG image file.")
            console.log(e);
        });
    }

    /**
     * Handles async loading of video file and creates movie object
     * @param  {.MP4 File} input
     */
    loadVideo(input) {
        let file = input.files[0];
        input.value = ''; // reset input value so you can load same file again in browser
        let fileLocation = URL.createObjectURL(file);
        if (this.pSketch.core.dataIsLoaded(this.pSketch.videoPlayer)) this.pSketch.videoPlayer.destroy(); // if a video exists, destroy it
        // TODO: Add this.pSketch as parameter for videoPlayer
        this.pSketch.videoPlayer = new VideoPlayer(fileLocation); // create new videoPlayer
    }
}