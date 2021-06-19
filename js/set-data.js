class SetData {
    /**
     * Organizes methods for recording once all data is loaded
     */
    setDrawingScreen() {
        if (core.recording) updateData.setData(); // records data and updates visualization if in record mode
        // If info screen showing, redraw current screen first, then drawKeys
        if (core.showInfo) {
            updateData.reDrawAllData();
            updateData.updateView.drawPath(core.curPath);
            keys.drawIntroScreen();
        }
    }

    /**
     * Displays image or blank screen indicating movie is loaded
     */
    setLoadDataScreen() {
        keys.drawLoadDataGUI();
        if (core.dataIsLoaded(floorPlan)) keys.drawFloorPlanBackground();
        else if (core.dataIsLoaded(videoPlayer)) updateData.updateView.drawCurVideoFrame();
        if (core.showInfo) keys.drawIntroScreen();
    }
}