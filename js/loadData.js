function loadFonts() {
  font_PlayfairReg = loadFont("data/fonts/PlayfairDisplay-Regular.ttf");
  font_PlayfairItalic = loadFont("data/fonts/PlayfairDisplay-Italic.ttf");
  font_PlayfairBold = loadFont("data/fonts/PlayfairDisplay-Bold.ttf");
  font_Lato = loadFont("data/fonts/Lato-Light.ttf");
}

// if image: replace floor plan and rerun movement?????
function handleFloorPlanFile(input) {
  let file = input.files[0];
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
  let fileLocation = URL.createObjectURL(file);
  if (movie !== undefined) movie.remove(); // remove exisiting movie element if not first video loaded
  movie = createVideo(fileLocation, function () {
    movie.id('moviePlayer');
    movie.size(displayVideoWidth, displayVideoHeight);
    movie.hide();
    // Native P5 onended and duration methods don't seem to work, so use below 
    let mov = document.getElementById('moviePlayer');
    mov.onended = function () {
      recording = false;
    };
    movie.onload = function () {
      URL.revokeObjectURL(this.src);
    }
    //loop(); // restart program loop (for other video platforms this is done in videoPlayer)
    movieLoaded = true;
  });
}