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
      deck.push({
        rank: r,
        img: `https://deckofcardsapi.com/static/img/${a + s}.png`
      });
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
        scores: {},
        turn: 0
      };
    }

    rooms[room].players.push({ id: socket.id, name });
    rooms[room].scores[socket.id] = 0;

    io.to(room).emit("state", rooms[room]);
  });

  socket.on("cardClick", ({ room, index }) => {
    const game = rooms[room];
    if (!game) return;

    io.to(room).emit("state", game);
  });

});

server.listen(3000);
