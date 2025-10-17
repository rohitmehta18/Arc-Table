// ui.js
export function createUI(container) {
  const startButton = document.createElement('button');
  startButton.textContent = 'START TABLE TENNIS';
  startButton.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 20px 40px;
    font-size: 24px;
    font-weight: bold;
    background: linear-gradient(45deg, #aa1a1a, #d42a2a);
    color: white;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    z-index: 100;
    font-family: Arial, sans-serif;
    box-shadow: 0 8px 16px rgba(0,0,0,0.3);
    transition: all 0.3s ease;
  `;

  startButton.onmouseover = () => {
    startButton.style.transform = 'translate(-50%, -50%) scale(1.05)';
  };

  startButton.onmouseout = () => {
    startButton.style.transform = 'translate(-50%, -50%) scale(1)';
  };

  const scoreBoard = document.createElement('div');
  scoreBoard.style.cssText = `
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 30px;
    z-index: 100;
    font-family: Arial, sans-serif;
  `;

  const playerScoreDiv = document.createElement('div');
  playerScoreDiv.style.cssText = `
    background: rgba(170, 26, 26, 0.9);
    padding: 15px 25px;
    border-radius: 8px;
    color: white;
    font-size: 20px;
    font-weight: bold;
  `;
  playerScoreDiv.innerHTML = '<div style="font-size: 12px; opacity: 0.8;">PLAYER</div><div id="player-score" style="font-size: 32px;">0</div>';

  const opponentScoreDiv = document.createElement('div');
  opponentScoreDiv.style.cssText = `
    background: rgba(17, 17, 17, 0.9);
    padding: 15px 25px;
    border-radius: 8px;
    color: white;
    font-size: 20px;
    font-weight: bold;
  `;
  opponentScoreDiv.innerHTML = '<div style="font-size: 12px; opacity: 0.8;">OPPONENT</div><div id="opponent-score" style="font-size: 32px;">0</div>';

  scoreBoard.appendChild(playerScoreDiv);
  scoreBoard.appendChild(opponentScoreDiv);

  const serveIndicator = document.createElement('div');
  serveIndicator.textContent = 'POSITION PADDLE - CLICK TO SERVE';
  serveIndicator.style.cssText = `
    position: absolute;
    top: 60%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 16px;
    background: rgba(0,0,0,0.8);
    padding: 15px 25px;
    border-radius: 8px;
    z-index: 100;
    font-family: Arial, sans-serif;
    display: none;
    text-align: center;
    border: 2px solid #aa1a1a;
  `;

  const rallyCounter = document.createElement('div');
  rallyCounter.textContent = 'RALLY: 0';
  rallyCounter.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    color: white;
    font-size: 18px;
    background: rgba(0,0,0,0.7);
    padding: 10px 15px;
    border-radius: 5px;
    z-index: 100;
    font-family: Arial, sans-serif;
    display: none;
  `;

  container.appendChild(startButton);
  container.appendChild(scoreBoard);
  container.appendChild(serveIndicator);
  container.appendChild(rallyCounter);

  return {
    startButton,
    serveIndicator,
    rallyCounter,
    playerScoreElem: document.getElementById('player-score'),
    opponentScoreElem: document.getElementById('opponent-score'),
  };
}

export function updateScore(ui, playerScore, opponentScore) {
  ui.playerScoreElem.textContent = String(playerScore);
  ui.opponentScoreElem.textContent = String(opponentScore);
}

export function updateRally(ui, count) {
  ui.rallyCounter.textContent = `RALLY: ${count}`;
}

export function showServeIndicator(ui, text, visible = true) {
  ui.serveIndicator.textContent = text;
  ui.serveIndicator.style.display = visible ? 'block' : 'none';
}

export function hideStartButton(ui) {
  ui.startButton.style.display = 'none';
}

export function showRallyCounter(ui, visible = true) {
  ui.rallyCounter.style.display = visible ? 'block' : 'none';
}