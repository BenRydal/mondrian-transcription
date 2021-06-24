class Controller {

    constructor(sketch) {
        this.sketch = sketch;
    }

    handleIntroButton() {
        this.sketch.mondrian.mediator.updateIntro();
    }

    handleSaveButton() {
        this.sketch.mondrian.mediator.writeFile();
    }

    /**
     * Handles asynchronous loading and error handling of floor plan image file
     * @param  {PNG/JPG File} input
     */
    handleFloorPlanButton(input) {
        let file = input.files[0];
        input.value = ''; // reset input value so you can load same file again in browser
        let fileLocation = URL.createObjectURL(file);
        this.sketch.mondrian.mediator.loadFloorPlan(fileLocation);
    }

    /**
     * Handles async loading of video file and creates movie object
     * @param  {.MP4 File} input
     */
    handleVideoButton(input) {
        let file = input.files[0];
        input.value = ''; // reset input value so you can load same file again in browser
        let fileLocation = URL.createObjectURL(file);
        this.sketch.mondrian.mediator.loadVideo(fileLocation);
    }

    handleResetButton() {
        this.sketch.mondrian.mediator.resetCurRecording();
    }
}