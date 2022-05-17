/*
CREDITS/LICENSE INFORMATION: 
This software is written in JavaScript and p5.js and is licensed under the GNU General Public License Version 2.0. 
See the GNU General Public License included with this software for more details. 
Mondrian Transcription software was originally developed by Ben Rydal Shapiro at Vanderbilt University
as part of his dissertation titled Interaction Geography & the Learning Sciences. 
Copyright (C) 2018 Ben Rydal Shapiro, and contributors. 
To reference or read more about this work please see: 
https://etd.library.vanderbilt.edu/available/etd-03212018-140140/unrestricted/Shapiro_Dissertation.pdf
*/

import {
    Mediator
} from './mediator.js';
import {
    Controller
} from './controller.js';

const mondrian = new p5((sk) => {

    sk.preload = function () {
        sk.font_Lato = sk.loadFont("data/fonts/Lato-Light.ttf");
    }

    sk.setup = function () {
        sk.canvas = sk.createCanvas(window.innerWidth, window.innerHeight);
        sk.canvas.parent('sketch-holder');
        sk.textFont(sk.font_Lato, 20);
        sk.mediator = new Mediator(sk);
        sk.controller = new Controller(sk.mediator);
        sk.addListeners();
    }

    sk.draw = function () {
        sk.mediator.updateProgram();
    }

    sk.addListeners = function () {
        document.getElementById("introButton").addEventListener("click", sk.controller.handleIntroButton);
        document.getElementById("inputFloorPlan").addEventListener("change", sk.controller.handleFloorPlanButton.bind(this));
        document.getElementById("inputVideo").addEventListener("change", sk.controller.handleVideoButton.bind(this));
        document.getElementById("saveButton").addEventListener("click", sk.controller.handleSaveButton.bind(this));
        document.getElementById("resetButton").addEventListener("click", sk.controller.handleResetButton.bind(this));
    }

    /**
     * While wrapped in a P5 instance, keyPressed and mousePressed P5 methods operate globally on the window (there can't be two of these methods)
     */
    sk.keyPressed = function () {
        sk.mediator.handleKeyPressed(sk.key);
    }

    sk.mousePressed = function () {
        sk.mediator.handleMousePressed();
    }

    sk.mouseDragged = function () {
        sk.mediator.handleMouseDragged();
    }

    sk.mouseReleased = function () {
        sk.mediator.handleMouseReleased();
    }

    sk.windowResized = function () {
        sk.mediator.resizeByWindow();
    }
});