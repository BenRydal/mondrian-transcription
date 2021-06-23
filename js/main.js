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

const app = new Controller(new Sketch());


// GLOBAL:
// Controller (loadData, handlers)

// P5 RELATED:
// UPDATE DATA is mediator for updateView and updatePath
// CORE is like the model
// - UpdatePath and Update Movie are like model for path/video data
// KEYS specific to p5 canvas
// VideoPlayer is a helper class for loading video