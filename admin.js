// GDD 15: Liste des fichiers à vérifier
// Basé sur GDD Section 14 et la photo
const assetList = [
    // Logo
    'uniteamadventure.png',
    
    // Fond
    'FOND DE PLAN.jpg',
    
    // Obstacles
    'cactus1.png',
    'cactus2.png',
    'cactus3.png',
    'cactus4.png',
    
    // Collectible
    'note.png',
    
    // Power-ups
    'chapeau.png',
    'botte.png',
    'aimant.png',
    
    // Têtes Joueurs (1 à 18)
    ...Array.from({length: 18}, (_, i) => `perso${i+1}.png`),
    
    // Musique (1 à 5)
    ...Array.from({length: 5}, (_, i) => `music${i+1}.mp3`)
];

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('asset-container');

    if (!container) {
        console.error("Conteneur d'assets non trouvé !");
        return;
    }

    console.log(`Chargement de ${assetList.length} assets pour vérification...`);

    assetList.forEach(src => {
        const item = document.createElement('div');
        item.classList.add('asset-item');
        
        const caption = document.createElement('p');
        caption.textContent = src;

        if (src.endsWith('.png') || src.endsWith('.jpg')) {
            // C'est une image
            const img = document.createElement('img');
            img.src = src;
            img.alt = `Test ${src}`;
            
            // Vérifier si l'image ne se charge pas
            img.onerror = () => {
                img.alt = `ERREUR: ${src} introuvable !`;
                item.style.backgroundColor = '#800'; // Rouge pour erreur
            };
            
            item.appendChild(img);

        } else if (src.endsWith('.mp3')) {
            // C'est de l'audio
            item.classList.add('audio');
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = src;

            audio.onerror = () => {
                caption.textContent = `ERREUR: ${src} introuvable !`;
                item.style.backgroundColor = '#800';
            };

            item.appendChild(audio);
        }

        item.appendChild(caption);
        container.appendChild(item);
    });
});