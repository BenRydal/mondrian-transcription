// if image: replace floor plan and rerun movement?????
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

// From image file, sets floor plan width/height to display and scale movement data
function processFloorPlan(imgFile) {
  floorPlan = imgFile;
  inputFloorPlanWidth = floorPlan.width; // set values based on pixel size of original img before resizing
  inputFloorPlanHeight = floorPlan.height;
  floorPlanLoaded = true;
}

// parses inputted video files from user computer
function handleVideoFile(input) {
  let file = input.files[0];
  input.value = ''; // reset input value so you can load same file again in browser
  let fileLocation = URL.createObjectURL(file);
  noLoop();
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
    loop();
  });
}

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