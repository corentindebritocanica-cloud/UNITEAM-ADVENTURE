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
    const GRAVITY = 0.8;
    const JUMP_POWER = 15;
    const MAX_JUMPS = 2;
    const GROUND_HEIGHT = 70;
    const BASE_OBSTACLE_SPAWN_INTERVAL = 100;
    const MIN_OBSTACLE_SPAWN_INTERVAL = 45;
    const BASE_GAME_SPEED = 5;
    const POWERUP_SCORE_INTERVAL = 20; // Points à marquer avant qu'un nouveau power-up puisse spawner
    const POWERUP_DURATION_MS = 5000; // 5 secondes

    // Variables d'état du jeu
    let gameState = 'loading'; // 'loading', 'menu', 'playing', 'gameOver'
    let player;
    let obstacles = [];
    let collectibles = [];
    let powerUps = [];
    let backgroundHeads = [];
    let particles = [];
    let score = 0;
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
        // Logo
        logo: 'uniteamadventure.png',
        // Fond
        background: 'FOND DE PLAN.jpg',
        // Personnages (1 à 18)
        ...Array.from({length: 18}, (_, i) => ({[`perso${i+1}`]: `perso${i+1}.png`})).reduce((a, b) => ({...a, ...b}), {}),
        // Obstacles (1 à 4)
        ...Array.from({length: 4}, (_, i) => ({[`cactus${i+1}`]: `cactus${i+1}.png`})).reduce((a, b) => ({...a, ...b}), {}),
        // Collectibles
        note: 'note.png',
        // Power-ups
        chapeau: 'chapeau.png',
        botte: 'botte.png',
        aimant: 'aimant.png',
        // Musique (1 à 5)
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
            } else if (src.endsWith('.mp3')) {
                assets[key] = new Audio();
                // On ne peut charger l'audio qu'après une interaction utilisateur, 
                // mais on le compte comme "chargé" pour le tracking
                if (key.startsWith('music')) {
                    musicTracks.push(assets[key]);
                }
                assets[key].src = src; // Pré-définir la source
                assetLoaded(); // Compter comme chargé pour débloquer le menu
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
            // Chargement terminé
            loadingTextElement.style.display = 'none';
            initMenu();
        }
    }

    // --- CLASSES DU JEU ---

    // Classe Joueur (GDD Section 4)
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
                let currentJumpPower = (activePowerUpType === 'superjump') ? JUMP_POWER * 1.5 : JUMP_POWER;
                this.velocityY = -currentJumpPower;
                this.isGrounded = false;
                this.jumpCount++;
            }
        }

        update() {
            // Appliquer la gravité
            this.velocityY += GRAVITY;
            this.y += this.velocityY;

            // Collision avec le sol
            if (this.y > CANVAS_HEIGHT - GROUND_HEIGHT - this.height) {
                this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
                this.velocityY = 0;
                this.isGrounded = true;
                this.jumpCount = 0;
            }

            // Émettre des particules (GDD 4)
            if (frameCount % 3 === 0) { // Limite la quantité
                particles.push(new Particle(this.x + this.width / 2, this.y + this.height / 2, 'standard'));
            }
        }

        draw() {
            // GDD 9: Effet de clignotement pour "Invincible"
            if (activePowerUpType === 'invincible' && frameCount % 10 < 5) {
                // Ne rien dessiner (clignote)
            } else if (this.image && this.image.complete) {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
        }
        
        getHitbox() {
            return { x: this.x, y: this.y, width: this.width, height: this.height };
        }
    }

    // Classe Obstacle (GDD Section 7)
    class Obstacle {
        constructor() {
            const cactusIndex = Math.floor(Math.random() * 4) + 1;
            this.image = assets[`cactus${cactusIndex}`];
            this.width = this.image.width * 0.8; // Redimensionner un peu
            this.height = this.image.height * 0.8;
            this.x = CANVAS_WIDTH;
            this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
            this.passed = false;
            
            // GDD 7: Obstacles Mobiles (10%)
            this.isMobile = Math.random() < 0.1;
            this.verticalSpeed = (Math.random() * 2 + 1) * (Math.random() < 0.5 ? 1 : -1);
            this.verticalRange = 15;
            this.baseY = this.y;
        }

        update() {
            this.x -= gameSpeed;
            
            // GDD 7: Oscillation verticale
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
            // Hitbox réduite pour être juste (GDD 7)
            return { 
                x: this.x + this.width * 0.1, 
                y: this.y + this.height * 0.1, 
                width: this.width * 0.8, 
                height: this.height * 0.8 
            };
        }
    }

    // Classe Collectible (Note) (GDD Section 8)
    class Collectible {
        constructor() {
            this.image = assets.note;
            this.width = 30;
            this.height = 30;
            this.x = CANVAS_WIDTH;
            // Hauteur aléatoire en l'air (GDD 8)
            this.y = Math.random() * (CANVAS_HEIGHT - GROUND_HEIGHT - 200) + 50; 
        }

        update() {
            // GDD 9: Effet Aimant
            if (activePowerUpType === 'magnet') {
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < 150) { // Rayon de 150px
                    this.x += dx * 0.05; // Se rapproche
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

    // Classe PowerUp (GDD Section 9)
    class PowerUp {
        constructor() {
            const types = ['invincible', 'superjump', 'magnet'];
            this.type = types[Math.floor(Math.random() * types.length)];
            
            if (this.type === 'invincible') this.image = assets.chapeau;
            else if (this.type === 'superjump') this.image = assets.botte;
            else if (this.type === 'magnet') this.image = assets.aimant;

            this.width = 100; // GDD 9: Plus grand en jeu
            this.height = (this.image.height / this.image.width) * this.width;
            this.x = CANVAS_WIDTH;
            this.y = Math.random() * (CANVAS_HEIGHT - GROUND_HEIGHT - 250) + 50;
            
            // Oscillation
            this.baseY = this.y;
            this.angle = Math.random() * Math.PI * 2;
        }

        update() {
            this.x -= gameSpeed;
            // Oscillation verticale (GDD 9)
            this.angle += 0.05;
            this.y = this.baseY + Math.sin(this.angle) * 20; // Oscille de 20px
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

    // Classe Particule (Paillettes) (GDD Section 4)
    class Particle {
        constructor(x, y, type) {
            this.x = x;
            this.y = y;
            this.type = type; // 'standard' ou 'gold'
            this.size = Math.random() * 5 + 2; // Carrés
            this.speedX = -Math.random() * 2 - 1; // Légèrement à gauche
            this.speedY = Math.random() * 2 - 1;
            this.gravity = 0.1;
            this.life = 100; // Durée de vie (frames)
            
            if (type === 'gold') {
                this.color = 'gold';
            } else {
                const colors = ['gold', 'white', 'silver'];
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }
        }

        update() {
            this.speedY += this.gravity;
            this.x += this.speedX;
            this.y += this.speedY;
            this.life--;
        }

        draw() {
            ctx.globalAlpha = this.life / 100; // Fondu (GDD 4)
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.size, this.size);
            ctx.globalAlpha = 1.0;
        }
    }

    // Classe Tête Arrière-Plan (GDD Section 6)
    class BackgroundHead {
        constructor() {
            const imgIndex = Math.floor(Math.random() * 18) + 1;
            this.image = assets[`perso${imgIndex}`];
            
            // GDD 6: Profondeurs variables
            this.scale = Math.random() * 0.3 + 0.2; // Taille (0.2 à 0.5)
            this.width = (this.image.width || 50) * this.scale;
            this.height = (this.image.height || 50) * this.scale;
            this.speed = gameSpeed * (this.scale * 0.5); // Plus lent si plus petit/loin
            this.alpha = this.scale * 1.5; // Plus transparent si plus petit
            
            this.x = CANVAS_WIDTH + Math.random() * CANVAS_WIDTH;
            this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height - Math.random() * 150;
            
            // Animation "sautillement" (GDD 6)
            this.baseY = this.y;
            this.angle = Math.random() * Math.PI * 2;
            this.jumpHeight = Math.random() * 20 + 10;
        }

        update() {
            this.x -= this.speed;
            
            // Sautillement
            this.angle += 0.03;
            this.y = this.baseY - Math.sin(this.angle) * this.jumpHeight;
            
            // Réapparition (GDD 6)
            if (this.x < -this.width) {
                this.x = CANVAS_WIDTH;
                // Recalculer la position Y pour varier
                this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height - Math.random() * 150;
                this.baseY = this.y;
            }
        }

        draw() {
            ctx.globalAlpha = this.alpha;
            // GDD 6: Silhouettes
            ctx.filter = 'brightness(0) opacity(0.5)';
            if (this.image && this.image.complete) {
                ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
            }
            ctx.filter = 'none';
            ctx.globalAlpha = 1.0;
        }
    }

    // --- FONCTIONS DE GESTION DU JEU ---

    // Initialisation du Menu (GDD 11)
    function initMenu() {
        gameState = 'menu';
        menuElement.style.display = 'flex';
        gameOverScreenElement.style.display = 'none';
        
        // Cacher l'UI du jeu
        scoreElement.style.display = 'none';
        versionElement.style.display = 'block'; // Visible au menu
        powerUpTextElement.style.display = 'none';
        powerUpTimerElement.style.display = 'none';
    }

    // Démarrer la partie (GDD 11)
    function startGame() {
        gameState = 'playing';
        menuElement.style.display = 'none';
        gameOverScreenElement.style.display = 'none';
        
        // Afficher l'UI du jeu
        scoreElement.style.display = 'block';
        versionElement.style.display = 'block';
        powerUpTextElement.style.display = 'block';
        powerUpTimerElement.style.display = 'block';

        // Réinitialiser les variables
        score = 0;
        gameSpeed = BASE_GAME_SPEED;
        frameCount = 0;
        obstacles = [];
        collectibles = [];
        powerUps = [];
        particles = [];
        
        obstacleTimer = BASE_OBSTACLE_SPAWN_INTERVAL;
        collectibleTimer = 200; // GDD 8: Moins fréquent
        rainTimer = 30 * 60; // 30 secondes (à 60fps)

        canSpawnPowerUp = false;
        scoreAtLastPowerUp = -POWERUP_SCORE_INTERVAL; // Permet au premier de spawner à 30
        resetPowerUp();
        
        // Créer le joueur (GDD 4: Tête aléatoire)
        player = new Player();
        
        // Créer les têtes d'arrière-plan (GDD 6)
        backgroundHeads = [];
        for(let i = 0; i < 10; i++) { // 10 têtes en fond
            backgroundHeads.push(new BackgroundHead());
        }

        // Musique aléatoire (GDD 12)
        if (currentMusic) {
            currentMusic.pause();
            currentMusic.currentTime = 0;
        }
        currentMusic = musicTracks[Math.floor(Math.random() * musicTracks.length)];
        currentMusic.loop = true;
        currentMusic.volume = 0.5;
        currentMusic.play().catch(e => console.log("L'audio n'a pas pu démarrer:", e));

        // Démarrer la boucle de jeu
        updateGame();
    }

    // Fin de partie (GDD 11)
    function endGame() {
        gameState = 'gameOver';
        
        if (currentMusic) {
            currentMusic.pause();
        }

        // Écran Game Over
        gameOverScreenElement.style.display = 'flex';
        finalScoreElement.innerText = `Score: ${score}`;
        
        // Secousse (GDD 11)
        gameContainer.classList.add('shake');
        setTimeout(() => gameContainer.classList.remove('shake'), 500);

        resetPowerUp();
    }

    // --- FONCTIONS DE MISE À JOUR (Handle) ---

    function handleBackground() {
        // Arrière-plan statique (GDD 6)
        ctx.drawImage(assets.background, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Têtes en arrière-plan (GDD 6)
        backgroundHeads.forEach(head => {
            head.update();
            head.draw();
        });

        // Sol (GDD 6)
        ctx.fillStyle = '#666';
        ctx.fillRect(0, CANVAS_HEIGHT - GROUND_HEIGHT, CANVAS_WIDTH, GROUND_HEIGHT);
    }

    function handleSpawners() {
        // Spawner d'Obstacles (GDD 7)
        obstacleTimer--;
        if (obstacleTimer <= 0) {
            obstacles.push(new Obstacle());
            
            // GDD 7: Paires (10% de chance)
            if (Math.random() < 0.1) {
                setTimeout(() => {
                    const pairObstacle = new Obstacle();
                    // Légèrement plus petit
                    pairObstacle.width *= 0.8;
                    pairObstacle.height *= 0.8;
                    pairObstacle.y = CANVAS_HEIGHT - GROUND_HEIGHT - pairObstacle.height;
                    obstacles.push(pairObstacle);
                }, 300 / gameSpeed); // Délai court
            }

            // Intervalle décroissant (GDD 7)
            const newInterval = BASE_OBSTACLE_SPAWN_INTERVAL - (gameSpeed - BASE_GAME_SPEED) * 5;
            obstacleTimer = Math.max(MIN_OBSTACLE_SPAWN_INTERVAL, newInterval);
            obstacleTimer += Math.random() * 20 - 10; // Variété
        }

        // Spawner de Collectibles (GDD 8)
        collectibleTimer--;
        if (collectibleTimer <= 0) {
            collectibles.push(new Collectible());
            collectibleTimer = 200 + Math.random() * 100; // Intervalle long
        }

        // Spawner de Power-Ups (GDD 9)
        // 1. Vérifier si on peut spawner (score >= 30, et 20 pts depuis le dernier)
        if (!canSpawnPowerUp && score >= 30 && score >= scoreAtLastPowerUp + POWERUP_SCORE_INTERVAL) {
            canSpawnPowerUp = true;
        }
        
        // 2. Si on peut, et qu'aucun n'est actif ou à l'écran
        if (canSpawnPowerUp && !isPowerUpActive && powerUps.length === 0) {
            // 3. 5% de chance par frame (GDD 9)
            if (Math.random() < 0.05) { 
                powerUps.push(new PowerUp());
                canSpawnPowerUp = false; // N'en spawner qu'un
            }
        }
    }

    function handleEntities() {
        // Particules (GDD 4)
        particles.forEach((p, index) => {
            p.update();
            p.draw();
            if (p.life <= 0) particles.splice(index, 1);
        });

        // Obstacles (GDD 7)
        obstacles.forEach((obstacle, index) => {
            obstacle.update();
            obstacle.draw();

            // Collision (GDD 7)
            if (checkCollision(player.getHitbox(), obstacle.getHitbox())) {
                if (activePowerUpType !== 'invincible') {
                    endGame();
                }
            }

            // Score (GDD 10)
            if (obstacle.x + obstacle.width < player.x && !obstacle.passed) {
                score++;
                obstacle.passed = true;
            }

            // Nettoyage
            if (obstacle.x < -obstacle.width) {
                obstacles.splice(index, 1);
            }
        });

        // Collectibles (GDD 8)
        collectibles.forEach((collectible, index) => {
            collectible.update();
            collectible.draw();

            // Collision
            if (checkCollision(player.getHitbox(), collectible.getHitbox())) {
                score += 10; // GDD 10
                // Éclat de paillettes (GDD 8)
                for(let i=0; i<10; i++) {
                    particles.push(new Particle(player.x + player.width/2, player.y + player.height/2, 'standard'));
                }
                collectibles.splice(index, 1);
            }
            
            // Nettoyage
            if (collectible.x < -collectible.width) {
                collectibles.splice(index, 1);
            }
        });

        // Power-Ups (GDD 9)
        powerUps.forEach((powerUp, index) => {
            powerUp.update();
            powerUp.draw();
            
            // Collision
            if (checkCollision(player.getHitbox(), powerUp.getHitbox())) {
                activatePowerUp(powerUp.type);
                powerUps.splice(index, 1);
            }

            // Nettoyage
            if (powerUp.x < -powerUp.width) {
                powerUps.splice(index, 1);
            }
        });
    }

    function handleWeather() {
        // Cycle Jour/Nuit (GDD 6)
        // Cycle tous les 500 points
        const cycle = (score % 500) / 500; // 0 à 1
        // Math.sin pour transition douce (0 -> 1 -> 0)
        const nightAlpha = Math.sin(cycle * Math.PI) * 0.7; // Opacité max 0.7
        ctx.fillStyle = `rgba(0, 0, 50, ${nightAlpha})`;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Météo (Pluie) (GDD 6)
        rainTimer--;
        if (rainTimer <= 0 && !rainActive) {
            // 30% de chance d'activer la pluie
            if (Math.random() < 0.3) {
                rainActive = true;
                rainDuration = Math.random() * 10 * 60 + 5 * 60; // 5-15 secondes
            }
            rainTimer = 30 * 60; // Réinitialiser le timer de check
        }

        if (rainActive) {
            rainDuration--;
            if (rainDuration <= 0) rainActive = false;

            // Teinte bleue (GDD 6)
            ctx.fillStyle = 'rgba(0, 0, 100, 0.1)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            
            // Gouttes de pluie (GDD 6)
            ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
            ctx.lineWidth = 1;
            for(let i=0; i<50; i++) { // 50 gouttes
                const x = Math.random() * CANVAS_WIDTH;
                const y = Math.random() * CANVAS_HEIGHT;
                const len = Math.random() * 10 + 5;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - 2, y + len); // Fines lignes
                ctx.stroke();
            }
        }
    }

    function handlePowerUps() {
        if (!isPowerUpActive) return;

        powerUpTimer -= 1000 / 60; // Décrémenter en ms (approx 60fps)
        
        if (powerUpTimer <= 0) {
            resetPowerUp();
        } else {
            // Mettre à jour le timer UI (GDD 9)
            powerUpTimerElement.innerText = (powerUpTimer / 1000).toFixed(1) + 's';
        }
    }

    function activatePowerUp(type) {
        isPowerUpActive = true;
        activePowerUpType = type;
        powerUpTimer = POWERUP_DURATION_MS;
        scoreAtLastPowerUp = score; // Enregistrer le score
        
        // Affichage UI (GDD 9)
        let text = '';
        if (type === 'invincible') text = 'INVINCIBLE !';
        if (type === 'superjump') text = 'SUPER SAUT !';
        if (type === 'magnet') text = 'AIMANT !';
        
        powerUpTextElement.innerText = text;
        powerUpTextElement.style.opacity = 1;
        
        // Fondu du texte (GDD 9)
        setTimeout(() => {
            powerUpTextElement.style.opacity = 0;
        }, 2000); // Disparaît après 2s

        // Éclat de paillettes dorées (GDD 9)
        for(let i=0; i<30; i++) {
            particles.push(new Particle(player.x + player.width/2, player.y + player.height/2, 'gold'));
        }
    }

    function resetPowerUp() {
        isPowerUpActive = false;
        activePowerUpType = null;
        powerUpTimer = 0;
        powerUpTextElement.innerText = '';
        powerUpTimerElement.innerText = '';
    }

    // --- UTILITAIRES ---

    function checkCollision(rect1, rect2) {
        // AABB Collision
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    // --- BOUCLE DE JEU PRINCIPALE (GDD 11) ---
    function updateGame() {
        if (gameState !== 'playing') return;

        // Demander la prochaine frame
        requestAnimationFrame(updateGame);
        frameCount++;

        // 1. Nettoyer le canvas
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // 2. Dessiner l'environnement (GDD 6)
        handleBackground();

        // 3. Météo et Jour/Nuit (GDD 6)
        handleWeather();

        // 4. Mettre à jour le joueur (GDD 4)
        player.update();
        player.draw();

        // 5. Gérer les spawners (GDD 7, 8, 9)
        handleSpawners();
        
        // 6. Gérer les entités (Obstacles, Collectibles, PowerUps, Particules)
        handleEntities();

        // 7. Gérer le PowerUp actif (GDD 9)
        handlePowerUps();

        // 8. Mettre à jour l'UI (GDD 10)
        scoreElement.innerText = `Score: ${score}`;

        // 9. Augmenter la difficulté (GDD 3)
        gameSpeed += 0.001;
    }

    // --- GESTION DES CONTRÔLES (GDD 5) ---
    function handleInput(event) {
        event.preventDefault(); // Empêche le zoom/défilement sur mobile

        switch (gameState) {
            case 'menu':
                startGame();
                break;
            case 'playing':
                player.jump();
                break;
            case 'gameOver':
                initMenu();
                break;
        }
    }

    // Écouteurs d'événements
    gameContainer.addEventListener('mousedown', handleInput);
    gameContainer.addEventListener('touchstart', handleInput, { passive: false });

    // Bouton Admin (GDD 15)
    adminButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Empêche de démarrer le jeu
        const password = prompt("Mot de passe Admin :");
        if (password === "corentin") {
            window.open('admin.html', '_blank');
        } else if (password) {
            alert("Mauvais mot de passe.");
        }
    });

    // Démarrer le chargement
    loadAssets();
});