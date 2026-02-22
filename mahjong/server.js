'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { MahjongGame, PHASES, WIND_VALUES } = require('./game/MahjongGame');
const AIPlayer = require('./game/AIPlayer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// Room management
const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function createRoom(hostName) {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }

  const game = new MahjongGame(code);
  const room = {
    code,
    game,
    players: [null, null, null, null],
    spectators: [],
    aiPlayers: [
      new AIPlayer(0, 'medium'),
      new AIPlayer(1, 'medium'),
      new AIPlayer(2, 'medium'),
      new AIPlayer(3, 'medium')
    ],
    aiTimers: {},
    created: Date.now()
  };

  rooms.set(code, room);
  return room;
}

function getRoomList() {
  const list = [];
  for (const [code, room] of rooms) {
    const humanCount = room.players.filter(p => p !== null).length;
    const spectatorCount = room.spectators.length;
    list.push({
      code,
      humanPlayers: humanCount,
      spectators: spectatorCount,
      phase: room.game.phase,
      created: room.created
    });
  }
  return list;
}

function broadcastGameState(room) {
  // Send personalized state to each player
  for (let i = 0; i < 4; i++) {
    if (room.players[i]) {
      const state = room.game.getPublicState();
      state.yourSeat = i;
      state.yourHand = room.game.hands[i] ? [...room.game.hands[i]] : [];
      state.yourFlowers = room.game.flowers[i] ? [...room.game.flowers[i]] : [];
      state.yourMelds = room.game.melds[i] ? [...room.game.melds[i]] : [];
      state.yourConcealedKongs = room.game.concealedKongs[i] ? [...room.game.concealedKongs[i]] : [];
      room.players[i].socket.emit('gameState', state);
    }
  }

  // Send spectator state (public only)
  const publicState = room.game.getPublicState();
  for (const spec of room.spectators) {
    spec.socket.emit('gameState', { ...publicState, isSpectator: true });
  }
}

function broadcastRoomUpdate(room) {
  const info = {
    code: room.code,
    players: room.players.map((p, i) => ({
      seat: i,
      name: p ? p.name : `AI ${WIND_VALUES[i].charAt(0).toUpperCase() + WIND_VALUES[i].slice(1)}`,
      isAI: !p,
      seatWind: room.game.getSeatWind(i)
    })),
    spectators: room.spectators.map(s => ({ name: s.name })),
    phase: room.game.phase
  };

  // Broadcast to all in room
  for (const p of room.players) {
    if (p) p.socket.emit('roomUpdate', info);
  }
  for (const s of room.spectators) {
    s.socket.emit('roomUpdate', info);
  }
}

function scheduleAIAction(room, seatIndex, delay = 1200) {
  if (room.aiTimers[seatIndex]) {
    clearTimeout(room.aiTimers[seatIndex]);
  }

  room.aiTimers[seatIndex] = setTimeout(() => {
    processAITurn(room, seatIndex);
  }, delay);
}

function processAITurn(room, seatIndex) {
  const game = room.game;
  const ai = room.aiPlayers[seatIndex];

  if (game.phase !== PHASES.PLAYING && game.phase !== PHASES.CLAIM) return;
  if (room.players[seatIndex]) return; // Human took over

  if (game.phase === PHASES.CLAIM) {
    // AI needs to respond to a claim
    const claims = game.checkClaims(game.lastDiscardPlayer, game.lastDiscard);
    const myClaims = claims.filter(c => c.playerIndex === seatIndex);

    if (myClaims.length > 0) {
      const decision = ai.decideClaim(myClaims, game.hands[seatIndex], game.melds[seatIndex], game.getPublicState());

      if (decision.type === 'pass') {
        const result = game.passClaimAction(seatIndex);
        handleActionResult(room, result);
      } else if (decision.type === 'win') {
        const result = game.processClaim(seatIndex, 'win', {});
        handleActionResult(room, result);
      } else if (decision.type === 'kong') {
        const result = game.processClaim(seatIndex, 'kong', {});
        handleActionResult(room, result);
      } else if (decision.type === 'pong') {
        const result = game.processClaim(seatIndex, 'pong', {});
        handleActionResult(room, result);
      } else if (decision.type === 'chow') {
        const result = game.processClaim(seatIndex, 'chow', { tiles: decision.tiles });
        handleActionResult(room, result);
      } else {
        const result = game.passClaimAction(seatIndex);
        handleActionResult(room, result);
      }
    }
    return;
  }

  if (game.currentPlayer !== seatIndex) return;

  // AI's turn to play
  if (game.hands[seatIndex].length % 3 === 2) {
    // Has drawn a tile (14 tiles or equivalent), need to discard
    // First check if can win
    if (game.checkWinCondition(seatIndex)) {
      const result = game.processClaim(seatIndex, 'win', {});
      handleActionResult(room, result);
      return;
    }

    // Check for kong options
    const kongOptions = game.findKongOptions(seatIndex);
    if (kongOptions.length > 0) {
      const kongDecision = ai.decideKong(kongOptions, game.hands[seatIndex], game.melds[seatIndex]);
      if (kongDecision) {
        let result;
        if (kongDecision.type === 'concealed_kong') {
          result = game.processConcealedKong(seatIndex, { tiles: kongDecision.tiles });
        } else if (kongDecision.type === 'add_kong') {
          result = game.processAddKong(seatIndex, { tile: kongDecision.tile, meldIndex: kongDecision.meldIndex });
        }
        if (result) {
          handleActionResult(room, result);
          return;
        }
      }
    }

    // Discard a tile
    const discardTile = ai.chooseDiscard(game.hands[seatIndex], game.melds[seatIndex], game.getPublicState());
    const result = game.discardTile(seatIndex, discardTile.id);
    handleActionResult(room, result);
  } else {
    // Need to draw a tile
    const result = game.drawTile(seatIndex);
    handleActionResult(room, result);
  }
}

function handleActionResult(room, result) {
  if (!result) return;

  broadcastGameState(room);

  if (result.action === 'game_won') {
    io.to(room.code).emit('gameWon', result);
    return;
  }

  if (result.action === 'draw_game') {
    io.to(room.code).emit('gameDraw', { message: 'Wall exhausted - draw game' });
    return;
  }

  if (result.action === 'tile_discarded') {
    io.to(room.code).emit('tileDiscarded', {
      tile: result.tile,
      playerIndex: result.playerIndex,
      playerName: room.game.getPlayerName(result.playerIndex)
    });

    if (result.claims && result.claims.length > 0) {
      // Notify players who can claim
      handleClaimPhase(room, result.claims);
      return;
    }

    // Next player's turn
    if (result.nextPlayer !== undefined) {
      triggerNextTurn(room, result.nextPlayer);
    }
    return;
  }

  if (result.action === 'tile_drawn') {
    // If it's an AI, it will discard on its next scheduled action
    if (!room.players[result.playerIndex]) {
      scheduleAIAction(room, result.playerIndex, 800);
    } else {
      // Human player - send them their options
      const socket = room.players[result.playerIndex].socket;
      socket.emit('yourTurn', {
        drawnTile: result.tile,
        canWin: result.canWin,
        canKong: result.canKong
      });
    }
    return;
  }

  if (result.action === 'meld_made') {
    io.to(room.code).emit('meldMade', {
      meldType: result.meldType,
      playerIndex: result.playerIndex,
      playerName: room.game.getPlayerName(result.playerIndex)
    });

    // Player who claimed needs to discard
    if (result.nextPlayer !== undefined) {
      if (!room.players[result.nextPlayer]) {
        scheduleAIAction(room, result.nextPlayer, 1000);
      } else {
        room.players[result.nextPlayer].socket.emit('yourTurnDiscard', {});
      }
    }
    return;
  }

  if (result.action === 'claims_resolved') {
    if (result.nextPlayer !== undefined) {
      triggerNextTurn(room, result.nextPlayer);
    }
    return;
  }

  if (result.action === 'kong_robbery_possible') {
    handleClaimPhase(room, result.claims);
    return;
  }
}

function handleClaimPhase(room, claims) {
  // Group claims by player
  const claimsByPlayer = {};
  for (const claim of claims) {
    if (!claimsByPlayer[claim.playerIndex]) {
      claimsByPlayer[claim.playerIndex] = [];
    }
    claimsByPlayer[claim.playerIndex].push(claim);
  }

  // Notify each player who can claim
  for (const [pStr, playerClaims] of Object.entries(claimsByPlayer)) {
    const p = parseInt(pStr);
    if (room.players[p]) {
      // Human player
      room.players[p].socket.emit('claimAvailable', {
        claims: playerClaims,
        tile: room.game.lastDiscard,
        fromPlayer: room.game.lastDiscardPlayer
      });
    } else {
      // AI player
      scheduleAIAction(room, p, 1500);
    }
  }

  // Auto-pass for players who have no claims
  for (let p = 0; p < 4; p++) {
    if (p === room.game.lastDiscardPlayer) continue;
    if (!claimsByPlayer[p]) {
      room.game.passClaimAction(p);
    }
  }

  // Check if all claims are auto-resolved
  if (room.game.allClaimsResolved()) {
    setTimeout(() => {
      const result = room.game.resolveClaims();
      handleActionResult(room, result);
    }, 500);
  }
}

function triggerNextTurn(room, playerIndex) {
  if (room.game.phase !== PHASES.PLAYING) return;

  if (!room.players[playerIndex]) {
    // AI player
    scheduleAIAction(room, playerIndex, 1000);
  } else {
    // Human player draws
    const result = room.game.drawTile(playerIndex);
    handleActionResult(room, result);
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  let currentRoom = null;
  let currentSeat = -1;
  let playerName = 'Guest';
  let isSpectator = false;

  socket.emit('roomList', getRoomList());

  socket.on('setName', (name) => {
    playerName = (name || 'Guest').substring(0, 20);
  });

  socket.on('getRoomList', () => {
    socket.emit('roomList', getRoomList());
  });

  socket.on('createRoom', (data) => {
    playerName = (data.name || 'Guest').substring(0, 20);
    const room = createRoom(playerName);

    // Host joins seat 0
    currentRoom = room;
    currentSeat = 0;
    isSpectator = false;
    room.players[0] = { socket, name: playerName };
    room.game.players[0] = { name: playerName };
    socket.join(room.code);

    socket.emit('roomJoined', { code: room.code, seat: 0 });
    broadcastRoomUpdate(room);
    io.emit('roomList', getRoomList());
  });

  socket.on('joinRoom', (data) => {
    const room = rooms.get(data.code);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    playerName = (data.name || 'Guest').substring(0, 20);

    // Find first available seat
    let seat = -1;
    for (let i = 0; i < 4; i++) {
      if (!room.players[i]) {
        seat = i;
        break;
      }
    }

    if (seat === -1) {
      // No seats, join as spectator
      isSpectator = true;
      currentRoom = room;
      currentSeat = -1;
      room.spectators.push({ socket, name: playerName });
      socket.join(room.code);

      socket.emit('roomJoined', { code: room.code, seat: -1, isSpectator: true });
      broadcastRoomUpdate(room);
      broadcastGameState(room);
      return;
    }

    currentRoom = room;
    currentSeat = seat;
    isSpectator = false;
    room.players[seat] = { socket, name: playerName };
    room.game.players[seat] = { name: playerName };
    socket.join(room.code);

    socket.emit('roomJoined', { code: room.code, seat });
    broadcastRoomUpdate(room);

    if (room.game.phase === PHASES.PLAYING) {
      broadcastGameState(room);
    }

    io.emit('roomList', getRoomList());
  });

  socket.on('spectateRoom', (data) => {
    const room = rooms.get(data.code);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    playerName = (data.name || 'Guest').substring(0, 20);
    isSpectator = true;
    currentRoom = room;
    currentSeat = -1;
    room.spectators.push({ socket, name: playerName });
    socket.join(room.code);

    socket.emit('roomJoined', { code: room.code, seat: -1, isSpectator: true });
    broadcastRoomUpdate(room);
    broadcastGameState(room);
  });

  socket.on('startGame', () => {
    if (!currentRoom || isSpectator) return;

    const room = currentRoom;
    if (room.game.phase !== PHASES.WAITING && room.game.phase !== PHASES.FINISHED) {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    room.game.initializeGame();
    broadcastGameState(room);
    broadcastRoomUpdate(room);

    io.to(room.code).emit('gameStarted', {});

    // If dealer is AI, start their turn
    const dealer = room.game.dealerIndex;
    if (!room.players[dealer]) {
      scheduleAIAction(room, dealer, 1500);
    } else {
      // Human dealer needs to discard (they have 14 tiles)
      room.players[dealer].socket.emit('yourTurnDiscard', { isDealer: true });
    }
  });

  socket.on('discardTile', (data) => {
    if (!currentRoom || isSpectator || currentSeat < 0) return;
    const room = currentRoom;

    if (room.game.currentPlayer !== currentSeat) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    const result = room.game.discardTile(currentSeat, data.tileId);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    handleActionResult(room, result);
  });

  socket.on('claimAction', (data) => {
    if (!currentRoom || isSpectator || currentSeat < 0) return;
    const room = currentRoom;

    if (data.type === 'pass') {
      const result = room.game.passClaimAction(currentSeat);
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      if (room.game.allClaimsResolved()) {
        const resolveResult = room.game.resolveClaims();
        handleActionResult(room, resolveResult);
      }
      return;
    }

    const result = room.game.processClaim(currentSeat, data.type, data);
    if (result.error) {
      socket.emit('error', { message: result.error });
      return;
    }

    handleActionResult(room, result);
  });

  socket.on('declareWin', () => {
    if (!currentRoom || isSpectator || currentSeat < 0) return;
    const room = currentRoom;

    if (room.game.phase === PHASES.CLAIM) {
      const result = room.game.processClaim(currentSeat, 'win', {});
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }
      handleActionResult(room, result);
    } else if (room.game.phase === PHASES.PLAYING && room.game.currentPlayer === currentSeat) {
      if (room.game.checkWinCondition(currentSeat)) {
        const result = room.game.processClaim(currentSeat, 'win', {});
        handleActionResult(room, result);
      }
    }
  });

  socket.on('declareKong', (data) => {
    if (!currentRoom || isSpectator || currentSeat < 0) return;
    const room = currentRoom;

    if (room.game.currentPlayer !== currentSeat) return;

    if (data.type === 'concealed_kong') {
      const result = room.game.processConcealedKong(currentSeat, data);
      if (result && !result.error) handleActionResult(room, result);
    } else if (data.type === 'add_kong') {
      const result = room.game.processAddKong(currentSeat, data);
      if (result && !result.error) handleActionResult(room, result);
    }
  });

  socket.on('nextRound', () => {
    if (!currentRoom || isSpectator) return;
    const room = currentRoom;

    if (room.game.phase !== PHASES.FINISHED) return;

    room.game.nextRound();
    broadcastGameState(room);
    broadcastRoomUpdate(room);
    io.to(room.code).emit('gameStarted', {});

    const dealer = room.game.dealerIndex;
    if (!room.players[dealer]) {
      scheduleAIAction(room, dealer, 1500);
    } else {
      room.players[dealer].socket.emit('yourTurnDiscard', { isDealer: true });
    }
  });

  socket.on('chatMessage', (data) => {
    if (!currentRoom) return;
    io.to(currentRoom.code).emit('chatMessage', {
      name: playerName,
      message: (data.message || '').substring(0, 200),
      isSpectator
    });
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = currentRoom;

    if (isSpectator) {
      room.spectators = room.spectators.filter(s => s.socket.id !== socket.id);
    } else if (currentSeat >= 0) {
      room.players[currentSeat] = null;
      room.game.players[currentSeat] = null;

      // If game is in progress, AI takes over
      if (room.game.phase === PHASES.PLAYING || room.game.phase === PHASES.CLAIM) {
        room.game.addLog(`${playerName} disconnected. AI is taking over.`);
        if (room.game.currentPlayer === currentSeat) {
          scheduleAIAction(room, currentSeat, 2000);
        }
      }
    }

    broadcastRoomUpdate(room);

    // Clean up empty rooms after a delay
    const hasHumans = room.players.some(p => p !== null) || room.spectators.length > 0;
    if (!hasHumans) {
      setTimeout(() => {
        const r = rooms.get(room.code);
        if (r && !r.players.some(p => p !== null) && r.spectators.length === 0) {
          // Clear AI timers
          for (const timer of Object.values(r.aiTimers)) {
            clearTimeout(timer);
          }
          rooms.delete(room.code);
          io.emit('roomList', getRoomList());
        }
      }, 60000);
    }

    io.emit('roomList', getRoomList());
  });
});

// Clean up old empty rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const hasHumans = room.players.some(p => p !== null) || room.spectators.length > 0;
    if (!hasHumans && now - room.created > 300000) {
      for (const timer of Object.values(room.aiTimers)) {
        clearTimeout(timer);
      }
      rooms.delete(code);
    }
  }
  io.emit('roomList', getRoomList());
}, 60000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Sparrow Mahjong Club running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});
