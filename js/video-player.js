class VideoPlayer {

    /**
     * @param  {String} fileLocation
     * @param  {P5 Instance} sketch
     */

    constructor(fileLocation, sketch) {
        this.videoJumpValue = 5; // Integer value in seconds to ff or rewind
        this.inputMovieWidth = null; // Original pixel size of video   
        this.inputMovieHeight = null;
        this.reScaledMovieWidth = null; // Rescaled pixel size of video to fit display container
        this.reScaledMovieHeight = null;
        this.movieDiv = sketch.createVideo(fileLocation, () => {
            // ADD VIDEO DURATION TEST HERE? console.log(movieDiv.duration());
            this.movieDiv.id('moviePlayer');
            this.movieDiv.hide();
            this.setInputMovieSize(); // set global movie size constants
            this.setDisplayMovieSize(sketch.videoContainer.width, sketch.videoContainer.height);
            this.movieDiv.onload = () => URL.revokeObjectURL(fileLocation);
            document.getElementById('moviePlayer').onended = () => sketch.mediator.setIsRecording(false); // end program recording when movie ends
            sketch.mediator.newVideoLoaded();
        });
    }

    /**
     * Sets global pixel width/height for movie file to scale size dynamically in program
     * NOTE: get input movie width/height because if you resize video movieDiv width/height are lost/set to 0
     */
    setInputMovieSize() {
        this.inputMovieWidth = this.movieDiv.width;
        this.inputMovieHeight = this.movieDiv.height;
    }

    /**
     * Sets pixel size to display video based on original input video size and container width/height parameters
     * NOTE: temp width/height values are created/used because movie.width and movie.height cause issues
     * @param  {} containerWidth
     * @param  {} containerHeight
     */
    setDisplayMovieSize(containerWidth, containerHeight) {
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
        if (this.reScaledMovieWidth > containerWidth) {
            ratio = containerWidth / this.reScaledMovieWidth; // get ratio for scaling image
            this.reScaledMovieHeight = this.reScaledMovieHeight * ratio; // Reset height to match scaled image
            this.reScaledMovieWidth = this.reScaledMovieWidth * ratio; // Reset width to match scaled image
        }
        this.movieDiv.size(this.reScaledMovieWidth, this.reScaledMovieHeight); // set the element to the new width and height
    }

    stop() {
        this.movieDiv.stop(); // sets movie time to 0
    }

    play() {
        this.movieDiv.play();
    }

    pause() {
        this.movieDiv.pause();
    }

    fastForward() {
        this.movieDiv.time(this.movieDiv.time() + this.videoJumpValue); // ff by videoJumpValue
    }

    /**
     * Rewind movie to parameter rewindToTime or 0 if it is too close to start of video
     * @param  {Float/Number} rewindToTime
     */
    rewind(rewindToTime) {
        if (this.movieDiv.time() > this.videoJumpValue) this.movieDiv.time(rewindToTime);
        else this.movieDiv.time(0);
    }

    destroy() {
        this.movieDiv.remove(); // remove div element
    }
}