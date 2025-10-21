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

    // Constantes du jeu (basées sur le GDD)
    const PLAYER_WIDTH = 50;
    const PLAYER_HEIGHT = 50;
    const BASE_GRAVITY = 0.8; // Gravité de base à 60 FPS
    const BASE_JUMP_POWER = 15; // Puissance de saut de base (impulsion)
    const MAX_JUMPS = 2;
    const GROUND_HEIGHT = 70;
    const POWERUP_SCORE_INTERVAL = 20; 
    const POWERUP_DURATION_S = 5; // Durée en secondes
    
    // --- MODIFICATIONS V2.8 ---
    const TARGET_FPS = 60; 
    const TARGET_BASE_SPEED = 9.0; // Vitesse de base cible effective (entre V2.6 et V2.7)
    const TARGET_ACCELERATION_PER_SECOND = 0.108; // Accélération cible effective par seconde (entre V2.6 et V2.7)
    // -------------------------

    const OBSTACLE_BASE_WIDTH = 40; // Cactus fins
    const BASE_OBSTACLE_SPAWN_INTERVAL = 120; // Écart V2.4 (en frames @ 60 FPS)
    const MIN_OBSTACLE_SPAWN_INTERVAL = 45; // (en frames @ 60 FPS)

    // Variables d'état du jeu
    let gameState = 'loading'; 
    let player;
    let obstacles = [];
    let collectibles = [];
    let powerUps = [];
    let backgroundHeads = [];
    let particles = [];
    let score = 0;
    let gameSpeed = TARGET_BASE_SPEED; // Vitesse actuelle du jeu
    let frameCount = 0; 
    let lastTime = 0; 
    
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
    let scoreAtLastPowerUp = -POWERUP_SCORE_INTERVAL;
    let lastPowerUpType = null; 

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
        ...Array.from({length: 5}, (_, i) => ({[`music${i+1}`]: `music${i+1}.mp3`})).reduce((a, b) => ({...a, ...b}), {}),
    };

    // --- CHARGEMENT DES RESSOURCES ---
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
            if (assets[key]) {
                assets[key].src = src;
            }
        }
    }
    function assetLoaded() {
        assetsLoaded++;
        loadingTextElement.innerText = `Chargement... (${Math.round((assetsLoaded / totalAssets) * 100)}%)`;
        if (assetsLoaded === totalAssets) {
            loadingTextElement.style.display = 'none';
            initMenu();
        }
    }
    function assetFailedToLoad(key, src) {
        console.error(`Échec du chargement de l'asset: ${key} (${src})`);
        loadingTextElement.innerText = `ERREUR DE CHARGEMENT`;
        alert(`ERREUR : Impossible de charger le fichier "${src}". \n\nVérifiez que le fichier existe bien dans le dossier et que le nom est correct (attention aux majuscules/minuscules et à l'extension .png/.jpg).`);
        throw new Error("Échec du chargement de l'asset. Vérifiez le nom du fichier.");
    }

    // --- CLASSES DU JEU ---

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
                let currentJumpPower = (activePowerUpType === 'superjump') ? BASE_JUMP_POWER * 1.5 : BASE_JUMP_POWER;
                this.velocityY = -currentJumpPower;
                this.isGrounded = false;
                this.jumpCount++;
            }
        }
        update(deltaTime) {
            this.velocityY += BASE_GRAVITY * deltaTime * TARGET_FPS; 
            this.y += this.velocityY * deltaTime * TARGET_FPS;

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
        constructor() {
            const cactusIndex = Math.floor(Math.random() * 4) + 1;
            this.image = assets[`cactus${cactusIndex}`];
            const aspectRatio = this.image.height / this.image.width;
            this.width = OBSTACLE_BASE_WIDTH + (Math.random() * 10 - 5); 
            this.height = this.width * aspectRatio;
            this.x = CANVAS_WIDTH;
            this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
            this.passed = false;
            this.isMobile = Math.random() < 0.1;
            this.verticalSpeed = (Math.random() * 2 + 1) * (Math.random() < 0.5 ? 1 : -1); 
            this.verticalRange = 15;
            this.baseY = this.y;
        }
        update(deltaTime) {
            this.x -= gameSpeed * deltaTime * TARGET_FPS; 
            if (this.isMobile) {
                this.y += this.verticalSpeed * deltaTime * TARGET_FPS; 
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
        constructor() {
            this.image = assets.note;
            this.width = 30;
            this.height = 30;
            this.x = CANVAS_WIDTH;
            const spawnRange = 150;
            const maxSpawnHeight = 250; 
            this.y = (CANVAS_HEIGHT - GROUND_HEIGHT - maxSpawnHeight) + (Math.random() * spawnRange);
        }
        update(deltaTime) {
            if (activePowerUpType === 'magnet') {
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 150) { 
                    const attractionFactor = 0.05 * deltaTime * TARGET_FPS;
                    this.x += dx * attractionFactor; 
                    this.y += dy * attractionFactor;
                }
            }
            this.x -= gameSpeed * deltaTime * TARGET_FPS; 
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
        constructor() {
            const types = ['invincible', 'superjump', 'magnet'];
            const availableTypes = types.filter(t => t !== lastPowerUpType);
            this.type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            if (this.type === 'invincible') this.image = assets.chapeau;
            else if (this.type === 'superjump') this.image = assets.botte;
            else if (this.type === 'magnet') this.image = assets.aimant;
            this.width = 100; 
            this.height = (this.image.height / this.image.width) * this.width;
            this.x = CANVAS_WIDTH;
            const spawnRange = 150;
            const maxSpawnHeight = 300; 
            this.y = (CANVAS_HEIGHT - GROUND_HEIGHT - maxSpawnHeight) + (Math.random() * spawnRange);
            this.baseY = this.y;
            this.angle = Math.random() * Math.PI * 2;
        }
        update(deltaTime) {
            this.x -= gameSpeed * deltaTime * TARGET_FPS; 
            this.angle += 0.05 * deltaTime * TARGET_FPS; 
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
            this.x = x; this.y = y; this.type = type; 
            this.size = Math.random() * 5 + 2; 
            this.speedX = -Math.random() * 2 - 1; 
            this.speedY = Math.random() * 2 - 1; 
            this.gravity = 0.1; 
            this.life = 100; 
            if (type === 'gold') { this.color = 'gold'; } 
            else { const colors = ['gold', 'white', 'silver']; this.color = colors[Math.floor(Math.random() * colors.length)]; }
        }
        update(deltaTime) {
            this.speedY += this.gravity * deltaTime * TARGET_FPS; 
            this.x += this.speedX * deltaTime * TARGET_FPS; 
            this.y += this.speedY * deltaTime * TARGET_FPS; 
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
            this.scale = 1/6; 
            this.width = (this.image.width || 50) * this.scale;
            this.height = (this.image.height || 50) * this.scale;
            this.baseSpeedFactor = this.scale * 0.5; 
            this.speed = gameSpeed * this.baseSpeedFactor; 
            this.alpha = 0.6; 
            this.x = CANVAS_WIDTH + Math.random() * CANVAS_WIDTH;
            this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height - Math.random() * 150;
            this.baseY = this.y;
            this.angle = Math.random() * Math.PI * 2;
            this.jumpHeight = Math.random() * 20 + 10;
        }
        update(deltaTime) {
            this.speed = gameSpeed * this.baseSpeedFactor; 
            this.x -= this.speed * deltaTime * TARGET_FPS; 
            this.angle += 0.03 * deltaTime * TARGET_FPS; 
            this.y = this.baseY - Math.abs(Math.sin(this.angle)) * this.jumpHeight; 
            if (this.x < -this.width) {
                this.x = CANVAS_WIDTH;
                this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height - Math.random() * 150;
                this.baseY = this.y;
            }
        }
        draw() {
            ctx.globalAlpha = this.alpha;
            if (this.image && this.image.complete) {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
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
        if (adminButton) adminButton.style.display = 'none';
        score = 0;
        gameSpeed = TARGET_BASE_SPEED; 
        frameCount = 0;
        obstacles = []; collectibles = []; powerUps = []; particles = [];
        obstacleTimer = BASE_OBSTACLE_SPAWN_INTERVAL; 
        collectibleTimer = 200; 
        rainTimer = 30; 
        canSpawnPowerUp = false;
        scoreAtLastPowerUp = -POWERUP_SCORE_INTERVAL; 
        resetPowerUp();
        lastPowerUpType = null; 
        player = new Player();
        backgroundHeads = [];
        for(let i = 0; i < 10; i++) { backgroundHeads.push(new BackgroundHead()); }
        if (currentMusic) { currentMusic.pause(); currentMusic.currentTime = 0; }
        currentMusic = musicTracks[Math.floor(Math.random() * musicTracks.length)];
        currentMusic.loop = true; currentMusic.volume = 0.5;
        currentMusic.play().catch(e => console.log("L'audio n'a pas pu démarrer:", e));
        lastTime = performance.now(); 
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

    // --- FONCTIONS DE MISE À JOUR (Handle) ---

    function handleBackground(deltaTime) {
        ctx.drawImage(assets.background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        backgroundHeads.forEach(head => { head.update(deltaTime); head.draw(); });
        ctx.fillStyle = '#666';
        ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
    }

    function handleSpawners(deltaTime) {
        const virtualFramesPassed = deltaTime * TARGET_FPS;
        obstacleTimer -= virtualFramesPassed; 
        if (obstacleTimer <= 0) {
            obstacles.push(new Obstacle());
            if (Math.random() < 0.1) {
                setTimeout(() => {
                    if (gameState !== 'playing') return; 
                    const pairObstacle = new Obstacle();
                    pairObstacle.width *= 0.8; pairObstacle.height *= 0.8;
                    pairObstacle.y = CANVAS_HEIGHT - GROUND_HEIGHT - pairObstacle.height;
                    obstacles.push(pairObstacle);
                }, 300 / (gameSpeed / TARGET_BASE_SPEED)); 
            }
            const speedFactor = gameSpeed / TARGET_BASE_SPEED; 
            const currentInterval = BASE_OBSTACLE_SPAWN_INTERVAL / speedFactor; 
            obstacleTimer = Math.max(MIN_OBSTACLE_SPAWN_INTERVAL, currentInterval);
            obstacleTimer += Math.random() * 20 - 10; 
        }

        collectibleTimer -= virtualFramesPassed;
        if (collectibleTimer <= 0) {
            collectibles.push(new Collectible());
            collectibleTimer = 200 + Math.random() * 100; 
        }

        if (!canSpawnPowerUp && score >= 30 && score >= scoreAtLastPowerUp + POWERUP_SCORE_INTERVAL) { canSpawnPowerUp = true; }
        if (canSpawnPowerUp && !isPowerUpActive && powerUps.length === 0) {
             if (Math.random() < 0.01) { 
                powerUps.push(new PowerUp());
                canSpawnPowerUp = false; 
            }
        }
    }

    function handleEntities(deltaTime) {
        particles.forEach((p, index) => { p.update(deltaTime); p.draw(); if (p.life <= 0) particles.splice(index, 1); });
        player.update(deltaTime); 
        player.draw(); 
        obstacles.forEach((obstacle, index) => {
            obstacle.update(deltaTime); 
            obstacle.draw(); 
            if (checkCollision(player.getHitbox(), obstacle.getHitbox())) { if (activePowerUpType !== 'invincible') { endGame(); } }
            if (obstacle.x + obstacle.width < player.x && !obstacle.passed) { score++; obstacle.passed = true; }
            if (obstacle.x < -obstacle.width) { obstacles.splice(index, 1); }
        });
        collectibles.forEach((collectible, index) => {
            collectible.update(deltaTime); 
            collectible.draw(); 
            if (checkCollision(player.getHitbox(), collectible.getHitbox())) { 
                score += 10; 
                for(let i=0; i<10; i++) { particles.push(new Particle(player.x + player.width/2, player.y + player.height/2, 'standard')); }
                collectibles.splice(index, 1);
            }
            if (collectible.x < -collectible.width) { collectibles.splice(index, 1); }
        });
        powerUps.forEach((powerUp, index) => {
            powerUp.update(deltaTime); 
            powerUp.draw(); 
            if (checkCollision(player.getHitbox(), powerUp.getHitbox())) { activatePowerUp(powerUp.type); powerUps.splice(index, 1); }
            if (powerUp.x < -powerUp.width) { powerUps.splice(index, 1); }
        });
    }

    function handleWeather(deltaTime) {
        const cycle = (score % 500) / 500; 
        const nightAlpha = Math.sin(cycle * Math.PI) * 0.7; 
        ctx.fillStyle = `rgba(0, 0, 50, ${nightAlpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        rainTimer -= deltaTime; 
        if (rainTimer <= 0 && !rainActive) {
            if (Math.random() < 0.3) { rainActive = true; rainDuration = Math.random() * 10 + 5; }
            rainTimer = 30; 
        }
        if (rainActive) {
            rainDuration -= deltaTime; 
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

    function handlePowerUps(deltaTime) {
        if (!isPowerUpActive) return;
        powerUpTimer -= deltaTime; 
        if (powerUpTimer <= 0) { resetPowerUp(); } 
        else { powerUpTimerElement.innerText = powerUpTimer.toFixed(1) + 's'; }
    }

    function activatePowerUp(type) {
        isPowerUpActive = true; activePowerUpType = type; powerUpTimer = POWERUP_DURATION_S; 
        lastPowerUpType = type; 
        let text = '';
        if (type === 'invincible') text = 'INVINCIBLE !';
        if (type === 'superjump') text = 'SUPER SAUT !';
        if (type === 'magnet') text = 'AIMANT !';
        powerUpTextElement.innerText = text; powerUpTextElement.style.opacity = 1;
        setTimeout(() => { powerUpTextElement.style.opacity = 0; }, 2000); 
        for(let i=0; i<30; i++) { particles.push(new Particle(player.x + player.width/2, player.y + player.height/2, 'gold')); }
    }

    function resetPowerUp() {
        if (isPowerUpActive) { scoreAtLastPowerUp = score; }
        isPowerUpActive = false; activePowerUpType = null; powerUpTimer = 0;
        powerUpTextElement.innerText = ''; powerUpTimerElement.innerText = '';
    }

    function checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
    }

    // --- BOUCLE DE JEU PRINCIPALE ---
    function updateGame(currentTime) {
        if (gameState !== 'playing') return;

        const deltaTime = (currentTime - lastTime) / 1000; 
        lastTime = currentTime;
        const maxDeltaTime = 1 / 15; 
        const effectiveDeltaTime = Math.min(deltaTime || (1/TARGET_FPS), maxDeltaTime); 

        requestAnimationFrame(updateGame);
        frameCount++;

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        handleBackground(effectiveDeltaTime); 
        handleWeather(effectiveDeltaTime);    
        handleEntities(effectiveDeltaTime);   
        handleSpawners(effectiveDeltaTime);   
        handlePowerUps(effectiveDeltaTime);   

        scoreElement.innerText = `Score: ${score}`;
        gameSpeed += TARGET_ACCELERATION_PER_SECOND * effectiveDeltaTime; 
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
