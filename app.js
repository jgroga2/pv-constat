// =============================================================================
// ÉTAT GLOBAL DE L'APPLICATION
// =============================================================================
let cadreActif = 'FLAGRANCE';
let sectionCiblePhoto = null;
let photosParSection = {
  situation: [],
  mesures: [],
  etat: [],
  corps: []
};

let sigCanvas, sigCtx, isDrawing = false;
let signatureBlobData = null;
let recognition = null;
let shouldKeepListening = false;
let restartTimeout = null;

// Initialisation
window.addEventListener('DOMContentLoaded', () => {
  chargerEtat();
  initSignaturePleinEcran();
  initServiceWorker();
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// =============================================================================
// SAUVEGARDE EN DIRECT (ANTI-PERTE SI SORTIE DE L'APPLICATION)
// =============================================================================
function sauvegarderEtat() {
  const etat = {
    cadreActif,
    compagnie: document.getElementById('cfg-compagnie').value,
    cob: document.getElementById('cfg-cob').value,
    brigade: document.getElementById('cfg-brigade').value,
    residence: document.getElementById('cfg-residence').value,
    codeUnite: document.getElementById('cfg-code-unite').value,
    email: document.getElementById('cfg-email').value,
    grade: document.getElementById('cfg-grade').value,
    nom: document.getElementById('cfg-nom').value,
    qualite: document.getElementById('cfg-qualite').value,
    adjointActif: document.getElementById('cfg-adjoint-actif').checked,
    adjGrade: document.getElementById('cfg-adj-grade').value,
    adjNom: document.getElementById('cfg-adj-nom').value,
    adjQualite: document.getElementById('cfg-adj-qualite').value,
    adjResidence: document.getElementById('cfg-adj-residence').value,
    arriveeTime: document.getElementById('f-arrivee-time').value,
    arriveeGps: document.getElementById('f-arrivee-gps').value,
    adresse: document.getElementById('f-adresse').value,
    saisine: document.getElementById('f-saisine').value,
    situation: document.getElementById('f-situation').value,
    mesures: document.getElementById('f-mesures').value,
    etatLieux: document.getElementById('f-etat-lieux').value,
    corpsDelit: document.getElementById('f-corps-delit').value,
    mesuresDiv: document.getElementById('f-mesures-div').value,
    signatureBlobData,
    photosParSection
  };
  localStorage.setItem('gn_pv_brouillon', JSON.stringify(etat));
}

function chargerEtat() {
  const donnees = localStorage.getItem('gn_pv_brouillon');
  if (!donnees) return;

  try {
    const e = JSON.parse(donnees);
    if (e.cadreActif) setCadre(e.cadreActif);
    if (e.compagnie) document.getElementById('cfg-compagnie').value = e.compagnie;
    if (e.cob) document.getElementById('cfg-cob').value = e.cob;
    if (e.brigade) document.getElementById('cfg-brigade').value = e.brigade;
    if (e.residence) document.getElementById('cfg-residence').value = e.residence;
    if (e.codeUnite) document.getElementById('cfg-code-unite').value = e.codeUnite;
    if (e.email) document.getElementById('cfg-email').value = e.email;
    if (e.grade) document.getElementById('cfg-grade').value = e.grade;
    if (e.nom) document.getElementById('cfg-nom').value = e.nom;
    if (e.qualite) document.getElementById('cfg-qualite').value = e.qualite;
    if (e.adjointActif !== undefined) {
      document.getElementById('cfg-adjoint-actif').checked = e.adjointActif;
      toggleAdjointForm();
    }
    if (e.adjGrade) document.getElementById('cfg-adj-grade').value = e.adjGrade;
    if (e.adjNom) document.getElementById('cfg-adj-nom').value = e.adjNom;
    if (e.adjQualite) document.getElementById('cfg-adj-qualite').value = e.adjQualite;
    if (e.adjResidence) document.getElementById('cfg-adj-residence').value = e.adjResidence;
    if (e.arriveeTime) document.getElementById('f-arrivee-time').value = e.arriveeTime;
    if (e.arriveeGps) document.getElementById('f-arrivee-gps').value = e.arriveeGps;
    if (e.adresse) document.getElementById('f-adresse').value = e.adresse;
    if (e.saisine) document.getElementById('f-saisine').value = e.saisine;
    if (e.situation) document.getElementById('f-situation').value = e.situation;
    if (e.mesures) document.getElementById('f-mesures').value = e.mesures;
    if (e.etatLieux) document.getElementById('f-etat-lieux').value = e.etatLieux;
    if (e.corpsDelit) document.getElementById('f-corps-delit').value = e.corpsDelit;
    if (e.mesuresDiv) document.getElementById('f-mesures-div').value = e.mesuresDiv;
    if (e.signatureBlobData) {
      signatureBlobData = e.signatureBlobData;
      document.getElementById('sig-preview-placeholder').style.display = 'none';
      const previewImg = document.getElementById('sig-preview-img');
      previewImg.src = signatureBlobData;
      previewImg.style.display = 'block';
    }
    if (e.photosParSection) {
      photosParSection = e.photosParSection;
      ['situation', 'mesures', 'etat', 'corps'].forEach(sec => afficherPhotosSection(sec));
    }
  } catch (err) {}
}

function demanderReinitialisation() {
  if (confirm("ATTENTION : Souhaitez-vous tout réinitialiser et effacer l'ensemble des données saisies ?")) {
    nettoyerTerminal(true);
  }
}

// =============================================================================
// CONFIGURATION PROFILS & CADRE
// =============================================================================
function toggleConfig() {
  const card = document.getElementById('config-card');
  card.style.display = card.style.display === 'none' ? 'block' : 'none';
}

function toggleAdjointForm() {
  const actif = document.getElementById('cfg-adjoint-actif').checked;
  document.getElementById('box-adjoint').style.display = actif ? 'block' : 'none';
}

function setCadre(type) {
  cadreActif = type;
  document.getElementById('btn-flagrance').className = type === 'FLAGRANCE' ? 'active' : '';
  document.getElementById('btn-preliminaire').className = type === 'PRELIMINAIRE' ? 'active' : '';
  sauvegarderEtat();
}

function insererTexte(champId, texte) {
  const el = document.getElementById(champId);
  el.value = el.value ? `${el.value}\n${texte}` : texte;
  sauvegarderEtat();
}

// =============================================================================
// HORODATAGE ET GÉOLOCALISATION
// =============================================================================
function declencherArrivee() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = `${String(now.getHours()).padStart(2, '0')} heures ${String(now.getMinutes()).padStart(2, '0')} minutes`;
  document.getElementById('f-arrivee-time').value = `${dateStr} à ${timeStr}`;

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        document.getElementById('f-arrivee-gps').value = `${lat}, ${lon}`;
        sauvegarderEtat();
        resoudreAdresse(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        document.getElementById('f-arrivee-gps').value = 'Signal GPS indisponible';
        sauvegarderEtat();
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
  sauvegarderEtat();
}

async function resoudreAdresse(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
    const data = await res.json();
    if (data && data.display_name) {
      document.getElementById('f-adresse').value = data.display_name;
      sauvegarderEtat();
    }
  } catch (e) {}
}

// =============================================================================
// DICTÉE VOCALE CONTINUE
// =============================================================================
function nettoyerTics(texte) {
  return texte
    .replace(/\b(euh|euh+|heu|heuu|hum|ben)\b/gi, '')
    .replace(/\b(tu vois|t'vois|genre|du coup|en fait|voilà)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function dicter(targetId, btnId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Reconnaissance vocale non prise en charge.");
    return;
  }

  const btn = document.getElementById(btnId);

  if (shouldKeepListening) {
    shouldKeepListening = false;
    clearTimeout(restartTimeout);
    if (recognition) recognition.stop();
    btn.classList.remove('recording');
    btn.innerText = '🎤 Dictée continue';
    return;
  }

  shouldKeepListening = true;
  btn.classList.add('recording');
  btn.innerText = '⏹️ Arrêter';

  function lancerReconnaissance() {
    if (!shouldKeepListening) return;

    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = false;

    const el = document.getElementById(targetId);

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const brut = event.results[i][0].transcript;
          const propre = nettoyerTics(brut);
          if (propre.length > 0) {
            el.value = el.value ? `${el.value} ${propre}` : propre;
            sauvegarderEtat();
          }
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' && shouldKeepListening) return;
    };

    recognition.onend = () => {
      if (shouldKeepListening) {
        restartTimeout = setTimeout(() => {
          try { lancerReconnaissance(); } catch (e) {}
        }, 1200);
      }
    };

    try { recognition.start(); } catch (e) {}
  }

  lancerReconnaissance();
}

// =============================================================================
// GESTION DES CLICHÉS PAR RUBRIQUE
// =============================================================================
function declencherPhotoSection(section) {
  sectionCiblePhoto = section;
  document.getElementById('global-camera-input').click();
}

function traiterPhotoPrise(event) {
  const file = event.target.files[0];
  if (!file || !sectionCiblePhoto) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1600;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedData = canvas.toDataURL('image/jpeg', 0.82);
      const now = new Date();
      const gpsVal = document.getElementById('f-arrivee-gps').value || '';

      const photoObj = {
        id: Date.now(),
        data: compressedData,
        width: width,
        height: height,
        aspectRatio: width / height,
        date: now.toLocaleDateString('fr-FR'),
        heure: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        gps: gpsVal,
        legende: ''
      };

      photosParSection[sectionCiblePhoto].push(photoObj);
      afficherPhotosSection(sectionCiblePhoto);
      sauvegarderEtat();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function afficherPhotosSection(section) {
  const cont = document.getElementById(`photos-${section}`);
  cont.innerHTML = '';

  photosParSection[section].forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'photo-item';
    card.innerHTML = `
      <img src="${p.data}">
      <div style="font-size:10px; color:#64748b;">Cliché ${idx + 1} — ${p.date} à ${p.heure}</div>
      <input type="text" id="leg-${p.id}" value="${p.legende}" placeholder="Légende du cliché..." onchange="majLegendeSection('${section}', ${p.id}, this.value)">
      <div class="btn-row">
        <button type="button" class="btn-vocal" id="voc-leg-${p.id}" onclick="dicter('leg-${p.id}', 'voc-leg-${p.id}')">🎤 Dictée</button>
        <button type="button" class="btn btn-danger" style="font-size:10px; padding:3px 6px;" onclick="supprimerPhotoSection('${section}', ${p.id})">Supprimer</button>
      </div>
    `;
    cont.appendChild(card);
  });
}

function majLegendeSection(section, id, val) {
  const p = photosParSection[section].find(x => x.id === id);
  if (p) {
    p.legende = val;
    sauvegarderEtat();
  }
}

function supprimerPhotoSection(section, id) {
  photosParSection[section] = photosParSection[section].filter(x => x.id !== id);
  afficherPhotosSection(section);
  sauvegarderEtat();
}

// =============================================================================
// SIGNATURE TACTILE AU DOIGT (PLEIN ÉCRAN ORIENTABLE)
// =============================================================================
function initSignaturePleinEcran() {
  sigCanvas = document.getElementById('sig-fullscreen-canvas');
  sigCtx = sigCanvas.getContext('2d');

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

  window.addEventListener('resize', redimensionnerCanvasSignature);
}

function redimensionnerCanvasSignature() {
  const modal = document.getElementById('modal-signature');
  if (modal && modal.style.display === 'flex') {
    const temp = sigCanvas.toDataURL();
    const container = sigCanvas.parentElement;
    sigCanvas.width = container.clientWidth;
    sigCanvas.height = container.clientHeight;
    sigCtx.lineWidth = 3;
    sigCtx.strokeStyle = '#000';
    sigCtx.lineCap = 'round';
    
    const img = new Image();
    img.onload = () => sigCtx.drawImage(img, 0, 0);
    img.src = temp;
  }
}

function ouvrirModalSignature() {
  const modal = document.getElementById('modal-signature');
  modal.style.display = 'flex';
  setTimeout(() => {
    const container = sigCanvas.parentElement;
    sigCanvas.width = container.clientWidth;
    sigCanvas.height = container.clientHeight;
    sigCtx.lineWidth = 3;
    sigCtx.strokeStyle = '#000';
    sigCtx.lineCap = 'round';
  }, 100);
}

function fermerModalSignature() {
  document.getElementById('modal-signature').style.display = 'none';
}

function effacerSignaturePleinEcran() {
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
}

function validerSignaturePleinEcran() {
  signatureBlobData = sigCanvas.toDataURL('image/png');
  document.getElementById('sig-preview-placeholder').style.display = 'none';
  const previewImg = document.getElementById('sig-preview-img');
  previewImg.src = signatureBlobData;
  previewImg.style.display = 'block';
  sauvegarderEtat();
  fermerModalSignature();
}

// =============================================================================
// CONTRÔLE ET GÉNÉRATION DU PDF
// =============================================================================
function ouvrirModalControle() {
  document.getElementById('modal-cotes').style.display = 'flex';
}

function fermerModal() {
  document.getElementById('modal-cotes').style.display = 'none';
}

async function genererEtEnvoyer() {
  fermerModal();

  ['situation', 'mesures', 'etat', 'corps'].forEach(sec => {
    photosParSection[sec].forEach(p => {
      const el = document.getElementById(`leg-${p.id}`);
      if (el) p.legende = el.value;
    });
  });

  const now = new Date();
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const dateFormatee = `${jours[now.getDay()]} ${String(now.getDate()).padStart(2, '0')} ${mois[now.getMonth()]} ${now.getFullYear()}`;
  const heureFinExacte = `${String(now.getHours()).padStart(2, '0')} heures ${String(now.getMinutes()).padStart(2, '0')} minutes`;

  const brutPv = document.getElementById('m-pv-num').value.trim();
  let pvNum = brutPv;
  if (brutPv.includes('/')) {
    const parts = brutPv.split('/');
    pvNum = parts.length === 3 ? parts[1] : parts[0];
  }

  const pieceNum = document.getElementById('m-piece-num').value;
  const dossierNum = document.getElementById('m-dossier-num').value;

  const comp = document.getElementById('cfg-compagnie').value;
  const cob = document.getElementById('cfg-cob').value;
  const bde = document.getElementById('cfg-brigade').value;
  const codeU = document.getElementById('cfg-code-unite').value;
  const residenceU = document.getElementById('cfg-residence').value;
  const destEmail = document.getElementById('cfg-email').value;

  const gradeOpj = document.getElementById('cfg-grade').value;
  const nomOpj = document.getElementById('cfg-nom').value;
  const qualiteOpj = document.getElementById('cfg-qualite').value;

  const adjointActif = document.getElementById('cfg-adjoint-actif').checked;
  const adjGrade = document.getElementById('cfg-adj-grade').value;
  const adjNom = document.getElementById('cfg-adj-nom').value;
  const adjQualiteCode = document.getElementById('cfg-adj-qualite').value;
  const adjResidence = document.getElementById('cfg-adj-residence').value;

  let adjQualiteLibelle = "Agent de Police Judiciaire Adjoint";
  if (adjQualiteCode === 'APJ') adjQualiteLibelle = "Agent de Police Judiciaire";
  if (adjQualiteCode === 'OPJ') adjQualiteLibelle = "Officier de Police Judiciaire";

  let articles = "";
  if (!adjointActif || adjQualiteCode === 'OPJ') {
    articles = cadreActif === 'FLAGRANCE' ? "16 à 19 et 53 à 67" : "16 à 19 et 75 à 78";
  } else if (adjQualiteCode === 'APJ') {
    articles = cadreActif === 'FLAGRANCE' ? "16 à 19, 20 et 53 à 67" : "16 à 19, 20 et 75 à 78";
  } else if (adjQualiteCode === 'APJA') {
    articles = cadreActif === 'FLAGRANCE' ? "16 à 19, 21 1° bis, 21-1 et 53 à 67" : "16 à 19, 21 1° bis, 21-1 et 75 à 78";[cite: 2, 5]
  }

  const arriveeTime = document.getElementById('f-arrivee-time').value || dateFormatee;
  const gps = document.getElementById('f-arrivee-gps').value || '';
  const adr = document.getElementById('f-adresse').value || '';

  const saisine = document.getElementById('f-saisine').value || 'Néant.';
  const situation = document.getElementById('f-situation').value || 'Néant.';
  const mesures = document.getElementById('f-mesures').value || 'Néant.';
  const etatLieux = document.getElementById('f-etat-lieux').value || 'Néant.';
  const corpsDelit = document.getElementById('f-corps-delit').value || 'Néant.';
  const mesuresDiv = document.getElementById('f-mesures-div').value || 'Néant.';

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const pageHeight = 297;
    const leftMargin = 12;
    const usableWidth = 186;
    const rightMarginX = leftMargin + usableWidth;
    const leftBlockW = 75;

    let y = 10;

    // =========================================================================
    // EN-TÊTE RÉGLEMENTAIRE
    // =========================================================================
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);

    doc.setFillColor(240, 240, 240);
    doc.rect(leftMargin, y, leftBlockW, 5, 'FD');
    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text("GENDARMERIE NATIONALE", leftMargin + (leftBlockW / 2), y + 3.6, { align: "center" });

    const uniteH = 15;
    doc.rect(leftMargin, y + 5, leftBlockW, uniteH);
    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    const linesComp = doc.splitTextToSize(comp, leftBlockW - 4);
    doc.text(linesComp, leftMargin + 2, y + 8.5);
    doc.setFont("times", "bold");
    doc.text(cob, leftMargin + 2, y + 15.5);
    doc.text(bde, leftMargin + 2, y + 19);

    const cartoucheY = y + 5 + uniteH;
    const cartoucheH = 9;
    doc.rect(leftMargin, cartoucheY, leftBlockW, cartoucheH);

    const wCode = 16, wPv = 18, wAnnee = 13;
    doc.line(leftMargin + wCode, cartoucheY, leftMargin + wCode, cartoucheY + cartoucheH);
    doc.line(leftMargin + wCode + wPv, cartoucheY, leftMargin + wCode + wPv, cartoucheY + cartoucheH);
    doc.line(leftMargin + wCode + wPv + wAnnee, cartoucheY, leftMargin + wCode + wPv + wAnnee, cartoucheY + cartoucheH);
    doc.line(leftMargin, cartoucheY + 4, leftMargin + leftBlockW, cartoucheY + 4);

    doc.setFont("times", "italic");
    doc.setFontSize(6.5);
    doc.text("Code unité", leftMargin + (wCode / 2), cartoucheY + 2.8, { align: "center" });
    doc.text("Nmr P.V.", leftMargin + wCode + (wPv / 2), cartoucheY + 2.8, { align: "center" });
    doc.text("Année", leftMargin + wCode + wPv + (wAnnee / 2), cartoucheY + 2.8, { align: "center" });
    doc.text("Nmr dossier justice", leftMargin + wCode + wPv + wAnnee + 1, cartoucheY + 2.8);

    doc.setFont("times", "bold");
    doc.setFontSize(8);
    doc.text(codeU, leftMargin + (wCode / 2), cartoucheY + 7.5, { align: "center" });
    doc.text(pvNum, leftMargin + wCode + (wPv / 2), cartoucheY + 7.5, { align: "center" });
    doc.text(String(now.getFullYear()), leftMargin + wCode + wPv + (wAnnee / 2), cartoucheY + 7.5, { align: "center" });
    doc.setFontSize(7.5);
    doc.text(dossierNum, leftMargin + wCode + wPv + wAnnee + 1, cartoucheY + 7.5);

    const rightBlockX = leftMargin + leftBlockW;

    doc.setFont("times", "bold");
    doc.setFontSize(9.5);
    doc.text(`ENQUÊTE ${cadreActif === 'FLAGRANCE' ? 'DE FLAGRANCE' : 'PRÉLIMINAIRE'}`, rightBlockX + 4, y + 6);
    doc.setFontSize(8.5);
    doc.text("PROCÈS-VERBAL DE TRANSPORT CONSTATATIONS ET", rightBlockX + 4, y + 12);
    doc.text("MESURES PRISES", rightBlockX + 4, y + 16.5);

    const wPiece = 20, wFeuillet = 18;
    const pieceX = rightMarginX - wPiece - wFeuillet;
    const feuilletX = rightMarginX - wFeuillet;

    doc.rect(pieceX, cartoucheY, wPiece, cartoucheH);
    doc.rect(feuilletX, cartoucheY, wFeuillet, cartoucheH);
    doc.line(pieceX, cartoucheY + 4, pieceX + wPiece, cartoucheY + 4);
    doc.line(feuilletX, cartoucheY + 4, feuilletX + wFeuillet, cartoucheY + 4);

    doc.setFont("times", "italic");
    doc.setFontSize(6.5);
    doc.text("Nmr pièce", pieceX + (wPiece / 2), cartoucheY + 2.8, { align: "center" });
    doc.text("N° feuillet", feuilletX + (wFeuillet / 2), cartoucheY + 2.8, { align: "center" });

    doc.setFont("times", "bold");
    doc.setFontSize(8);
    doc.text(pieceNum, pieceX + (wPiece / 2), cartoucheY + 7.5, { align: "center" });

    const pageNumX = feuilletX + (wFeuillet / 2);
    const pageNumY = cartoucheY + 7.5;

    doc.line(leftMargin, cartoucheY + cartoucheH, rightMarginX, cartoucheY + cartoucheH);

    y = cartoucheY + cartoucheH + 5;
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);

    let intro = `Le ${dateFormatee}\nNous soussigné ${gradeOpj} ${nomOpj}, ${qualiteOpj} en résidence à ${residenceU}`;
    if (adjointActif) {
      intro += `\nAssisté du ${adjGrade} ${adjNom}, ${adjQualiteLibelle} en résidence à ${adjResidence}`;
    }
    intro += `\nVu les articles ${articles} du Code de Procédure Pénale.\nNous trouvant au bureau de notre unité à ${residenceU}, rapportons les opérations suivantes :`;

    const introLines = doc.splitTextToSize(intro, usableWidth);
    doc.text(introLines, leftMargin, y);
    y += introLines.length * 4.2 + 4;

    // =========================================================================
    // BANDEAUX DE TITRES ET GESTION DES PHOTOS
    // =========================================================================
    function ajouterRubrique(titre, texte, listePhotos) {
      if (y > pageHeight - 35) {
        doc.addPage();
        y = 14;
      }

      const bannerH = 6;
      doc.setFillColor(242, 242, 242);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.rect(leftMargin, y, usableWidth, bannerH, 'FD');

      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(titre, leftMargin + (usableWidth / 2), y + 4.2, { align: "center" });

      y += bannerH + 4;

      doc.setFont("times", "normal");
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(texte, usableWidth);
      lines.forEach(line => {
        if (y > pageHeight - 15) {
          doc.addPage();
          y = 14;
        }
        doc.text(line, leftMargin, y);
        y += 4.2;
      });

      if (listePhotos && listePhotos.length > 0) {
        y += 2;
        listePhotos.forEach((p, i) => {
          const ratio = p.aspectRatio || 1.33;
          const imgW = 135;
          const imgH = imgW / ratio;
          const blockH = imgH + 11;

          if (y + blockH > pageHeight - 15) {
            doc.addPage();
            y = 14;
          }

          try {
            const posX = leftMargin + (usableWidth - imgW) / 2;
            doc.addImage(p.data, 'JPEG', posX, y, imgW, imgH);
            y += imgH + 3.5;
            doc.setFontSize(8);
            doc.setFont("times", "italic");
            const legTxt = p.legende ? `Cliché n° ${i + 1} : ${p.legende}` : `Cliché n° ${i + 1} (${p.date} à ${p.heure})`;
            doc.text(legTxt, posX, y);
            y += 5.5;
          } catch (e) {}
        });
      }

      y += 3;
    }

    ajouterRubrique("SAISINE", saisine, []);
    ajouterRubrique("SITUATION À L'ARRIVÉE DES ENQUÊTEURS", `Nous arrivons sur les lieux le ${arriveeTime} sis à ${adr} ${gps ? `(GPS : ${gps})` : ''}.\n${situation}`, photosParSection.situation);
    ajouterRubrique("MESURES PRISES", mesures, photosParSection.mesures);
    ajouterRubrique("ÉTAT DES LIEUX", etatLieux, photosParSection.etat);
    ajouterRubrique("CORPS DU DÉLIT", corpsDelit, photosParSection.corps);
    ajouterRubrique("MESURES DIVERSES", mesuresDiv, []);

    // =========================================================================
    // CLÔTURE & SIGNATURE TACTILE APPOSÉE
    // =========================================================================
    if (y > pageHeight - 45) {
      doc.addPage();
      y = 14;
    }

    y += 4;
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.text(`Nos constatations prennent fin le ${dateFormatee} à ${heureFinExacte}.`, leftMargin, y);
    y += 5.5;
    doc.text(`Dont procès verbal fait et clos à ${residenceU}, le ${dateFormatee}`, leftMargin, y);
    y += 7;

    doc.setFont("times", "bold");
    doc.text("L'Officier de Police Judiciaire", leftMargin + (usableWidth / 2), y, { align: "center" });
    y += 4.5;
    doc.setFont("times", "normal");
    doc.text(`${gradeOpj} ${nomOpj}`, leftMargin + (usableWidth / 2), y, { align: "center" });

    // Insertion du tracé de signature manuel si validé
    if (signatureBlobData) {
      doc.addImage(signatureBlobData, 'PNG', leftMargin + (usableWidth / 2) - 25, y + 2, 50, 22);
      y += 26;
    } else {
      y += 12;
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont("times", "bold");
      doc.setFontSize(8);
      doc.text(`${p} / ${totalPages}`, pageNumX, pageNumY, { align: "center" });
    }

    const nomFichier = `PV_Constatations_${now.toISOString().slice(0, 10)}.pdf`;
    const pdfBlob = doc.output('blob');
    const fichierPdf = new File([pdfBlob], nomFichier, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [fichierPdf] })) {
      await navigator.share({
        title: `PV de Constatations - ${pvNum}`,
        text: `PV de transport constatations et mesures prises (${cadreActif}). Destinataire : ${destEmail}`,
        files: [fichierPdf]
      });
    } else {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomFichier;
      a.click();
      URL.revokeObjectURL(url);
      alert('Le fichier PDF a été téléchargé.');
    }

    setTimeout(() => {
      if (confirm("Transmission effectuée.\n\nSouhaitez-vous PURGER DÉFINITIVEMENT les clichés et le brouillon local ?")) {
        nettoyerTerminal(false);
      }
    }, 1200);

  } catch (err) {
    alert('Erreur lors de la génération du document : ' + err.message);
  }
}

function nettoyerTerminal(alerter = false) {
  localStorage.removeItem('gn_pv_brouillon');
  photosParSection = { situation: [], mesures: [], etat: [], corps: [] };
  signatureBlobData = null;
  ['situation', 'mesures', 'etat', 'corps'].forEach(sec => afficherPhotosSection(sec));
  document.getElementById('sig-preview-placeholder').style.display = 'block';
  document.getElementById('sig-preview-img').style.display = 'none';
  document.getElementById('f-arrivee-time').value = '';
  document.getElementById('f-arrivee-gps').value = '';
  document.getElementById('f-adresse').value = '';
  document.getElementById('f-saisine').value = '';
  document.getElementById('f-situation').value = '';
  document.getElementById('f-mesures').value = '';
  document.getElementById('f-etat-lieux').value = '';
  document.getElementById('f-corps-delit').value = '';
  document.getElementById('f-mesures-div').value = '';
  if (alerter) {
    alert('Brouillon et données réinitialisés.');
  }
}
