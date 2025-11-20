let ligneCount = 1;

const OPTIONS_LIBELLES = [
    { value: "Loyers et charges", text: "Loyers et charges" },
    { value: "Réparations locatives (après DG)", text: "Réparations locatives (après DG)" },
    { value: "Frais de procédure", text: "Frais de procédure" },
    { value: "Autre", text: "Autre..." }
];

const OPTIONS_CHOIX_RESULTAT = [
    { value: "Somme à passer au crédit en rubrique 686", text: "Crédit Rubrique 686" },
    { value: "Somme à passer au débit en ODL", text: "Débit ODL" },
    { value: "Autre", text: "Autre..." }
];

// --- Fonctions utilitaires ---

// Ajout du symbole € et formatage FR
const formaterEuro = (nombre) => {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(nombre);
};

// Gère l'affichage du champ "Autre" si sélectionné
const handleSelectChange = (selectElement) => {
    const parent = selectElement.closest('.demande-input') || selectElement.closest('.choix-resultat');
    if (!parent) return;

    const inputAutre = parent.querySelector('.input-autre, .input-autre-resultat');
    const inputMontant = parent.querySelector('.input-with-euro');

    if (!inputAutre) return;

    if (selectElement.value === 'Autre') {
        inputAutre.classList.remove('hidden');
        inputAutre.required = true;
        inputAutre.style.flexGrow = '2'; 
        if (inputMontant) {
             inputMontant.style.flexGrow = '1';
        }
    } else {
        inputAutre.classList.add('hidden');
        inputAutre.required = false;
        inputAutre.value = '';
        inputAutre.style.flexGrow = '1';
        if (inputMontant) {
             inputMontant.style.flexGrow = '1.5';
        }
    }
};

// Crée le HTML pour une nouvelle ligne de calcul (demande/condamnation)
const creerLigneCalculHTML = (id, libelles) => {
    const optionsHTML = libelles.map(opt => 
        `<option value="${opt.value}">${opt.text}</option>`
    ).join('');

    return `
        <div class="ligne-calcul" data-id="${id}">
            <div class="demande-input input-group">
                <label>Poste de Demande :</label>
                <select class="select-libelle" data-input-target="demande-${id}">
                    ${optionsHTML}
                </select>
                <input type="text" class="input-autre hidden" placeholder="Détail du poste">
                <div class="input-with-euro">
                    <input type="number" class="valeur-demande" data-input-name="demande-${id}" step="0.01" value="0" required>
                    <span class="euro-suffix">€</span>
                </div>
            </div>
            <div class="condamnation-input input-group">
                <label>Condamnation :</label>
                <div class="input-with-euro">
                    <input type="number" class="valeur-condamnation" data-input-name="condamnation-${id}" step="0.01" value="0" required>
                    <span class="euro-suffix">€</span>
                </div>
            </div>
            <button type="button" class="supprimer-ligne non-imprimable" data-id="${id}">Supprimer</button>
        </div>
    `;
};

// Crée le HTML pour le résultat d'une ligne
const creerResultatLigneHTML = (id, libelle, deboute, optionsResultat) => {
    const optionsHTML = optionsResultat.map(opt => 
        `<option value="${opt.value}">${opt.text}</option>`
    ).join('');

    const couleurClasse = deboute < 0 ? 'resultat-negatif' : 'resultat-positif';

    return `
        <div class="resultat-ligne" data-id="${id}">
            <div class="resultat-content">
                <span class="resultat-label">Débouté ${libelle} :</span> 
                <span class="resultat-valeur ${couleurClasse}">${formaterEuro(deboute)}</span>
                
                <div class="choix-resultat non-imprimable">
                    <label>Action :</label>
                    <select class="select-choix-resultat" data-resultat-id="${id}">
                        ${optionsHTML}
                    </select>
                    <input type="text" class="input-autre-resultat hidden" placeholder="Détail de l'action">
                </div>

                <span class="action-imprimable hidden"></span>
            </div>
        </div>
    `;
};


// --- Logique principale ---

document.addEventListener('DOMContentLoaded', () => {
    const formulaire = document.getElementById('formulaireCalcul');
    const lignesContainer = document.getElementById('lignes-dynamiques');
    const resultatsContainer = document.getElementById('resultats-dynamiques');
    const resultatsSection = document.getElementById('resultats');
    const boutonAjouter = document.getElementById('ajouterLigne');
    
    
    // Initialisation et gestion des lignes 
    document.querySelector('.ligne-calcul[data-id="1"] .select-libelle').addEventListener('change', (e) => handleSelectChange(e.target));
    
    boutonAjouter.addEventListener('click', () => {
        ligneCount++;
        const nouvelleLigne = creerLigneCalculHTML(ligneCount, OPTIONS_LIBELLES); 
        lignesContainer.insertAdjacentHTML('beforeend', nouvelleLigne);

        const nouvelleLigneElement = lignesContainer.lastElementChild;
        nouvelleLigneElement.querySelector('.select-libelle').addEventListener('change', (e) => handleSelectChange(e.target));
    });
    
    document.getElementById('demandes-condamnations').addEventListener('click', (e) => {
        if (e.target.classList.contains('supprimer-ligne')) {
            e.target.closest('.ligne-calcul').remove();
            formulaire.dispatchEvent(new Event('submit')); 
        }
    });
    lignesContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('select-libelle')) {
            handleSelectChange(e.target);
        }
    });
    // Fin des gestionnaires de lignes


    // Gestion du calcul
    formulaire.addEventListener('submit', function(e) {
        e.preventDefault(); 

        resultatsContainer.innerHTML = '';
        const lignes = document.querySelectorAll('.ligne-calcul');
        
        lignes.forEach(ligne => {
            const id = ligne.dataset.id;
            
            // 1. Récupérer le libellé choisi
            const selectDemandeLibelle = ligne.querySelector('.select-libelle');
            const inputAutreDemande = ligne.querySelector('.input-autre');
            let libelleDemande;

            if (selectDemandeLibelle.value === 'Autre' && inputAutreDemande.value.trim() !== '') {
                libelleDemande = inputAutreDemande.value.trim();
            } else if (selectDemandeLibelle.value !== 'Autre') {
                libelleDemande = selectDemandeLibelle.value;
            } else {
                libelleDemande = 'Poste non spécifié'; 
            }
            
            // 2. Calculer le débouté
            const demande = parseFloat(ligne.querySelector('.valeur-demande').value) || 0;
            const condamnation = parseFloat(ligne.querySelector('.valeur-condamnation').value) || 0;
            const deboute = demande - condamnation;

            // 3. Créer et insérer le résultat
            const resultatHTML = creerResultatLigneHTML(id, libelleDemande, deboute, OPTIONS_CHOIX_RESULTAT);
            resultatsContainer.insertAdjacentHTML('beforeend', resultatHTML);
        });
        
        resultatsSection.classList.remove('hidden');

        // 4. Ajout des listeners pour les choix d'action de résultats
        resultatsContainer.querySelectorAll('.select-choix-resultat').forEach(select => {
            const parentDiv = select.closest('.resultat-ligne');
            const actionImprimable = parentDiv.querySelector('.action-imprimable');
            const inputAutre = parentDiv.querySelector('.input-autre-resultat');
            
            // Fonction de mise à jour de l'affichage imprimable (CORRECTION DE LA PHRASE)
            const updatePrintableAction = () => {
                let actionText;
                let action;

                if (select.value === 'Autre') {
                    action = inputAutre.value.trim() || '[Détail action...]';
                } else {
                    action = select.options[select.selectedIndex].text;
                }
                
                // CORRECTION : "A passer sur le compte AU"
                actionText = `A passer sur le compte au ${action}`;
                
                actionImprimable.textContent = actionText;
                actionImprimable.classList.remove('hidden');
            };

            select.addEventListener('change', (e) => {
                handleSelectChange(e.target);
                updatePrintableAction();
            });

            if (inputAutre) {
                 inputAutre.addEventListener('input', updatePrintableAction);
            }

            // Déclencher le change initial
            select.dispatchEvent(new Event('change'));
        });
    });

    // Déclenchement du calcul initial
    formulaire.dispatchEvent(new Event('submit'));

});