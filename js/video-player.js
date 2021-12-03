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
            this.movieDiv.hide(); // hide html5 video element as program use p5 image drawing methods to draw video frames
            [this.scaledWidth, this.scaledHeight] = this.scaleRectToBounds(this.movieDiv, sketch.videoContainer);
            this.movieDiv.onload = () => URL.revokeObjectURL(fileLocation);
            document.getElementById('moviePlayer').onended = () => sketch.mediator.isRecording = false; // end program recording when movie ends
            sketch.mediator.newVideoLoaded();
        });
    }

    /**
     * Fits rectangle into another rectangle's bounds
     * @param rect
     * @param bounds
     * @returns {width: Number, height: Number}
     */
    scaleRectToBounds(rect, bounds) {
        const rectRatio = rect.width / rect.height;
        const boundsRatio = bounds.width / bounds.height;
        if (rectRatio > boundsRatio) return [bounds.width, rect.height * (bounds.width / rect.width)]; // Fit to width if rect is more landscape than bounds
        else return [rect.width * (bounds.height / rect.height), bounds.height]; // Fit to height if rect is more portrait than bounds
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