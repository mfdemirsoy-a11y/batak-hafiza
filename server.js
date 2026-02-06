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
        players: [],       // {id, name}
        deck: createDeck(),
        open: [],          // Açılan kartların indexleri (max 2)
        matched: [],       // Eşleşen kartların indexleri
        scores: {},        // oyuncuId -> puan
        turn: 0            // players array indeki sıra
      };
    }

    const game = rooms[room];

    // Aynı oyuncu tekrar eklenmesin
    if (!game.players.find(p => p.id === socket.id)) {
      game.players.push({ id: socket.id, name });
      game.scores[socket.id] = 0;
    }

    io.to(room).emit("state", game);
  });

  socket.on("cardClick", ({ room, index }) => {
    const game = rooms[room];
    if (!game) return;

    // Kart zaten açılmış veya eşleşmişse işlem yok
    if (game.open.includes(index) || game.matched.includes(index)) return;

    // Sadece sıra kimdeyse oynayabilir
    if (game.players[game.turn].id !== socket.id) return;

    game.open.push(index);

    if (game.open.length === 2) {
      const [a, b] = game.open;
      const cardA = game.deck[a];
      const cardB = game.deck[b];

      if (cardA.rank === cardB.rank) {
        game.matched.push(a, b);
        game.scores[game.players[game.turn].id] += 1;
      } else {
        game.turn = (game.turn + 1) % game.players.length;
      }

      // Durumu hemen gönder
      io.to(room).emit("state", game);

      // Açılan kartları 800ms sonra kapat
      setTimeout(() => {
        game.open = [];
        io.to(room).emit("state", game);
      }, 800);
    } else {
      // 1 kart açıldığında durumu gönder
      io.to(room).emit("state", game);
    }
  });

  socket.on("disconnect", () => {
    for (const roomName in rooms) {
      const game = rooms[roomName];
      const idx = game.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        game.players.splice(idx, 1);
        delete game.scores[socket.id];
        if (game.turn >= game.players.length) game.turn = 0;
        io.to(roomName).emit("state", game);
        break;
      }
    }
  });

});

server.listen(3000);
