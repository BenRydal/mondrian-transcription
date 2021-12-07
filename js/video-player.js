class VideoPlayer {

    /**
     * @param  {String} fileLocation
     * @param  {P5 Instance} sketch
     */

    constructor(fileLocation, sketch, videoContainer) {
        this.sk = sketch;
        this.scaledWidth = null; // Rescaled pixel size of video to fit display container
        this.scaledHeight = null;
        this.movieDiv = this.sk.createVideo(fileLocation, () => {
            this.movieDiv.id('moviePlayer');
            this.movieDiv.hide(); // hide html5 video element as program use p5 image drawing methods to draw video frames
            [this.scaledWidth, this.scaledHeight] = this.scaleRectToBounds(this.movieDiv, videoContainer);
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

    setScaledValues(bounds) {
        [this.scaledWidth, this.scaledHeight] = this.scaleRectToBounds(this.movieDiv, bounds);
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

    /**
     * Param allows to adjust test for different fast forward rates
     * @param  {Number} timeInSeconds
     */
    notEnded(timeInSeconds) {
        return this.movieDiv.time() < (this.movieDiv.duration() - timeInSeconds);
    }

    notBeginning(timeInSeconds) {
        return this.movieDiv.time() > timeInSeconds;
    }

    /**
     * Draw current movie frame image and white background to GUI in video display
     */
    drawVideoFrame(videoContainer) {
        this.drawVideoImage(videoContainer);
        this.drawVideoTimeLabel(videoContainer);
    }

    drawVideoImage(videoContainer) {
        this.sk.fill(255);
        this.sk.stroke(255);
        this.sk.rect(videoContainer.xPos, videoContainer.yPos, videoContainer.width, videoContainer.height); // erases previous video frames from other loaded videos that can be different size than current frames
        this.sk.image(this.movieDiv, videoContainer.xPos, videoContainer.yPos, this.scaledWidth, this.scaledHeight);
    }

    drawVideoTimeLabel(videoContainer) {
        const curVideoTime = this.curTime;
        this.sk.fill(0);
        this.sk.noStroke();
        const labelSpacing = 30;
        const minutes = Math.floor(curVideoTime / 60);
        const seconds = Math.floor(curVideoTime - minutes * 60);
        const label = minutes + " minutes  " + seconds + " seconds";
        this.sk.text(label, videoContainer.xPos + labelSpacing / 2, videoContainer.yPos + labelSpacing);
    }

    // TODO: retitle these stupid getters
    get curTime() {
        return this.movieDiv.time();
    }

    get duration() {
        return this.movieDiv.duration();
    }
}