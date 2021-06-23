class Sketch {

    constructor() {
        this.mondrian = this.initializeSketch(); // creates drawing surface and keys
    }

    /*
Could move updatePath to "core" and updateVideo to VideoPlayer
Then... updateData mediates between core (path data) and videoPlayer (video data) 
both of which depend on the P5 sketch
videoPlayer and floorPlan in core? 

P5 Sketch (program flow/move core recording stuff here)
    has core vars (videoPlayer object, floorPlan object)
    has keys
    has updateCore (updatePath)
    has updateView (these are like drawing methods)
    has updateVideo (updateMovie)

Update data (has reference to sketch)

*/

    initializeSketch() {
        return new p5((sketch) => {
            sketch.setup = function () {
                sketch.canvas = sketch.createCanvas(window.innerWidth, window.innerHeight);
                this.core = new Core(); // data/misc methods
                this.keys = new Keys(sketch); // UI/containers
                this.updateData = new UpdateData(); // mediator between canvas, data, video
                this.videoPlayer = null;
                this.floorPlan = null;
            }

            /**
             * Program loop organizes two drawing modes for when data is and is not loaded
             */
            sketch.draw = function () {
                if (sketch.core.dataIsLoaded(this.floorPlan) && this.core.dataIsLoaded(this.videoPlayer)) {
                    if (this.core.recording) this.updateData.updateRecording(); // records data and updates visualization if in record mode
                    // If info screen showing, redraw current screen first, then drawKeys
                    if (this.core.showInfo) {
                        this.updateData.drawAllData();
                        this.keys.drawIntroScreen();
                    }
                } else {
                    this.keys.drawLoadDataGUI();
                    if (this.core.dataIsLoaded(this.floorPlan)) this.updateData.drawFloorPlan();
                    else if (this.core.dataIsLoaded(this.videoPlayer)) this.updateData.drawVideoFrame();
                    if (this.core.showInfo) this.keys.drawIntroScreen();
                }
            }

            /**
             * While wrapped in a P5 instance, this P5 method operates globally on the window (there can't be two of these methods)
             */
            sketch.keyPressed = function () {
                if (this.core.dataIsLoaded(this.floorPlan) && this.core.dataIsLoaded(this.videoPlayer)) app.handleKeyPressed();
            }
        });
    }
}