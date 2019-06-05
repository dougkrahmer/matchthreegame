### Severe
* ~~Getting two horizontal matches, one above the other, in a single move causes the gravity animation to not play properly.~~
  * This is caused by resolveMatches() moving tiles around. It is dependent on the order of matches in the array. This means it's dependent on which direciton the user made the move.
  * The solution is to make the function process the drops in a consistent order. This can be accomplished by sorting the array before processing.

### Less Severe
* You can make a match while tiles are falling elsewhere, but it can cause a race condition that results in rendering errors.

* Making a move while tiles are falling sometimes results in cascades not processing.