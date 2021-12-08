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
        sk.isSelectResize = false; // TODO: move to mediator?
    }

    /**
     * Program loop
     */
    sk.draw = function () {
        sk.mediator.updateDrawLoop();
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
        if (sk.isSelectResize) sk.selectResize();
    }

    sk.mouseReleased = function () {
        sk.isSelectResize = false;
    }

    sk.windowResized = function () {
        sk.mediator.updateWindowResize();
    }

    sk.selectResize = function () {
        sk.mediator.updateSelectResize();
    }
});