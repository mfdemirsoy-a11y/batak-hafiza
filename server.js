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

  // Masa oluştur / katıl
  socket.on("joinRoom", ({ room, name, password }) => {
    if (!rooms[room]) {
      // Masa yoksa kurucu oluşturur
      rooms[room] = {
        host: socket.id,
        password: password || "",
        players: [],
        deck: createDeck(),
        open: [],
        matched: [],
        scores: {},
        turn: 0
      };
    }

    const game = rooms[room];

    // Şifreyi kontrol et
    if (game.password && game.host !== socket.id && password !== game.password) {
      socket.emit("passwordError", "Yanlış şifre!");
      return;
    }

    socket.join(room);

    if (!game.players.find(p => p.id === socket.id)) {
      game.players.push({ id: socket.id, name });
      game.scores[socket.id] = 0;
    }

    io.to(room).emit("state", game);
  });

  // Kart tıklama
  socket.on("cardClick", ({ room, index }) => {
    const game = rooms[room];
    if (!game) return;
    if (game.open.includes(index) || game.matched.includes(index)) return;
    if (game.players[game.turn].id !== socket.id) return;

    game.open.push(index);
    io.to(room).emit("state", game);

    if (game.open.length === 2) {
      const [a, b] = game.open;
      const cardA = game.deck[a];
      const cardB = game.deck[b];

      let waitTime = 1200; // eşleşme görünmesi için bekleme
      if (cardA.rank === cardB.rank) {
        game.matched.push(a, b);
        game.scores[game.players[game.turn].id] += 1;
      } else {
        game.turn = (game.turn + 1) % game.players.length;
      }

      setTimeout(() => {
        game.open = [];
        io.to(room).emit("state", game);
      }, waitTime);
    }
  });

  // Restart butonu (sadece host)
  socket.on("restart", ({ room }) => {
    const game = rooms[room];
    if (!game) return;
    if (socket.id !== game.host) return;

    game.deck = createDeck();
    game.open = [];
    game.matched = [];
    game.turn = 0;
    game.players.forEach(p => game.scores[p.id] = 0);

    io.to(room).emit("state", game);
  });

  socket.on("disconnect", () => {
    for (const roomName in rooms) {
      const game = rooms[roomName];
      const idx = game.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        game.players.splice(idx, 1);
        delete game.scores[socket.id];
        if (game.turn >= game.players.length) game.turn = 0;

        // Eğer host ayrılırsa yeni host belirle
        if (game.host === socket.id && game.players.length > 0) {
          game.host = game.players[0].id;
        }

        io.to(roomName).emit("state", game);
        break;
      }
    }
  });

});
server.listen(3000);
