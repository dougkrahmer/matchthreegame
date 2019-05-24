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
var images = [];

var allowDrag = false;
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
var pendingMatches = [];

// this pointless syntax enables type completion in Visual Studio Code
var canvas = false ? new HTMLCanvasElement() : null;
var graphics = false ? canvas.getContext('2d') : null;

var gGravityCallbackID = null;
// all tiles will fall at the same time, 
// so as long as there is one moving
// we can increase the acceleration for all of them
var gGravityAccelerationCounter = 0;
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
function createBoard(rows, columns) {
    const size = W*H;
    _colors = new Array(size);
    for (var i = 0; i < size; i++) {
        _colors[i] = i % NUM_COLORS + 1;
        if (i % 8 % 3 == 0) _colors[i] = (_colors[i] + 1) % NUM_COLORS + 1;
    }
    // create a test pattern
    // TEST CASE: the extremely rare + shaped match
    _colors[32] = _colors[33] = _colors[1] = _colors[9] = _colors[17] = 7;
    _colors[34] = _colors[25] = _colors[41] = 4;
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
            var debugMatches = pendingMatches.slice();
            if (match1 === null && match2 === null) {
                // undo illegal move
                swapCells(selectedX, selectedY, x, y);
                gClearSelection();
            } else {
                resolveMatches();
                if (pendingMatches.length) {
                    console.log('User Matches:')
                    console.log(pendingMatches);
                }
                gAnimateGravity().then(() => {
                    findCascadeMatches(pendingMatches);
                });
                {// debug
                    var hasEmpties = false;
                    for (var i = 0; i < 64; i++) {
                        if (_colors[i] === 0) {
                            hasEmpties = true;
                            break;
                        }
                    } 
                    if (hasEmpties || _colors.length > 64) {
                        console.log("Previous state: ");
                        console.log(debugTemp)
                        console.log(`Tile 1 (Selected): ${selectedX}, ${selectedY}`);
                        console.log(`Tile 2 (toSwap) ${x}, ${y}`)
                        console.log("Generated Matches: ");
                        console.log(debugMatches);
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
 * If the match was caused by a cascade, the offset is always 0.
 * 
 * The length is the count of tiles that were matched in that direction. 
 * Most commonly only one length will be non-zero. But it can have both, indicating and L or T shaped match.
 */
class Match {
    constructor(originX, originY, offsetX, offsetY, lengthX, lengthY) {
        this.originX = originX;
        this.originY = originY;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.lengthX = lengthX;
        this.lengthY = lengthY;
    }

    // now you're thinking with functions
    forEachCell(fn) {
        var startX = this.originX + this.offsetX;
        var startY = this.originY + this.offsetY;

        for (var x = startX; x < startX + this.lengthX; x++) {
            fn(x, this.originY);
        }

        for (var y = startY; y < startY + this.lengthY; y++) {
            fn(this.originX, y);
        }
    }

    hasSameCellsAs(match) {
        var startX = this.originX + this.offsetX;
        var otherStartX = match.originX + match.offsetX;

        var startY = this.originY + this.offsetY;
        var otherStartY = match.originY + match.offsetY;

        return (startX == otherStartX && this.lengthX == match.lengthX
                && startY == otherStartY && this.lengthY == match.lengthY);
    }

    numberOfCells() {
        return (this.lengthX + this.lengthY) - 1;
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
        var match = new Match(originX, originY, offx, offy, lx, ly);
        pendingMatches.push(match);
        return match;
    }
    return null;
}

// okay, this is epic 
function findCascadeMatches(previousMatches) {
    pendingMatches = [];
    // check for a match on every tile that shifted down
    let lowestCellPerColumn = new Array(W).fill(-1);
    for (var i = 0; i < previousMatches.length; i++) {
        previousMatches[i].forEachCell((x,y) => {
            if (y > lowestCellPerColumn[x]) {
                lowestCellPerColumn[x] = y;
            }
        });
    }
    var prevColumnMatchCount = 0;
    for (var x = 0; x < W; x++) {
        var matchCount = 0;
        for (var y = lowestCellPerColumn[x]; y >= 0; y--) {
            var match = checkForMatch(x,y);
            if (match) {
                if (pendingMatches.length >= 2 && prevColumnMatchCount != 0) {
                    // since we are counting upwards before moving right, find the match from the other column
                    var indexOfPossibleDuplicate = pendingMatches.length - (prevColumnMatchCount + 1);
                    var possibleDuplicateOf = pendingMatches[indexOfPossibleDuplicate];
                    var startX = match.originX + match.offsetX;
                    var otherX = possibleDuplicateOf.originX + possibleDuplicateOf.offsetX;

                    if (startX == otherX) {
                        if (match.lengthY == possibleDuplicateOf.lengthY) {
                            pendingMatches.pop();
                        } else {
                            // this is a situation where we've actually discovered a T or L match,
                            // in that case, this match must supercede the other one
                            pendingMatches.splice(indexOfPossibleDuplicate, 1);
                        }
                    }
                }
                
                // skip to the next cell above this match
                // if it's a vertical match, this prevents double-counting of the cells
                y -= match.lengthY - 1; // -1 because the loop decrementer will get it
                matchCount++;
            }
        }
        prevColumnMatchCount = matchCount;
    }
    if (pendingMatches.length > 0) {
        console.log("Cascade matches: ");
        console.log(pendingMatches);
        resolveMatches();
        gAnimateGravity().then(() => {
            findCascadeMatches(pendingMatches);
        });
    }
}

/*
 * algorithm:
 * remove all of the matched tiles
 * place any special tiles generated by the match
 * bubble the empty cells up to the top of the board
 *     start at the lowest row affected by the match
 *     if the cell is empty :
 *         swap the empty cell with the row above
 *     move up a row and repeat
 * Insert random items at the top
 * check for new matches
 */
function resolveMatches() {
    for (var i = 0; i < pendingMatches.length; i++) {
        pendingMatches[i].forEachCell((x, y) => {
            setCellColor(x, y, 0);
        });
    }

    for (var i = 0; i < pendingMatches.length; i++) {
        var match = pendingMatches[i];
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
                setCellColor(x, lowestEmptyRow, getRandomInt(1,7));
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

// this is seriously incomprehensible
// derived from https://yeti.co/blog/cool-tricks-with-animating-using-requestanimationframe/
function _gravityStep(resolve) {
    return function(time) {
        var allTilesStationary = true;
        // TODO use the time instead of a counter, frame rates are arbitrary
        // console.log(time);
        gGravityAccelerationCounter += 1;
        for (var i = 0; i < W * H; i++) {
            if (_tileYPixelOffsets[i] < 0) {
                _tileYPixelOffsets[i] = 
                        Math.min(gGravityAccelerationCounter + _tileYPixelOffsets[i], 0);
                allTilesStationary = false;
            }
        }
        gRenderBoard();
        gGravityCallbackID = requestAnimationFrame(_gravityStep(resolve));
        if (allTilesStationary) {
            cancelAnimationFrame(gGravityCallbackID);
            gGravityCallbackID = null;
            gGravityAccelerationCounter = 0;
            resolve();
        }
    }
}

function gAnimateGravity() {
    return new Promise(resolve => {
        requestAnimationFrame(_gravityStep(resolve));
    });
}

function init() {
    canvas = document.getElementById('game');
    canvas.width = W * G_CELL_SIZE;
    canvas.height = H * G_CELL_SIZE;
    graphics = canvas.getContext('2d');
    createBoard();
    loadImages().then(() => {
        gRenderBoard();
        canvas.onmousedown = canvasMouseDown;
        canvas.onmouseup = canvasMouseUp;
    });
}

init();
