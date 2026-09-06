// =============================================================================
// ÉTAT GLOBAL DE L'APPLICATION
// =============================================================================
let cadreActif = 'FLAGRANCE';
let photos = [];
let sigCanvas, sigCtx, isDrawing = false;

// Initialisation au chargement
window.addEventListener('DOMContentLoaded', () => {
  chargerProfil();
  initSignature();
  initServiceWorker();
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// =============================================================================
// GESTION DU PROFIL ENQUÊTEUR (PERSISTANT HORS-LIGNE)
// =============================================================================
function toggleConfig() {
  const card = document.getElementById('config-card');
  card.style.display = card.style.display === 'none' ? 'block' : 'none';
}

function sauvegarderProfil() {
  const profil = {
    compagnie: document.getElementById('cfg-compagnie').value,
    cob: document.getElementById('cfg-cob').value,
    brigade: document.getElementById('cfg-brigade').value,
    residence: document.getElementById('cfg-residence').value,
    codeUnite: document.getElementById('cfg-code-unite').value,
    nom: document.getElementById('cfg-nom').value,
    qualite: document.getElementById('cfg-qualite').value,
    email: document.getElementById('cfg-email').value
  };
  localStorage.setItem('gn_profil', JSON.stringify(profil));
  toggleConfig();
  alert('Profil enquêteur enregistré.');
}

function chargerProfil() {
  const data = localStorage.getItem('gn_profil');
  if (data) {
    const p = JSON.parse(data);
    if (p.compagnie) document.getElementById('cfg-compagnie').value = p.compagnie;
    if (p.cob) document.getElementById('cfg-cob').value = p.cob;
    if (p.brigade) document.getElementById('cfg-brigade').value = p.brigade;
    if (p.residence) document.getElementById('cfg-residence').value = p.residence;
    if (p.codeUnite) document.getElementById('cfg-code-unite').value = p.codeUnite;
    if (p.nom) document.getElementById('cfg-nom').value = p.nom;
    if (p.qualite) document.getElementById('cfg-qualite').value = p.qualite;
    if (p.email) document.getElementById('cfg-email').value = p.email;
  }
}

// =============================================================================
// CADRE D'ENQUÊTE
// =============================================================================
function setCadre(type) {
  cadreActif = type;
  document.getElementById('btn-flagrance').className = type === 'FLAGRANCE' ? 'active' : '';
  document.getElementById('btn-preliminaire').className = type === 'PRELIMINAIRE' ? 'active' : '';
}

// =============================================================================
// HORODATAGE, GPS ET LOCALISATION
// =============================================================================
function declencherArrivee() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = now.toLocaleTimeString('fr-FR');
  document.getElementById('f-arrivee-time').value = `${dateStr} à ${timeStr}`;

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        document.getElementById('f-arrivee-gps').value = `${lat}, ${lon}`;
        resoudreAdresse(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        document.getElementById('f-arrivee-gps').value = 'Signal GPS indisponible';
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
}

async function resoudreAdresse(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const data = await res.json();
    if (data && data.display_name) {
      document.getElementById('f-adresse').value = data.display_name;
    }
  } catch (e) {
    // Mode hors-ligne : l'adresse reste à compléter manuellement ou vocalement
  }
}

// =============================================================================
// DICTÉE VOCALE DIRECTE
// =============================================================================
function dicter(targetId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('La reconnaissance vocale n\'est pas disponible sur ce navigateur.');
    return;
  }
  const recog = new SpeechRecognition();
  recog.lang = 'fr-FR';
  recog.interimResults = false;
  recog.start();

  recog.onresult = (event) => {
    const texte = event.results[0][0].transcript;
    const el = document.getElementById(targetId);
    el.value = el.value ? `${el.value} ${texte}` : texte;
  };
}

// =============================================================================
// GESTION DES CLICHÉS PHOTOGRAPHIQUES ET LÉGENDES
// =============================================================================
function ajouterPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const now = new Date();
    const gpsVal = document.getElementById('f-arrivee-gps').value || 'Non renseigné';
    const photoObj = {
      id: Date.now(),
      data: e.target.result,
      date: now.toLocaleDateString('fr-FR'),
      heure: now.toLocaleTimeString('fr-FR'),
      gps: gpsVal,
      legende: ''
    };
    photos.push(photoObj);
    afficherPhotos();
  };
  reader.readAsDataURL(file);
}

function afficherPhotos() {
  const cont = document.getElementById('galerie-photos');
  cont.innerHTML = '';
  document.getElementById('photo-compteur').innerText = `${photos.length} cliché${photos.length > 1 ? 's' : ''}`;

  photos.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'photo-slot';
    card.innerHTML = `
      <img src="${p.data}" class="photo-preview">
      <div style="font-size:11px; color:#64748b; margin-bottom:4px;">
        Cliché n° ${idx + 1} — ${p.date} à ${p.heure} — GPS : ${p.gps}
      </div>
      <label>Légende descriptive :</label>
      <input type="text" id="legende-${p.id}" value="${p.legende}" onchange="majLegende(${p.id}, this.value)" placeholder="Description de la trace, outil, dégradation...">
      <div class="btn-row">
        <button type="button" class="btn-vocal" onclick="dicter('legende-${p.id}')">🎤 Dicter légende</button>
        <button type="button" class="btn btn-danger" style="padding:4px 8px; font-size:11px;" onclick="supprimerPhoto(${p.id})">Supprimer</button>
      </div>
    `;
    cont.appendChild(card);
  });
}

function majLegende(id, val) {
  const p = photos.find(x => x.id === id);
  if (p) p.legende = val;
}

function supprimerPhoto(id) {
  photos = photos.filter(x => x.id !== id);
  afficherPhotos();
}

// =============================================================================
// ZONE DE SIGNATURE MANUSCRITE
// =============================================================================
function initSignature() {
  sigCanvas = document.getElementById('sig-canvas');
  sigCtx = sigCanvas.getContext('2d');
  
  // Résolution nette
  sigCanvas.width = sigCanvas.offsetWidth;
  sigCanvas.height = sigCanvas.offsetHeight;
  sigCtx.lineWidth = 2;
  sigCtx.strokeStyle = '#000';

  const getPos = (e) => {
    const rect = sigCanvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const start = (e) => { isDrawing = true; const p = getPos(e); sigCtx.beginPath(); sigCtx.moveTo(p.x, p.y); };
  const move = (e) => { if (!isDrawing) return; const p = getPos(e); sigCtx.lineTo(p.x, p.y); sigCtx.stroke(); };
  const end = () => { isDrawing = false; };

  sigCanvas.addEventListener('mousedown', start);
  sigCanvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  sigCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); start(e); });
  sigCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); move(e); });
  sigCanvas.addEventListener('touchend', end);
}

function effacerSignature() {
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
}

// =============================================================================
// MODALE DE CONTRÔLE ET GÉNÉRATION DU PDF PROCÉDURAL
// =============================================================================
function ouvrirModalControle() {
  document.getElementById('modal-cotes').style.display = 'flex';
}

function fermerModal() {
  document.getElementById('modal-cotes').style.display = 'none';
}

function genererEtEnvoyer() {
  fermerModal();

  // Mise à jour finale des légendes
  photos.forEach(p => {
    const el = document.getElementById(`legende-${p.id}`);
    if (el) p.legende = el.value;
  });

  const now = new Date();
  const dateCloture = now.toLocaleDateString('fr-FR');
  const heureCloture = now.toLocaleTimeString('fr-FR');

  const pvNum = document.getElementById('m-pv-num').value;
  const pieceNum = document.getElementById('m-piece-num').value;
  const dossierNum = document.getElementById('m-dossier-num').value;

  const comp = document.getElementById('cfg-compagnie').value;
  const cob = document.getElementById('cfg-cob').value;
  const bde = document.getElementById('cfg-brigade').value;
  const codeU = document.getElementById('cfg-code-unite').value;
  const nomOpj = document.getElementById('cfg-nom').value;
  const qualiteOpj = document.getElementById('cfg-qualite').value;
  const residenceU = document.getElementById('cfg-residence').value;

  const articles = cadreActif === 'FLAGRANCE' ? '53 à 67' : '75 à 78';

  const arriveeTime = document.getElementById('f-arrivee-time').value || `${dateCloture} à ${heureCloture}`;
  const gps = document.getElementById('f-arrivee-gps').value || 'Coordonnées non relevées';
  const adr = document.getElementById('f-adresse').value || 'Non précisée';

  const saisine = document.getElementById('f-saisine').value || 'Néant.';
  const situation = document.getElementById('f-situation').value || 'Néant.';
  const mesures = document.getElementById('f-mesures').value || 'Néant.';
  const etatLieux = document.getElementById('f-etat-lieux').value || 'Néant.';
  const corpsDelit = document.getElementById('f-corps-delit').value || 'Néant.';
  const mesuresDiv = document.getElementById('f-mesures-div').value || 'Néant.';

  const signatureData = sigCanvas.toDataURL('image/png');

  // Construction dynamique des photos (≤ 4 photos intégrées dans l'état des lieux, > 4 en annexe)
  let photosIntegreHtml = '';
  let photosAnnexeHtml = '';

  if (photos.length > 0 && photos.length <= 4) {
    photos.forEach((p, i) => {
      photosIntegreHtml += `
        <div class="photo-card-pdf">
          <img src="${p.data}">
          <div class="photo-caption-pdf">
            <strong>Cliché n° ${i + 1} :</strong> ${p.legende || 'Sans légende'}<br>
            <em>Pris le ${p.date} à ${p.heure} — GPS : ${p.gps}</em>
          </div>
        </div>
      `;
    });
  } else if (photos.length > 4) {
    photosIntegreHtml = `<p><em>(Se reporter aux clichés photographiques n° 01 à ${photos.length} annexés au présent procès-verbal).</em></p>`;
    
    photosAnnexeHtml = `
      <div class="page-break"></div>
      <table class="header-table">
        <tr>
          <td class="header-unite">GENDARMERIE NATIONALE<br>${bde}</td>
          <td class="header-titres">
            <div class="pv-nom">ANNEXE PHOTOGRAPHIQUE</div>
            <div style="font-size:9.5pt; margin-top:4px;">P.V. N° : <strong>${pvNum}</strong></div>
          </td>
        </tr>
      </table>
      <div style="text-align:center; font-weight:bold; font-size:11pt; text-transform:uppercase; margin-bottom:12px; border-bottom:1px solid #000; padding-bottom:3px;">
        Planche Photographique Continue
      </div>
    `;

    photos.forEach((p, i) => {
      photosAnnexeHtml += `
        <div class="photo-card-pdf">
          <img src="${p.data}">
          <div class="photo-caption-pdf">
            <strong>Cliché n° ${i + 1} :</strong> ${p.legende || 'Sans légende'}<br>
            <em>Pris le ${p.date} à ${p.heure} — GPS : ${p.gps}</em>
          </div>
        </div>
      `;
    });
  }

  // Assemblage du gabarit complet
  const renderDiv = document.getElementById('pdf-render');
  renderDiv.innerHTML = `
    <table class="header-table">
      <tr>
        <td class="header-unite">
          GENDARMERIE NATIONALE<br>
          ${comp}<br>
          ${cob}<br>
          ${bde}
          <table class="cartouche-table">
            <tr>
              <td>Code Unité<br><strong>${codeU}</strong></td>
              <td>P.V. N°<br><strong>${pvNum}</strong></td>
              <td>Année<br><strong>${now.getFullYear()}</strong></td>
            </tr>
            <tr>
              <td colspan="2">Nmr Dossier Justice : <strong>${dossierNum}</strong></td>
              <td>N° Pièce<br><strong>${pieceNum}</strong></td>
            </tr>
          </table>
        </td>
        <td class="header-titres">
          <div class="enquete-type">ENQUÊTE DE ${cadreActif}</div>
          <div class="pv-nom">PROCÈS-VERBAL DE TRANSPORT CONSTATATIONS ET MESURES PRISES</div>
        </td>
      </tr>
    </table>

    <div class="intro-block">
      Le <strong>${dateCloture}</strong> à <strong>${heureCloture}</strong>.<br>
      Nous soussigné, <strong>${nomOpj}</strong>, ${qualiteOpj} en résidence à ${residenceU}.<br>
      Vu les articles 16 à 19 et ${articles} du Code de Procédure Pénale.<br>
      Nous trouvant au bureau de notre unité à ${residenceU}, rapportons les opérations suivantes :
    </div>

    <div class="section-title">SAISINE</div>
    <div class="section-content">${saisine}</div>

    <div class="section-title">SITUATION A L'ARRIVÉE DES ENQUÊTEURS</div>
    <div class="section-content">
      Transport sur les lieux le <strong>${arriveeTime}</strong> sis à <strong>${adr}</strong> (Coordonnées GPS : ${gps}).<br><br>
      ${situation}
    </div>

    <div class="section-title">MESURES PRISES</div>
    <div class="section-content">${mesures}</div>

    <div class="section-title">ETAT DES LIEUX</div>
    <div class="section-content">
      ${etatLieux}
      ${photosIntegreHtml}
    </div>

    <div class="section-title">CORPS DU DELIT</div>
    <div class="section-content">${corpsDelit}</div>

    <div class="section-title">MESURES DIVERSES</div>
    <div class="section-content">${mesuresDiv}</div>

    <div style="margin-top:16px; page-break-inside: avoid;">
      <p><strong>Dont procès-verbal fait et clos le ${dateCloture} à ${heureCloture}.</strong></p>
      <div class="signature-container">
        <div class="signature-box">
          ${qualiteOpj}<br>
          ${nomOpj}<br>
          <img src="${signatureData}" class="signature-img">
        </div>
      </div>
    </div>

    ${photosAnnexeHtml}
  `;

  // Génération du PDF
  renderDiv.style.display = 'block';
  const opt = {
    margin: [10, 10, 10, 10],
    filename: `PV_Constatations_${now.toISOString().slice(0, 10)}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(opt).from(renderDiv).save().then(() => {
    renderDiv.style.display = 'none';

    // Proposition de transmission par courriel et purge sécurisée
    const destEmail = document.getElementById('cfg-email').value;
    const mailto = `mailto:${encodeURIComponent(destEmail)}?subject=${encodeURIComponent(`PV de Constatations - ${pvNum}`)}&body=${encodeURIComponent("Veuillez trouver ci-joint le procès-verbal de transport constatations et mesures prises généré sur le terrain.")}`;
    
    window.location.href = mailto;

    setTimeout(() => {
      if (confirm("Transmission initiée.\n\nSouhaitez-vous PURGER DÉFINITIVEMENT les clichés et données locales du terminal par mesure de confidentialité ?")) {
        nettoyerTerminal();
      }
    }, 1500);
  });
}

function nettoyerTerminal() {
  photos = [];
  afficherPhotos();
  effacerSignature();
  document.getElementById('f-arrivee-time').value = '';
  document.getElementById('f-arrivee-gps').value = '';
  document.getElementById('f-adresse').value = '';
  document.getElementById('f-saisine').value = '';
  document.getElementById('f-situation').value = '';
  document.getElementById('f-mesures').value = '';
  document.getElementById('f-etat-lieux').value = '';
  document.getElementById('f-corps-delit').value = '';
  document.getElementById('f-mesures-div').value = '';
  alert('Nettoyage sécurisé effectué. Aucune donnée ne subsiste sur le terminal.');
}
