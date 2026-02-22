'use strict';

const { tileKey, tilesMatch, isSuitedTile, isHonorTile, isBonusTile, sortTiles } = require('./MahjongGame');

class AIPlayer {
  constructor(seatIndex, difficulty = 'medium') {
    this.seatIndex = seatIndex;
    this.difficulty = difficulty; // 'easy', 'medium', 'hard'
  }

  // Decide which tile to discard
  chooseDiscard(hand, melds, gameState) {
    const sorted = sortTiles(hand);
    const scores = this.scoreTiles(sorted, melds);

    // Sort by score (lowest = best to discard)
    const ranked = scores.sort((a, b) => a.score - b.score);

    // Add some randomness for easy/medium difficulty
    if (this.difficulty === 'easy') {
      const topN = Math.min(5, ranked.length);
      const idx = Math.floor(Math.random() * topN);
      return ranked[idx].tile;
    }

    if (this.difficulty === 'medium') {
      const topN = Math.min(3, ranked.length);
      const idx = Math.floor(Math.random() * topN);
      return ranked[idx].tile;
    }

    // Hard: always discard the worst tile
    return ranked[0].tile;
  }

  scoreTiles(hand, melds) {
    const scores = [];
    const counts = {};

    for (const t of hand) {
      const key = tileKey(t);
      counts[key] = (counts[key] || 0) + 1;
    }

    for (const tile of hand) {
      let score = 50; // Base score (higher = more valuable to keep)
      const key = tileKey(tile);
      const count = counts[key];

      // Pairs and trips are valuable
      if (count >= 3) score += 80;
      else if (count === 2) score += 40;

      // Suited tiles: check for sequences
      if (isSuitedTile(tile)) {
        const val = tile.value;
        const suit = tile.suit;

        // Check neighbors
        const hasLower2 = hand.some(t => t.suit === suit && t.value === val - 2);
        const hasLower1 = hand.some(t => t.suit === suit && t.value === val - 1);
        const hasUpper1 = hand.some(t => t.suit === suit && t.value === val + 1);
        const hasUpper2 = hand.some(t => t.suit === suit && t.value === val + 2);

        // Part of a sequence
        if (hasLower1 && hasUpper1) score += 60; // Middle of sequence
        else if (hasLower1 && hasLower2) score += 55; // End of sequence
        else if (hasUpper1 && hasUpper2) score += 55; // Start of sequence
        else if (hasLower1 || hasUpper1) score += 30; // Adjacent pair
        else if (hasLower2 || hasUpper2) score += 15; // Gap pair

        // Terminal tiles are slightly less valuable for sequences
        if (val === 1 || val === 9) score -= 5;

        // Middle tiles are more versatile
        if (val >= 3 && val <= 7) score += 5;
      }

      // Honor tiles
      if (isHonorTile(tile)) {
        if (count === 1) score -= 10; // Isolated honor
        // Dragons are valuable
        if (tile.suit === 'dragons') score += 10;
      }

      scores.push({ tile, score });
    }

    return scores;
  }

  // Decide whether to claim a discard
  decideClaim(claims, hand, melds, gameState) {
    // Always claim a win
    if (claims.some(c => c.type === 'win')) {
      return { type: 'win' };
    }

    // Consider kong
    const kongClaim = claims.find(c => c.type === 'kong');
    if (kongClaim) {
      if (this.difficulty === 'hard' || Math.random() > 0.2) {
        return kongClaim;
      }
    }

    // Consider pong
    const pongClaim = claims.find(c => c.type === 'pong');
    if (pongClaim) {
      // Pong is usually good, but not always (breaks concealed hand)
      const handStrength = this.evaluateHandStrength(hand, melds);
      if (handStrength > 0.6 || this.difficulty === 'easy') {
        if (Math.random() > 0.3) return pongClaim;
      } else {
        if (Math.random() > 0.5) return pongClaim;
      }
    }

    // Consider chow
    const chowClaim = claims.find(c => c.type === 'chow');
    if (chowClaim) {
      const handStrength = this.evaluateHandStrength(hand, melds);
      // Only chow if hand is already somewhat developed or on easy difficulty
      if (melds.length >= 1 || handStrength > 0.5) {
        if (Math.random() > 0.4) {
          // Pick the best chow option
          if (chowClaim.options && chowClaim.options.length > 0) {
            return { ...chowClaim, tiles: chowClaim.options[0] };
          }
          return chowClaim;
        }
      }
    }

    return { type: 'pass' };
  }

  // Decide whether to declare kong from hand
  decideKong(kongOptions, hand, melds) {
    if (kongOptions.length === 0) return null;

    // Usually declare kong (free tile draw)
    if (Math.random() > 0.15) {
      return kongOptions[0];
    }
    return null;
  }

  evaluateHandStrength(hand, melds) {
    let score = 0;
    const totalSets = melds.length;

    // Count pairs and potential sets in hand
    const counts = {};
    for (const t of hand) {
      const key = tileKey(t);
      counts[key] = (counts[key] || 0) + 1;
    }

    let pairs = 0;
    let trips = 0;
    for (const count of Object.values(counts)) {
      if (count >= 3) trips++;
      else if (count === 2) pairs++;
    }

    // Count sequence potential
    let sequenceParts = 0;
    for (const t of hand) {
      if (isSuitedTile(t)) {
        const hasNext = hand.some(h => h.suit === t.suit && h.value === t.value + 1);
        if (hasNext) sequenceParts++;
      }
    }

    score = (totalSets * 0.25) + (trips * 0.2) + (pairs * 0.1) + (sequenceParts * 0.05);
    return Math.min(1, score);
  }
}

module.exports = AIPlayer;
