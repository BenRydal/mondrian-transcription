class Handlers {

    handleKeyPressed() {
        if (core.floorPlanLoaded && core.movieLoaded) {
            if (key == 'p' || key == 'P') {
                dataUpdate.updateMovie.playPauseRecording();
                if (core.showInfo) handleIntroButton(); // prevent info screen from showing while recording for smooth user interaction
            } else if (key == 'r' || key == 'R') dataUpdate.resetCurRecording();
            else if (key == 'b' || key == 'B') dataUpdate.rewind();
            else if (key == 'f' || key == 'F') dataUpdate.fastForward();
        }
    }
}