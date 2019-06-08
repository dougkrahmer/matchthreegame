/**
 * GLOSSARY:
 * Tile: an object in the game that the player interacts with.
 * It can be moved around the board
 * 
 * Cell:
 * The location on the board itself. Every tile occupies a cell,
 * or is in a transition state between them.
 * 
 * Any function name starting with 'g' is a function that uses the graphics object
 * This keeps them distict from the logical game functions, allowing for
 * neat, conceptual, decoupled code.
 */
const W = 8;
const H = 8;
const G_CELL_SIZE = 64;
const NUM_COLORS = 7;
// null, red, orange, yellow, green, blue, indigo, violet
const IMAGE_NAMES = 'roygbiv'.split('');
const SCORE_BASE = [100, 200, 300];
const SCORE_EXTRA = 50;
const SCORE_CROSS_MODIFIER = -50;
var images = [];
/**
 * DON'T ACCESS DIRECTLY (except to debug): 
 * it will make your life easier in the long run (encapsulation)
 * 
 * An array of integers representing which color each tile is.
 * This array is one dimensional.
 */
var _colors = [];
/**
 * An array of FLOATS showing how far away from a cell to render a tile.
 * This is used to animate tiles falling to fill a cleared space
 */
var _tileYPixelOffsets = new Array(W * H);
var selectedX = -1, selectedY = -1;

// this pointless syntax enables type completion in Visual Studio Code
var canvas = false ? new HTMLCanvasElement() : null;
var graphics = false ? canvas.getContext('2d') : null;

var gGravityCallbackID = null;
// start time for acceleration
var gGravityStartTime = null;

var score = 0;
var scoreElement;
/**
 * 
 * @param {number} x index
 * @param {number} y index
 * @returns {number} which color is at (x,y)
 */
function getTileColor(x, y) {
    var idx = y * W + x;
    if (idx >= W * H || idx < 0) {
        throw "Index out of bounds"
    }
    return _colors[idx] & 7; // lowest 3 bits represent color
}

function gGetTileYPixelOffset(x, y) {
    var idx = y * W + x;
    if (idx >= W * H || idx < 0) {
        throw "Index out of bounds"
    }
    return _tileYPixelOffsets[idx]
}

function gSetTileYPixelOffset(x, y, yOffset) {
    var idx = y * W + x;
    if (idx >= W * H || idx < 0) {
        throw "Index out of bounds"
    }
    _tileYPixelOffsets[idx] = yOffset;
}

function idx(x, y) {
    return y * W + x;
}

function setCellColor(x, y, color) {
    var idx = y * W + x;
    if (idx >= W * H || idx < 0) {
        throw "Index out of bounds"
    }
    _colors[idx] = color;
}

/**
 * Returns true if cells are adjacent vertically or horizontally, but not diagonally
 */
function areCellsAdjacent(x1,y1,x2,y2) {
    var a = y1 * W + x1, b = y2 * W + x2;
    var diff = Math.abs(a - b);
    return diff === W || (diff === 1 && y1 === y2);
}

function swapCells(x1,y1,x2,y2) {
    var i = y1 * W + x1, j = y2 * W + x2;
    if (i < 0 || i >= W * H || j < 0 || j >= W * H) {
        throw "Index out of bounds"
    }
    var temp = _colors[i];
    _colors[i] = _colors[j];
    _colors[j] = temp;
}


/**
* Setup the arrays and variables needed to store the game state
* Calling this function again will reset the game
* 
* Performs an algorithm to populate the board so that it starts in a state where there
* are no tiles currently matched, but tiles can be matched with a single move
*/
function createBoard() {
    const size = W*H;
    _colors = new Array(size);
    for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
            setCellColor(x, y, getRandomInt(1, NUM_COLORS));
        }
    }
    var matches = [];
    for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
            pushIfNotDuplicate(matches, checkForMatch(x, y));
        }
    }
    resolveMatches(matches);
    findCascadeMatches(matches, false);
    // clear all visual y offsets, okay to use array directly for speed
    for (var i = 0; i < W * H; i++) {
        _tileYPixelOffsets[i] = 0;
    }
    score = 0;
}

function gRenderBoard() {
    graphics.fillStyle = 'white';
    graphics.fillRect(0,0, canvas.width, canvas.height);
    for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
            gRenderTile(x, y);
        }
    }
}

function gRenderCell(x, y) {
    graphics.fillStyle = 'white';
    graphics.fillRect(x * G_CELL_SIZE,y * G_CELL_SIZE, G_CELL_SIZE, G_CELL_SIZE);
}

function gRenderTile(x, y) {
    var c = getTileColor(x, y);
    var offset = gGetTileYPixelOffset(x, y) || 0;
    if (c !== 0) {
        graphics.drawImage(images[c-1], x * G_CELL_SIZE, y * G_CELL_SIZE + offset, G_CELL_SIZE, G_CELL_SIZE);
    }
}

function gRenderSelection(x, y) {
    graphics.strokeRect(x * G_CELL_SIZE + 1, y * G_CELL_SIZE + 1, G_CELL_SIZE - 2, G_CELL_SIZE - 2);
}

function gEraseCell(x, y) {
    graphics.fillStyle = 'white';
    graphics.fillRect(x * G_CELL_SIZE, y * G_CELL_SIZE, G_CELL_SIZE, G_CELL_SIZE);
}

function gClearSelection() {
    // remove selection graphics
    var previousX = selectedX;
    var previousY = selectedY;
    selectedX = -1;
    selectedY = -1;
    gEraseCell(previousX, previousY);
    gRenderTile(previousX, previousY);
}

function gUpdateScore(score) {
    scoreElement.innerHTML = ''+score;
}

function gRenderScorePopup(match) {
    graphics.fillStyle = 'black';
    graphics.font = (G_CELL_SIZE / 2) +'px sans-serif';
    graphics.textBaseline = 'top';
    graphics.fillText(''+match.score(), 
            match.originX * G_CELL_SIZE,
            match.originY * G_CELL_SIZE + G_CELL_SIZE / 4);
}

// TODO
var _event; // use to check if you mouse up over the same cell you moused down on
function canvasMouseDown(event) {
    _event = event;
}

function cellMouseDown(x,y) {
}

function canvasMouseUp(event) {
    var x = Math.floor(event.offsetX / G_CELL_SIZE);
    var y = Math.floor(event.offsetY / G_CELL_SIZE);
    cellMouseUp(x, y)
}

function cellMouseUp(x, y) {
    if (selectedX === -1) {
        selectedX = x;
        selectedY = y;
        gRenderSelection(x, y);
    } else {
        if (areCellsAdjacent(selectedX, selectedY, x, y)
                && (getTileColor(x, y) !== 0 && getTileColor(selectedX, selectedY) !== 0)) {
            var debugTemp = _colors.slice();
            swapCells(selectedX, selectedY, x, y);
            var match1 = checkForMatch(x, y);
            var match2 = checkForMatch(selectedX, selectedY);
            if (match1 === null && match2 === null) {
                // undo illegal move
                swapCells(selectedX, selectedY, x, y);
                gClearSelection();
            } else {
                let matches = [match1, match2].filter(e => e !== null);
                resolveMatches(matches);
                console.log('User Matches:')
                console.log(matches);
                gUpdateScore(score);
                gAnimateFadeOut(matches).then(() => {
                    return gAnimateGravity(matches);
                }).then(() => {
                    findCascadeMatches(matches);
                });
                {// (debug) this section should only log if something is very wrong
                    var hasEmpties = false;
                    for (var i = 0; i < W * H; i++) {
                        if (_colors[i] === 0) {
                            hasEmpties = true;
                            break;
                        }
                    } 
                    if (hasEmpties || _colors.length > W * H) {
                        console.log("Previous state: ");
                        console.log(debugTemp)
                        console.log(`Tile 1 (Selected): ${selectedX}, ${selectedY}`);
                        console.log(`Tile 2 (toSwap) ${x}, ${y}`)
                        console.log("Generated Matches: ");
                        console.log(matches);
                    }
                }// /debug
                // TODO better rendering,
                selectedX = -1;
                selectedY = -1;
                gRenderBoard();
            }
        } else {
            gClearSelection();
        }
    }
}
/**
 * Matches have an origin, horizontal and vertical offsets, and
 * horizontal and vertical lengths.
 * 
 * For a match created by a user's move, the origin is the cell to which the user moved the tile.
 * For a match created by a cascade, the origin is the cell with the lowest index.
 * 
 * The offset shows the number of matched tiles to the side of the origin. For example, if a match began
 * 2 tiles to the left the origin, the offsetX would be -2. 
 * Offsets must be negative, because a positive offset would mean the match does not contain the origin.
 * 
 * The length is the count of tiles that were matched in that direction. 
 * Most commonly only one length will be non-zero. But it can have both, indicating and L or T shaped match.
 */
class Match {
    /**
     * @param {number} originX >= 0, < W
     * @param {number} originY >= 0, < H
     * @param {number} offsetX <= 0
     * @param {number} offsetY <= 0
     * @param {number} lengthX >= 1
     * @param {number} lengthY >= 1
     * @param {number} [color] used for some animations, currently has no impact on game logic
     */
    constructor(originX, originY, offsetX, offsetY, lengthX, lengthY, color) {
        this.originX = originX;
        this.originY = originY;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.lengthX = lengthX;
        this.lengthY = lengthY;
        this.gColor = color; // only used for animating fade out
    }

    // now you're thinking with functions
    forEachCell(fn) {
        var startX = this.originX + this.offsetX;
        var startY = this.originY + this.offsetY;

        for (var y = startY; y < startY + this.lengthY; y++) {
            var x, end;
            if (y == this.originY) {
                x = startX;
                end = startX + this.lengthX;
            } else {
                x = this.originX;
                end = this.originX + 1;
            }
            for (; x < end; x++) {
                fn(x, y);
            }
        }
    }

    toStr() {
        let strRep = '';
        this.forEachCell((x, y) => {
            strRep += ''+x+','+y+';';
        });
        return strRep;
    }

    hasSameCellsAs(other) {
        // this is pretty lazily written, could likely be faster
        return this.toStr() == other.toStr();
    }

    isSupersetOf(other) {
        if (this.numberOfCells() <= other.numberOfCells()) {
            return false;
        }
        let coversAll = true;
        other.forEachCell((x, y) => {
            if (!this.coversCell(x, y)) {
                coversAll = false;
            }
        });
        return coversAll;
    }

    coversCell(x, y) {
        if (this.originX == x) {
            return y >= (this.originY + this.offsetY) && y < this.originY + this.offsetY + this.lengthY;
        }
        if (this.originY == y) {
            return x >= (this.originX + this.offsetX) && x < this.originX + this.offsetX + this.lengthX;
        }
        return false;
    }

    numberOfCells() {
        return (this.lengthX + this.lengthY) - 1;
    }

    score() {
        var count = this.numberOfCells() - 3;
        var _score = SCORE_BASE[Math.min(count, 2)];
        if (count > 2) {
            _score += (count - 2) * SCORE_EXTRA;
        }
        if (this.lengthX > 1 && this.lengthY > 1) {
            _score += SCORE_CROSS_MODIFIER;
        }
        return _score;
    }
}

function checkForMatch(originX, originY) {
    const originColor = getTileColor(originX, originY);
    var lx = 1, ly = 1, offx = 0, offy = 0;

    var y = originY - 1;
    while (y >= 0 && getTileColor(originX, y) == originColor) {
        ly++;
        offy--;
        y--;
    }
    y = originY + 1;
    while (y < H && getTileColor(originX, y) == originColor) {
        ly++;
        y++;
    }
    var x = originX - 1;
    while (x >= 0 && getTileColor(x, originY) == originColor) {
        lx++;
        offx--;
        x--;
    }
    x = originX + 1;
    while (x < W && getTileColor(x, originY) == originColor) {
        lx++;
        x++;
    }

    // don't pass values less than 3, because it will affect the clearing algorithm
    if (lx < 3) {
        lx = 1;
        offx = 0;
    }
    if (ly < 3) {
        ly = 1;
        offy = 0;
    }

    if (lx >= 3 || ly >= 3) {
        var match = new Match(originX, originY, offx, offy, lx, ly, originColor);
        return match;
    }
    return null;
}

// okay, this is epic 
function findCascadeMatches(previousMatches, animate = true) {
    // check for a match on every tile that shifted down
    let lowestCellPerColumn = new Array(W).fill(-1);
    for (var i = 0; i < previousMatches.length; i++) {
        previousMatches[i].forEachCell((x,y) => {
            if (y > lowestCellPerColumn[x]) {
                lowestCellPerColumn[x] = y;
            }
        });
    }
    var matches = [];
    for (var x = 0; x < W; x++) {
        for (var y = lowestCellPerColumn[x]; y >= 0; y--) {
            var match = checkForMatch(x,y);
            pushIfNotDuplicate(matches, match);
        }
    }
    if (matches.length > 0) {
        console.log("Cascade matches: ");
        console.log(matches);
        resolveMatches(matches);
        if (animate) {
            gUpdateScore(score);
            gAnimateFadeOut(matches).then(() => {
                return gAnimateGravity(matches);
            }).then(() => {
                findCascadeMatches(matches);
            });
        } else {
            findCascadeMatches(matches, false);
        }
    }
}

/**
 * 
 * @param {Match[]} matches
 * @param {Match} match
 */
function pushIfNotDuplicate(matches, match) {
    if (match == null || matches == null) return;
    for (var i = 0; i < matches.length; i++) {
        if (match.isSupersetOf(matches[i])) {
            matches.splice(i, 1);
        } else if (matches[i].isSupersetOf(match)) {
            return;
        } else if (match.hasSameCellsAs(matches[i])) {
            return;
        }
    }
    matches.push(match);
}

/*
 * Algorithm:
 * remove all of the matched tiles
 * bubble the empty cells up to the top of the board
 *     start at the lowest row affected by the match
 *     if the cell is empty :
 *         swap the empty cell with the row above
 *     move up a row and repeat
 * Insert random items at the top
 */
function resolveMatches(matches) {
    // sorting in descending order prevents a certain animation bug (see bugs.md)
    matches = matches.sort((a, b) => b.originY - a.originY);
    for (var i = 0; i < matches.length; i++) {
        matches[i].forEachCell((x, y) => {
            setCellColor(x, y, 0);
        });
        score += matches[i].score();
    }

    for (var i = 0; i < matches.length; i++) {
        var match = matches[i];
        // start at the bottom and work up
        // note that the end is an exclusive index, so subtract 1
        var startY = match.originY + match.offsetY + match.lengthY - 1;
        // endY is implicitly 0, the top off the board
        var startX = match.originX + match.offsetX;
        var endX = startX + match.lengthX;
        // move empties upward
        for (var x = startX; x < endX; x++) {
            for (var y = startY; y > 0; y--) {
                var nextNonEmptyY = y-1;
                if (getTileColor(x, y) === 0) {
                    while (nextNonEmptyY > 0 && getTileColor(x,nextNonEmptyY) === 0) {
                        nextNonEmptyY--;
                    }
                    swapCells(x,y, x,nextNonEmptyY);
                    var gYOffset = -(y - nextNonEmptyY) * G_CELL_SIZE;
                    gSetTileYPixelOffset(x, y, gYOffset);
                }
            }
        }
        // fill top row with randoms
        for (var x = startX; x < endX; x++) {
            var lowestEmptyRow = 0; // by lowest, I mean spacially, think of a spreadsheet
            while (lowestEmptyRow < H && getTileColor(x, lowestEmptyRow) === 0) {
                setCellColor(x, lowestEmptyRow, getRandomInt(1,NUM_COLORS));
                lowestEmptyRow++;
            }
            lowestEmptyRow -= 1;
            // now that we know how many empty spaces there were, calculate fall gravity
            for (var y = lowestEmptyRow; y >= 0; y--) {
                gSetTileYPixelOffset(x,y, -(lowestEmptyRow+1) * G_CELL_SIZE)
            }
        }
    }
}

function inBounds(x, y) {
    return (x >= 0 && y >= 0 && x < W && y < H);
}

function isPossibleMatch(x, y) {
    var originColor = getTileColor(x, y);
    // first, check for corners
    // they are a predicate of type A matches,
    // and if there are two adjacent corners, it is a type B match
    const cornerOrder = [[1,-1],[1,1],[-1,1],[-1,-1]]; // this is clockwise
    var corners = [];
    var previousCornerMatched = false;
    for (var i = 0; i < 4; i++) {
        const d = cornerOrder[i];
        var v = x+d[0], w = y+d[1];
        if (!inBounds(v,w)) {
            corners[i] = false;
            continue;
        }
        corners[i] = originColor == getTileColor(v,w);
        if (corners[i]) {
            // roll type B checking into this loop
            if (previousCornerMatched) return true;
            // check for type A
            var t = v + d[0], u = w + d[1];
            if (inBounds(t,w) && getTileColor(t, w) == originColor) return true;
            if (inBounds(v,u) && getTileColor(v, u) == originColor) return true;
        }
        previousCornerMatched = corners[i];
    }
    if (corners[0] && corners[3]) return true; // the loop misses this case
    // check for type C
    if (inBounds(x + 3, y) && getTileColor(x + 2, y) == originColor && getTileColor(x + 3, y) == originColor) return true;
    if (inBounds(x - 3, y) && getTileColor(x - 2, y) == originColor && getTileColor(x - 3, y) == originColor) return true;
    if (inBounds(x, y + 3) && getTileColor(x, y + 2) == originColor && getTileColor(x, y + 3) == originColor) return true;
    if (inBounds(x, y - 3) && getTileColor(x, y - 2) == originColor && getTileColor(x, y - 3) == originColor) return true;
    return false;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function loadImage(name) {
    return new Promise(resolve => {
        var img = new Image();
        img.onload = () => resolve();
        img.src = 'img/' + name + '.png';
        images.push(img);
    });
}

function loadImages() {
    return Promise.all(IMAGE_NAMES.map(loadImage));
}

// derived from https://yeti.co/blog/cool-tricks-with-animating-using-requestanimationframe/
// good article to read if you need to understand requestAnimationFrame
function _gravityStep(matches, resolve) {
    return function(time) {
        var allTilesStationary = true;
        var timeSinceStart;
        if (gGravityStartTime === null) {
            gGravityStartTime = time;
        }
        timeSinceStart = (time - gGravityStartTime) / 1000; // convert to seconds
        var speed = timeSinceStart * (G_CELL_SIZE / 2);
        for (var x = 0; x < W; x++) {
            for (var y = 0; y < H; y++) {
                var offset = gGetTileYPixelOffset(x, y);
                if (offset < 0) {
                    allTilesStationary = false;
                    gSetTileYPixelOffset(x, y, Math.min(speed + offset, 0));
                    gRenderCell(x,y);
                    gRenderTile(x,y);
                }
            }
        }
        for (var match of matches) {
            if (gGetTileYPixelOffset(match.originX, match.originY) < 0) {
                gRenderScorePopup(match);
            }
        }
        if (allTilesStationary) {
            // console.log(timeSinceStart);
            cancelAnimationFrame(gGravityCallbackID);
            gGravityCallbackID = null;
            gGravityStartTime = null;
            resolve();
        } else {
            gGravityCallbackID = requestAnimationFrame(_gravityStep(matches, resolve));
        }
    }
}

function gAnimateGravity(matches) {
    return new Promise(resolve => {
        requestAnimationFrame(_gravityStep(matches, resolve));
    });
}

function _fadeOutStep(matches, startTime, resolve) {
    return function(time) {
        startTime = startTime || time;
        var timeSinceStart = time - startTime;
        if (timeSinceStart < 100) {
            let percent = 1 - timeSinceStart / 100;
            for (var m of matches) {
                m.forEachCell((x, y) => {
                    gEraseCell(x, y);
                    var c = m.gColor || 1;
                    graphics.save();
                    graphics.globalAlpha = percent;
                    graphics.drawImage(images[c-1], x * G_CELL_SIZE, y * G_CELL_SIZE, G_CELL_SIZE, G_CELL_SIZE);
                    graphics.restore();
                });
            }
            requestAnimationFrame(_fadeOutStep(matches, startTime, resolve));
        } else {
            resolve();
        }
    }
}

function gAnimateFadeOut(matches) {
    return new Promise(resolve => {
        requestAnimationFrame(_fadeOutStep(matches, null, resolve));
    });
}

function init() {
    canvas = document.getElementById('game');
    canvas.width = W * G_CELL_SIZE;
    canvas.height = H * G_CELL_SIZE;
    graphics = canvas.getContext('2d');
    createBoard();
    scoreElement = document.getElementById('score');
    gUpdateScore(score);
    loadImages().then(() => {
        gRenderBoard();
        canvas.onmousedown = canvasMouseDown;
        canvas.onmouseup = canvasMouseUp;
    });
}

init();