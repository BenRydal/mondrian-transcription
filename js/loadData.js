// if image: replace floor plan and rerun movement?????
function handleFloorPlanFile(input) {
  let file = input.files[0];
  let fileLocation = URL.createObjectURL(file);
  loadImage(fileLocation, img => {
    processFloorPlan(img);
    //   img.onload = function () {
    //     URL.revokeObjectURL(this.src);
    //   }
  });
}

// From image file, sets floor plan width/height to display and scale movement data
function processFloorPlan(fileName) {
  floorPlan = fileName;
  inputFloorPlanWidth = floorPlan.width; // set values based on pixel size of original img before resizing
  inputFloorPlanHeight = floorPlan.height;
  floorPlanLoaded = true;
}

// parses inputted video files from user computer
function handleVideoFile(input) {
  let file = input.files[0];
  let fileLocation = URL.createObjectURL(file);
  print(movie);
  if (movie !== undefined) movie.remove(); // remove exisiting movie element if not first video loaded
  movie = createVideo(fileLocation, setVideo);
  // movie.onload = function () {
  //   URL.revokeObjectURL(this.src);
  // }
}

// Creates movie element specific to videoPlatform and params
function setVideo() {
  movie.size(windowVideoWidth, windowVideoHeight);
  movie.id('moviePlayer');
  movie.hide();
  // Native P5 onended and duration methods don't seem to work, so use below 
  var mov = document.getElementById('moviePlayer');
  mov.onended = function () {
    dataUpdate.writeFile(); // write file when ended
    recording = false;
  };
  movieLoaded = true;
}

// // parses inputted video files from user computer
// function handleVideoFile(input) {
//   let file = input.files[0];
//   processVideo(URL.createObjectURL(file));
//   // revoke url
// }

// // Creates movie element specific to videoPlatform and params
// function processVideo(fileLocation) {
//   movie = createVideo(fileLocation);
//   // movie.id('moviePlayer');
//   // movie.style('display', 'none');
//   //setupMovie('moviePlayer', videoPlatform, videoParams); // set up the video player
//   //let video = select('#moviePlayer').position(100, 0); // position video in upper left corner on timeline
//   //movie.position(windowVideoWidth, 0);
//   movie.size(windowVideoWidth, windowVideoHeight);
//   movie.onended(stopRecording);
//   movieLoaded = true;
// }