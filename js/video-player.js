class VideoPlayer {

    /**
     * @param  {String} fileLocation
     */
    constructor(fileLocation) {
        this.videoJumpValue = 5; // Integer value in seconds to ff or rewind
        this.inputMovieWidth = undefined;
        this.inputMovieHeight = undefined; // Decimal pixel width/ height of inputted video file
        this.reScaledMovieWidth = undefined; // Decimal scaled width/height of input video file to fit display container
        this.reScaledMovieHeight = undefined;
        this.movieDiv = mondrian.createVideo(fileLocation, () => {
            // ADD VIDEO DURATION TEST HERE? console.log(movieDiv.duration());
            this.movieDiv.id('moviePlayer');
            this.movieDiv.hide();
            // Native P5 onended and duration methods don't seem to work, so use below 
            const mov = document.getElementById('moviePlayer');
            mov.onended = () => core.recording = false;
            videoPlayer.setInputMovieSize(); // set global movie size constants
            videoPlayer.setDisplayMovieSize(keys.displayVideoWidth, keys.displayVideoHeight);
            this.movieDiv.onload = () => URL.revokeObjectURL(this.src);
            updateData.newVideoLoaded();
            console.log("New Video Loaded");
        });
    }

    /**
     * Sets global pixel width/height for movie file to scale size dynamically in program
     */
    setInputMovieSize() {
        this.inputMovieWidth = this.movieDiv.width;
        this.inputMovieHeight = this.movieDiv.height;
    }

    /**
     * Sets pixel size to display video based on original input video size and container width/height parameters
     * NOTE: temp width/height values are created/used because movie.width and movie.height cause issues
     * @param  {} containterWidth
     * @param  {} containerHeight
     */
    setDisplayMovieSize(containterWidth, containerHeight) {
        let ratio = 0; // Used for aspect ratio
        this.reScaledMovieWidth = this.inputMovieWidth; // set to equal input size in case first conditional is not triggered
        this.reScaledMovieHeight = this.inputMovieHeight;
        // Check if input video pixel height is larger than display container, scale down if it is
        if (this.inputMovieHeight > containerHeight) {
            ratio = containerHeight / this.inputMovieHeight; // get ratio for scaling image, use tempHeight
            this.reScaledMovieHeight = this.inputMovieHeight * ratio; // Reset height to match scaled image
            this.reScaledMovieWidth = this.inputMovieWidth * ratio; // Reset width to match scaled image
        }
        // Then check if input/display video pixel width is still larger than display container, scale down if it is
        if (this.reScaledMovieWidth > containterWidth) {
            ratio = containterWidth / this.reScaledMovieWidth; // get ratio for scaling image
            this.reScaledMovieHeight = this.reScaledMovieHeight * ratio; // Reset height to match scaled image
            this.reScaledMovieWidth = this.reScaledMovieWidth * ratio; // Reset width to match scaled image
        }
        this.movieDiv.size(this.reScaledMovieWidth, this.reScaledMovieHeight); // set the element to the new width and height
    }

    destroy() {
        this.movieDiv.remove(); // remove div element
    }
}