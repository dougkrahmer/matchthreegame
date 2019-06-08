

/*
 * VARIOUS TESTS FUNCTIONS FOR EDGE CASES AND BUGS
 * Test coverage here is poor, I only started doing this when I ran into trouble with
 * the de-duplication step, which turned out to be one of the hardest things to write.
 */ 

// tests that a is "equal" to b
// and also that b is "equal" to a
function testEq(a, b, f, expected) {
    var result = f.call(a, b);
    var reverse = f.call(b, a);
    if (result !== reverse || result !== expected) {
        console.log("Test Failed\n",a,b,f.name,expected);
    }
}

// just a regular test
function test(a, b, f, expected) {
    var result = f.call(a, b);
    if (result !== expected) {
        console.log("Test Failed\n",a,b,f.name,expected);
    }
}

function testMatchEquality() {
    const M = Match.prototype;
    var a = new Match(0,0,0,0,3,1);
    var b = new Match(1,0,-1,0,3,1);
    testEq(a, b, M.hasSameCellsAs, true);
    var c = new Match(0,0,0,0,1,3);
    var d = new Match(0,1,0,-1,1,3);
    testEq(c, d, M.hasSameCellsAs, true);
    var e = new Match(1,1,-1,-1,3,3);
    if (e.toStr() != '1,0;0,1;1,1;2,1;1,2;') {
        console.log('Cross-shape failure', e.toStr());
    }
    var L = new Match(0,2,0,-2,3,3);
    if (L.toStr() != '0,0;0,1;0,2;1,2;2,2;') {
        console.log('L-shape failure', L.toStr());
    }
    test(new Match(0,0,0,0,3,3), a, M.isSupersetOf, true);
}

function testI() {
    _colors[0] = _colors[1] = _colors[2] = _colors[9] = _colors[17] = _colors[16] = _colors[18] = 3;
    gRenderBoard();
}

function testSquare() {
    _colors[0] = _colors[1] = _colors[2] = _colors[8] = _colors[9] =
     _colors[10] = _colors[17] = _colors[16] = _colors[18] = 3;
    gRenderBoard();
}

function testU() {
    _colors[0] = _colors[2] = _colors[8] =
     _colors[10] = _colors[17] = _colors[16] = _colors[18] = 3;
    gRenderBoard();
}

function testH() {
    _colors[0] = _colors[2] = _colors[8] = _colors[9] =
     _colors[10] = _colors[16] = _colors[18] = 3;
    gRenderBoard();
}

function testC() {
    _colors[0] = _colors[1] = _colors[2] = _colors[8] =
     _colors[17] = _colors[16] = _colors[18] = 3;
    gRenderBoard();
}

function testDoubleHorizontalMatch() {
    _colors[56] = _colors[49] = _colors[58] = 1;
    _colors[48] = _colors[57] = _colors[50] = 2;
    gRenderBoard();
}

function testCascadePlusShape() {

    _colors[32] = _colors[33] = _colors[1] = _colors[9] = _colors[17] = 7;
    _colors[34] = _colors[25] = _colors[41] = 4;
    gRenderBoard();
}

function expect(expected, f, ...args) {
    if (expected !== f(...args)) {
        console.log('Test Failed', f.name, args);
    }
}

function testMoveDetection() {
    // some random board that had all three match types
    _colors = [
        2, 5, 5, 1, 5, 1, 1, 3, 
        4, 6, 5, 6, 4, 1, 7, 5, 
        7, 7, 3, 5, 7, 3, 3, 5, 
        5, 5, 7, 2, 6, 6, 4, 6, 
        1, 6, 6, 1, 5, 7, 1, 3, 
        1, 6, 4, 4, 7, 6, 7, 3, 
        7, 7, 1, 5, 3, 6, 3, 2, 
        3, 6, 7, 2, 4, 7, 4, 4];
    expect(true, isPossibleMatch,4,0);
    expect(true, isPossibleMatch,2,3);
    expect(true, isPossibleMatch,3,2);
    expect(true, isPossibleMatch,5,4);
    // test edge case at end of B loop
    _colors[44] = _colors[46] = _colors[20] = 2;
    _colors[28] = _colors[30] = 7;
    expect(true, isPossibleMatch,5,4);
}

function testMovesRemainingDeadBoard() {
    _colors = [
        1,1,6,7,6,7,4,6,
        6,7,3,5,1,1,2,6,
        3,2,5,6,2,4,7,2,
        3,5,6,4,3,1,1,5,
        5,2,3,2,5,3,2,6,
        7,4,1,6,7,4,5,7,
        6,4,3,1,6,7,4,1,
        7,7,5,5,2,3,3,6];
    for (var x = 0; x < W; x++) {
        for (var y = 0; y < H; y++) {
            if (isPossibleMatch(x, y)) {
                console.log('Test Failed', x, y);
                return;
            }
        }
    }
}

function printFormattedColorArray(array = _colors) {
    var str = array.toString();
    var subStrings = []
    for (var i = 0; i < (W * H) * 2; i += W * 2) {
        subStrings.push(str.substr(i, W * 2));
    }
    var retval = '[\n' + subStrings.join('\n') + ']';
    // console.log(retval); returning will print in chrome console anyway
    return retval;
}

function testOddsOfGettingUnplayableStart(count = 10000) {
    var fails = 0;
    var unplayables = [];
    for (var i = 0; i < count; i++) {
        createBoard();
        var moveFound = false;
        checkForMatch: for (var x = 0; x < W; x++) {
            for (var y = 0; y < H; y++) {
                if (isPossibleMatch(x, y)) {
                    moveFound = true;
                    break checkForMatch;
                }
            }
        }
        if (!moveFound) {
            fails++;
            unplayables.push(_colors.slice());
        }
    }
    console.log(fails + ' out of ' + count + ' starts were unplayable');
    for (var board of unplayables) {
        console.log(printFormattedColorArray(board));
    }
}