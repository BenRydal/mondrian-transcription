class FloorPlan {

    constructor(sketch, fileLocation) {
        this.sk = sketch;
        this.img = this.sk.loadImage(fileLocation, () => {
            this.sk.mediator.newFloorPlanLoaded();
            URL.revokeObjectURL(fileLocation);
            console.log("New Floor Plan Loaded");
        }, e => {
            alert("Error loading floor plan image file. Please make sure it is correctly formatted as a PNG or JPG image file.")
            console.log(e);
        });
    }
}