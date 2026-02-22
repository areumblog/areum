'use strict';

const SUITS = {
  DOTS: 'dots',
  BAMBOO: 'bamboo',
  CHARACTERS: 'characters',
  WINDS: 'winds',
  DRAGONS: 'dragons',
  FLOWERS: 'flowers',
  SEASONS: 'seasons'
};

const WIND_VALUES = ['east', 'south', 'west', 'north'];
const DRAGON_VALUES = ['red', 'green', 'white'];
const FLOWER_VALUES = ['plum', 'orchid', 'chrysanthemum', 'bamboo_flower'];
const SEASON_VALUES = ['spring', 'summer', 'autumn', 'winter'];

const TILE_DISPLAY = {
  dots: { name: 'Dots', symbol: '筒', values: ['一', '二', '三', '四', '五', '六', '七', '八', '九'] },
  bamboo: { name: 'Bamboo', symbol: '索', values: ['一', '二', '三', '四', '五', '六', '七', '八', '九'] },
  characters: { name: 'Characters', symbol: '萬', values: ['一', '二', '三', '四', '五', '六', '七', '八', '九'] },
  winds: { name: 'Winds', values: { east: '東', south: '南', west: '西', north: '北' } },
  dragons: { name: 'Dragons', values: { red: '中', green: '發', white: '白' } },
  flowers: { name: 'Flowers', values: { plum: '梅', orchid: '蘭', chrysanthemum: '菊', bamboo_flower: '竹' } },
  seasons: { name: 'Seasons', values: { spring: '春', summer: '夏', autumn: '秋', winter: '冬' } }
};

function createTileSet() {
  const tiles = [];
  let id = 0;

  // Suited tiles: 4 copies each
  for (const suit of [SUITS.DOTS, SUITS.BAMBOO, SUITS.CHARACTERS]) {
    for (let value = 1; value <= 9; value++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({ id: id++, suit, value, copy });
      }
    }
  }

  // Wind tiles: 4 copies each
  for (const value of WIND_VALUES) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ id: id++, suit: SUITS.WINDS, value, copy });
    }
  }

  // Dragon tiles: 4 copies each
  for (const value of DRAGON_VALUES) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ id: id++, suit: SUITS.DRAGONS, value, copy });
    }
  }

  // Flowers: 1 each
  for (const value of FLOWER_VALUES) {
    tiles.push({ id: id++, suit: SUITS.FLOWERS, value, copy: 0 });
  }

  // Seasons: 1 each
  for (const value of SEASON_VALUES) {
    tiles.push({ id: id++, suit: SUITS.SEASONS, value, copy: 0 });
  }

  return tiles; // 144 tiles total
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function tileKey(tile) {
  return `${tile.suit}_${tile.value}`;
}

function tilesMatch(a, b) {
  return a.suit === b.suit && a.value === b.value;
}

function isSuitedTile(tile) {
  return [SUITS.DOTS, SUITS.BAMBOO, SUITS.CHARACTERS].includes(tile.suit);
}

function isHonorTile(tile) {
  return tile.suit === SUITS.WINDS || tile.suit === SUITS.DRAGONS;
}

function isBonusTile(tile) {
  return tile.suit === SUITS.FLOWERS || tile.suit === SUITS.SEASONS;
}

function isTerminal(tile) {
  return isSuitedTile(tile) && (tile.value === 1 || tile.value === 9);
}

function isTerminalOrHonor(tile) {
  return isTerminal(tile) || isHonorTile(tile);
}

// Sort tiles for display
function sortTiles(tiles) {
  const suitOrder = { dots: 0, bamboo: 1, characters: 2, winds: 3, dragons: 4, flowers: 5, seasons: 6 };
  const windOrder = { east: 0, south: 1, west: 2, north: 3 };
  const dragonOrder = { red: 0, green: 1, white: 2 };

  return [...tiles].sort((a, b) => {
    if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
    if (a.suit === SUITS.WINDS) return windOrder[a.value] - windOrder[b.value];
    if (a.suit === SUITS.DRAGONS) return dragonOrder[a.value] - dragonOrder[b.value];
    return a.value - b.value;
  });
}

// Check if a set of tiles forms a valid winning hand
// Standard winning hand: 4 sets (chow/pong) + 1 pair
// Returns array of possible hand decompositions
function findWinningDecompositions(handTiles) {
  const results = [];
  const sorted = sortTiles(handTiles);

  function decompose(remaining, melds, pairFound) {
    if (remaining.length === 0 && pairFound) {
      results.push([...melds]);
      return;
    }
    if (remaining.length === 0) return;

    const first = remaining[0];
    const rest = remaining.slice(1);

    // Try pair (only if no pair yet)
    if (!pairFound) {
      const pairIdx = rest.findIndex(t => tilesMatch(t, first));
      if (pairIdx >= 0) {
        const newRemaining = [...rest.slice(0, pairIdx), ...rest.slice(pairIdx + 1)];
        decompose(newRemaining, [...melds, { type: 'pair', tiles: [first, rest[pairIdx]] }], true);
      }
    }

    // Try pong (triplet)
    const matches = rest.filter(t => tilesMatch(t, first));
    if (matches.length >= 2) {
      let newRemaining = [...rest];
      let pongTiles = [first];
      let count = 0;
      for (let i = 0; i < newRemaining.length && count < 2; i++) {
        if (tilesMatch(newRemaining[i], first)) {
          pongTiles.push(newRemaining[i]);
          newRemaining.splice(i, 1);
          i--;
          count++;
        }
      }
      decompose(newRemaining, [...melds, { type: 'pong', tiles: pongTiles }], pairFound);
    }

    // Try chow (sequence) - only for suited tiles
    if (isSuitedTile(first)) {
      const val = first.value;
      const suit = first.suit;
      const next1Idx = rest.findIndex(t => t.suit === suit && t.value === val + 1);
      if (next1Idx >= 0) {
        const afterFirst = [...rest.slice(0, next1Idx), ...rest.slice(next1Idx + 1)];
        const next2Idx = afterFirst.findIndex(t => t.suit === suit && t.value === val + 2);
        if (next2Idx >= 0) {
          const newRemaining = [...afterFirst.slice(0, next2Idx), ...afterFirst.slice(next2Idx + 1)];
          decompose(newRemaining, [...melds, { type: 'chow', tiles: [first, rest[next1Idx], afterFirst[next2Idx]] }], pairFound);
        }
      }
    }
  }

  decompose(sorted, [], false);
  return results;
}

// Check for Thirteen Orphans (十三幺)
function isThirteenOrphans(handTiles) {
  if (handTiles.length !== 14) return false;

  const required = [
    { suit: SUITS.DOTS, value: 1 }, { suit: SUITS.DOTS, value: 9 },
    { suit: SUITS.BAMBOO, value: 1 }, { suit: SUITS.BAMBOO, value: 9 },
    { suit: SUITS.CHARACTERS, value: 1 }, { suit: SUITS.CHARACTERS, value: 9 },
    { suit: SUITS.WINDS, value: 'east' }, { suit: SUITS.WINDS, value: 'south' },
    { suit: SUITS.WINDS, value: 'west' }, { suit: SUITS.WINDS, value: 'north' },
    { suit: SUITS.DRAGONS, value: 'red' }, { suit: SUITS.DRAGONS, value: 'green' },
    { suit: SUITS.DRAGONS, value: 'white' }
  ];

  const remaining = [...handTiles];
  for (const req of required) {
    const idx = remaining.findIndex(t => t.suit === req.suit && t.value === req.value);
    if (idx < 0) return false;
    remaining.splice(idx, 1);
  }

  // The 14th tile must match one of the required tiles (pair)
  return remaining.length === 1 && required.some(r => r.suit === remaining[0].suit && r.value === remaining[0].value);
}

// Check for Seven Pairs (七對子)
function isSevenPairs(handTiles) {
  if (handTiles.length !== 14) return false;
  const sorted = sortTiles(handTiles);
  for (let i = 0; i < 14; i += 2) {
    if (!tilesMatch(sorted[i], sorted[i + 1])) return false;
  }
  return true;
}

// HK Mahjong Faan Calculation
function calculateFaan(hand, melds, seatWind, prevailingWind, selfDrawn, lastTile, isLastWallTile, isKongReplacement, isRobbingKong) {
  // hand: concealed tiles (excluding melds)
  // melds: all melds (both concealed and exposed)
  // All tiles combined for analysis
  const allMelds = [...melds];
  const allTiles = [];
  for (const m of allMelds) {
    allTiles.push(...m.tiles);
  }
  // Add the pair if present
  const handTilesForAnalysis = [...hand];
  allTiles.push(...handTilesForAnalysis);

  let faan = 0;
  const fanDetails = [];

  const exposedMelds = allMelds.filter(m => m.exposed);
  const concealedMelds = allMelds.filter(m => !m.exposed);
  const isFullyConcealed = exposedMelds.length === 0;

  // Collect all sets (excluding pair)
  const sets = allMelds.filter(m => m.type !== 'pair');
  const pair = allMelds.find(m => m.type === 'pair');

  // Check suits present
  const suitedTiles = allTiles.filter(t => isSuitedTile(t));
  const honorTiles = allTiles.filter(t => isHonorTile(t));
  const suits = new Set(suitedTiles.map(t => t.suit));

  // Dragon pongs/kongs
  const dragonSets = sets.filter(s => s.tiles[0].suit === SUITS.DRAGONS);
  for (const ds of dragonSets) {
    faan += 1;
    fanDetails.push(`Dragon ${ds.tiles[0].value} (1 faan)`);
  }

  // Seat wind pong/kong
  const seatWindSets = sets.filter(s => s.tiles[0].suit === SUITS.WINDS && s.tiles[0].value === seatWind);
  if (seatWindSets.length > 0) {
    faan += 1;
    fanDetails.push('Seat Wind (1 faan)');
  }

  // Prevailing wind pong/kong
  const prevWindSets = sets.filter(s => s.tiles[0].suit === SUITS.WINDS && s.tiles[0].value === prevailingWind);
  if (prevWindSets.length > 0) {
    faan += 1;
    fanDetails.push('Prevailing Wind (1 faan)');
  }

  // Self-drawn (自摸)
  if (selfDrawn) {
    faan += 1;
    fanDetails.push('Self-Drawn (1 faan)');
  }

  // All Chows (平糊) - all sets are chows, pair is not dragons/winds
  const allChows = sets.length > 0 && sets.every(s => s.type === 'chow');
  if (allChows && pair && !isHonorTile(pair.tiles[0]) && isFullyConcealed) {
    faan += 1;
    fanDetails.push('All Chows / Concealed (1 faan)');
  }

  // All Pongs (對對糊)
  const allPongs = sets.length > 0 && sets.every(s => s.type === 'pong' || s.type === 'kong');
  if (allPongs) {
    faan += 3;
    fanDetails.push('All Pongs (3 faan)');
  }

  // Mixed One Suit (混一色) - one suit + honors
  if (suits.size === 1 && honorTiles.length > 0) {
    faan += 3;
    fanDetails.push('Mixed One Suit (3 faan)');
  }

  // Pure One Suit (清一色) - one suit, no honors
  if (suits.size === 1 && honorTiles.length === 0 && suitedTiles.length > 0) {
    faan += 7;
    fanDetails.push('Pure One Suit (7 faan)');
  }

  // All Honors (字一色)
  if (suitedTiles.length === 0 && honorTiles.length === allTiles.length) {
    faan = 10; // Limit hand
    fanDetails.length = 0;
    fanDetails.push('All Honors (Limit)');
  }

  // Small Three Dragons (小三元)
  const dragonPongs = dragonSets.length;
  const dragonPair = pair && pair.tiles[0].suit === SUITS.DRAGONS;
  if (dragonPongs === 2 && dragonPair) {
    faan += 5;
    fanDetails.push('Small Three Dragons (5 faan)');
  }

  // Big Three Dragons (大三元)
  if (dragonPongs === 3) {
    faan = 10;
    fanDetails.length = 0;
    fanDetails.push('Big Three Dragons (Limit)');
  }

  // Small Four Winds (小四喜)
  const windSets = sets.filter(s => s.tiles[0].suit === SUITS.WINDS);
  const windPair = pair && pair.tiles[0].suit === SUITS.WINDS;
  if (windSets.length === 3 && windPair) {
    faan += 6;
    fanDetails.push('Small Four Winds (6 faan)');
  }

  // Big Four Winds (大四喜)
  if (windSets.length === 4) {
    faan = 10;
    fanDetails.length = 0;
    fanDetails.push('Big Four Winds (Limit)');
  }

  // Fully Concealed Hand with self-draw
  if (isFullyConcealed && selfDrawn && !allChows) {
    faan += 1;
    fanDetails.push('Fully Concealed (1 faan)');
  }

  // Last tile from wall
  if (isLastWallTile) {
    faan += 1;
    fanDetails.push('Last Tile Draw (1 faan)');
  }

  // Win on Kong replacement
  if (isKongReplacement) {
    faan += 1;
    fanDetails.push('Kong Replacement Win (1 faan)');
  }

  // Robbing the Kong
  if (isRobbingKong) {
    faan += 1;
    fanDetails.push('Robbing the Kong (1 faan)');
  }

  // Flower bonus (calculated separately based on player flowers)

  return { faan, details: fanDetails };
}

// Calculate flower faan
function calculateFlowerFaan(flowers, seatWindIndex) {
  let faan = 0;
  const details = [];

  // Each flower/season = 1 faan if it matches seat
  // Flower set matching seat: plum=east(0), orchid=south(1), chrysanthemum=west(2), bamboo=north(3)
  // Season set matching seat: spring=east(0), summer=south(1), autumn=west(2), winter=north(3)
  const flowerMatch = [FLOWER_VALUES[seatWindIndex], SEASON_VALUES[seatWindIndex]];

  for (const f of flowers) {
    if (flowerMatch.includes(f.value)) {
      faan += 1;
      details.push(`Matching ${f.value} (1 faan)`);
    }
  }

  // Complete set of flowers
  const hasAllFlowers = FLOWER_VALUES.every(fv => flowers.some(f => f.value === fv));
  if (hasAllFlowers) {
    faan += 2;
    details.push('Complete Flowers (2 faan)');
  }

  // Complete set of seasons
  const hasAllSeasons = SEASON_VALUES.every(sv => flowers.some(f => f.value === sv));
  if (hasAllSeasons) {
    faan += 2;
    details.push('Complete Seasons (2 faan)');
  }

  return { faan, details };
}

const PHASES = {
  WAITING: 'waiting',
  DEALING: 'dealing',
  PLAYING: 'playing',
  CLAIM: 'claim',
  FINISHED: 'finished'
};

class MahjongGame {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = [null, null, null, null]; // seat 0=East, 1=South, 2=West, 3=North
    this.phase = PHASES.WAITING;
    this.wall = [];
    this.deadWall = [];
    this.hands = [[], [], [], []];
    this.melds = [[], [], [], []]; // exposed melds
    this.concealedKongs = [[], [], [], []];
    this.discards = [[], [], [], []];
    this.flowers = [[], [], [], []];
    this.currentPlayer = 0;
    this.dealerIndex = 0;
    this.prevailingWind = 'east';
    this.roundNumber = 0;
    this.turnNumber = 0;
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.pendingClaims = {};
    this.claimTimer = null;
    this.drawnTile = null;
    this.lastAction = null;
    this.gameLog = [];
    this.scores = [0, 0, 0, 0];
    this.isKongReplacement = false;
    this.spectators = [];
  }

  getSeatWind(seatIndex) {
    return WIND_VALUES[(seatIndex - this.dealerIndex + 4) % 4];
  }

  initializeGame() {
    this.wall = shuffle(createTileSet());
    this.deadWall = this.wall.splice(-14); // Last 14 tiles as dead wall
    this.hands = [[], [], [], []];
    this.melds = [[], [], [], []];
    this.concealedKongs = [[], [], [], []];
    this.discards = [[], [], [], []];
    this.flowers = [[], [], [], []];
    this.currentPlayer = this.dealerIndex;
    this.turnNumber = 0;
    this.lastDiscard = null;
    this.lastDiscardPlayer = -1;
    this.pendingClaims = {};
    this.drawnTile = null;
    this.lastAction = null;
    this.isKongReplacement = false;
    this.gameLog = [];
    this.phase = PHASES.DEALING;

    // Deal 13 tiles to each player
    for (let round = 0; round < 3; round++) {
      for (let p = 0; p < 4; p++) {
        const seat = (this.dealerIndex + p) % 4;
        for (let i = 0; i < 4; i++) {
          this.hands[seat].push(this.wall.shift());
        }
      }
    }
    // Deal 1 more to each
    for (let p = 0; p < 4; p++) {
      const seat = (this.dealerIndex + p) % 4;
      this.hands[seat].push(this.wall.shift());
    }
    // Dealer gets 1 extra (14th tile)
    this.hands[this.dealerIndex].push(this.wall.shift());

    // Handle bonus tiles (flowers/seasons) - replace with new draws
    for (let p = 0; p < 4; p++) {
      this.replaceBonusTiles(p);
    }

    // Sort hands
    for (let p = 0; p < 4; p++) {
      this.hands[p] = sortTiles(this.hands[p]);
    }

    this.phase = PHASES.PLAYING;
    this.addLog(`Game started. ${WIND_VALUES[0].toUpperCase()} wind round.`);
    this.addLog(`${this.getPlayerName(this.dealerIndex)} is the dealer (East).`);

    return this.getFullState();
  }

  replaceBonusTiles(playerIndex) {
    let replaced = true;
    while (replaced) {
      replaced = false;
      for (let i = this.hands[playerIndex].length - 1; i >= 0; i--) {
        const tile = this.hands[playerIndex][i];
        if (isBonusTile(tile)) {
          this.flowers[playerIndex].push(tile);
          this.hands[playerIndex].splice(i, 1);
          // Draw replacement from dead wall or wall
          const replacement = this.deadWall.length > 0 ? this.deadWall.shift() : this.wall.shift();
          if (replacement) {
            this.hands[playerIndex].push(replacement);
            replaced = true;
            this.addLog(`${this.getPlayerName(playerIndex)} drew bonus tile ${this.getTileDisplayName(tile)} and replaced it.`);
          }
        }
      }
    }
  }

  drawTile(playerIndex) {
    if (this.wall.length === 0) {
      this.phase = PHASES.FINISHED;
      this.addLog('Wall exhausted. Game is a draw.');
      return { action: 'draw_game' };
    }

    const tile = this.wall.shift();
    this.hands[playerIndex].push(tile);
    this.drawnTile = tile;
    this.turnNumber++;

    // Check for bonus tile
    if (isBonusTile(tile)) {
      this.flowers[playerIndex].push(tile);
      this.hands[playerIndex] = this.hands[playerIndex].filter(t => t.id !== tile.id);
      this.addLog(`${this.getPlayerName(playerIndex)} drew bonus tile ${this.getTileDisplayName(tile)}.`);
      // Draw replacement
      return this.drawReplacementTile(playerIndex);
    }

    this.addLog(`${this.getPlayerName(playerIndex)} drew a tile.`);

    // Check if player can win (self-draw / 自摸)
    const canWin = this.checkWinCondition(playerIndex);
    // Check if player can declare kong
    const canKong = this.findKongOptions(playerIndex);

    return {
      action: 'tile_drawn',
      tile: tile,
      playerIndex,
      canWin,
      canKong,
      wallRemaining: this.wall.length
    };
  }

  drawReplacementTile(playerIndex) {
    this.isKongReplacement = true;
    const source = this.deadWall.length > 0 ? this.deadWall : this.wall;
    if (source.length === 0) {
      this.phase = PHASES.FINISHED;
      return { action: 'draw_game' };
    }

    const tile = source.shift();
    this.hands[playerIndex].push(tile);
    this.drawnTile = tile;

    if (isBonusTile(tile)) {
      this.flowers[playerIndex].push(tile);
      this.hands[playerIndex] = this.hands[playerIndex].filter(t => t.id !== tile.id);
      return this.drawReplacementTile(playerIndex);
    }

    const canWin = this.checkWinCondition(playerIndex);
    const canKong = this.findKongOptions(playerIndex);

    return {
      action: 'tile_drawn',
      tile,
      playerIndex,
      canWin,
      canKong,
      isReplacement: true,
      wallRemaining: this.wall.length
    };
  }

  discardTile(playerIndex, tileId) {
    if (this.phase !== PHASES.PLAYING || this.currentPlayer !== playerIndex) {
      return { error: 'Not your turn' };
    }

    const tileIdx = this.hands[playerIndex].findIndex(t => t.id === tileId);
    if (tileIdx < 0) return { error: 'Tile not in hand' };

    const tile = this.hands[playerIndex].splice(tileIdx, 1)[0];
    this.discards[playerIndex].push(tile);
    this.lastDiscard = tile;
    this.lastDiscardPlayer = playerIndex;
    this.drawnTile = null;
    this.isKongReplacement = false;

    this.hands[playerIndex] = sortTiles(this.hands[playerIndex]);
    this.addLog(`${this.getPlayerName(playerIndex)} discarded ${this.getTileDisplayName(tile)}.`);

    // Check if any other player can claim
    const claims = this.checkClaims(playerIndex, tile);

    if (claims.length > 0) {
      this.phase = PHASES.CLAIM;
      this.pendingClaims = {};
      return {
        action: 'tile_discarded',
        tile,
        playerIndex,
        claims,
        wallRemaining: this.wall.length
      };
    }

    // No claims possible, next player draws
    this.currentPlayer = (playerIndex + 1) % 4;
    return {
      action: 'tile_discarded',
      tile,
      playerIndex,
      nextPlayer: this.currentPlayer,
      wallRemaining: this.wall.length
    };
  }

  checkClaims(discardPlayer, tile) {
    const claims = [];

    for (let p = 0; p < 4; p++) {
      if (p === discardPlayer) continue;

      const playerClaims = [];

      // Check win
      const testHand = [...this.hands[p], tile];
      if (this.canFormWinningHand(testHand, this.melds[p], this.concealedKongs[p])) {
        playerClaims.push({ type: 'win', playerIndex: p });
      }

      // Check kong
      const kongCount = this.hands[p].filter(t => tilesMatch(t, tile)).length;
      if (kongCount === 3) {
        playerClaims.push({ type: 'kong', playerIndex: p, tiles: this.hands[p].filter(t => tilesMatch(t, tile)) });
      }

      // Check pong
      if (kongCount >= 2) {
        playerClaims.push({ type: 'pong', playerIndex: p });
      }

      // Check chow (only next player)
      if (p === (discardPlayer + 1) % 4 && isSuitedTile(tile)) {
        const chowOptions = this.findChowOptions(p, tile);
        if (chowOptions.length > 0) {
          playerClaims.push({ type: 'chow', playerIndex: p, options: chowOptions });
        }
      }

      if (playerClaims.length > 0) {
        claims.push(...playerClaims);
      }
    }

    return claims;
  }

  findChowOptions(playerIndex, tile) {
    if (!isSuitedTile(tile)) return [];
    const options = [];
    const hand = this.hands[playerIndex];
    const val = tile.value;
    const suit = tile.suit;

    // tile is the lowest: need val+1, val+2
    if (val <= 7) {
      const t1 = hand.find(t => t.suit === suit && t.value === val + 1);
      const t2 = hand.find(t => t.suit === suit && t.value === val + 2);
      if (t1 && t2) options.push([tile, t1, t2]);
    }
    // tile is the middle: need val-1, val+1
    if (val >= 2 && val <= 8) {
      const t1 = hand.find(t => t.suit === suit && t.value === val - 1);
      const t2 = hand.find(t => t.suit === suit && t.value === val + 1);
      if (t1 && t2) options.push([t1, tile, t2]);
    }
    // tile is the highest: need val-2, val-1
    if (val >= 3) {
      const t1 = hand.find(t => t.suit === suit && t.value === val - 2);
      const t2 = hand.find(t => t.suit === suit && t.value === val - 1);
      if (t1 && t2) options.push([t1, t2, tile]);
    }

    return options;
  }

  findKongOptions(playerIndex) {
    const hand = this.hands[playerIndex];
    const options = [];

    // Concealed kong: 4 of same tile in hand
    const counts = {};
    for (const t of hand) {
      const key = tileKey(t);
      counts[key] = (counts[key] || 0) + 1;
    }
    for (const [key, count] of Object.entries(counts)) {
      if (count === 4) {
        options.push({
          type: 'concealed_kong',
          tiles: hand.filter(t => tileKey(t) === key)
        });
      }
    }

    // Exposed kong (add to existing pong): have 1 in hand matching an exposed pong
    for (const meld of this.melds[playerIndex]) {
      if (meld.type === 'pong') {
        const matching = hand.find(t => tilesMatch(t, meld.tiles[0]));
        if (matching) {
          options.push({
            type: 'add_kong',
            tile: matching,
            meldIndex: this.melds[playerIndex].indexOf(meld)
          });
        }
      }
    }

    return options;
  }

  processClaim(playerIndex, claimType, claimData) {
    if (this.phase !== PHASES.CLAIM) {
      // Allow kong/win during playing phase too
      if (this.phase !== PHASES.PLAYING) {
        return { error: 'No claim phase active' };
      }
    }

    // Handle self-draw win
    if (claimType === 'win' && this.phase === PHASES.PLAYING && this.currentPlayer === playerIndex) {
      return this.processWin(playerIndex, true);
    }

    // Handle concealed kong during playing phase
    if (claimType === 'concealed_kong' && this.phase === PHASES.PLAYING && this.currentPlayer === playerIndex) {
      return this.processConcealedKong(playerIndex, claimData);
    }

    // Handle add kong during playing phase
    if (claimType === 'add_kong' && this.phase === PHASES.PLAYING && this.currentPlayer === playerIndex) {
      return this.processAddKong(playerIndex, claimData);
    }

    if (this.phase !== PHASES.CLAIM) {
      return { error: 'No claim phase active' };
    }

    this.pendingClaims[playerIndex] = { type: claimType, data: claimData };

    // Check if all potential claimers have responded
    if (this.allClaimsResolved()) {
      return this.resolveClaims();
    }

    return { action: 'claim_registered', playerIndex, claimType };
  }

  passClaimAction(playerIndex) {
    if (this.phase !== PHASES.CLAIM) return { error: 'No claim phase' };
    this.pendingClaims[playerIndex] = { type: 'pass' };

    if (this.allClaimsResolved()) {
      return this.resolveClaims();
    }
    return { action: 'pass_registered', playerIndex };
  }

  allClaimsResolved() {
    for (let p = 0; p < 4; p++) {
      if (p === this.lastDiscardPlayer) continue;
      if (!(p in this.pendingClaims)) {
        // Check if player even has any possible claims
        const claims = this.checkClaims(this.lastDiscardPlayer, this.lastDiscard);
        const playerClaims = claims.filter(c => c.playerIndex === p);
        if (playerClaims.length > 0 && !(p in this.pendingClaims)) {
          return false;
        }
      }
    }
    return true;
  }

  resolveClaims() {
    // Priority: Win > Kong/Pong > Chow
    const priority = { win: 3, kong: 2, pong: 2, chow: 1, pass: 0 };

    let bestClaim = null;
    let bestPriority = 0;

    for (const [pStr, claim] of Object.entries(this.pendingClaims)) {
      const p = parseInt(pStr);
      const pri = priority[claim.type] || 0;
      if (pri > bestPriority) {
        bestPriority = pri;
        bestClaim = { playerIndex: p, ...claim };
      }
    }

    this.pendingClaims = {};
    this.phase = PHASES.PLAYING;

    if (!bestClaim || bestClaim.type === 'pass') {
      // No claims, next player draws
      this.currentPlayer = (this.lastDiscardPlayer + 1) % 4;
      return {
        action: 'claims_resolved',
        result: 'pass',
        nextPlayer: this.currentPlayer
      };
    }

    const tile = this.lastDiscard;
    // Remove tile from discards
    const discardIdx = this.discards[this.lastDiscardPlayer].findIndex(t => t.id === tile.id);
    if (discardIdx >= 0) {
      this.discards[this.lastDiscardPlayer].splice(discardIdx, 1);
    }

    switch (bestClaim.type) {
      case 'win':
        this.hands[bestClaim.playerIndex].push(tile);
        return this.processWin(bestClaim.playerIndex, false);

      case 'kong': {
        const kongTiles = this.hands[bestClaim.playerIndex].filter(t => tilesMatch(t, tile));
        for (const kt of kongTiles) {
          const idx = this.hands[bestClaim.playerIndex].findIndex(t => t.id === kt.id);
          if (idx >= 0) this.hands[bestClaim.playerIndex].splice(idx, 1);
        }
        this.melds[bestClaim.playerIndex].push({
          type: 'kong',
          tiles: [...kongTiles, tile],
          exposed: true,
          source: this.lastDiscardPlayer
        });
        this.currentPlayer = bestClaim.playerIndex;
        this.addLog(`${this.getPlayerName(bestClaim.playerIndex)} declared Kong on ${this.getTileDisplayName(tile)}!`);
        // Draw replacement tile
        return this.drawReplacementTile(bestClaim.playerIndex);
      }

      case 'pong': {
        const pongTiles = [];
        let count = 0;
        for (let i = this.hands[bestClaim.playerIndex].length - 1; i >= 0 && count < 2; i--) {
          if (tilesMatch(this.hands[bestClaim.playerIndex][i], tile)) {
            pongTiles.push(this.hands[bestClaim.playerIndex].splice(i, 1)[0]);
            count++;
          }
        }
        this.melds[bestClaim.playerIndex].push({
          type: 'pong',
          tiles: [...pongTiles, tile],
          exposed: true,
          source: this.lastDiscardPlayer
        });
        this.currentPlayer = bestClaim.playerIndex;
        this.hands[bestClaim.playerIndex] = sortTiles(this.hands[bestClaim.playerIndex]);
        this.addLog(`${this.getPlayerName(bestClaim.playerIndex)} declared Pong on ${this.getTileDisplayName(tile)}!`);
        return {
          action: 'meld_made',
          meldType: 'pong',
          playerIndex: bestClaim.playerIndex,
          tile,
          nextPlayer: bestClaim.playerIndex
        };
      }

      case 'chow': {
        const chowTiles = bestClaim.data.tiles || [];
        for (const ct of chowTiles) {
          if (ct.id !== tile.id) {
            const idx = this.hands[bestClaim.playerIndex].findIndex(t => t.id === ct.id);
            if (idx >= 0) this.hands[bestClaim.playerIndex].splice(idx, 1);
          }
        }
        const meldTiles = chowTiles.length > 0 ? chowTiles : [tile];
        this.melds[bestClaim.playerIndex].push({
          type: 'chow',
          tiles: sortTiles(meldTiles),
          exposed: true,
          source: this.lastDiscardPlayer
        });
        this.currentPlayer = bestClaim.playerIndex;
        this.hands[bestClaim.playerIndex] = sortTiles(this.hands[bestClaim.playerIndex]);
        this.addLog(`${this.getPlayerName(bestClaim.playerIndex)} declared Chow on ${this.getTileDisplayName(tile)}!`);
        return {
          action: 'meld_made',
          meldType: 'chow',
          playerIndex: bestClaim.playerIndex,
          tile,
          nextPlayer: bestClaim.playerIndex
        };
      }
    }

    return { action: 'claims_resolved', result: 'none' };
  }

  processConcealedKong(playerIndex, data) {
    const tiles = data.tiles;
    if (!tiles || tiles.length !== 4) return { error: 'Invalid kong' };

    for (const t of tiles) {
      const idx = this.hands[playerIndex].findIndex(h => h.id === t.id);
      if (idx >= 0) this.hands[playerIndex].splice(idx, 1);
    }

    this.concealedKongs[playerIndex].push({
      type: 'kong',
      tiles,
      exposed: false
    });

    this.hands[playerIndex] = sortTiles(this.hands[playerIndex]);
    this.addLog(`${this.getPlayerName(playerIndex)} declared a concealed Kong!`);
    return this.drawReplacementTile(playerIndex);
  }

  processAddKong(playerIndex, data) {
    const tile = data.tile;
    const meldIndex = data.meldIndex;

    const idx = this.hands[playerIndex].findIndex(t => t.id === tile.id);
    if (idx < 0) return { error: 'Tile not in hand' };

    // Check if anyone can rob the kong (win)
    for (let p = 0; p < 4; p++) {
      if (p === playerIndex) continue;
      const testHand = [...this.hands[p], tile];
      if (this.canFormWinningHand(testHand, this.melds[p], this.concealedKongs[p])) {
        // Someone can rob the kong - enter claim phase
        this.lastDiscard = tile;
        this.lastDiscardPlayer = playerIndex;
        this.phase = PHASES.CLAIM;
        this.pendingClaims = {};
        return {
          action: 'kong_robbery_possible',
          tile,
          playerIndex,
          claims: [{ type: 'win', playerIndex: p }]
        };
      }
    }

    this.hands[playerIndex].splice(idx, 1);
    this.melds[playerIndex][meldIndex].tiles.push(tile);
    this.melds[playerIndex][meldIndex].type = 'kong';

    this.hands[playerIndex] = sortTiles(this.hands[playerIndex]);
    this.addLog(`${this.getPlayerName(playerIndex)} added to Kong!`);
    return this.drawReplacementTile(playerIndex);
  }

  canFormWinningHand(handTiles, exposedMelds, concealedKongs) {
    // Check standard winning patterns
    const concealedTiles = handTiles.filter(t => !isBonusTile(t));
    const totalMelds = exposedMelds.length + concealedKongs.length;
    const expectedConcealedTiles = (4 - totalMelds) * 3 + 2;

    if (concealedTiles.length !== expectedConcealedTiles) return false;

    // Check special hands first
    if (totalMelds === 0) {
      if (isThirteenOrphans(concealedTiles)) return true;
      if (isSevenPairs(concealedTiles)) return true;
    }

    // Standard hand decomposition
    const decompositions = findWinningDecompositions(concealedTiles);
    return decompositions.length > 0;
  }

  checkWinCondition(playerIndex) {
    return this.canFormWinningHand(
      this.hands[playerIndex],
      this.melds[playerIndex],
      this.concealedKongs[playerIndex]
    );
  }

  processWin(playerIndex, selfDrawn) {
    const handTiles = this.hands[playerIndex];
    const allMelds = [...this.melds[playerIndex]];
    const concealedTiles = handTiles.filter(t => !isBonusTile(t));
    const totalExposedMelds = allMelds.length + this.concealedKongs[playerIndex].length;

    let decomposition = [];
    let isSpecialHand = false;

    // Check special hands
    if (totalExposedMelds === 0) {
      if (isThirteenOrphans(concealedTiles)) {
        isSpecialHand = true;
        decomposition = [{ type: 'special', name: 'Thirteen Orphans', tiles: concealedTiles }];
      } else if (isSevenPairs(concealedTiles)) {
        isSpecialHand = true;
        const sorted = sortTiles(concealedTiles);
        for (let i = 0; i < 14; i += 2) {
          decomposition.push({ type: 'pair', tiles: [sorted[i], sorted[i + 1]] });
        }
      }
    }

    if (!isSpecialHand) {
      const decompositions = findWinningDecompositions(concealedTiles);
      if (decompositions.length > 0) {
        // Use the decomposition with highest faan
        decomposition = decompositions[0];
        // Add exposed melds
        for (const m of allMelds) {
          decomposition.push(m);
        }
        for (const k of this.concealedKongs[playerIndex]) {
          decomposition.push(k);
        }
      }
    }

    const seatWind = this.getSeatWind(playerIndex);
    const lastTile = selfDrawn ? this.drawnTile : this.lastDiscard;

    let faanResult;
    if (isSpecialHand) {
      if (isThirteenOrphans(concealedTiles)) {
        faanResult = { faan: 13, details: ['Thirteen Orphans (Limit - 13 faan)'] };
      } else {
        // Seven pairs
        faanResult = { faan: 4, details: ['Seven Pairs (4 faan)'] };
        if (selfDrawn) {
          faanResult.faan += 1;
          faanResult.details.push('Self-Drawn (1 faan)');
        }
      }
    } else {
      faanResult = calculateFaan(
        concealedTiles,
        decomposition,
        seatWind,
        this.prevailingWind,
        selfDrawn,
        lastTile,
        this.wall.length === 0,
        this.isKongReplacement,
        false
      );
    }

    // Add flower faan
    const seatWindIndex = WIND_VALUES.indexOf(seatWind);
    const flowerFaan = calculateFlowerFaan(this.flowers[playerIndex], seatWindIndex);
    faanResult.faan += flowerFaan.faan;
    faanResult.details.push(...flowerFaan.details);

    // Calculate payment
    const basePoints = Math.pow(2, Math.min(faanResult.faan, 10));
    const payment = basePoints;

    this.phase = PHASES.FINISHED;

    const winType = selfDrawn ? 'Self-Drawn' : 'Discard';
    this.addLog(`${this.getPlayerName(playerIndex)} wins! (${winType}) - ${faanResult.faan} faan`);

    // Update scores
    if (selfDrawn) {
      for (let p = 0; p < 4; p++) {
        if (p !== playerIndex) {
          this.scores[p] -= payment;
          this.scores[playerIndex] += payment;
        }
      }
    } else {
      this.scores[this.lastDiscardPlayer] -= payment * 3;
      this.scores[playerIndex] += payment * 3;
    }

    return {
      action: 'game_won',
      winner: playerIndex,
      winnerName: this.getPlayerName(playerIndex),
      selfDrawn,
      faan: faanResult,
      decomposition,
      payment,
      scores: [...this.scores],
      lastTile
    };
  }

  getPlayerName(index) {
    if (this.players[index]) {
      return this.players[index].name || `Player ${index + 1}`;
    }
    return `AI ${WIND_VALUES[this.getSeatWindIndex(index)].charAt(0).toUpperCase() + WIND_VALUES[this.getSeatWindIndex(index)].slice(1)}`;
  }

  getSeatWindIndex(seatIndex) {
    return (seatIndex - this.dealerIndex + 4) % 4;
  }

  getPlayerState(playerIndex) {
    return {
      hand: this.hands[playerIndex] ? [...this.hands[playerIndex]] : [],
      melds: this.melds[playerIndex] ? [...this.melds[playerIndex]] : [],
      concealedKongs: this.concealedKongs[playerIndex] ? [...this.concealedKongs[playerIndex]] : [],
      flowers: this.flowers[playerIndex] ? [...this.flowers[playerIndex]] : [],
      discards: this.discards[playerIndex] ? [...this.discards[playerIndex]] : [],
      seatWind: this.getSeatWind(playerIndex),
      score: this.scores[playerIndex]
    };
  }

  getPublicState() {
    const players = [];
    for (let i = 0; i < 4; i++) {
      players.push({
        name: this.getPlayerName(i),
        isAI: !this.players[i],
        isHuman: !!this.players[i],
        handSize: this.hands[i] ? this.hands[i].length : 0,
        melds: this.melds[i] ? [...this.melds[i]] : [],
        concealedKongCount: this.concealedKongs[i] ? this.concealedKongs[i].length : 0,
        flowers: this.flowers[i] ? [...this.flowers[i]] : [],
        discards: this.discards[i] ? [...this.discards[i]] : [],
        seatWind: this.getSeatWind(i),
        score: this.scores[i]
      });
    }

    return {
      roomId: this.roomId,
      phase: this.phase,
      currentPlayer: this.currentPlayer,
      dealerIndex: this.dealerIndex,
      prevailingWind: this.prevailingWind,
      roundNumber: this.roundNumber,
      turnNumber: this.turnNumber,
      wallRemaining: this.wall.length,
      lastDiscard: this.lastDiscard,
      lastDiscardPlayer: this.lastDiscardPlayer,
      players,
      gameLog: this.gameLog.slice(-20)
    };
  }

  getFullState() {
    return {
      ...this.getPublicState(),
      hands: this.hands.map(h => h ? [...h] : [])
    };
  }

  getTileDisplayName(tile) {
    if (isSuitedTile(tile)) {
      return `${tile.value} of ${tile.suit}`;
    }
    return `${tile.value} (${tile.suit})`;
  }

  addLog(message) {
    this.gameLog.push({
      time: Date.now(),
      message
    });
  }

  nextRound() {
    // Move dealer
    this.dealerIndex = (this.dealerIndex + 1) % 4;
    this.roundNumber++;

    // Change prevailing wind every 4 rounds
    if (this.roundNumber % 4 === 0) {
      const windIdx = WIND_VALUES.indexOf(this.prevailingWind);
      this.prevailingWind = WIND_VALUES[(windIdx + 1) % 4];
    }

    return this.initializeGame();
  }
}

module.exports = {
  MahjongGame,
  PHASES,
  SUITS,
  WIND_VALUES,
  DRAGON_VALUES,
  TILE_DISPLAY,
  tileKey,
  tilesMatch,
  isSuitedTile,
  isHonorTile,
  isBonusTile,
  isTerminal,
  sortTiles,
  createTileSet
};
