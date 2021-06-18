class SetData {
    /**
     * Organizes methods for recording once all data is loaded
     */
    setDrawingScreen() {
        if (core.recording) updateData.setData(); // records data and updates visualization if in record mode
        // If info screen showing, redraw current screen first, then drawKeys
        if (core.showInfo) {
            updateData.reDrawAllData();
            updateData.updatePath.drawPath(core.curPath);
            keys.drawIntroScreen();
        }
    }

    /**
     * Displays image or blank screen indicating movie is loaded
     */
    setLoadDataScreen() {
        keys.drawLoadDataGUI();
        if (loadData.floorPlanLoaded) keys.drawFloorPlanBackground();
        else if (loadData.movieLoaded) updateData.updateMovie.drawCurFrame();
        if (core.showInfo) keys.drawIntroScreen();
    }
}