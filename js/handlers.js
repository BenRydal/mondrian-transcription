class Handlers {

    handleKeyPressed() {
        if (mondrian.key == 'p' || mondrian.key == 'P') {
            updateData.updateMovie.playPauseRecording();
            if (core.showInfo) this.handleIntroButton(); // prevent info screen from showing while recording for smooth user interaction
        } else if (mondrian.key == 'r' || mondrian.key == 'R') updateData.resetCurRecording();
        else if (mondrian.key == 'b' || mondrian.key == 'B') updateData.rewind();
        else if (mondrian.key == 'f' || mondrian.key == 'F') updateData.fastForward();
    }

    /**
     * Shows/hides info screen and redraws data if needed
     */
    handleIntroButton() {
        if (core.showInfo && core.floorPlanLoaded && core.movieLoaded) {
            updateData.reDrawAllData();
            updateData.updatePath.drawPath(core.curPath, CURPATHCOLOR); // TO DO: combine functions??
        }
        core.showInfo = !core.showInfo;
    }

    handleSaveButton() {
        if (core.floorPlanLoaded && core.movieLoaded && core.curPath.xPos.length > 0) updateData.writeFile();
    }
}