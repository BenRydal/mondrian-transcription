class Controller {

    constructor(sketch) {
        this.sketch = sketch;
    }

    // TODO: change to ===
    handleKeyPressed() {
        if (this.sketch.key == 'p' || this.sketch.key == 'P') {
            this.sketch.mediator.playPauseRecording();
            if (this.sketch.showInfo) this.handleIntroButton(); // prevent info screen from showing while recording for smooth user interaction
        } else if (this.sketch.key == 'r' || this.sketch.key == 'R') this.sketch.mediator.resetCurRecording();
        else if (this.sketch.key == 'b' || this.sketch.key == 'B') this.sketch.mediator.rewind();
        else if (this.sketch.key == 'f' || this.sketch.key == 'F') this.sketch.mediator.fastForward();
    }

    /**
     * Shows/hides info screen and redraws data if needed
     */
    handleIntroButton() {
        console.log(app.sketch.showInfo);
        if (this.sketch.showInfo && this.sketch.mediator.floorPlanLoaded() && this.sketch.mediator.videoLoaded()) {
            this.sketch.mediator.updateAllData();
        }
        this.sketch.showInfo = !this.sketch.showInfo;
    }

    handleSaveButton() {
        this.sketch.mediator.writeFile();
    }

    /**
     * Handles asynchronous loading and error handling of floor plan image file
     * @param  {File} input
     */
    loadFloorPlan(input) {
        let file = input.files[0];
        input.value = ''; // reset input value so you can load same file again in browser
        let fileLocation = URL.createObjectURL(file);
        this.sketch.loadImage(fileLocation, (img) => {
            URL.revokeObjectURL(img.src);
            this.sketch.mediator.newFloorPlanLoaded(img);
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
        this.sketch.mediator.createVideoOnLoad(fileLocation);
    }
}