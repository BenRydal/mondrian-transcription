class Controller {

    constructor(sketch) {
        this.sketch = sketch;
    }

    /**
     * Shows/hides info screen and redraws data if needed
     */
    handleIntroButton() {
        console.log(this.sketch.mondrian.showInfo);
        if (this.sketch.mondrian.showInfo && this.sketch.mondrian.mediator.floorPlanLoaded() && this.sketch.mondrian.mediator.videoLoaded()) {
            this.sketch.mondrian.mediator.updateAllData();
        }
        this.sketch.mondrian.showInfo = !this.sketch.mondrian.showInfo;
    }

    handleSaveButton() {
        this.sketch.mondrian.mediator.writeFile();
    }

    /**
     * Handles asynchronous loading and error handling of floor plan image file
     * @param  {File} input
     */
    loadFloorPlan(input) {
        let file = input.files[0];
        input.value = ''; // reset input value so you can load same file again in browser
        let fileLocation = URL.createObjectURL(file);
        this.sketch.mondrian.loadImage(fileLocation, (img) => {
            URL.revokeObjectURL(img.src);
            this.sketch.mondrian.mediator.newFloorPlanLoaded(img);
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
        this.sketch.mondrian.mediator.createVideoOnLoad(fileLocation);
    }
}