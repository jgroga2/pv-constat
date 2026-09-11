// =============================================================================
// ÉTAT GLOBAL
// =============================================================================
let cadreActif = 'FLAGRANCE';
let sectionCiblePhoto = null;
let photosParSection = {
  situation: [],
  mesures: [],
  etat: [],
  corps: []
};

let sigCanvas = null, sigCtx = null, isDrawing = false;
let signatureBlobData = null;
let recognition = null;
let shouldKeepListening = false;
let restartTimeout = null;

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
// SAUVEGARDE EN DIRECT (ANTI-PERTE)
// =============================================================================
function sauvegarderEtat() {
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };

  const chkAdj = document.getElementById('cfg-adjoint-actif');

  const etat = {
    cadreActif,
    compagnie: getVal('cfg-compagnie'),
    cob: getVal('cfg-cob'),
    brigade: getVal('cfg-brigade'),
    residence: getVal('cfg-residence'),
    codeUnite: getVal('cfg-code-unite'),
    email: getVal('cfg-email'),
    grade: getVal('cfg-grade'),
    nom: getVal('cfg-nom'),
    qualite: getVal('cfg-qualite'),
    adjointActif: chkAdj ? chkAdj.checked : false,
    adjGrade: getVal('cfg-adj-grade'),
    adjNom: getVal('cfg-adj-nom'),
    adjQualite: getVal('cfg-adj-qualite'),
    adjResidence: getVal('cfg-adj-residence'),
    arriveeTime: getVal('f-arrivee-time'),
    arriveeGps: getVal('f-arrivee-gps'),
    adresse: getVal('f-adresse'),
    saisine: getVal('f-saisine'),
    situation: getVal('f-situation'),
    mesures: getVal('f-mesures'),
    etatLieux: getVal('f-etat-lieux'),
    corpsDelit: getVal('f-corps-delit'),
    mesuresDiv: getVal('f-mesures-div'),
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
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };

    if (e.cadreActif) setCadre(e.cadreActif);
    setVal('cfg-compagnie', e.compagnie);
    setVal('cfg-cob', e.cob);
    setVal('cfg-brigade', e.brigade);
    setVal('cfg-residence', e.residence);
    setVal('cfg-code-unite', e.codeUnite);
    setVal('cfg-email', e.email);
    setVal('cfg-grade', e.grade);
    setVal('cfg-nom', e.nom);
    setVal('cfg-qualite', e.qualite);

    const chkAdj = document.getElementById('cfg-adjoint-actif');
    if (chkAdj && e.adjointActif !== undefined) {
      chkAdj.checked = e.adjointActif;
      toggleAdjointForm();
    }
    setVal('cfg-adj-grade', e.adjGrade);
    setVal('cfg-adj-nom', e.adjNom);
    setVal('cfg-adj-qualite', e.adjQualite);
    setVal('cfg-adj-residence', e.adjResidence);

    setVal('f-arrivee-time', e.arriveeTime);
    setVal('f-arrivee-gps', e.arriveeGps);
    setVal('f-adresse', e.adresse);
    setVal('f-saisine', e.saisine);
    setVal('f-situation', e.situation);
    setVal('f-mesures', e.mesures);
    setVal('f-etat-lieux', e.etatLieux);
    setVal('f-corps-delit', e.corpsDelit);
    setVal('f-mesures-div', e.mesuresDiv);

    if (e.signatureBlobData) {
      signatureBlobData = e.signatureBlobData;
      const ph = document.getElementById('sig-preview-placeholder');
      const img = document.getElementById('sig-preview-img');
      if (ph) ph.style.display = 'none';
      if (img) {
        img.src = signatureBlobData;
        img.style.display = 'block';
      }
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
// PROFILS & CADRE
// =============================================================================
function toggleConfig() {
  const card = document.getElementById('config-card');
  if (card) {
    card.style.display = (card.style.display === 'none' || card.style.display === '') ? 'block' : 'none';
  }
}

function toggleAdjointForm() {
  const chk = document.getElementById('cfg-adjoint-actif');
  const box = document.getElementById('box-adjoint');
  if (box && chk) {
    box.style.display = chk.checked ? 'block' : 'none';
  }
}

function setCadre(type) {
  cadreActif = type;
  const btnF = document.getElementById('btn-flagrance');
  const btnP = document.getElementById('btn-preliminaire');
  if (btnF) btnF.className = type === 'FLAGRANCE' ? 'active' : '';
  if (btnP) btnP.className = type === 'PRELIMINAIRE' ? 'active' : '';
  sauvegarderEtat();
}

function insererTexte(champId, texte) {
  const el = document.getElementById(champId);
  if (el) {
    el.value = el.value ? `${el.value}\n${texte}` : texte;
    sauvegarderEtat();
  }
}

// =============================================================================
// HORODATAGE ET GÉOLOCALISATION
// =============================================================================
function declencherArrivee() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR');
  const timeStr = `${String(now.getHours()).padStart(2, '0')} heures ${String(now.getMinutes()).padStart(2, '0')} minutes`;
  const elTime = document.getElementById('f-arrivee-time');
  if (elTime) elTime.value = `${dateStr} à ${timeStr}`;

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(5);
        const lon = pos.coords.longitude.toFixed(5);
        const elGps = document.getElementById('f-arrivee-gps');
        if (elGps) elGps.value = `${lat}, ${lon}`;
        sauvegarderEtat();
        resoudreAdresse(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        const elGps = document.getElementById('f-arrivee-gps');
        if (elGps) elGps.value = 'Signal GPS indisponible';
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
      const elAdr = document.getElementById('f-adresse');
      if (elAdr) elAdr.value = data.display_name;
      sauvegarderEtat();
    }
  } catch (e) {}
}

// =============================================================================
// DICTÉE CONTINUE
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
    alert("Reconnaissance vocale non prise en charge sur ce navigateur.");
    return;
  }

  const btn = document.getElementById(btnId);

  if (shouldKeepListening) {
    shouldKeepListening = false;
    clearTimeout(restartTimeout);
    if (recognition) recognition.stop();
    if (btn) {
      btn.classList.remove('recording');
      btn.innerText = '🎤 Dictée continue';
    }
    return;
  }

  shouldKeepListening = true;
  if (btn) {
    btn.classList.add('recording');
    btn.innerText = '⏹️ Arrêter';
  }

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
          if (propre.length > 0 && el) {
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
// GESTION DES CLICHÉS
// =============================================================================
function declencherPhotoSection(section) {
  sectionCiblePhoto = section;
  const input = document.getElementById('global-camera-input');
  if (input) input.click();
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
      const elGps = document.getElementById('f-arrivee-gps');
      const gpsVal = elGps ? elGps.value : '';

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
  if (!cont) return;
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
// SIGNATURE TACTILE AU DOIGT
// =============================================================================
function initSignaturePleinEcran() {
  sigCanvas = document.getElementById('sig-fullscreen-canvas');
  if (!sigCanvas) return;
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
  if (modal && modal.style.display === 'flex' && sigCanvas) {
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
  if (!modal || !sigCanvas) return;
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
  const modal = document.getElementById('modal-signature');
  if (modal) modal.style.display = 'none';
}

function effacerSignaturePleinEcran() {
  if (sigCtx && sigCanvas) {
    sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
  }
}

function validerSignaturePleinEcran() {
  if (!sigCanvas) return;
  signatureBlobData = sigCanvas.toDataURL('image/png');
  const ph = document.getElementById('sig-preview-placeholder');
  const img = document.getElementById('sig-preview-img');
  if (ph) ph.style.display = 'none';
  if (img) {
    img.src = signatureBlobData;
    img.style.display = 'block';
  }
  sauvegarderEtat();
  fermerModalSignature();
}

// =============================================================================
// CONTRÔLE ET GÉNÉRATION DU PDF
// =============================================================================
function ouvrirModalControle() {
  const m = document.getElementById('modal-cotes');
  if (m) m.style.display = 'flex';
}

function fermerModal() {
  const m = document.getElementById('modal-cotes');
  if (m) m.style.display = 'none';
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

  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const brutPv = getVal('m-pv-num');
  let pvNum = brutPv;
  if (brutPv.includes('/')) {
    const parts = brutPv.split('/');
    pvNum = parts.length === 3 ? parts[1] : parts[0];
  }

  const pieceNum = getVal('m-piece-num') || '1';
  const dossierNum = getVal('m-dossier-num') || '[ En cours ]';

  const comp = getVal('cfg-compagnie');
  const cob = getVal('cfg-cob');
  const bde = getVal('cfg-brigade');
  const codeU = getVal('cfg-code-unite');
  const residenceU = getVal('cfg-residence');
  const destEmail = getVal('cfg-email');

  const gradeOpj = getVal('cfg-grade');
  const nomOpj = getVal('cfg-nom');
  const qualiteOpj = getVal('cfg-qualite');

  const chkAdj = document.getElementById('cfg-adjoint-actif');
  const adjointActif = chkAdj ? chkAdj.checked : false;
  const adjGrade = getVal('cfg-adj-grade');
  const adjNom = getVal('cfg-adj-nom');
  const adjQualiteCode = getVal('cfg-adj-qualite');
  const adjResidence = getVal('cfg-adj-residence');

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

  const arriveeTime = getVal('f-arrivee-time') || dateFormatee;
  const gps = getVal('f-arrivee-gps');
  const adr = getVal('f-adresse');

  const saisine = getVal('f-saisine') || 'Néant.';
  const situation = getVal('f-situation') || 'Néant.';
  const mesures = getVal('f-mesures') || 'Néant.';
  const etatLieux = getVal('f-etat-lieux') || 'Néant.';
  const corpsDelit = getVal('f-corps-delit') || 'Néant.';
  const mesuresDiv = getVal('f-mesures-div') || 'Néant.';

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    const pageHeight = 297;
    const leftMargin = 12;
    const usableWidth = 186;
    const rightMarginX = leftMargin + usableWidth;
    const leftBlockW = 75;

    let y = 10;

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

  const setEmpty = (id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  };

  const ph = document.getElementById('sig-preview-placeholder');
  const img = document.getElementById('sig-preview-img');
  if (ph) ph.style.display = 'block';
  if (img) img.style.display = 'none';

  setEmpty('f-arrivee-time');
  setEmpty('f-arrivee-gps');
  setEmpty('f-adresse');
  setEmpty('f-saisine');
  setEmpty('f-situation');
  setEmpty('f-mesures');
  setEmpty('f-etat-lieux');
  setEmpty('f-corps-delit');
  setEmpty('f-mesures-div');

  if (alerter) {
    alert('Brouillon et données réinitialisés.');
  }
}
