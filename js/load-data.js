/**
 * Controls showInfo boolean for showing/hiding info screen
 * NOTE: redraws current screen if data is loaded
 */
function handleIntroButton() {
  if (showInfo && floorPlanLoaded && movieLoaded) {
    dataUpdate.reDrawAllData();
    dataUpdate.updatePath.drawPath(curPath, curPathColor); // TO DO: combine functions??
  }
  showInfo = !showInfo;
}

/**
 * If floor plan and video are loaded and if curPath has data method sends current path to be saved to output file
 */
function handleSaveFileButton() {
  if (floorPlanLoaded && movieLoaded && curPath.xPos.length > 0) dataUpdate.writeFile();
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
  floorPlan = img;
  inputFloorPlanWidth = floorPlan.width; // set values based on pixel size of original img before resizing
  inputFloorPlanHeight = floorPlan.height;
  floorPlanLoaded = true;
}

/**
 * Handles async loading of video file and creates movie object
 * @param  {.MP4 File} input
 */
function handleVideoFile(input) {
  let file = input.files[0];
  input.value = ''; // reset input value so you can load same file again in browser
  let fileLocation = URL.createObjectURL(file);
  noLoop(); // resumed after video has been loaded
  if (movie !== undefined) movie.remove(); // remove exisiting movie element if not first video loaded
  movie = createVideo(fileLocation, setMovie);
}

/**
 * Sets movie object and resumes program loop
 */
function setMovie() {
  movie.id('moviePlayer');
  setInputMovieSize(); // set global movie size constants
  setDisplayMovieSize(displayVideoWidth, displayVideoHeight);
  movie.hide();
  movie.stop(); // necessary to be able to draw starting frame before playing the video
  movie.onload = function () {
    URL.revokeObjectURL(this.src);
  }
  // Native P5 onended and duration methods don't seem to work, so use below 
  let mov = document.getElementById('moviePlayer');
  // When movie ends, set recording false
  mov.onended = function () {
    recording = false;
  };
  movieLoaded = true;
  dataUpdate.updateMovie.drawCurFrame(); // after loading video and restarting loop, draw starting frame to indicate movie is loaded
  loop(); // resume
}

/**
 * Sets global pixel width/height for movie file to scale size dynamically in program
 */
function setInputMovieSize() {
  inputMovieWidth = movie.width;
  inputMovieHeight = movie.height;
}

/**
 * Sets pixel size to display video based on original input video size and container width/height parameters
 * NOTE: temp width/height values are created/used because movie.width and movie.height cause issues
 * @param  {} containterWidth
 * @param  {} containerHeight
 */
function setDisplayMovieSize(containterWidth, containerHeight) {
  let ratio = 0; // Used for aspect ratio
  reScaledMovieWidth = inputMovieWidth; // set to equal input size in case first conditional is not triggered
  reScaledMovieHeight = inputMovieHeight;
  // Check if input video pixel height is larger than display container, scale down if it is
  if (inputMovieHeight > containerHeight) {
    ratio = containerHeight / inputMovieHeight; // get ratio for scaling image, use tempHeight
    reScaledMovieHeight = inputMovieHeight * ratio; // Reset height to match scaled image
    reScaledMovieWidth = inputMovieWidth * ratio; // Reset width to match scaled image
  }
  // Then check if input/display video pixel width is still larger than display container, scale down if it is
  if (reScaledMovieWidth > containterWidth) {
    ratio = containterWidth / reScaledMovieWidth; // get ratio for scaling image
    reScaledMovieHeight = reScaledMovieHeight * ratio; // Reset height to match scaled image
    reScaledMovieWidth = reScaledMovieWidth * ratio; // Reset width to match scaled image
  }
  movie.size(reScaledMovieWidth, reScaledMovieHeight); // set the element to the new width and height
}