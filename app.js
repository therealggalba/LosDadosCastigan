const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");
const playerConfig = document.getElementById("player-config");
const scoreTableBody = document.querySelector("#score-table tbody");
const diceContainer = document.getElementById("dice-container");
const rollButton = document.getElementById("roll-dice");
const turnInfo = document.createElement("div");
const roundInfo = document.createElement("div");

let players = [];
let currentPlayerIndex = 0;
let roundScore = 0;
let savedDice = [];
let gameOver = false;
let suddenDeath = false;
let suddenDeathTarget = 3000;
let suddenDeathPlayers = [];
let roundNumber = 1;
let suddenDeathTiebreakers = [];

const colorOptions = [
  { name: "Rojo +B", bg: "#FF0000", text: "#FFFFFF" },
  { name: "Rojo +N", bg: "#FF0000", text: "#000000" },
  { name: "Rojo +D", bg: "#FF0000", text: "#e9b50b" },
  { name: "Celeste +N", bg: "#00FFFF", text: "#000000" },
  { name: "Celeste +AZ", bg: "#00FFFF", text: "#0000FF" },
  { name: "Celeste +R", bg: "#00FFFF", text: "#FF0000" },
  { name: "Morado +B", bg: "#800080", text: "#FFFFFF" },
  { name: "Morado +AM", bg: "#800080", text: "#FFFF00" },
  { name: "Morado +RS", bg: "#800080", text: "#FFC0CB" },
  { name: "Amarillo +N", bg: "#FFFF00", text: "#000000" },
  { name: "Amarillo +AZ", bg: "#FFFF00", text: "#0000FF" },
  { name: "Amarillo +R", bg: "#FFFF00", text: "#FF0000" },
  { name: "Naranja +N", bg: "#FFA500", text: "#000000" },
  { name: "Naranja +M", bg: "#FFA500", text: "#8f3b02" },
  { name: "Naranja +V", bg: "#FFA500", text: "#008000" },
  { name: "Verde +B", bg: "#008000", text: "#FFFFFF" },
  { name: "Verde +N", bg: "#008000", text: "#000000" },
  { name: "Verde +AM", bg: "#008000", text: "#FFFF00" },
  { name: "Azul +B", bg: "#0000FF", text: "#FFFFFF" },
  { name: "Azul +AZ", bg: "#0000FF", text: "#00FFFF" },
  { name: "Azul +RS", bg: "#0000FF", text: "#FFC0CB" },
  { name: "Rosa +N", bg: "#FFC0CB", text: "#000000" },
  { name: "Rosa +R", bg: "#FFC0CB", text: "#FF0000" },
  { name: "Rosa +MO", bg: "#FFC0CB", text: "#800080" }
];

// CONFIGURACIÓN DE PARTIDA y JUGADORES //
function createPlayerInput(index, existing = {}) {
  const div = document.createElement("div");
  div.className = "player-input";

  const selectHTML = colorOptions.map(c => `
    <option value="${c.bg}" data-text="${c.text}" style="background-color:${c.bg}; color:${c.text};"
      ${existing.color === c.bg ? 'selected' : ''}>
      ${c.name}
    </option>
  `).join('');

  div.innerHTML = `
    <label>Jugador ${index + 1}</label>
    <input type="text" placeholder="Nombre" value="${existing.name || ''}" />
    <select>${selectHTML}</select>
  `;

  // Aplicar estilo inicial al select
  const select = div.querySelector("select");
  const selectedOption = select.options[select.selectedIndex];
  select.style.backgroundColor = selectedOption.value;
  select.style.color = selectedOption.getAttribute("data-text");

  // Listener para actualizar estilo al cambiar
  select.addEventListener("change", () => {
    const option = select.options[select.selectedIndex];
    select.style.backgroundColor = option.value;
    select.style.color = option.getAttribute("data-text");
  });

  return div;
}
function renderPlayerInputs() {
  playerConfig.innerHTML = "";
  players.forEach((player, i) => {
    playerConfig.appendChild(createPlayerInput(i, player));
  });
}
document.getElementById("add-player").addEventListener("click", () => {
  if (players.length < 8) {
    players.push({ name: "", color: colorOptions[players.length % colorOptions.length], score: 0 });
    renderPlayerInputs();
  }
});
document.getElementById("remove-player").addEventListener("click", () => {
  if (players.length > 4) {
    players.pop();
    renderPlayerInputs();
  }
});
document.getElementById("start-game").addEventListener("click", () => {
  const inputs = document.querySelectorAll(".player-input");
  players = Array.from(inputs).map(input => {
  const name = input.querySelector("input[type='text']").value || "Jugador";
  const select = input.querySelector("select");
  const bgColor = select.value;
  const textColor = select.options[select.selectedIndex].getAttribute("data-text");
  return { name, color: bgColor, textColor: textColor, score: 0, eliminated: false };
});

  if (players.length < 4) {
    alert("Debes tener al menos 4 jugadores.");
    return;
  }

  setupScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");

  turnInfo.id = "turn-info";
  roundInfo.id = "round-info";
  gameScreen.prepend(turnInfo);
  gameScreen.prepend(roundInfo);

  updateScoreboard();
  startTurn();
});

// LÓGICA DEL JUEGO //
function updateScoreboard() {
  scoreTableBody.innerHTML = "";

  // Calcular clasificación visual
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const rankings = sorted.map(p => p.name);

  players.forEach(player => {
    const position = rankings.indexOf(player.name) + 1;
    const row = document.createElement("tr");
    if (player.eliminated) row.classList.add("eliminated-row");
    row.innerHTML = `
      <td>${position}º</td>
      <td>${player.name}</td>
      <td><div style="width:20px; height:20px; background:${player.color}; border-radius:50%; justify-self: center;"></div></td>
      <td>${player.roundScore || 0}</td>
      <td>${player.score}</td>
      <td class="player-status">${player.eliminated ? "❌" : ""}</td>
    `;
    scoreTableBody.appendChild(row);
  });
}
function startTurn() {
  if (gameOver) return;

  if (currentPlayerIndex === players.length - 1 && !suddenDeath) {
    roundNumber++;
    document.getElementById("round-counter").textContent = `Ronda: ${roundNumber}`;
  }

  roundScore = 0;
  savedDice = [];
  diceContainer.innerHTML = "";
  rollButton.disabled = false;

  turnInfo.innerHTML = `<h3>Turno de: ${players[currentPlayerIndex].name}</h3>`;
  roundInfo.innerHTML = `<p>Puntuación de ronda: ${roundScore} | Dados guardados: ${savedDice.length} | Dados por lanzar: ${5 - savedDice.length}</p>`;
}
rollButton.addEventListener("click", () => {
  const diceToRoll = 5 - savedDice.length;
  const diceValues = [];

  for (let i = 0; i < diceToRoll; i++) {
    const value = Math.floor(Math.random() * 6) + 1;
    diceValues.push(value);
  }

  renderDice(diceValues);

  const isFirstRoll = savedDice.length === 0;
  const result = calculatePoints(diceValues, isFirstRoll);
  renderDice(diceValues, result.scoringDice);

  if (result.cancelRound) {
    roundScore = 0;
    roundInfo.innerHTML = `<p>¡4 dados con valor 1! Puntuación anulada.</p>`;
    endTurn();
    return;
  }

  // REGLA 6: Si no hay ningún 5 ni 6, turno termina con 0
  if (!diceValues.includes(5) && !diceValues.includes(6)) {
    rollButton.disabled = true;
    roundInfo.innerHTML = `<p>Los dados castigan. No has obtenido puntuación.</p>`;
    const continueBtn = document.createElement("button");
    continueBtn.textContent = "Continuar";
    continueBtn.onclick = () => {
      roundScore = 0;
      rollButton.disabled = false;
      endTurn();
    };
    roundInfo.appendChild(continueBtn);
    return;
  }

  roundScore += result.points;
  savedDice.push(...result.scoringDice);

  if (savedDice.length === 5) {
    roundInfo.innerHTML += `<p>🎲 ¡Todos los dados han puntuado! Puedes volver a lanzar los 5 dados.</p>`;
    savedDice = []; // 👈 Reinicia para permitir relanzar
    }


  roundInfo.innerHTML = `<p>Puntuación de ronda: ${roundScore} | Dados guardados: ${savedDice.length} | Dados por lanzar: ${5 - savedDice.length}</p>`;

  if (roundScore % 100 === 0) {
    const plantarseBtn = document.createElement("button");
    plantarseBtn.textContent = "Plantarse";
    plantarseBtn.onclick = () => endTurn();
    roundInfo.appendChild(plantarseBtn);
  }

  updateScoreboard();
});
function renderDice(values, scoringDice = []) {
  diceContainer.innerHTML = "";
  const player = players[currentPlayerIndex];
  const textColor = player.textColor;
  const bgColor = player.color;

  // Copia mutable de los dados puntuables
  let scoringCopy = [...scoringDice];

  values.forEach(val => {
    const die = document.createElement("div");
    die.className = "dice";
    die.textContent = val;
    die.style.backgroundColor = bgColor;
    die.style.color = textColor;
    die.style.animation = "shake 0.5s ease";

    // Si el dado está en la lista de puntuables, resaltarlo
    const index = scoringCopy.indexOf(val);
    if (index !== -1) {
      die.classList.add("highlighted");
      scoringCopy.splice(index, 1); // Eliminar para evitar duplicados
    }

    diceContainer.appendChild(die);
  });
}
function calculatePoints(diceValues, isFirstRoll) {
  let points = 0;
  let scoringDice = [];
  let cancelRound = false;

  const counts = {};
  diceValues.forEach(val => {
    counts[val] = (counts[val] || 0) + 1;
  });

  // Paso 1: Combinaciones especiales solo si es primera tirada de 5 dados
  if (isFirstRoll && diceValues.length === 5) {
    if (counts[6] >= 3) {
      points += 1000;
      let used = 0;
      diceValues.forEach(val => {
        if (val === 6 && used < 3) {
          scoringDice.push(val);
          used++;
        }
      });
      // Añadir dados puntuables restantes
      diceValues.forEach(val => {
        if (val === 6 && scoringDice.filter(v => v === 6).length < counts[6]) {
          points += 100;
          scoringDice.push(val);
        } else if (val === 5) {
          points += 50;
          scoringDice.push(val);
        }
      });
      return { points, scoringDice, cancelRound };
    }

    if (counts[5] >= 3) {
      points += 500;
      let used = 0;
      diceValues.forEach(val => {
        if (val === 5 && used < 3) {
          scoringDice.push(val);
          used++;
        }
      });
      // Añadir dados puntuables restantes
      diceValues.forEach(val => {
        if (val === 5 && scoringDice.filter(v => v === 5).length < counts[5]) {
          points += 50;
          scoringDice.push(val);
        } else if (val === 6) {
          points += 100;
          scoringDice.push(val);
        }
      });
      return { points, scoringDice, cancelRound };
    }

    if (counts[1] === 4) {
      cancelRound = true;
      return { points: 0, scoringDice: [], cancelRound };
    }
  }

  // Paso 2: Evaluar dado por dado si no hay combinación especial
  diceValues.forEach(val => {
    if (val === 6) {
      points += 100;
      scoringDice.push(val);
    } else if (val === 5) {
      points += 50;
      scoringDice.push(val);
    }
  });

  return { points, scoringDice, cancelRound };
}
function endTurn() {
  players[currentPlayerIndex].score += roundScore;
  players[currentPlayerIndex].roundScore = roundScore;

  if (players[currentPlayerIndex].score > 3000) {
    players[currentPlayerIndex].score -= roundScore;
    players[currentPlayerIndex].roundScore = 0;
    roundInfo.innerHTML += `<p style="color:red;">⚠️ ¡Has superado los 3000 puntos! Tu puntuación vuelve a la ronda anterior.</p>`;
  }

  updateScoreboard();

  if (players[currentPlayerIndex].score === 3000 && !suddenDeath) {
    suddenDeath = true;
    suddenDeathTrigger = players[currentPlayerIndex];
    suddenDeathPlayers = players.filter((_, i) => i !== currentPlayerIndex);
    showSuddenDeathMessage(suddenDeathTrigger.name);
    rollButton.disabled = true; // 👈 Bloquea el botón para el jugador que activó muerte súbita
    updateScoreboard();
    setTimeout(() => startNextSuddenDeathTurn(), 1000); // 👈 Avanza automáticamente
    return;
  }

  if (suddenDeath) {
    const player = players[currentPlayerIndex];

    if (player.score === 3000) {
        suddenDeathTiebreakers.push(player);
    } else {
        markAsEliminated(player);
    }

    updateScoreboard();

    // Avanzar al siguiente jugador en muerte súbita
    startNextSuddenDeathTurn();
    return;
    }


  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  startTurn();
}


// RONDA DE MUERTE SÚBITA //
function startNextSuddenDeathTurn() {
  if (suddenDeathPlayers.length === 0) {
    checkSuddenDeathEnd();
    return;
  }

  const nextPlayer = suddenDeathPlayers.shift();
  currentPlayerIndex = players.indexOf(nextPlayer);
  startTurn();
}
function markAsEliminated(player) {
  const rows = scoreTableBody.querySelectorAll("tr");
  player.eliminated = true;
  rows.forEach(row => {
    if (row.innerText.includes(player.name)) {
      row.classList.add("eliminated-row");

      // Añadir ❌ en la última celda si existe columna "Estado"
      const statusCell = row.querySelector(".player-status");
      if (statusCell) {
        statusCell.textContent = "❌";
        statusCell.style.color = "red";
        statusCell.style.fontWeight = "bold";
      }
    }
  });
}
function showSuddenDeathMessage(name) {
  const banner = document.getElementById("sudden-death-banner");
  banner.classList.remove("hidden");
  banner.innerHTML = `⚠️ <strong>${name}</strong> ha alcanzado exactamente 3000 puntos.<br>
  Comienza la <strong>muerte súbita</strong><br>. Los demás jugadores tienen una única oportunidad para empatar.`;
}
function checkSuddenDeathEnd() {
  if (suddenDeathTiebreakers.length === 0) {
    declareWinner(suddenDeathTrigger); // nadie empató
  } else if (suddenDeathTiebreakers.length === 1) {
    declareWinner(suddenDeathTiebreakers[0]); // solo uno empató
  } else {
    startTiebreaker(suddenDeathTiebreakers); // varios empatados
  }
}
function declareWinner(winner) {
  gameOver = true;
  rollButton.disabled = true;

  const banner = document.getElementById("sudden-death-banner");
  banner.innerHTML = `<h2 style="color:green;">🏆 ¡${winner.name} ha ganado la partida con 3000 puntos en la ronda ${roundNumber}! 🏆</h2>`;

  // Guardar récord si es mejor
  const previousRecord = JSON.parse(localStorage.getItem("record")) || null;

  if (!previousRecord || roundNumber < previousRecord.round) {
    const newRecord = {
      name: winner.name,
      round: roundNumber
    };
    localStorage.setItem("record", JSON.stringify(newRecord));
    banner.innerHTML += `<p style="color:blue;">🎉 ¡Nuevo récord establecido por ${winner.name} en la ronda ${roundNumber}!</p>`;
  } else {
    banner.innerHTML += `<p style="color:gray;">🏅 Récord actual: ${previousRecord.name} en la ronda ${previousRecord.round}</p>`;
  }

    const restartBtn = document.createElement("button");
    restartBtn.textContent = "Nueva partida";
    restartBtn.style.marginTop = "20px";
    restartBtn.onclick = () => resetGame();
    banner.appendChild(restartBtn);
}

// RONDA DE DESEMPATE //
function startTiebreaker(playersInTiebreak) {
  turnInfo.innerHTML = `<h2>⚔️ Desempate entre: ${playersInTiebreak.map(p => p.name).join(", ")}</h2>`;
  rollButton.disabled = false;
  tiebreakQueue = [...playersInTiebreak];
  tiebreakResults = [];
  currentTiebreakIndex = 0;
  startTiebreakTurn();
}
function startTiebreakTurn() {
  const player = tiebreakQueue[currentTiebreakIndex];
  turnInfo.innerHTML = `<h3>Turno de desempate: ${player.name}</h3>`;
  rollButton.onclick = () => {
    const diceValues = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
    renderDice(diceValues);
    const result = calculatePoints(diceValues, true);
    tiebreakResults.push({ player, score: result.points });
    currentTiebreakIndex++;

    if (currentTiebreakIndex < tiebreakQueue.length) {
      startTiebreakTurn();
    } else {
      resolveTiebreak();
    }
  };
}
function resolveTiebreak() {
  const maxScore = Math.max(...tiebreakResults.map(r => r.score));
  const winners = tiebreakResults.filter(r => r.score === maxScore);

  if (winners.length === 1) {
    declareWinner(winners[0].player);
  } else {
    startTiebreaker(winners.map(w => w.player)); // Repetir solo entre empatados
  }
}

// NUEVA PARTIDA //
function resetGame() {
  // Resetear variables globales
  currentPlayerIndex = 0;
  roundNumber = 1;
  suddenDeath = false;
  suddenDeathPlayers = [];
  suddenDeathTiebreakers = [];
  gameOver = false;

  // Resetear jugadores
  players.forEach(p => {
    p.score = 0;
    p.roundScore = 0;
    p.eliminated = false;
  });

  // Limpiar interfaz
  diceContainer.innerHTML = "";
  turnInfo.innerHTML = "";
  roundInfo.innerHTML = "";
  document.getElementById("sudden-death-banner").classList.add("hidden");
  document.getElementById("sudden-death-banner").innerHTML = "";
  document.getElementById("round-counter").textContent = "Ronda: 1";

  // Volver a la pantalla de configuración
  gameScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");

  // Volver a mostrar inputs de jugadores
  renderPlayerInputs();
  updateScoreboard(); // opcional si quieres mostrar tabla vacía
}
window.onload = () => {
    const record = JSON.parse(localStorage.getItem("record"));
    const recordDisplay = document.getElementById("record-display");

    if (record) {
        recordDisplay.innerHTML = `<p>🏅 Récord actual: <strong>${record.name}</strong> ganó en la ronda <strong>${record.round}</strong></p>`;
    } else {
        recordDisplay.innerHTML = `<p>🏅 Aún no hay récord establecido. ¡Sé el primero en lograrlo!</p>`;
    }

  if (players.length === 0) {
    players = [
      { name: "", color: "", score: 0 },
      { name: "", color: "", score: 0 },
      { name: "", color: "", score: 0 },
      { name: "", color: "", score: 0 }
    ];
    renderPlayerInputs();
  }
};