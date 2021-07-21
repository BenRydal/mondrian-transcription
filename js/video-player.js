class VideoPlayer {

    /**
     * @param  {String} fileLocation
     * @param  {P5 Instance} sketch
     */

    constructor(fileLocation, sketch) {
        this.scaledWidth = null; // Rescaled pixel size of video to fit display container
        this.scaledHeight = null;
        this.movieDiv = sketch.createVideo(fileLocation, () => {
            this.movieDiv.id('moviePlayer');
            this.movieDiv.hide();
            this.setDisplayMovieSize(sketch.videoContainer.width, sketch.videoContainer.height);
            this.movieDiv.onload = () => URL.revokeObjectURL(fileLocation);
            document.getElementById('moviePlayer').onended = () => sketch.mediator.isRecording = false; // end program recording when movie ends
            sketch.mediator.newVideoLoaded();
        });
    }

    /**
     * Sets pixel size to display video based on original input video size and container width/height parameters
     * NOTE: temp width/height values are created/used because movie.width and movie.height cause issues
     * @param  {} containerWidth
     * @param  {} containerHeight
     */
    setDisplayMovieSize(containerWidth, containerHeight) {
        let ratio = 0; // Used for aspect ratio
        this.scaledWidth = this.movieDiv.width; // set to equal input size in case first conditional is not triggered
        this.scaledHeight = this.movieDiv.height;
        // Check if input video pixel height is larger than display container, scale down if it is
        if (this.movieDiv.height > containerHeight) {
            ratio = containerHeight / this.movieDiv.height; // get ratio for scaling image, use tempHeight
            this.scaledHeight = this.movieDiv.height * ratio; // Reset height to match scaled image
            this.scaledWidth = this.movieDiv.width * ratio; // Reset width to match scaled image
        }
        // Then check if input/display video pixel width is still larger than display container, scale down if it is
        if (this.scaledWidth > containerWidth) {
            ratio = containerWidth / this.scaledWidth; // get ratio for scaling image
            this.scaledHeight = this.scaledHeight * ratio; // Reset height to match scaled image
            this.scaledWidth = this.scaledWidth * ratio; // Reset width to match scaled image
        }
        this.movieDiv.size(this.scaledWidth, this.scaledHeight); // set the element to the new width and height
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

    /**
     * @param  {Float/Number} jumpInSeconds
     */
    fastForward(jumpInSeconds) {
        const curTime = this.movieDiv.time();
        this.movieDiv.time(curTime + jumpInSeconds);
    }

    /**
     * @param  {Float/Number} rewindToTime
     */
    rewind(rewindToTime) {
        this.movieDiv.time(rewindToTime);
    }

    destroy() {
        this.movieDiv.remove(); // remove div element
    }

    get curTime() {
        return this.movieDiv.time();
    }

    get duration() {
        return this.movieDiv.duration();
    }
}