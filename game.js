// Attendre que le DOM soit chargé
window.addEventListener('load', function() {

    // Vérification initiale des éléments essentiels
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
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
    const flashOverlay = document.getElementById('flash-overlay');
    const playerNameInput = document.getElementById('playerNameInput');
    const leaderboardListElement = document.getElementById('leaderboardList');


    if (!canvas || !ctx || !gameContainer || !scoreElement || !versionElement || !powerUpTextElement || !powerUpTimerElement || !loadingTextElement || !menuElement || !gameOverScreenElement || !finalScoreElement || !adminButton || !livesContainer || !flashOverlay || !playerNameInput || !leaderboardListElement) {
        console.error("Un ou plusieurs éléments UI essentiels sont manquants ! Vérifiez les IDs dans index.html.");
        if(loadingTextElement) loadingTextElement.innerText = "ERREUR: INTERFACE INCOMPLETE";
        alert("Erreur critique: L'interface du jeu n'a pas pu être initialisée correctement.");
        return; // Arrêter l'exécution
    }

    // Dimensions du Canvas
    let CANVAS_WIDTH, CANVAS_HEIGHT;
    function resizeCanvas() {
        if (!gameContainer || !canvas) return;
        CANVAS_WIDTH = gameContainer.clientWidth;
        CANVAS_HEIGHT = gameContainer.clientHeight;
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Constantes du jeu (V4 = V3.6)
    const PLAYER_WIDTH = 50; const PLAYER_HEIGHT = 50; const GRAVITY = 0.8;
    const JUMP_POWER = 15; const MAX_JUMPS = 2; const GROUND_HEIGHT = 70;
    const BASE_GAME_SPEED = 5; const GAME_ACCELERATION = 0.001;
    const POWERUP_SCORE_INTERVAL = 20; const POWERUP_DURATION_MS = 5000;
    const BASE_OBSTACLE_SPAWN_INTERVAL = 100; const MIN_OBSTACLE_SPAWN_INTERVAL = 45;
    const OBSTACLE_BASE_WIDTH = 60; const INITIAL_LIVES = 3;

    // Variables d'état
    let gameState = 'loading'; let player;
    let currentPlayerName = ''; // V4.1: Pour stocker le nom
    let obstacles = []; let collectibles = []; let powerUps = [];
    let backgroundHeads = []; let particles = [];
    let score = 0; let lives = INITIAL_LIVES; let gameSpeed = BASE_GAME_SPEED;
    let frameCount = 0; let obstacleTimer = 0; let collectibleTimer = 0;
    let rainTimer = 0; let rainActive = false; let rainDuration = 0;
    let isPowerUpActive = false; let activePowerUpType = null; let powerUpTimer = 0;
    let canSpawnPowerUp = false; let scoreAtLastPowerUp = 0;
    let currentMusic = null; const musicTracks = []; const assets = {};

    // Ressources
    const assetSources = {
        logo: 'uniteamadventure.png', background: 'FOND DE PLAN.jpg',
        ...Array.from({length: 18}, (_, i) => ({[`perso${i+1}`]: `perso${i+1}.png`})).reduce((a, b) => ({...a, ...b}), {}),
        ...Array.from({length: 4}, (_, i) => ({[`cactus${i+1}`]: `cactus${i+1}.png`})).reduce((a, b) => ({...a, ...b}), {}),
        note: 'note.png', chapeau: 'chapeau.png', botte: 'botte.png', aimant: 'aimant.png', coeur: 'coeur.png',
        ...Array.from({length: 5}, (_, i) => ({[`music${i+1}`]: `music${i+1}.mp3`})).reduce((a, b) => ({...a, ...b}), {}),
    };

    // --- CHARGEMENT DES RESSOURCES ---
    let assetsLoaded = 0; const totalAssets = Object.keys(assetSources).length;
    function loadAssets() {
        if (!loadingTextElement) { console.error("loadingTextElement manquant."); return; }
        for (const key in assetSources) {
            const src = assetSources[key];
            try {
                if (src.endsWith('.png') || src.endsWith('.jpg')) {
                    assets[key] = new Image();
                    assets[key].onload = assetLoaded;
                    assets[key].onerror = function() { assetFailedToLoad(key, src); };
                    assets[key].src = src;
                } else if (src.endsWith('.mp3')) {
                    assets[key] = new Audio();
                    assets[key].preload = 'metadata';
                    if (key.startsWith('music')) { musicTracks.push(assets[key]); }
                    assets[key].src = src;
                    assetLoaded();
                } else { console.warn(`Type de fichier non reconnu: ${key}: ${src}`); assetLoaded(); }
            } catch (error) { console.error(`Erreur création asset ${key} (${src}): `, error); assetFailedToLoad(key, `${src} (Erreur JS)`); }
        }
    }
    function assetLoaded() {
        assetsLoaded++;
        loadingTextElement.innerText = `Chargement... (${Math.round((assetsLoaded / totalAssets) * 100)}%)`;
        if (assetsLoaded === totalAssets) {
            loadingTextElement.style.display = 'none';
            const savedName = localStorage.getItem('uniteamPlayerName');
            if (savedName) { playerNameInput.value = savedName; }
            initMenu();
        }
    }
     function assetFailedToLoad(key, src) {
        console.error(`Échec chargement asset: ${key} (${src})`);
        loadingTextElement.innerText = `ERREUR CHARGEMENT`;
        alert(`ERREUR : Impossible de charger "${src}". Vérifiez nom/présence.`);
        gameState = 'error';
    }

    // --- CLASSES DU JEU (UNE SEULE DEFINITION PAR CLASSE) ---

    class Player {
        constructor() {
            this.width = PLAYER_WIDTH; this.height = PLAYER_HEIGHT;
            this.x = 50; this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
            this.velocityY = 0; this.isGrounded = true;
            this.jumpCount = 0; this.maxJumps = MAX_JUMPS;
            this.setImage();
        }
        setImage() { const i = Math.floor(Math.random() * 18) + 1; this.image = assets[`perso${i}`]; }
        jump() {
            if (this.jumpCount < this.maxJumps) {
                let pwr = (activePowerUpType === 'superjump') ? JUMP_POWER * 1.5 : JUMP_POWER;
                this.velocityY = -pwr; this.isGrounded = false; this.jumpCount++;
            }
        }
        update() {
            this.velocityY += GRAVITY; this.y += this.velocityY;
            const groundPos = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
            if (this.y > groundPos) { this.y = groundPos; this.velocityY = 0; if (!this.isGrounded) { this.isGrounded = true; this.jumpCount = 0; }}
            else { this.isGrounded = false; }
            particles.push(new Particle(this.x + this.width / 2, this.y + this.height / 2, 'standard'));
        }
        draw() {
            if (activePowerUpType === 'invincible' && frameCount % 10 < 5) { return; }
            if (this.image && this.image.complete) { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); }
        }
        getHitbox() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
    }

    class Obstacle {
        constructor() {
            const i = Math.floor(Math.random() * 4) + 1; this.image = assets[`cactus${i}`];
            const ratio = (this.image && this.image.height && this.image.width) ? this.image.height / this.image.width : 1;
            this.width = OBSTACLE_BASE_WIDTH + (Math.random() * 20 - 10); this.height = this.width * ratio;
            this.x = CANVAS_WIDTH; this.y = CANVAS_HEIGHT - GROUND_HEIGHT - this.height;
            this.passed = false; this.isMobile = Math.random() < 0.1;
            this.verticalSpeed = (Math.random() * 2 +
