// -------- UNITEAM ADVENTURE - game.js (version corrigée) --------

// On attend que le DOM soit prêt (script chargé en "defer" dans l'HTML)
window.addEventListener('DOMContentLoaded', () => {

  // ---- DOM ----
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const gameContainer = document.getElementById('game-container');
  const scoreElement = document.getElementById('score');
  const versionElement = document.getElementById('version');
  const powerUpTextElement = document.getElementById('powerUpText');
  const powerUpTimerElement = document.getElementById('powerUpTimer');
  const loadingTextElement = document.getElementById('loadingText');
  const menuElement = document.getElementById('menu');
  const gameOverScreenElement = document.getElementById('gameOverScreen');
  const finalScoreElement = document.getElementById('finalScore');
  const adminButton = document.getElementById('adminButton');
  const livesContainer = document.getElementById('lives-container');

  // ---- Canvas responsive ----
  let CANVAS_WIDTH, CANVAS_HEIGHT;
  function resizeCanvas() {
    CANVAS_WIDTH = gameContainer.clientWidth;
    CANVAS_HEIGHT = gameContainer.clientHeight;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // ---- Constantes ----
  const PLAYER_WIDTH = 50;
  const PLAYER_HEIGHT = 50;
  const GRAVITY = 0.8;
  const JUMP_POWER = 15;
  const MAX_JUMPS = 2;
  const GROUND_HEIGHT = 70;
  const BASE_GAME_SPEED = 5;
  const GAME_ACCELERATION = 0.001;
  const POWERUP_SCORE_INTERVAL = 20;
  const POWERUP_DURATION_MS = 5000;
  const BASE_OBSTACLE_SPAWN_INTERVAL = 100; // ~ frames
  const MIN_OBSTACLE_SPAWN_INTERVAL = 45;
  const OBSTACLE_BASE_WIDTH = 60;
  const INITIAL_LIVES = 3;

  // ---- État ----
  let gameState = 'loading';
  let player;
  let obstacles = [];
  let collectibles = [];
  let powerUps = [];
  let backgroundHeads = [];
  let particles = [];
  let score = 0;
  let lives = INITIAL_LIVES;
  let gameSpeed = BASE_GAME_SPEED;
  let frameCount = 0;

  // Timers
  let obstacleTimer = 0;
  let collectibleTimer = 0;
  let rainTimer = 0;
  let rainActive = false;
  let rainDuration = 0;

  // Power-up
  let isPowerUpActive = false;
  let activePowerUpType = null;
  let powerUpTimer = 0;
  let scoreAtLastPowerUp = -POWERUP_SCORE_INTERVAL;

  // Audio
  let currentMusic = null;
  const musicTracks = [];

  // ---- Assets ----
  const assets = {};
  const assetSources = {
    logo: './uniteamadventure.png',
    background: './FOND DE PLAN.jpg',
    ...Array.from({ length: 18 }, (_, i) => ({ [`perso${i + 1}`]: `./perso${i + 1}.png` })).reduce((a, b) => ({ ...a, ...b }), {}),
    ...Array.from({ length: 4 }, (_, i) => ({ [`cactus${i + 1}`]: `./cactus${i + 1}.png` })).reduce((a, b) => ({ ...a, ...b }), {}),
    note: './note.png',
    chapeau: './chapeau.png',
    botte: './botte.png',
    aimant: './aimant.png',
    coeur: './coeur.png',
    ...Array.from({ length: 5 }, (_, i) => ({ [`music${i + 1}`]: `./music${i + 1}.mp3` })).reduce((a, b) => ({ ...a, ...b }), {}),
  };

  let assetsLoaded = 0;
  const totalAssets = Object.keys(assetSources).length;

  function assetLoaded() {
    assetsLoaded++;
    if (loadingTextElement) {
      loadingTextElement.innerText = `Chargement... (${Math.round((assetsLoaded / totalAssets) * 100)}%)`;
    }
    if (assetsLoaded >= totalAssets) {
      if (loadingTextElement) loadingTextElement.style.display = 'none';
      initMenu();
    }
  }

  function assetFailedToLoad(key, src) {
    console.error(`Échec du chargement de l'asset: ${key} (${src})`);
    if (loadingTextElement) loadingTextElement.innerText = `ERREUR DE CHARGEMENT`;
    alert(`ERREUR : Impossible de charger "${src}". Vérifie le nom (majuscules/minuscules) et l'extension.`);
    throw new Error(`Asset manquant: ${src}`);
  }

  function loadAssets() {
    for (const key in assetSources) {
      const src = assetSources[key];

      if (src.endsWith('.png') || src.endsWith('.jpg') || src.endsWith('.jpeg') || src.endsWith('.webp')) {
        const img = new Image();
        img.onload = assetLoaded;
        img.onerror = () => assetFailedToLoad(key, src);
        img.src = src;
        assets[key] = img;
      } else if (src.endsWith('.mp3') || src.endsWith('.wav') || src.endsWith('.ogg')) {
        const a = new Audio();
        a.preload = 'auto';          // on ne bloque pas l'UI sur l'audio
        a.src = src;
        assets[key] = a;
        if (key.startsWith('music')) musicTracks.push(a);
        assetLoaded();               // on compte immédiatement l'audio comme "chargé" pour l'UI
      } else {
        // type inconnu -> ignore
        assetLoaded();
      }
    }
  }

  // ---- Classes ----
  class Player {
    constructor() {
      this.width = PLAYER_WIDTH;
      this.height = PLAYER_HEIGHT;
      this.x = 50;
      this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
      this.velocityY = 0;
      this.isGrounded = true;
      this.jumpCount = 0;
      this.maxJumps = MAX_JUMPS;
      this.setImage();
    }
    setImage() {
      const randomIndex = Math.floor(Math.random() * 18) + 1;
      this.image = assets[`perso${randomIndex}`];
    }
    jump() {
      if (this.jumpCount < this.maxJumps) {
        const boost = (activePowerUpType === 'superjump') ? 1.5 : 1.0;
        this.velocityY = -JUMP_POWER * boost;
        this.isGrounded = false;
        this.jumpCount++;
      }
    }
    update() {
      this.velocityY += GRAVITY;
      this.y += this.velocityY;

      const floorY = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
      if (this.y > floorY) {
        this.y = floorY;
        this.velocityY = 0;
        if (!this.isGrounded) {
          this.isGrounded = true;
          this.jumpCount = 0;
        }
      } else {
        this.isGrounded = false;
      }

      if (frameCount % 3 === 0) {
        particles.push(new Particle(this.x + this.width / 2, this.y + this.height / 2, 'standard'));
      }
    }
    draw() {
      if (activePowerUpType === 'invincible' && frameCount % 10 < 5) {
        // clignotement léger quand invincible
        return;
      }
      if (this.image && this.image.complete) {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
      } else {
        ctx.fillStyle = '#ddd';
        ctx.fillRect(this.x, this.y, this.width, this.height);
      }
    }
    getHitbox() {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
  }

  class Obstacle {
    constructor() {
      const cactusIndex = Math.floor(Math.random() * 4) + 1;
      this.image = assets[`cactus${cactusIndex}`];
      const aspectRatio = (this.image?.height || 100) / (this.image?.width || 50);
      this.width = OBSTACLE_BASE_WIDTH + (Math.random() * 20 - 10);
      this.height = this.width * aspectRatio;
      this.x = CANVAS_WIDTH;
      this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
      this.passed = false;
      this.isMobile = Math.random() < 0.1;
      this.verticalSpeed = (Math.random() * 2 + 1) * (Math.random() < 0.5 ? 1 : -1);
      this.verticalRange = 15;
      this.baseY = this.y;
    }
    update() {
      this.x -= gameSpeed;
      if (this.isMobile) {
        this.y += this.verticalSpeed;
        if (this.y < this.baseY - this.verticalRange || this.y > this.baseY + this.verticalRange) {
          this.verticalSpeed *= -1;
        }
      }
    }
    draw() {
      if (this.image && this.image.complete) {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
      } else {
        ctx.fillStyle = '#4a8a2b';
        ctx.fillRect(this.x, this.y, this.width, this.height);
      }
    }
    getHitbox() {
      return {
        x: this.x + this.width * 0.1,
        y: this.y + this.height * 0.1,
        width: this.width * 0.8,
        height: this.height * 0.8,
      };
    }
  }

  class Collectible {
    constructor() {
      this.image = assets.note;
      this.width = 30;
      this.height = 30;
      this.x = CANVAS_WIDTH;

      const groundPlayerY = CANVAS_HEIGHT - GROUND_HEIGHT;
      const maxSpawnHeightAboveGround = 120;
      const minSpawnHeightAboveGround = 50;
      const maxSpawnY = groundPlayerY - maxSpawnHeightAboveGround - this.height;
      const minSpawnY = groundPlayerY - (JUMP_POWER * JUMP_POWER) / (2 * GRAVITY) - 50;
      this.y = Math.random() * (maxSpawnY - minSpawnY) + minSpawnY;
      if (this.y > maxSpawnY) this.y = maxSpawnY;
      if (this.y < 50) this.y = 50;
    }
    update() {
      if (activePowerUpType === 'magnet') {
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 150) {
          this.x += dx * 0.05;
          this.y += dy * 0.05;
        }
      }
      this.x -= gameSpeed;
    }
    draw() {
      if (this.image && this.image.complete) {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
      } else {
        ctx.fillStyle = 'gold';
        ctx.fillRect(this.x, this.y, this.width, this.height);
      }
    }
    getHitbox() {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
  }

  class PowerUp {
    constructor() {
      const types = ['invincible', 'superjump', 'magnet'];
      this.type = types[Math.floor(Math.random() * types.length)];
      this.image = (this.type === 'invincible') ? assets.chapeau :
                   (this.type === 'superjump') ? assets.botte : assets.aimant;

      this.width = 100;
      this.height = (this.image?.height || 100) / (this.image?.width || 100) * this.width;
      this.x = CANVAS_WIDTH;

      const groundPlayerY = CANVAS_HEIGHT - GROUND_HEIGHT;
      const maxSpawnHeightAboveGround = 120;
      const minSpawnHeightAboveGround = 70;
      const maxSpawnY = groundPlayerY - maxSpawnHeightAboveGround - this.height;
      const minSpawnY = groundPlayerY - (JUMP_POWER * JUMP_POWER) / (2 * GRAVITY) - 70;
      this.y = Math.random() * (maxSpawnY - minSpawnY) + minSpawnY;
      if (this.y > maxSpawnY) this.y = maxSpawnY;
      if (this.y < 50) this.y = 50;

      this.baseY = this.y;
      this.angle = Math.random() * Math.PI * 2;
    }
    update() {
      this.x -= gameSpeed;
      this.angle += 0.05;
      this.y = this.baseY + Math.sin(this.angle) * 20;
    }
    draw() {
      if (this.image && this.image.complete) {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
      }
    }
    getHitbox() {
      return { x: this.x, y: this.y, width: this.width, height: this.height };
    }
  }

  class Particle {
    constructor(x, y, type) {
      this.x = x;
      this.y = y;
      this.type = type;
      this.size = Math.random() * 5 + 2;
      this.speedX = -Math.random() * 2 - 1;
      this.speedY = Math.random() * 2 - 1;
      this.gravity = 0.1;
      this.life = 100;
      this.color = (type === 'gold') ? 'gold' : (['gold', 'white', 'silver'])[Math.floor(Math.random() * 3)];
    }
    update() {
      this.speedY += this.gravity;
      this.x += this.speedX;
      this.y += this.speedY;
      this.life--;
    }
    draw() {
      ctx.globalAlpha = Math.max(0, this.life / 100);
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.size, this.size);
      ctx.globalAlpha = 1.0;
    }
  }

  class BackgroundHead {
    constructor() {
      const imgIndex = Math.floor(Math.random() * 18) + 1;
      this.image = assets[`perso${imgIndex}`];
      this.scale = Math.random() * 0.3 + 0.2;
      this.width = (this.image?.width || 50) * this.scale;
      this.height = (this.image?.height || 50) * this.scale;
      this.speed = BASE_GAME_SPEED * (this.scale * 0.5);
      this.alpha = this.scale * 1.5;
      this.x = CANVAS_WIDTH + Math.random() * CANVAS_WIDTH;

      const groundPlayerY = CANVAS_HEIGHT - GROUND_HEIGHT;
      const minHeightAboveGround = 160;
      const maxSpawnY = groundPlayerY - minHeightAboveGround - this.height;
      const minSpawnY = 50;
      this.y = Math.random() * (maxSpawnY - minSpawnY) + minSpawnY;
      this.y = Math.max(minSpawnY, Math.min(this.y, maxSpawnY));

      this.baseY = this.y;
      this.angle = Math.random() * Math.PI * 2;
      this.jumpHeight = Math.random() * 20 + 10;
    }
    update() {
      this.speed = gameSpeed * (this.scale * 0.5);
      this.x -= this.speed;
      this.angle += 0.03;
      this.y = this.baseY - Math.abs(Math.sin(this.angle)) * this.jumpHeight;
      if (this.x < -this.width) {
        this.x = CANVAS_WIDTH + Math.random() * CANVAS_WIDTH * 0.5;

        const groundPlayerY = CANVAS_HEIGHT - GROUND_HEIGHT;
        const minHeightAboveGround = 160;
        const maxSpawnY = groundPlayerY - minHeightAboveGround - this.height;
        const minSpawnY = 50;
        this.y = Math.random() * (maxSpawnY - minSpawnY) + minSpawnY;
        this.y = Math.max(minSpawnY, Math.min(this.y, maxSpawnY));
        this.baseY = this.y;
      }
    }
    draw() {
      ctx.globalAlpha = this.alpha;
      ctx.filter = 'brightness(0) opacity(0.5)'; // silhouettes
      if (this.image && this.image.complete) {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
      }
      ctx.filter = 'none';
      ctx.globalAlpha = 1.0;
    }
  }

  // ---- UI ----
  function initMenu() {
    gameState = 'menu';
    if (menuElement) menuElement.style.display = 'flex';
    if (gameOverScreenElement) gameOverScreenElement.style.display = 'none';
    if (scoreElement) scoreElement.style.display = 'none';
    if (versionElement) versionElement.style.display = 'block';
    if (powerUpTextElement) powerUpTextElement.style.display = 'none';
    if (powerUpTimerElement) powerUpTimerElement.style.display = 'none';
    if (livesContainer) livesContainer.style.display = 'none';
    if (adminButton) adminButton.style.display = 'block';
  }

  function startGame() {
    gameState = 'playing';
    if (menuElement) menuElement.style.setProperty('display', 'none', 'important');
    if (gameOverScreenElement) gameOverScreenElement.style.display = 'none';
    if (scoreElement) scoreElement.style.display = 'block';
    if (versionElement) versionElement.style.display = 'block';
    if (powerUpTextElement) powerUpTextElement.style.display = 'block';
    if (powerUpTimerElement) powerUpTimerElement.style.display = 'block';
    if (livesContainer) livesContainer.style.display = 'flex';

    score = 0;
    lives = INITIAL_LIVES;
    gameSpeed = BASE_GAME_SPEED;
    frameCount = 0;
    obstacles = [];
    collectibles = [];
    powerUps = [];
    particles = [];
    obstacleTimer = BASE_OBSTACLE_SPAWN_INTERVAL;
    collectibleTimer = 200;
    rainTimer = 30 * 60;
    isPowerUpActive = false;
    activePowerUpType = null;
    powerUpTimer = 0;
    scoreAtLastPowerUp = -POWERUP_SCORE_INTERVAL;

    updateLivesDisplay();
    player = new Player();
    backgroundHeads = [];
    for (let i = 0; i < 10; i++) backgroundHeads.push(new BackgroundHead());

    if (currentMusic) {
      currentMusic.pause();
      currentMusic.currentTime = 0;
    }
    if (musicTracks.length) {
      currentMusic = musicTracks[Math.floor(Math.random() * musicTracks.length)];
      currentMusic.loop = true;
      currentMusic.volume = 0.5;
      currentMusic.play().catch(() => { /* silencieux si bloqué */ });
    }

    requestAnimationFrame(updateGame);
  }

  function endGame() {
    gameState = 'gameOver';
    if (currentMusic) currentMusic.pause();
    if (gameOverScreenElement) gameOverScreenElement.style.display = 'flex';
    if (finalScoreElement) finalScoreElement.innerText = `${score}`;
    gameContainer.classList.add('shake');
    setTimeout(() => gameContainer.classList.remove('shake'), 500);
    resetPowerUp();
  }

  function updateLivesDisplay() {
    livesContainer.innerHTML = '';
    if (assets.coeur && assets.coeur.complete) {
      for (let i = 0; i < lives; i++) {
        const heartImg = document.createElement('img');
        heartImg.src = assets.coeur.src;
        heartImg.alt = 'Vie';
        livesContainer.appendChild(heartImg);
      }
    }
  }

  // ---- Gestion du jeu ----
  function handleBackground() {
    // Fond uni + image de fond si dispo
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const bg = assets.background;
    if (bg && bg.complete) {
      // on remplit en conservant le ratio
      const scale = Math.max(CANVAS_WIDTH / bg.width, CANVAS_HEIGHT / bg.height);
      const w = bg.width * scale;
      const h = bg.height * scale;
      const x = (CANVAS_WIDTH - w) / 2;
      const y = (CANVAS_HEIGHT - h) / 2;
      ctx.drawImage(bg, x, y, w, h);
    }

    // Parallax des têtes silhouette
    backgroundHeads.forEach((b) => { b.update(); b.draw(); });

    // Sol
    ctx.fillStyle = '#222';
    ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
  }

  function handleSpawners() {
    // Obstacles
    obstacleTimer--;
    if (obstacleTimer <= 0) {
      obstacles.push(new Obstacle());
      const next = Math.max(MIN_OBSTACLE_SPAWN_INTERVAL, BASE_OBSTACLE_SPAWN_INTERVAL - Math.floor(score / 5));
      obstacleTimer = next;
    }

    // Notes
    collectibleTimer--;
    if (collectibleTimer <= 0) {
      collectibles.push(new Collectible());
      collectibleTimer = 120 + Math.floor(Math.random() * 80);
    }

    // Power-up toutes les X points si aucun actif
    if (!isPowerUpActive && score - scoreAtLastPowerUp >= POWERUP_SCORE_INTERVAL) {
      powerUps.push(new PowerUp());
      scoreAtLastPowerUp = score;
    }
  }

  function handleEntities() {
    // Particules
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();
      if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Joueur
    player.update();
    player.draw();

    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.update();
      o.draw();

      if (checkCollision(player.getHitbox(), o.getHitbox())) {
        if (activePowerUpType !== 'invincible') {
          lives--;
          updateLivesDisplay();
          obstacles.splice(i, 1);
          if (lives <= 0) {
            endGame();
            break;
          }
        }
      } else if (!o.passed && (o.x + o.width) < player.x) {
        score++;
        o.passed = true;
      }

      if (o.x < -o.width) obstacles.splice(i, 1);
    }

    // Notes
    for (let i = collectibles.length - 1; i >= 0; i--) {
      const
