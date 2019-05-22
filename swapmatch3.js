/**
 * GLOSSARY:
 * Tile: an object in the game that the player interacts with.
 * It can be moved around the board
 * 
 * Cell:
 * The location on the board itself. Every tile occupies a cell,
 * or is in a transition state between them.
 */
const W = 8;
const H = 8;
const CELL_SIZE = 64;
const NUM_COLORS = 7;
// null, red, orange, yellow, green, blue, indigo, violet
const IMAGE_NAMES = 'roygbiv'.split('');
var images = [];

var allowDrag = false;
/**
 * An array of integers representing which color each cell is.
 * This array is one dimensional.
 */
var colors = [];
var selectedX = -1, selectedY = -1;
var pendingMatches = [];

// this pointless syntax enables type completion in Visual Studio Code
var canvas = false ? new HTMLCanvasElement() : null;
var graphics = false ? canvas.getContext('2d') : null;
/**
 * 
 * @param {number} x index
 * @param {number} y index
 * @returns {number} which color is at (x,y)
 */
function getCellColor(x, y) {
    return colors[y * W + x] & 7; // lowest 3 bits represent color
}

function idx(x, y) {
    return y * W + x;
}

function setCellColor(x, y, color) {
    var idx = y * W + x;
    if (idx >= W * H || idx < 0) {
        throw "Index out of bounds"
    }
    colors[y * W + x] = color;
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
    var temp = colors[i];
    colors[i] = colors[j];
    colors[j] = temp;
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
    colors = new Array(size);
    for (var i = 0; i < size; i++) {
        colors[i] = i % NUM_COLORS + 1;
        if (i % 8 % 3 == 0) colors[i] = (colors[i] + 1) % NUM_COLORS + 1;
    }
}

function renderBoard() {
    graphics.fillStyle = 'white';
    graphics.fillRect(0,0, canvas.width, canvas.height);
    for (var y = 0; y < H; y++) {
        for (var x = 0; x < W; x++) {
            renderCell(x, y);
        }
    }
}

function renderCell(x, y) {
    graphics.fillStyle = 'white';
    graphics.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    var c = getCellColor(x, y);
    if (c !== 0) {
        graphics.drawImage(images[c-1], x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
    if (selectedX === x && selectedY === y) {
        graphics.strokeRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
}

function clearSelection() {
    // remove selection graphics
    var previousX = selectedX;
    var previousY = selectedY;
    selectedX = -1;
    selectedY = -1;
    renderCell(previousX, previousY);
}

// TODO
var _event; // use to check if you mouse up over the same cell you moused down on
function canvasMouseDown(event) {
    _event = event;
}

function cellMouseDown(x,y) {
}

function canvasMouseUp(event) {
    var x = Math.floor(event.offsetX / CELL_SIZE);
    var y = Math.floor(event.offsetY / CELL_SIZE);
    cellMouseUp(x, y)
}

function cellMouseUp(x, y) {
    if (selectedX === -1) {
        selectedX = x;
        selectedY = y;
        renderCell(x, y);
    } else {
        if (areCellsAdjacent(selectedX, selectedY, x, y)
                && (getCellColor(x, y) !== 0 && getCellColor(selectedX, selectedY) !== 0)) {
            var debugTemp = colors.slice();
            swapCells(selectedX, selectedY, x, y);
            checkForMatch(x, y);
            checkForMatch(selectedX, selectedY);
            var debugMatches = pendingMatches.slice();
            if (pendingMatches.length === 0) {
                // undo illegal move
                swapCells(selectedX, selectedY, x, y);
                clearSelection();
            } else {
                resolveMatchesCascade();
                {// debug
                    var hasEmpties = false;
                    for (var i = 0; i < 64; i++) {
                        if (colors[i] === 0) {
                            hasEmpties = true;
                            break;
                        }
                    } 
                    if (hasEmpties || colors.length > 64) {
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
                renderBoard();
            }
        } else {
            clearSelection();
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

    resolve() {
        var startX = this.originX + this.offsetX;
        var startY = this.originY + this.offsetY;

        for (var x = startX; x < startX + this.lengthX; x++) {
            setCellColor(x, this.originY, 0);
        }

        for (var y = startY; y < startY + this.lengthY; y++) {
            setCellColor(this.originX, y, 0);
        }
    }
}

function checkForMatch(originX, originY) {
    const originColor = getCellColor(originX, originY);
    var lx = 1, ly = 1, offx = 0, offy = 0;

    var y = originY - 1;
    while (y >= 0 && getCellColor(originX, y) == originColor) {
        ly++;
        offy--;
        y--;
    }
    y = originY + 1;
    while (y < H && getCellColor(originX, y) == originColor) {
        ly++;
        y++;
    }
    var x = originX - 1;
    while (x >= 0 && getCellColor(x, originY) == originColor) {
        lx++;
        offx--;
        x--;
    }
    x = originX + 1;
    while (x < W && getCellColor(x, originY) == originColor) {
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
        pendingMatches.push(new Match(originX, originY, offx, offy, lx, ly));
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
function resolveMatchesCascade() {
    for (var i = 0; i < pendingMatches.length; i++) {
        pendingMatches[i].resolve();
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
                if (getCellColor(x, y) === 0) {
                    while (nextNonEmptyY > 0 && getCellColor(x,nextNonEmptyY) === 0) nextNonEmptyY--;
                    swapCells(x,y, x,nextNonEmptyY);
                }
            }
        }
        // fill top row with randoms
        for (var x = startX; x < endX; x++) {
            var lowestEmptyRow = 0; // by lowest, I mean spacially, think of a spreadsheet
            while (getCellColor(x, lowestEmptyRow) === 0) {
                setCellColor(x, lowestEmptyRow, getRandomInt(1,7));
                lowestEmptyRow++;
            }
        }
    }
    pendingMatches = [];
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

function init() {
    canvas = document.getElementById('game');
    canvas.width = W * CELL_SIZE;
    canvas.height = H * CELL_SIZE;
    graphics = canvas.getContext('2d');
    createBoard();
    loadImages().then(() => {
        renderBoard();
        canvas.onmousedown = canvasMouseDown;
        canvas.onmouseup = canvasMouseUp;
    });
}

init();
