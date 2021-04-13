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
  });
}

/**
 * Sets floor plan image width/height to loaded image. 
 * Note: All data recording that occurs after is scaled to the width/height of floor plan image
 * @param  {PNG or JPG PImage} img
 */
function processFloorPlan(img) {
  floorPlan = img;
  inputFloorPlanWidth = floorPlan.width; // set values based on pixel size of original img before resizing
  inputFloorPlanHeight = floorPlan.height;
  floorPlanLoaded = true;
}

/**
 * Handles async loading of video file and creates/updates movie object with video file
 * @param  {.MP4 File} input
 */
function handleVideoFile(input) {
  let file = input.files[0];
  input.value = ''; // reset input value so you can load same file again in browser
  let fileLocation = URL.createObjectURL(file);
  noLoop(); // resumed after video has been loaded
  if (movie !== undefined) movie.remove(); // remove exisiting movie element if not first video loaded
  movie = createVideo(fileLocation, function () {
    movie.id('moviePlayer');
    setMovieSize();
    movie.size(movie.width, movie.height);
    movie.hide();
    // Native P5 onended and duration methods don't seem to work, so use below 
    let mov = document.getElementById('moviePlayer');
    mov.onended = function () {
      recording = false;
    };
    movie.onload = function () {
      URL.revokeObjectURL(this.src);
    }
    movieLoaded = true;
    loop(); // resume
  });
}
/**
 * Sets movie width/height pixel dimenions proportionally to scale to GUI
 */
function setMovieSize() {
  let ratio = 0; // Used for aspect ratio
  // Check if input video pixel width is larger than display container, scale down if it is
  if (movie.width > displayVideoWidth) {
    ratio = displayVideoWidth / movie.width; // get ratio for scaling image
    movie.height = movie.height * ratio; // Reset height to match scaled image
    movie.width = movie.width * ratio; // Reset width to match scaled image
  }
  // Then check if input video pixel height is still larger than display container, scale down if it is
  if (movie.height > displayVideoHeight) {
    ratio = displayVideoHeight / movie.height; // get ratio for scaling image
    movie.height = movie.height * ratio; // Reset height to match scaled image
    movie.width = movie.width * ratio; // Reset width to match scaled image
  }
}