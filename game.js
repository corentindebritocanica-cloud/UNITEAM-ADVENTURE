// Attendre que le DOM soit chargé
window.addEventListener('load', function() {

    // Éléments du DOM
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
    const livesContainer = document.getElementById('lives-container'); // Nécessaire pour V3.2, mais on reste sur V3.1 pour l'instant

    // Dimensions du Canvas (remplit le conteneur)
    let CANVAS_WIDTH, CANVAS_HEIGHT;

    function resizeCanvas() {
        CANVAS_WIDTH = gameContainer.clientWidth;
        CANVAS_HEIGHT = gameContainer.clientHeight;
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Appel initial

    // Constantes du jeu (basées sur le GDD et V3)
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
    const BASE_OBSTACLE_SPAWN_INTERVAL = 100;
    const MIN_OBSTACLE_SPAWN_INTERVAL = 45;
    const OBSTACLE_BASE_WIDTH = 60;
    const INITIAL_LIVES = 3; // Gardé pour compatibilité future V3.2
    const HEART_SIZE = 30;
    const HEART_SPACING = 5;

    // Variables d'état du jeu
    let gameState = 'loading';
    let player;
    let obstacles = [];
    let collectibles = [];
    let powerUps = [];
    let backgroundHeads = [];
    let particles = [];
    let score = 0;
    let lives = INITIAL_LIVES; // Gardé pour V3.2
    let gameSpeed = BASE_GAME_SPEED;
    let frameCount = 0;

    // Timers
    let obstacleTimer = 0;
    let collectibleTimer = 0;
    let rainTimer = 0;
    let rainActive = false;
    let rainDuration = 0;

    // Power-Up
    let isPowerUpActive = false;
    let activePowerUpType = null;
    let powerUpTimer = 0;
    let canSpawnPowerUp = false;
    let scoreAtLastPowerUp = 0;

    // Musique
    let currentMusic = null;
    const musicTracks = [];

    // Ressources
    const assets = {};
    const assetSources = {
        logo: 'uniteamadventure.png',
        background: 'FOND DE PLAN.jpg',
        ...Array.from({length: 18}, (_, i) => ({[`perso${i+1}`]: `perso${i+1}.png`})).reduce((a, b) => ({...a, ...b}), {}),
        ...Array.from({length: 4}, (_, i) => ({[`cactus${i+1}`]: `cactus${i+1}.png`})).reduce((a, b) => ({...a, ...b}), {}),
        note: 'note.png',
        chapeau: 'chapeau.png',
        botte: 'botte.png',
        aimant: 'aimant.png',
        coeur: 'coeur.png', // Gardé pour V3.2
        ...Array.from({length: 5}, (_, i) => ({[`music${i+1}`]: `music${i+1}.mp3`})).reduce((a, b) => ({...a, ...b}), {}),
    };

    // --- CHARGEMENT DES RESSOURCES (V3: Avec gestion d'erreurs) ---
    let assetsLoaded = 0;
    const totalAssets = Object.keys(assetSources).length;

    function loadAssets() {
        for (const key in assetSources) {
            const src = assetSources[key];
            if (src.endsWith('.png') || src.endsWith('.jpg')) {
                assets[key] = new Image();
                assets[key].onload = assetLoaded;
                assets[key].onerror = function() {
                    assetFailedToLoad(key, src);
                };
            } else if (src.endsWith('.mp3')) {
                assets[key] = new Audio();
                if (key.startsWith('music')) {
                    musicTracks.push(assets[key]);
                }
                assets[key].src = src;
                assetLoaded();
            }
            // Correction: S'assurer que .src est défini même pour l'audio
            if (assets[key]) {
                assets[key].src = src;
            } else {
                 console.warn(`Asset key ${key} was potentially not initialized correctly before setting src.`);
            }
        }
    }

    function assetLoaded() {
        assetsLoaded++;
        // Mise à jour optionnelle du texte de chargement
        if (loadingTextElement) {
             loadingTextElement.innerText = `Chargement... (${Math.round((assetsLoaded / totalAssets) * 100)}%)`;
        }
        if (assetsLoaded === totalAssets) {
             if (loadingTextElement) loadingTextElement.style.display = 'none';
            initMenu();
        }
    }

    function assetFailedToLoad(key, src) {
        console.error(`Échec du chargement de l'asset: ${key} (${src})`);
         if (loadingTextElement) loadingTextElement.innerText = `ERREUR DE CHARGEMENT`;
        alert(`ERREUR : Impossible de charger le fichier "${src}". \n\nVérifiez que le fichier existe bien dans le dossier et que le nom est correct (attention aux majuscules/minuscules et à l'extension .png/.jpg).`);
        throw new Error("Échec du chargement de l'asset. Vérifiez le nom du fichier.");
    }

    // --- CLASSES DU JEU ---

    class Player {
        // UN SEUL CONSTRUCTOR
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
                let currentJumpPower = (activePowerUpType === 'superjump') ? JUMP_POWER * 1.5 : JUMP_POWER;
                this.velocityY = -currentJumpPower;
                this.isGrounded = false;
                this.jumpCount++;
            }
        }
        update() {
            this.velocityY += GRAVITY;
            this.y += this.velocityY;

            if (this.y > CANVAS_HEIGHT - GROUND_HEIGHT - this.height) {
                this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
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
                // clignote
            } else if (this.image && this.image.complete) {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
        }
        getHitbox() {
            return { x: this.x, y: this.y, width: this.width, height: this.height };
        }
    }

    class Obstacle {
        // UN SEUL CONSTRUCTOR
        constructor() {
            const cactusIndex = Math.floor(Math.random() * 4) + 1;
            this.image = assets[`cactus${cactusIndex}`];
            const aspectRatio = this.image.height / this.image.width;
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
            }
        }
        getHitbox() {
            return {
                x: this.x + this.width * 0.1,
                y: this.y + this.height * 0.1,
                width: this.width * 0.8,
                height: this.height * 0.8
            };
        }
    }

    class Collectible {
        // UN SEUL CONSTRUCTOR
        constructor() {
            this.image = assets.note;
            this.width = 30;
            this.height = 30;
            this.x = CANVAS_WIDTH;
            // Hauteur V3.1
            const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
            const spawnRange = 150;
            const maxSpawnHeight = 250;
            const maxSpawnY = groundY - maxSpawnHeight - this.height;
            const minSpawnY = groundY - JUMP_POWER*JUMP_POWER/(2*GRAVITY) - 50;
            this.y = Math.random() * (maxSpawnY - minSpawnY) + minSpawnY;
            if (this.y > maxSpawnY) this.y = maxSpawnY;
            if (this.y < 50) this.y = 50;
        }
        update() {
            if (activePowerUpType === 'magnet') {
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
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
            }
        }
        getHitbox() {
            return { x: this.x, y: this.y, width: this.width, height: this.height };
        }
    }

    class PowerUp {
        // UN SEUL CONSTRUCTOR
        constructor() {
            const types = ['invincible', 'superjump', 'magnet'];
            this.type = types[Math.floor(Math.random() * types.length)];
            if (this.type === 'invincible') this.image = assets.chapeau;
            else if (this.type === 'superjump') this.image = assets.botte;
            else if (this.type === 'magnet') this.image = assets.aimant;
            this.width = 100;
            this.height = (this.image && this.image.height && this.image.width) ? (this.image.height / this.image.width) * this.width : 100; // Sécurité
            this.x = CANVAS_WIDTH;
             // Hauteur V3.1
            const groundY = CANVAS_HEIGHT - GROUND_HEIGHT;
            const spawnRange = 150;
            const maxSpawnHeight = 300;
            const maxSpawnY = groundY - maxSpawnHeight - this.height;
            const minSpawnY = groundY - JUMP_POWER*JUMP_POWER/(2*GRAVITY) - 70;
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
        // UN SEUL CONSTRUCTOR
        constructor(x, y, type) {
            this.x = x; this.y = y; this.type = type;
            this.size = Math.random() * 5 + 2;
            this.speedX = -Math.random() * 2 - 1;
            this.speedY = Math.random() * 2 - 1;
            this.gravity = 0.1;
            this.life = 100;
            if (type === 'gold') { this.color = 'gold'; }
            else { const colors = ['gold', 'white', 'silver']; this.color = colors[Math.floor(Math.random() * colors.length)]; }
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
        // UN SEUL CONSTRUCTOR
        constructor() {
            const imgIndex = Math.floor(Math.random() * 18) + 1;
            this.image = assets[`perso${imgIndex}`];
            this.scale = Math.random() * 0.3 + 0.2;
            this.width = (this.image.width || 50) * this.scale;
            this.height = (this.image.height || 50) * this.scale;
            this.speed = BASE_GAME_SPEED * (this.scale * 0.5);
            this.alpha = this.scale * 1.5;
            this.x = CANVAS_WIDTH + Math.random() * CANVAS_WIDTH;
            // Hauteur V3.1
            const groundPlayerY = CANVAS_HEIGHT - GROUND_HEIGHT;
            const minHeightAboveGround = 160;
            const maxSpawnY = groundPlayerY - minHeightAboveGround - this.height;
            const minSpawnY = 50;
            this.y = Math.random() * (maxSpawnY - minSpawnY) + minSpawnY;
            if (this.y > maxSpawnY) this.y = maxSpawnY;
            if (this.y < minSpawnY) this.y = minSpawnY;
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
                this.x = CANVAS_WIDTH;
                const groundPlayerY = CANVAS_HEIGHT - GROUND_HEIGHT;
                const minHeightAboveGround = 160;
                const maxSpawnY = groundPlayerY - minHeightAboveGround - this.height;
                const minSpawnY = 50;
                this.y = Math.random() * (maxSpawnY - minSpawnY) + minSpawnY;
                 if (this.y > maxSpawnY) this.y = maxSpawnY;
                 if (this.y < minSpawnY) this.y = minSpawnY;
                this.baseY = this.y;
            }
        }
         draw() {
            ctx.globalAlpha = this.alpha;
            ctx.filter = 'brightness(0) opacity(0.5)'; // Silhouette V1-V3
            if (this.image && this.image.complete) {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
            ctx.filter = 'none';
            ctx.globalAlpha = 1.0;
        }
    }

    // --- FONCTIONS DE GESTION DU JEU ---
    function initMenu() {
        gameState = 'menu';
        menuElement.style.display = 'flex';
        gameOverScreenElement.style.display = 'none';
        scoreElement.style.display = 'none';
        versionElement.style.display = 'block';
        powerUpTextElement.style.display = 'none';
        powerUpTimerElement.style.display = 'none';
         if(livesContainer) livesContainer.style.display = 'none'; // Cacher vies si l'élément existe
        if (adminButton) adminButton.style.display = 'block';
    }

    function startGame() {
        gameState = 'playing';
        menuElement.style.display = 'none';
        gameOverScreenElement.style.display = 'none';
        scoreElement.style.display = 'block';
        versionElement.style.display = 'block';
        powerUpTextElement.style.display = 'block';
        powerUpTimerElement.style.display = 'block';
        if(livesContainer) livesContainer.style.display = 'flex'; // Afficher vies si l'élément existe
        if (adminButton) adminButton.style.display = 'none';
        score = 0;
        lives = INITIAL_LIVES; // Réinit vies
        gameSpeed = BASE_GAME_SPEED;
        frameCount = 0;
        obstacles = []; collectibles = []; powerUps = []; particles = [];
        obstacleTimer = BASE_OBSTACLE_SPAWN_INTERVAL;
        collectibleTimer = 200;
        rainTimer = 30 * 60;
        canSpawnPowerUp = false;
        scoreAtLastPowerUp = -POWERUP_SCORE_INTERVAL;
        resetPowerUp();
        updateLivesDisplay(); // MAJ affichage vies
        player = new Player();
        backgroundHeads = [];
        for(let i = 0; i < 10; i++) { backgroundHeads.push(new BackgroundHead()); }
        if (currentMusic) { currentMusic.pause(); currentMusic.currentTime = 0; }
        currentMusic = musicTracks[Math.floor(Math.random() * musicTracks.length)];
        currentMusic.loop = true; currentMusic.volume = 0.5;
        currentMusic.play().catch(e => console.log("L'audio n'a pas pu démarrer:", e));
        updateGame();
    }

    function endGame() {
        gameState = 'gameOver';
        if (currentMusic) { currentMusic.pause(); }
        gameOverScreenElement.style.display = 'flex';
        finalScoreElement.innerText = `${score}`;
        gameContainer.classList.add('shake');
        setTimeout(() => gameContainer.classList.remove('shake'), 500);
        resetPowerUp();
    }

    // Fonction affichage vies (gardée pour V3.2)
    function updateLivesDisplay() {
         if (!livesContainer) return; // Ne rien faire si l'élément n'existe pas
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

    // --- FONCTIONS DE MISE À JOUR (Handle) ---
    function handleBackground() {
        // Dessiner le fond d'abord
        if(assets.background && assets.background.complete) {
             ctx.drawImage(assets.background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        } else {
             ctx.fillStyle = '#111'; // Fond de secours si l'image n'est pas chargée
             ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        }
        // Dessiner les persos de fond ensuite
        backgroundHeads.forEach(head => { head.update(); head.draw(); });
        // Dessiner le sol par-dessus
        ctx.fillStyle = '#666';
        ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
    }

    function handleSpawners() {
        obstacleTimer--;
        if (obstacleTimer <= 0) {
            obstacles.push(new Obstacle());
            if (Math.random() < 0.1) {
                setTimeout(() => {
                    if(gameState !== 'playing') return;
                    const pairObstacle = new Obstacle();
                    pairObstacle.width *= 0.8; pairObstacle.height *= 0.8;
                    pairObstacle.y = CANVAS_HEIGHT - GROUND_HEIGHT - pairObstacle.height;
                    obstacles.push(pairObstacle);
                }, 300 / gameSpeed);
            }
            const speedFactor = Math.max(1, (gameSpeed - BASE_GAME_SPEED)); // Eviter division par 0 ou ralentissement initial
            const newInterval = BASE_OBSTACLE_SPAWN_INTERVAL - speedFactor * 5;
            obstacleTimer = Math.max(MIN_OBSTACLE_SPAWN_INTERVAL, newInterval) + (Math.random() * 20 - 10);
        }
        collectibleTimer--;
        if (collectibleTimer <= 0) {
            collectibles.push(new Collectible());
            collectibleTimer = 200 + Math.random() * 100;
        }
        if (!canSpawnPowerUp && score >= 30 && score >= scoreAtLastPowerUp + POWERUP_SCORE_INTERVAL) { canSpawnPowerUp = true; }
        if (canSpawnPowerUp && !isPowerUpActive && powerUps.length === 0) {
            if (Math.random() < 0.005) { // Chance V3
                powerUps.push(new PowerUp());
                canSpawnPowerUp = false;
            }
        }
    }

    function handleEntities() {
        particles.forEach((p, index) => { p.update(); p.draw(); if (p.life <= 0) particles.splice(index, 1); });
        player.update();
        player.draw();

        obstacles.forEach((obstacle, index) => {
            obstacle.update();
            obstacle.draw();
            if (checkCollision(player.getHitbox(), obstacle.getHitbox())) {
                if (activePowerUpType !== 'invincible') {
                    lives--; // Perdre une vie
                    updateLivesDisplay();
                    obstacles.splice(index, 1); // Enlever l'obstacle touché
                    if (lives <= 0) {
                        endGame(); // Game Over
                    }
                    // Ajouter ici un petit effet visuel/sonore de perte de vie si souhaité
                }
            } else if (obstacle.x + obstacle.width < player.x && !obstacle.passed) {
                score++;
                obstacle.passed = true;
            }
            // Enlever l'obstacle seulement s'il est hors écran ET qu'il n'y a pas de collision
            // (évite bug si collision pile au bord gauche)
            if (obstacle.x < -obstacle.width && !checkCollision(player.getHitbox(), obstacle.getHitbox())) {
                 obstacles.splice(index, 1);
            }
        });

        collectibles.forEach((collectible, index) => {
            collectible.update();
            collectible.draw();
            if (checkCollision(player.getHitbox(), collectible.getHitbox())) {
                score += 10;
                for(let i=0; i<10; i++) { particles.push(new Particle(player.x + player.width/2, player.y + player.height/2, 'standard')); }
                collectibles.splice(index, 1);
            }
            if (collectible.x < -collectible.width) { collectibles.splice(index, 1); }
        });
        powerUps.forEach((powerUp, index) => {
            powerUp.update();
            powerUp.draw();
            if (checkCollision(player.getHitbox(), powerUp.getHitbox())) { activatePowerUp(powerUp.type); powerUps.splice(index, 1); }
            if (powerUp.x < -powerUp.width) { powerUps.splice(index, 1); }
        });
    }

    function handleWeather() {
        const cycle = (score % 500) / 500;
        const nightAlpha = Math.sin(cycle * Math.PI) * 0.7;
        ctx.fillStyle = `rgba(0, 0, 50, ${nightAlpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        rainTimer--;
        if (rainTimer <= 0 && !rainActive) {
            if (Math.random() < 0.3) { rainActive = true; rainDuration = (Math.random() * 10 + 5) * 60; }
            rainTimer = 30 * 60;
        }
        if (rainActive) {
            rainDuration--;
            if (rainDuration <= 0) rainActive = false;
            ctx.fillStyle = 'rgba(0, 0, 100, 0.1)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
            ctx.lineWidth = 1;
             for(let i=0; i<50; i++) {
                const x = Math.random() * CANVAS_WIDTH; const y = Math.random() * CANVAS_HEIGHT; const len = Math.random() * 10 + 5;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + len); ctx.stroke();
            }
        }
    }

    function handlePowerUps() {
        if (!isPowerUpActive) return;
        powerUpTimer -= 1000 / 60;
        if (powerUpTimer <= 0) { resetPowerUp(); }
        else { powerUpTimerElement.innerText = (powerUpTimer / 1000).toFixed(1) + 's'; }
    }

    function activatePowerUp(type) {
        isPowerUpActive = true; activePowerUpType = type; powerUpTimer = POWERUP_DURATION_MS;
        scoreAtLastPowerUp = score;
        let text = '';
        if (type === 'invincible') text = 'INVINCIBLE !';
        if (type === 'superjump') text = 'SUPER SAUT !';
        if (type === 'magnet') text = 'AIMANT !';
        powerUpTextElement.innerText = text; powerUpTextElement.style.opacity = 1;
        setTimeout(() => { powerUpTextElement.style.opacity = 0; }, 2000);
        for(let i=0; i<30; i++) { particles.push(new Particle(player.x + player.width/2, player.y + player.height/2, 'gold')); }
    }

    function resetPowerUp() {
        isPowerUpActive = false; activePowerUpType = null; powerUpTimer = 0;
        powerUpTextElement.innerText = ''; powerUpTimerElement.innerText = '';
    }

    // --- UTILITAIRES ---
    function checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
    }

    // --- BOUCLE DE JEU PRINCIPALE ---
    function updateGame() {
        if (gameState !== 'playing') return;
        requestAnimationFrame(updateGame);
        frameCount++;
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        handleBackground();
        handleWeather();
        handleEntities(); // Modifié V3.2
        handleSpawners();
        handlePowerUps();
        scoreElement.innerText = `Score: ${score}`;
        gameSpeed += GAME_ACCELERATION;
    }

    // --- GESTION DES CONTRÔLES ---
     function handleInput(event) {
        event.preventDefault();
        switch (gameState) {
            case 'menu': startGame(); break;
            case 'playing': if (player) player.jump(); break;
            case 'gameOver': initMenu(); break;
        }
    }
    gameContainer.addEventListener('mousedown', handleInput);
    gameContainer.addEventListener('touchstart', handleInput, { passive: false });

    // Bouton Admin
     adminButton.addEventListener('click', (e) => {
        const password = prompt("Mot de passe Admin :");
        if (password === "corentin") { window.open('admin.html', '_blank'); }
        else if (password) { alert("Mauvais mot de passe."); }
    });
     function stopEventPropagation(e) { e.stopPropagation(); }
    adminButton.addEventListener('mousedown', stopEventPropagation);
    adminButton.addEventListener('touchstart', stopEventPropagation, { passive: false });

    // Démarrer le chargement
    loadAssets();
});
