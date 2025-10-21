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
    const POWERUP_SCORE_INTERVAL = 20; 
    const POWERUP_DURATION_MS = 5000; 
    
    // --- MODIFICATIONS V9 ---
    const BASE_GAME_SPEED = 3; 
    const GAME_ACCELERATION = 0.003; // Vitesse de l'exemple V8
    const OBSTACLE_BASE_WIDTH = 50; // Cactus légèrement plus grands (était 40)
    // ------------------------

    // Constantes des obstacles
    const BASE_OBSTACLE_SPAWN_INTERVAL = 100;
    const MIN_OBSTACLE_SPAWN_INTERVAL = 45;

    // Variables d'état du jeu
    let gameState = 'loading'; 
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
    let scoreAtLastPowerUp = -POWERUP_SCORE_INTERVAL;
    let lastPowerUpType = null; 

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
            this.velocityY += GRAVITY;
            this.y += this.velocityY;

            if (this.y > CANVAS_HEIGHT - GROUND_HEIGHT - this.height) {
                this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
                this.velocityY = 0;
                this.isGrounded = true;
                this.jumpCount = 0;
            }

            // Paillettes V7
            if (frameCount % 2 === 0) { 
                particles.push(new Particle(this.x, this.y + this.height / 2, 'standard'));
            }
        }

        draw() {
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
            
            const aspectRatio = this.image.height / this.image.width;
            // V9: Augmentation de la largeur de base
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

    // Classe Collectible (Note) (GDD Section 8)
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

    // Classe PowerUp (GDD Section 9)
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

    // Classe Particule (Paillettes) (GDD Section 4)
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
