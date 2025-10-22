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
    // V4.1: Récupérer l'input du nom et la liste du classement
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
                } else {
                     console.warn(`Type de fichier non reconnu: ${key}: ${src}`);
                     assetLoaded();
                }
            } catch (error) {
                 console.error(`Erreur création asset ${key} (${src}): `, error);
                 assetFailedToLoad(key, `${src} (Erreur JS)`);
            }
        }
    }
    function assetLoaded() {
        assetsLoaded++;
        loadingTextElement.innerText = `Chargement... (${Math.round((assetsLoaded / totalAssets) * 100)}%)`;
        if (assetsLoaded === totalAssets) {
            loadingTextElement.style.display = 'none';
            // V4.1: Restaurer le nom du joueur s'il existe
            const savedName = localStorage.getItem('uniteamPlayerName');
            if (savedName) {
                 playerNameInput.value = savedName;
            }
            initMenu();
        }
    }
     function assetFailedToLoad(key, src) {
        console.error(`Échec chargement asset: ${key} (${src})`);
        loadingTextElement.innerText = `ERREUR CHARGEMENT`;
        alert(`ERREUR : Impossible de charger "${src}". Vérifiez nom/présence.`);
        gameState = 'error';
    }

    // --- CLASSES DU JEU (Inchangées par rapport à V3.6) ---
    class Player { /* ... */ }
    class Obstacle { /* ... */ }
    class Collectible { /* ... */ }
    class PowerUp { /* ... */ }
    class Particle { /* ... */ }
    class BackgroundHead { /* ... */ }
    // --- (Copier les 6 classes de V3.6 ici) ---
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
            this.verticalSpeed = (Math.random() * 2 + 1) * (Math.random() < 0.5 ? 1 : -1);
            this.verticalRange = 15; this.baseY = this.y;
        }
        update() {
            this.x -= gameSpeed;
            if (this.isMobile) { this.y += this.verticalSpeed; if (this.y < this.baseY - this.verticalRange || this.y > this.baseY + this.verticalRange) { this.verticalSpeed *= -1; } }
        }
        draw() { if (this.image && this.image.complete) { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); } }
        getHitbox() { return { x: this.x + this.width*0.1, y: this.y + this.height*0.1, width: this.width*0.8, height: this.height*0.8 }; }
    }
     class Collectible {
        constructor() {
            this.image = assets.note; this.width = 30; this.height = 30; this.x = CANVAS_WIDTH;
            const pgy = CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT; const minH = 70; const maxH = 120;
            this.y = pgy - (Math.random() * (maxH - minH) + minH);
             if(this.y < 20) this.y = 20;
        }
        update() {
            if (activePowerUpType === 'magnet' && player) {
                const dx = player.x - this.x; const dy = player.y - this.y; const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 150) { this.x += dx * 0.05; this.y += dy * 0.05; }
            }
            this.x -= gameSpeed;
        }
        draw() { if (this.image && this.image.complete) { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); } }
        getHitbox() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
    }
     class PowerUp {
        constructor() {
            const types = ['invincible', 'superjump', 'magnet']; this.type = types[Math.floor(Math.random() * types.length)];
            if (this.type === 'invincible') this.image = assets.chapeau; else if (this.type === 'superjump') this.image = assets.botte; else this.image = assets.aimant;
            this.width = 100; this.height = (this.image && this.image.height && this.image.width) ? (this.image.height / this.image.width) * this.width : 100;
            this.x = CANVAS_WIDTH;
            const pgy = CANVAS_HEIGHT - GROUND_HEIGHT - PLAYER_HEIGHT; const minH = 70; const maxH = 120;
            this.y = pgy - (Math.random() * (maxH - minH) + minH);
             if(this.y < 20) this.y = 20; if (this.y + this.height > pgy - minH) { this.y = pgy - minH - this.height; }
            this.baseY = this.y; this.angle = Math.random() * Math.PI * 2;
        }
        update() { this.x -= gameSpeed; this.angle += 0.05; this.y = this.baseY + Math.sin(this.angle) * 20; }
        draw() { if (this.image && this.image.complete) { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); } }
        getHitbox() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
    }
     class Particle {
        constructor(x, y, type) {
            this.x = x; this.y = y; this.type = type; this.size = Math.random() * 5 + 2;
            this.speedX = -Math.random() * 2 - 1; this.speedY = Math.random() * 2 - 1;
            this.gravity = 0.1; this.life = 100;
            if (type === 'gold') { this.color = 'gold'; } else { const c = ['gold', 'white', 'silver']; this.color = c[Math.floor(Math.random() * c.length)]; }
        }
        update() { this.speedY += this.gravity; this.x += this.speedX; this.y += this.speedY; this.life--; }
        draw() {
            ctx.globalAlpha = Math.max(0, this.life / 100); ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.size, this.size); ctx.globalAlpha = 1.0;
        }
    }
     class BackgroundHead {
        constructor() {
            const i = Math.floor(Math.random() * 18) + 1; this.image = assets[`perso${i}`]; this.scale = Math.random() * 0.3 + 0.2;
            this.width = (this.image?.width || 50) * this.scale; this.height = (this.image?.height || 50) * this.scale;
            this.speed = BASE_GAME_SPEED * (this.scale * 0.5); this.alpha = this.scale * 1.5;
            this.x = CANVAS_WIDTH + Math.random() * CANVAS_WIDTH;
            const pgy = CANVAS_HEIGHT - GROUND_HEIGHT; const minH = 160 + PLAYER_HEIGHT;
            const maxSY = pgy - minH - this.height; const minSY = 50;
            this.y = Math.random() * (maxSY - minSY) + minSY;
             if (this.y > maxSY) this.y = maxSY; if (this.y < minSY) this.y = minSY;
            this.baseY = this.y; this.angle = Math.random() * Math.PI * 2; this.jumpHeight = Math.random() * 20 + 10;
        }
        update() {
            this.speed = gameSpeed * (this.scale * 0.5); this.x -= this.speed;
            this.angle += 0.03; this.y = this.baseY - Math.abs(Math.sin(this.angle)) * this.jumpHeight;
            if (this.x < -this.width) {
                this.x = CANVAS_WIDTH;
                const pgy = CANVAS_HEIGHT - GROUND_HEIGHT; const minH = 160 + PLAYER_HEIGHT;
                const maxSY = pgy - minH - this.height; const minSY = 50;
                this.y = Math.random() * (maxSY - minSY) + minSY;
                 if (this.y > maxSY) this.y = maxSY; if (this.y < minSY) this.y = minSY;
                this.baseY = this.y;
            }
        }
         draw() {
            ctx.globalAlpha = this.alpha; ctx.filter = 'brightness(0) opacity(0.5)';
            if (this.image && this.image.complete) { ctx.drawImage(this.image, this.x, this.y, this.width, this.height); }
            ctx.filter = 'none'; ctx.globalAlpha = 1.0;
        }
    }


    // --- FONCTIONS DE GESTION DU JEU ---
    function initMenu() {
        gameState = 'menu';
        menuElement.style.display = 'flex'; gameOverScreenElement.style.display = 'none';
        scoreElement.style.display = 'none'; versionElement.style.display = 'block';
        powerUpTextElement.style.display = 'none'; powerUpTimerElement.style.display = 'none';
        livesContainer.style.display = 'none'; adminButton.style.display = 'block';
    }

    // V4.1: Modifiée pour lire le nom
    function startGame() {
        // Lire et valider le nom
        currentPlayerName = playerNameInput.value.trim();
        if (!currentPlayerName) {
            alert("Veuillez entrer votre nom !");
            return;
        }
        if (currentPlayerName.length > 15) { currentPlayerName = currentPlayerName.substring(0, 15); }
        // Sauvegarder le nom pour la prochaine fois
        localStorage.setItem('uniteamPlayerName', currentPlayerName);
        console.log("Player Name:", currentPlayerName);

        // Reste du démarrage
        if (!ctx) { console.error("Canvas non prêt."); return; }
        gameState = 'playing';
        menuElement.style.display = 'none'; gameOverScreenElement.style.display = 'none';
        scoreElement.style.display = 'block'; versionElement.style.display = 'block';
        powerUpTextElement.style.display = 'block'; powerUpTimerElement.style.display = 'block';
        livesContainer.style.display = 'flex'; adminButton.style.display = 'none';
        score = 0; lives = INITIAL_LIVES; gameSpeed = BASE_GAME_SPEED; frameCount = 0;
        obstacles = []; collectibles = []; powerUps = []; particles = [];
        obstacleTimer = BASE_OBSTACLE_SPAWN_INTERVAL; collectibleTimer = 200; rainTimer = 30 * 60;
        canSpawnPowerUp = false; scoreAtLastPowerUp = -POWERUP_SCORE_INTERVAL; resetPowerUp();
        updateLivesDisplay();
        player = new Player();
        backgroundHeads = [];
        for(let i = 0; i < 10; i++) { backgroundHeads.push(new BackgroundHead()); }
        if (currentMusic) { currentMusic.pause(); currentMusic.currentTime = 0; }
        if (musicTracks.length > 0) {
            currentMusic = musicTracks[Math.floor(Math.random() * musicTracks.length)];
            currentMusic.loop = true; currentMusic.volume = 0.5;
            let playPromise = currentMusic.play();
            if (playPromise !== undefined) { playPromise.catch(e => { console.log("Audio bloqué.", e); }); }
        } else { console.warn("Aucune piste musicale."); }
        updateGame();
    }

    // V4.1: Modifiée pour appeler submitScore et displayLeaderboard
    async function endGame() {
        if (gameState === 'gameOver') return;
        gameState = 'gameOver';
        if (currentMusic) { currentMusic.pause(); }

        // Envoyer le score
        try {
            await submitScore(currentPlayerName, score);
        } catch (error) {
            console.error("Erreur envoi score:", error);
            // Optionnel : informer l'utilisateur
        }

        gameOverScreenElement.style.display = 'flex';
        finalScoreElement.innerText = `${score}`;
        gameContainer.classList.add('shake');
        setTimeout(() => gameContainer.classList.remove('shake'), 500);
        resetPowerUp();

        // Afficher le classement
        displayLeaderboard();
    }

    // Fonction affichage vies V3.5
    function updateLivesDisplay() {
        livesContainer.innerHTML = '';
        if (assets.coeur && assets.coeur.complete) {
            for (let i = 0; i < lives; i++) {
                const heartImg = document.createElement('img');
                heartImg.src = assets.coeur.src; heartImg.alt = 'Vie';
                livesContainer.appendChild(heartImg);
            }
        }
    }

    // Fonction flash V3.3
    function triggerFlash() {
        flashOverlay.classList.add('active');
        setTimeout(() => { flashOverlay.classList.remove('active'); }, 150);
    }

    // --- V4.1: FONCTIONS FIREBASE ---

    // Fonction pour envoyer le score (utilise window.db défini dans index.html)
    async function submitScore(name, scoreValue) {
        if (!window.db || !name || typeof scoreValue !== 'number' || scoreValue < 0) {
            console.log("DB non prête, nom/score invalide, non envoyé.");
            return;
        }
        // Accéder aux fonctions Firestore via l'objet global firebase
        const { collection, doc, getDoc, setDoc } = firebase.firestore;

        console.log(`Tentative d'envoi: ${name} - ${scoreValue}`);
        const scoresCollectionRef = collection(window.db, 'scores'); // 'scores' = nom de la collection
        const playerDocRef = doc(scoresCollectionRef, name); // Nom comme ID

        try {
            const docSnap = await getDoc(playerDocRef);

            if (docSnap.exists()) {
                const currentBestScore = docSnap.data().score || 0;
                if (scoreValue > currentBestScore) {
                    console.log(`Nouveau meilleur score pour ${name}: ${scoreValue}`);
                    await setDoc(playerDocRef, { name: name, score: scoreValue });
                } else {
                    console.log(`Score ${scoreValue} pas meilleur que ${currentBestScore}`);
                }
            } else {
                console.log(`Nouveau joueur: ${name} score ${scoreValue}`);
                await setDoc(playerDocRef, { name: name, score: scoreValue });
            }
        } catch (error) {
            console.error("Erreur Firestore écriture: ", error);
            throw error; // Propager l'erreur
        }
    }

    // Fonction pour afficher le classement (utilise window.db)
    async function displayLeaderboard() {
        if (!leaderboardListElement) return;
        leaderboardListElement.innerHTML = '<li>Chargement...</li>';

        if (!window.db) {
             leaderboardListElement.innerHTML = '<li>Erreur connexion classement.</li>';
             return;
        }
        // Accéder aux fonctions Firestore via l'objet global firebase
        const { collection, query, orderBy, limit, getDocs } = firebase.firestore;

        try {
            const scoresCollectionRef = collection(window.db, 'scores');
            const q = query(scoresCollectionRef, orderBy('score', 'desc'), limit(10));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                leaderboardListElement.innerHTML = '<li>Aucun score enregistré.</li>';
                return;
            }

            let leaderboardHTML = '';
            let rank = 1;
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const name = data.name.replace(/</g, "&lt;").replace(
