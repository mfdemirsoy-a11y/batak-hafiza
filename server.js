const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

function createDeck() {
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const suits = ['S','H','D','C'];
  let deck = [];
  for (let r of ranks) {
    for (let s of suits) {
      const a = r === '10' ? '0' : r;
      deck.push({ rank: r, img: `https://deckofcardsapi.com/static/img/${a + s}.png` });
    }
  }
  return deck.sort(() => Math.random() - 0.5);
}

io.on("connection", socket => {

  socket.on("joinRoom", ({ room, name }) => {
    socket.join(room);

    if (!rooms[room]) {
      rooms[room] = {
        players: [],
        deck: createDeck(),
        open: [],
        matched: [],
        scores: {},
        turn: 0
      };
    }

    const game = rooms[room];
    if (!game.players.find(p => p.id === socket.id)) {
      game.players.push({ id: socket.id, name });
      game.scores[socket.id] = 0;
    }

    io.to(room).emit("state", game);
  });

  socket.on("cardClick", ({ room, index }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.open.includes(index) || game.matched.includes(index)) return;
    if (game.players[game.turn].id !== socket.id) return;

    game.open.push(index);
    io.to(room).emit("state", game);
