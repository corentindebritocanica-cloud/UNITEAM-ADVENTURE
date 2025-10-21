// Attendre que la page soit chargée
window.addEventListener('load', () => {
    console.log("Window loaded. Initializing game setup..."); 

    // Vérifications initiales des éléments HTML
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const gameContainer = document.querySelector('.game-container');
    const scoreEl = document.getElementById('score');
    const startScreenEl = document.getElementById('startScreen');
    const gameOverScreenEl = document.getElementById('gameOverScreen');
    const finalScoreEl = document.getElementById('finalScore');
    const loadingText = document.getElementById('loadingText'); 
    const powerUpTextEl = document.getElementById('powerUpText');
    const powerUpTimerEl = document.getElementById('powerUpTimer');
    const adminBtn = document.getElementById('adminBtn');

    if (!canvas || !ctx || !gameContainer || !scoreEl || !startScreenEl || !gameOverScreenEl || !loadingText || !powerUpTextEl || !powerUpTimerEl || !adminBtn) {
         console.error("CRITICAL ERROR: One or more essential HTML elements are missing!");
         if(loadingText) loadingText.innerText = "Erreur: Interface HTML incomplète!";
         return; 
    }
    console.log("HTML elements verified.");

    // Logique du bouton Admin
    function handleAdminClick(e) {
         if (e) e.stopPropagation(); 
         console.log("Admin button clicked."); 
         const password = prompt("Mot de passe Administrateur :");
         if (password === "corentin") {
             console.log("Password correct, opening admin page...");
             // Note: Ce code assume que 'admin.html' existe,
             // mais il n'est pas dans votre GDD V2.1. 
             // Si vous en avez besoin, je peux le recréer.
             // Pour l'instant, nous le laissons tel quel.
             window.open('admin.html', '_blank'); 
         } else if (password !== null) { 
             alert("Mot de passe incorrect.");
         } else {
             console.log("Admin prompt cancelled."); 
         }
    }
    // Attacher les écouteurs pour le bouton Admin
    adminBtn.addEventListener('click', handleAdminClick);
    adminBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); handleAdminClick(e); }, { passive: false }); 
    console.log("Admin button listeners attached.");
    
    console.log("Setting canvas dimensions..."); 
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Musiques
    const musicPaths = [ 'music1.mp3', 'music2.mp3', 'music3.mp3', 'music4.mp3', 'music5.mp3' ];
    let musicObjects = []; // Stocker les objets Audio
    let currentMusic = null; 

    // Variables du jeu
    let player, obstacles, collectibles, particles, powerUps, backgroundCharacters, score, gameSpeed, gravity, isGameOver, gameLoopId;
    let isReady = false; 
    let activePowerUp = null; 
    let powerUpTimer = 0; 
    let powerUpDuration = 5; // Durée en secondes
    let isPowerUpActive = false; 
    let powerUpTextTimeout = null; 
    let canSpawnPowerUp = false; 
    let nextPowerUpScoreThreshold = 30; // Premier powerup à 30
    const POWERUP_SCORE_INTERVAL = 20; // 20 points après la fin du précédent
    let lastPowerUpType = null; // Pour éviter les doublons
    
    let weatherEffect = null; 
    let weatherTimer = 0;

    const groundY = canvas.height - 70;

    // Images
    const obstacleImages = [];
    const playerHeadImages = []; 
    const collectibleImages = [];
    const powerUpImages = {}; 

    let selectedHeadImage = null; 
    const PLAYER_WIDTH = 50; 
    const PLAYER_HEIGHT = 50; 
    
    // Chemins des images
    const collectibleImagePaths = ['note.png'];
    const obstacleImagePaths = [ 'cactus1.png', 'cactus2.png', 'cactus3.png', 'cactus4.png' ];
    const playerImagePaths = [
         'perso1.png', 'perso2.png', 'perso3.png', 'perso4.png', 'perso5.png',
         'perso6.png', 'perso7.png', 'perso8.png', 'perso9.png', 'perso10.png',
         'perso11.png', 'perso12.png', 'perso13.png', 'perso14.png', 'perso15.png',
         'perso16.png', 'perso17.png', 'perso18.png'
    ];
    
    // *** CORRECTION APPLIQUÉE ICI ***
    // Utilise .png (minuscule) pour correspondre à vos fichiers
    const powerUpImagePaths = {
         invincible: 'chapeau.png',
         superJump: 'botte.png',
         magnet: 'aimant.png'
    };
    
    let imagesLoadedCount = 0; 
    const allImagePaths = [
         ...obstacleImagePaths, ...playerImagePaths, ...collectibleImagePaths, 
         ...Object.values(powerUpImagePaths) 
    ];
    const totalImages = allImagePaths.length;
    console.log(`Attempting to load ${totalImages} images.`); 

    // Fonction pour charger TOUTES les images
    function loadGameImages() {
         console.log("Starting loadGameImages function..."); 
         return new Promise((resolve, reject) => { 
             if (imagesLoadedCount === totalImages && playerHeadImages.length > 0 && obstacleImages.length > 0) { 
                   console.log("Images already loaded."); resolve(); return; 
             }
             console.log("Resetting image arrays and counters for loading."); 
             imagesLoadedCount = 0; 
             playerHeadImages.length = 0; obstacleImages.length = 0; collectibleImages.length = 0;
             Object.keys(powerUpImages).forEach(key => delete powerUpImages[key]); 

             if (totalImages === 0) { console.log("No images to load."); resolve(); return; }
             
             let currentLoadAttemptCount = 0; 
             let errorOccurredInThisLoad = false; 

             allImagePaths.forEach((path, index) => {
                 console.log(`Starting load for: ${path}`); 
                 const img = new Image(); 
                 img.src = path;
                 
                 img.onload = () => {
                     if (errorOccurredInThisLoad) return; 
                     currentLoadAttemptCount++; 
                     imagesLoadedCount = currentLoadAttemptCount; 
                     console.log(`Image loaded successfully (${currentLoadAttemptCount}/${totalImages}): ${path}`); 
                     
                     if (obstacleImagePaths.includes(path)) obstacleImages.push(img);
                     else if (playerImagePaths.includes(path)) playerHeadImages.push(img);
                     else if (collectibleImagePaths.includes(path)) collectibleImages.push(img);
                     else { 
                         for (const type in powerUpImagePaths) {
                             if (powerUpImagePaths[type] === path) {
                                 powerUpImages[type] = img; break;
                             }
                         }
                     }
                     
                     if (currentLoadAttemptCount === totalImages) { 
                         console.log("All images loaded successfully in this attempt!"); 
                         resolve(); 
                     }
                 };

                 img.onerror = (e) => { 
                     if (errorOccurredInThisLoad) return; 
                     errorOccurredInThisLoad = true; 
                     console.error(`!!!!!!!! IMAGE LOAD FAILED: ${path} !!!!!!!!`, e); 
                     reject(`Failed to load image: ${path}`); 
                 };
             });
         });
    }

    // Fonction pour charger les MUSIQUES
    function loadMusic() {
        console.log("Loading music...");
        musicObjects = musicPaths.map(path => {
            const audio = new Audio(path);
            audio.loop = true;
            audio.volume = 0.5; // Volume par défaut
            return audio;
        });
        console.log(`${musicObjects.length} music tracks prepped.`);
    }

    // --- Classe Particule ---
    class Particle { 
        constructor(x, y, type) {
            this.x = x;
            this.y = y;
            this.type = type; // 'standard' or 'gold'
            this.size = Math.random() * 5 + 2;
            this.speedX = -Math.random() * 2 - 1; // Se déplace vers la gauche
            this.speedY = (Math.random() * 2 - 1);
            this.gravity = 0.1;
            this.life = 100; // Durée de vie en frames
            
            if (type === 'gold') {
                this.color = '#FFD700'; // Or
            } else {
                const colors = ['#FFD700', '#FFFFFF', '#C0C0C0']; // Or, Blanc, Argent
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
            ctx.globalAlpha = this.life / 100; // Fondu
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.size, this.size);
            ctx.globalAlpha = 1.0;
        }
    }

    // --- CLASSE PLAYER ---
    class Player { 
        constructor() {
            this.w = PLAYER_WIDTH; 
            this.h = PLAYER_HEIGHT;
            this.x = 50; 
            this.y = groundY - this.h;
            this.velocityY = 0;
            this.jumpPower = 15;
            this.isGrounded = true;
            this.jumpCount = 0;
            this.maxJumps = 2; // GDD: Double Saut
            this.image = selectedHeadImage; 
        }
        draw() {
            if (isPowerUpActive && activePowerUp === 'invincible' && Math.floor(powerUpTimer * 10) % 2 === 0) {
                 // Ne pas dessiner (clignote)
            } else if (this.image) {
                ctx.drawImage(this.image, this.x, this.y, this.w, this.h);
            }
        }
        update() {
            this.velocityY += gravity;
            this.y += this.velocityY;

            // Collision avec le sol
            if (this.y + this.h > groundY) {
                this.y = groundY - this.h;
                this.velocityY = 0;
                if (!this.isGrounded) {
                    this.isGrounded = true;
                    this.jumpCount = 0; // Réinitialise les sauts au sol
                }
            } else {
                this.isGrounded = false;
            }

            // Émettre des particules (GDD 4)
            if (frameCount % 2 === 0) { // Plus fréquent
                particles.push(new Particle(this.x, this.y + this.h / 2, 'standard'));
            }

            this.draw();
        }
        jump() {
            if (this.jumpCount < this.maxJumps) {
                let currentJumpPower = (isPowerUpActive && activePowerUp === 'superJump') ? this.jumpPower * 1.5 : this.jumpPower;
                this.velocityY = -currentJumpPower;
                this.jumpCount++;
                this.isGrounded = false;
            }
        }
    }
    
    // --- CLASSE OBSTACLE ---
    class Obstacle { 
        constructor(image) {
            this.image = image;
            const scale = (Math.random() * 0.3) + 0.8; // 80% à 110% taille
            const aspectRatio = image.height / image.width;
            this.w = 50 * scale; // Largeur de base 50px
            this.h = this.w * aspectRatio;
            this.x = canvas.width;
            this.y = groundY - this.h;
            this.isPassed = false;
            
            // GDD 7: Obstacles mobiles (10%)
            this.isMobile = Math.random() < 0.1;
            this.verticalSpeed = (Math.random() * 1.5 + 0.5) * (Math.random() < 0.5 ? 1 : -1);
            this.verticalRange = 15;
            this.baseY = this.y;
        }
        draw() {
            ctx.drawImage(this.image, this.x, this.y, this.w, this.h);
        }
        update() {
            this.x -= gameSpeed;
            
            // GDD 7: Oscillation
            if (this.isMobile) {
                this.y += this.verticalSpeed;
                if (this.y < this.baseY - this.verticalRange || this.y > this.baseY + this.verticalRange) {
                    this.verticalSpeed *= -1;
                }
            }
            this.draw();
        }
    }

    // --- CLASSE COLLECTIBLE ---
    class Collectible { 
        constructor(x, y, image) {
            this.image = image;
            this.w = 30; // GDD 8
            this.h = 30;
            this.x = x;
            this.y = y;
            this.magnetRadius = 150; // GDD 8
        }
        draw() {
            ctx.drawImage(this.image, this.x, this.y, this.w, this.h);
        }
        update() {
            // GDD 9: Effet Aimant
            if (isPowerUpActive && activePowerUp === 'magnet' && player) {
                const dx = player.x - this.x;
                const dy = player.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < this.magnetRadius) {
                    this.x += dx * 0.08; // Vitesse d'attraction
                    this.y += dy * 0.08;
                }
            }
            this.x -= gameSpeed;
            this.draw();
        }
    }

    // --- CLASSE POWERUP ---
    class PowerUp { 
        constructor(x, y, type) {
            this.type = type; 
            this.image = powerUpImages[type];
            if (!this.image || !this.image.width || !this.image.height) { 
                   console.warn(`Image pour power-up ${type} non chargée ou invalide.`); return null; 
            }
            this.w = 80; // Plus large
            this.h = (this.image.height / this.image.width) * this.w; 
            this.x = x; 
            this.y = y; 
            this.initialY = y; 
            this.angle = Math.random() * Math.PI * 2;
        }
        draw() { 
            if (this.image) ctx.drawImage(this.image, this.x, this.y, this.w, this.h); 
        }
        update() {
            this.x -= gameSpeed; 
            this.angle += 0.05;
            this.y = this.initialY + Math.sin(this.angle) * 15; // Oscillation
            this.draw();
        }
    }

     // --- CLASSE BACKGROUND CHARACTER ---
    class BackgroundCharacter {
        constructor(image) {
            this.image = image;
            // GDD 6: Tailles/transparences/vitesses différentes
            this.scale = Math.random() * 0.3 + 0.2; // 0.2x à 0.5x (un peu plus grand que 1/3)
            this.w = (image.width || 50) * this.scale;
            this.h = (image.height || 50) * this.scale;
            this.x = canvas.width + Math.random() * canvas.width;
            this.y = groundY - this.h - (Math.random() * 150 + 20); // Apparaît au-dessus du sol
            this.alpha = this.scale * 0.8; // Plus petit = plus transparent (max 0.4)
            this.speed = gameSpeed * this.scale * 0.5; // Plus lent
            
            // GDD 6: Animation "sautillement"
            this.baseY = this.y;
            this.jumpAngle = Math.random() * Math.PI;
            this.jumpHeight = Math.random() * 20 + 10;
        }
        draw() {
            ctx.globalAlpha = this.alpha;
            // GDD 6: Pas de silhouette, juste transparent
            ctx.drawImage(this.image, this.x, this.y, this.w, this.h);
            ctx.globalAlpha = 1.0;
        }
        update() {
            this.x -= this.speed;
            // GDD 6: Sautillement
            this.jumpAngle += 0.03;
            this.y = this.baseY - Math.abs(Math.sin(this.jumpAngle)) * this.jumpHeight;
            
            this.draw();
        }
    }

    // --- 'initGameData' prépare une nouvelle partie ---
    async function initGameData() { 
        console.log("Initializing game data...");
        // Réinitialisation des variables
        score = 0;
        gameSpeed = 5; // Vitesse de départ (plus rapide)
        gravity = 0.8;
        isGameOver = false;
        gameLoopId = null;
        obstacles = [];
        collectibles = [];
        particles = [];
        powerUps = [];
        backgroundCharacters = [];
        frameCount = 0;

        // Réinitialisation PowerUps
        activePowerUp = null;
        isPowerUpActive = false;
        powerUpTimer = 0;
        nextPowerUpScoreThreshold = 30; // Seuil initial
        canSpawnPowerUp = false;
        lastPowerUpType = null;
        powerUpTextEl.innerText = "";
        powerUpTimerEl.innerText = "";
        
        // Réinitialisation Météo
        weatherEffect = null;
        weatherTimer = 30 * 60; // Check dans 30s
        
        scoreEl.innerText = `Score: ${score}`;

        // Charger les images (s'assure qu'elles le sont)
        await loadGameImages(); 
        
        // GDD 4: Choisir une tête aléatoire
        if (playerHeadImages.length > 0) {
            selectedHeadImage = playerHeadImages[Math.floor(Math.random() * playerHeadImages.length)];
        } else {
             console.error("No player images loaded!");
             throw new Error("Aucune image de joueur chargee.");
        }
        player = new Player();

        // GDD 6: Créer les personnages en fond
        if (playerHeadImages.length > 0) {
            for (let i = 0; i < playerHeadImages.length; i++) {
                backgroundCharacters.push(new BackgroundCharacter(playerHeadImages[i]));
            }
        }
        
        // Charger et choisir la musique
        loadMusic(); // S'assure que les objets audio existent
        if (currentMusic) {
            currentMusic.pause();
            currentMusic.currentTime = 0;
        }
        if (musicObjects.length > 0) {
            currentMusic = musicObjects[Math.floor(Math.random() * musicObjects.length)];
        }
        console.log("Game data initialized.");
    }

    // --- 'initMenu' prépare le menu ---
    async function initMenu() { 
         console.log("Initializing menu (initMenu)..."); 
         isReady = false; 
         loadingText.innerText = "Chargement..."; 
         
         try {
             console.log("Calling initGameData from initMenu..."); 
             await initGameData(); 
             console.log("initGameData successful. Setting up menu screen..."); 
             gameOverScreenEl.style.display = 'none'; 
             startScreenEl.style.display = 'flex'; 
             isReady = true; 
             loadingText.innerText = "Appuyez pour commencer"; 
             console.log("Menu ready!"); 
         } catch (error) {
             console.error("CRITICAL ERROR during initMenu:", error); 
             loadingText.innerHTML = `Erreur: ${error}.<br/>Vérifiez console (F12) & images !`; 
             loadingText.style.color = 'red'; 
             isReady = false; 
         }
    }

    // --- Démarrage du jeu ---
    function startGame() { 
         console.log(`Attempting startGame: gameLoopId=${gameLoopId}, isReady=${isReady}`); 
         if (gameLoopId || !isReady) return; 
         console.log("Starting game..."); 
         startScreenEl.style.display = 'none'; 
         gameOverScreenEl.style.display = 'none';
         
         if (currentMusic) {
              var promise = currentMusic.play();
              if (promise !== undefined) promise.catch(e => console.warn("Music play blocked:", e)); 
         } else { console.warn("No music selected to play."); }
         
         lastTime = performance.now(); 
         gameLoopId = requestAnimationFrame(gameLoop);
         console.log("Game loop started."); 
    }

    // --- Fonctions PowerUp ---
    function activatePowerUp(type) {
        console.log("Activating powerup:", type);
        isPowerUpActive = true;
        activePowerUp = type;
        powerUpTimer = powerUpDuration; // 5 secondes
        lastPowerUpType = type; // Mémoriser pour éviter doublon
        
        let text = "";
        if (type === 'invincible') text = "INVINCIBLE !";
        if (type === 'superJump') text = "SUPER SAUT !";
        if (type === 'magnet') text = "AIMANT À NOTES !";
        
        powerUpTextEl.innerText = text;
        powerUpTextEl.classList.remove('fade-out');
        
        // GDD 9: Fondu après 2s
        if (powerUpTextTimeout) clearTimeout(powerUpTextTimeout);
        powerUpTextTimeout = setTimeout(() => {
            powerUpTextEl.classList.add('fade-out');
        }, 2000);

        // GDD 9: Éclat de paillettes dorées
        for (let i = 0; i < 30; i++) {
            particles.push(new Particle(player.x + player.w / 2, player.y + player.h / 2, 'gold'));
        }
    }

    function deactivatePowerUp() {
        console.log("Deactivating powerup:", activePowerUp);
        isPowerUpActive = false;
        activePowerUp = null;
        powerUpTimer = 0;
        
        // GDD 9: Préparer le prochain spawn (20 points après la FIN)
        canSpawnPowerUp = false;
        nextPowerUpScoreThreshold = score + POWERUP_SCORE_INTERVAL;
        
        powerUpTextEl.innerText = "";
        powerUpTimerEl.innerText = "";
        if (powerUpTextTimeout) clearTimeout(powerUpTextTimeout);
    }
    
    // --- Boucle de jeu principale ---
    let lastTime = 0; 
    let obstacleTimer = 0; 
    let collectibleTimer = 150; 
    let powerUpSpawnTimer = 0;
    let frameCount = 0; // Ajouté pour les timers
    const OBSTACLE_SPAWN_INTERVAL = 100; // Frames de base

    function gameLoop(currentTime) { 
         if (isGameOver) { console.log("Game loop stopping: isGameOver true."); cancelAnimationFrame(gameLoopId); gameLoopId = null; return; }

         const deltaTime = (currentTime - lastTime) / 1000 || 0; 
         lastTime = currentTime;
         frameCount++;

         ctx.clearRect(0, 0, canvas.width, canvas.height);
         
         // GDD 6: Cycle Jour/Nuit
         const cycle = (score % 500) / 500;
         const nightAlpha = Math.sin(cycle * Math.PI) * 0.7;
         ctx.fillStyle = `rgba(0, 0, 50, ${nightAlpha})`;
         ctx.fillRect(0, 0, canvas.width, canvas.height);
         
         // GDD 6: Effet Météo (Pluie)
         weatherTimer--;
         if (weatherTimer <= 0 && weatherEffect === null) {
            if (Math.random() < 0.3) { // 30% chance
                console.log("Weather: Rain started");
                weatherEffect = 'rain';
                weatherTimer = (Math.random() * 10 + 5) * 60; // 5-15 secondes
            } else {
                weatherTimer = 30 * 60; // Re-check dans 30s
            }
         }
         
         if (weatherEffect === 'rain') {
            weatherTimer--;
            if (weatherTimer <= 0) weatherEffect = null;
            
            // Teinte bleue
            ctx.fillStyle = 'rgba(0, 0, 100, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // Gouttes
            ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
            ctx.lineWidth = 1;
            for(let i=0; i<50; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const len = Math.random() * 10 + 5;
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + len); ctx.stroke();
            }
         }

         // Sol
         ctx.fillStyle = '#666'; ctx.fillRect(0, groundY, canvas.width, 70); 
         
         // Personnages Fond (GDD 6)
         backgroundCharacters.forEach(char => { 
            char.update(); 
            if (char.x + char.w < 0) {
                // Réapparition
                char.x = canvas.width + Math.random() * 50; 
                char.y = groundY - char.h - (Math.random() * 150 + 20);
                char.baseY = char.y;
            }
         });
         
         // Paillettes (GDD 4)
         for (let i = particles.length - 1; i >= 0; i--) { 
            let p = particles[i]; p.update(); p.draw(); 
            if (p.life <= 0) particles.splice(i, 1); 
         }
         
         // Joueur (avec vérification)
         if (player) { player.update(); } 
         else { console.error("Player undefined in gameLoop!"); endGame(); return; }

         // Timers apparition
         obstacleTimer++; 
         collectibleTimer++; 
         powerUpSpawnTimer++;
         
         // GDD 3: Intervalle de spawn décroissant
         let spawnInterval = Math.max(OBSTACLE_SPAWN_INTERVAL - (gameSpeed * 5), 45); 
         
         // Apparition Obstacles (GDD 7)
         if (obstacleTimer > spawnInterval && obstacleImages.length > 0) { 
            const img = obstacleImages[Math.floor(Math.random() * obstacleImages.length)];
            obstacles.push(new Obstacle(img));
            obstacleTimer = 0;
            
            // GDD 7: Paires (10% chance)
            if (Math.random() < 0.1) {
                setTimeout(() => {
                    const img2 = obstacleImages[Math.floor(Math.random() * obstacleImages.length)];
                    obstacles.push(new Obstacle(img2));
                }, 300); // Délai
            }
         }
         
         // Apparition Collectibles (GDD 8)
         if (collectibleTimer > 200 && collectibleImages.length > 0) { // Moins fréquent
            const img = collectibleImages[0];
            const y = groundY - 100 - (Math.random() * 150); // Plage de hauteur
            collectibles.push(new Collectible(canvas.width, y, img));
            collectibleTimer = 0;
         }

        // GDD 9: Vérifier si on peut spawner un power-up
        if (!canSpawnPowerUp && score >= nextPowerUpScoreThreshold) {
            canSpawnPowerUp = true;
            powerUpSpawnTimer = 0; // Reset timer pour le 5% de chance
        }

         // Apparition Power-Ups (GDD 9)
         if (canSpawnPowerUp && !isPowerUpActive && powerUps.length === 0 && Object.keys(powerUpImages).length > 0) {
            // 5% de chance par frame (approx)
            if (powerUpSpawnTimer > 60 && Math.random() < 0.05) {
                const types = Object.keys(powerUpImagePaths).filter(t => t !== lastPowerUpType); // Évite doublon
                const type = types[Math.floor(Math.random() * types.length)];
                const y = groundY - 150 - (Math.random() * 100); // Hauteur
                powerUps.push(new PowerUp(canvas.width, y, type));
                canSpawnPowerUp = false; // N'en spawner qu'un
                powerUpSpawnTimer = 0;
            }
         }

         // Màj & Collisions Power-Ups
         for (let i = powerUps.length - 1; i >= 0; i--) { 
            let p = powerUps[i];
            p.update();
            if (player.x < p.x + p.w && player.x + player.w > p.x &&
                player.y < p.y + p.h && player.y + player.h > p.y) {
                activatePowerUp(p.type);
                powerUps.splice(i, 1);
            }
            if (p.x + p.w < 0) powerUps.splice(i, 1);
         }
         
         // Collisions Collectibles
         for (let i = collectibles.length - 1; i >= 0; i--) { 
            let c = collectibles[i];
            c.update();
            if (player.x < c.x + c.w && player.x + player.w > c.x &&
                player.y < c.y + c.h && player.y + player.h > c.y) {
                collectibles.splice(i, 1);
                updateScore(10); // GDD 10
                // GDD 8: Éclat de paillettes
                for(let j=0; j<10; j++) particles.push(new Particle(player.x+player.w/2, player.y+player.h/2, 'standard'));
            }
            if (c.x + c.w < 0) collectibles.splice(i, 1);
         }
         
         // Collisions Obstacles
         for (let i = obstacles.length - 1; i >= 0; i--) { 
            let o = obstacles[i];
            o.update();
            // GDD 10: Score
            if (o.x + o.w < player.x && !o.isPassed) {
                o.isPassed = true;
                updateScore(1);
            }
            // GDD 7: Collision
            if (player.x < o.x + o.w - 10 && player.x + player.w > o.x + 10 && // Hitbox réduite
                player.y < o.y + o.h - 10 && player.y + player.h > o.y + 10) {
                if (!isPowerUpActive || activePowerUp !== 'invincible') {
                    endGame();
                }
            }
            if (o.x + o.w < 0) obstacles.splice(i, 1);
         }
         
         // Timer Bonus Actif (GDD 9)
         if (isPowerUpActive) { 
            powerUpTimer -= deltaTime;
            powerUpTimerEl.innerText = powerUpTimer.toFixed(1) + 's';
            if (powerUpTimer <= 0) {
                deactivatePowerUp();
            }
         }
         
         // GDD 3: Difficulté croissante (Vitesse de l'exemple)
         gameSpeed += 0.003; 
         
         if (!isGameOver) { gameLoopId = requestAnimationFrame(gameLoop); } 
         else { console.log("Game ended within gameLoop, stopping loop."); gameLoopId = null; }
    }

    // --- Update Score ---
    function updateScore(value = 1) { 
        score += value;
        scoreEl.innerText = `Score: ${score}`;
        
        // GDD 9: Vérifier si le seuil pour un NOUVEAU powerup est atteint
        if (!isPowerUpActive && !canSpawnPowerUp && score >= nextPowerUpScoreThreshold) {
            console.log("Score threshold reached, can spawn powerup now.");
            canSpawnPowerUp = true;
            powerUpSpawnTimer = 0; // Démarrer le timer pour le 5% de chance
        }
    }

    // --- Fin de partie ---
    function endGame() { 
        if (isGameOver) return; // Évite les appels multiples
        console.log("Game Over!");
        isGameOver = true;
        
        if (currentMusic) currentMusic.pause();
        
        // GDD 11: Secousse
        gameContainer.classList.add('shake');
        setTimeout(() => gameContainer.classList.remove('shake'), 300);

        finalScoreEl.innerText = score;
        gameOverScreenEl.style.display = 'flex';
        
        // GDD 11: Reset powerup
        if (isPowerUpActive) deactivatePowerUp(); 
    }

    // --- 'resetGame' retourne au menu ---
    async function resetGame() { 
        console.log("Resetting game to menu...");
        if (gameLoopId) {
            cancelAnimationFrame(gameLoopId);
            gameLoopId = null;
        }
        isGameOver = true; // S'assurer que tout est arrêté
        await initMenu(); // Re-préparer le menu et les données
    }
    
    // --- 'handleInput' gère tous les taps ---
    async function handleInput(e) { 
        if (e) e.preventDefault();

        // GDD 5: Taper n'importe où
        if (isGameOver && gameLoopId === null) {
            console.log("Input detected: Resetting game.");
            await resetGame();
        } 
        else if (!isGameOver && gameLoopId === null && isReady) {
            console.log("Input detected: Starting game.");
            startGame();
        } 
        else if (player && !isGameOver) {
            // console.log("Input detected: Jump!"); // (Trop verbeux)
            player.jump();
        }
    }
    
    // Écouteurs d'événements (bouton admin attaché plus tôt)
    console.log("Adding main input listeners..."); 
    window.addEventListener('touchstart', handleInput, { passive: false });
    window.addEventListener('mousedown', handleInput);
    
    // Lancement initial (vers le menu)
    console.log("Calling initMenu for initial load."); 
    initMenu();
});
