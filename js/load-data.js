class LoadData {

  /**
   * Handles asynchronous loading and error handling of floor plan image file
   * @param  {File} input
   */
  loadFloorPlan(input) {
    let file = input.files[0];
    input.value = ''; // reset input value so you can load same file again in browser
    let fileLocation = URL.createObjectURL(file);
    loadImage(fileLocation, (img) => {
      URL.revokeObjectURL(img.src);
      core.floorPlan = img;
      core.inputFloorPlanWidth = core.floorPlan.width; // set values based on pixel size of original img before resizing
      core.inputFloorPlanHeight = core.floorPlan.height;
      core.floorPlanLoaded = true;
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
    if (dataIsLoaded(videoPlayer)) videoPlayer.destroy(); // if a video exists, destroy it
    videoPlayer = new VideoPlayer(fileLocation); // create new videoPlayer
  }
}