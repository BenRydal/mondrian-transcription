/**
 * Controls core.showInfo boolean for showing/hiding info screen
 * NOTE: redraws current screen if data is loaded
 */
function handleIntroButton() {
  if (core.showInfo && core.floorPlanLoaded && core.movieLoaded) {
    updateData.reDrawAllData();
    updateData.updatePath.drawPath(core.curPath, CURPATHCOLOR); // TO DO: combine functions??
  }
  core.showInfo = !core.showInfo;
}

/**
 * If floor plan and video are loaded and if core.curPath has data method sends current path to be saved to output file
 */
function handleSaveFileButton() {
  if (core.floorPlanLoaded && core.movieLoaded && core.curPath.xPos.length > 0) updateData.writeFile();
}

/**
 * Handles async loading of floor plan image file
 * @param  {File} input
 */
function handleFloorPlanFile(input) {
  let file = input.files[0];
  input.value = ''; // reset input value so you can load same file again in browser
  let fileLocation = URL.createObjectURL(file);
  loadImage(fileLocation, img => {
    processFloorPlan(img);
    img.onload = function () {
      URL.revokeObjectURL(this.src);
    }
  }, e => {
    alert("Error loading floor plan image file. Please make sure it is correctly formatted as a PNG or JPG image file.")
    console.log(e);
  });
}

/**
 * Sets floor plan image width/height to loaded image. 
 * Note: All data recording that occurs after is scaled to the width/height of floor plan image
 * @param  {PNG or JPG PImage} img
 */
function processFloorPlan(img) {
  core.floorPlan = img;
  core.inputFloorPlanWidth = core.floorPlan.width; // set values based on pixel size of original img before resizing
  core.inputFloorPlanHeight = core.floorPlan.height;
  core.floorPlanLoaded = true;
}

/**
 * Handles async loading of video file and creates movie object
 * @param  {.MP4 File} input
 */
function handleVideoFile(input) {
  let file = input.files[0];
  input.value = ''; // reset input value so you can load same file again in browser
  let fileLocation = URL.createObjectURL(file);
  if (dataIsLoaded(videoPlayer)) videoPlayer.destroy(); // if a video exisits, destroy it
  videoPlayer = new VideoPlayer(fileLocation); // create new videoPlayer
}