class Controller {

    constructor(mediator) {
        this.mediator = mediator;
    }

    handleIntroButton() {
        this.mediator.updateIntro();
    }

    handleSaveButton() {
        this.mediator.writeFile();
    }

    /**
     * Handles asynchronous loading and error handling of floor plan image file
     * @param  {PNG/JPG File} input
     */
    handleFloorPlanButton(input) {
        let file = input.files[0];
        input.value = ''; // reset input value so you can load same file again in browser
        let fileLocation = URL.createObjectURL(file);
        this.mediator.loadFloorPlan(fileLocation);
    }

    /**
     * Handles async loading of video file and creates movie object
     * @param  {.MP4 File} input
     */
    handleVideoButton(input) {
        let file = input.files[0];
        input.value = ''; // reset input value so you can load same file again in browser
        let fileLocation = URL.createObjectURL(file);
        this.mediator.loadVideo(fileLocation);
    }

    handleResetButton() {
        this.mediator.resetCurRecording();
    }
}