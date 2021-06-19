class SetData {
    /**
     * Organizes methods for recording once all data is loaded
     */
    setDrawingScreen() {
        if (core.recording) updateData.updateRecording(); // records data and updates visualization if in record mode
        // If info screen showing, redraw current screen first, then drawKeys
        if (core.showInfo) {
            updateData.drawAllData();
            keys.drawIntroScreen();
        }
    }

    /**
     * Displays image or blank screen indicating movie is loaded
     */
    setLoadDataScreen() {
        keys.drawLoadDataGUI();
        if (core.dataIsLoaded(floorPlan)) updateData.drawFloorPlan();
        else if (core.dataIsLoaded(videoPlayer)) updateData.drawVideoFrame();
        if (core.showInfo) keys.drawIntroScreen();
    }
}