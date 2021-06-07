class Handlers {

    handleKeyPressed() {
        if (core.floorPlanLoaded && core.movieLoaded) {
            if (key == 'p' || key == 'P') {
                updateData.updateMovie.playPauseRecording();
                if (core.showInfo) handleIntroButton(); // prevent info screen from showing while recording for smooth user interaction
            } else if (key == 'r' || key == 'R') updateData.resetCurRecording();
            else if (key == 'b' || key == 'B') updateData.rewind();
            else if (key == 'f' || key == 'F') updateData.fastForward();
        }
    }
}