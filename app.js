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

window.addEventListener('DOMContentLoaded', () => {
  chargerProfil();
  initSignaturePleinEcran();
  initServiceWorker();
});

function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// =============================================================================
// PROFIL ENQUÊTEUR & CO-ENQUÊTEUR (PERSISTANT)
// =============================================================================
function toggleConfig() {
  const card = document.getElementById('config-card');
  card.style.display = card.style.display === 'none' ? 'block' : 'none';
}

function toggleAdjointForm() {
  const actif = document.getElementById('cfg-adjoint-actif').checked;
  document.getElementById('box-adjoint').style.display = actif ? 'block' : 'none';
}

function sauvegarderProfil() {
  const profil = {
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
    adjResidence: document.getElementById('cfg-adj-residence').value
  };
  localStorage.setItem('gn_profil_v3', JSON.stringify(profil));
  toggleConfig();
  alert('Profils enregistrés.');
}

function chargerProfil() {
  const data = localStorage.getItem('gn_profil_v3');
  if (data) {
    const p = JSON.parse(data);
    if (p.compagnie) document.getElementById('cfg-compagnie').value = p.compagnie;
    if (p.cob) document.getElementById('cfg-cob').value = p.cob;
    if (p.brigade) document.getElementById('cfg-brigade').value = p.brigade;
    if (p.residence) document.getElementById('cfg-residence').value = p.residence;
    if (p.codeUnite) document.getElementById('cfg-code-unite').value = p.codeUnite;
    if (p.email) document.getElementById('cfg-email').value = p.email;
    if (p.grade) document.getElementById('cfg-grade').value = p.grade;
    if (p.nom) document.getElementById('cfg-nom').value = p.nom;
    if (p.qualite) document.getElementById('cfg-qualite').value = p.qualite;
    if (p.adjointActif !== undefined) {
      document.getElementById('cfg-adjoint-actif').checked = p.adjointActif;
      toggleAdjointForm();
    }
    if (p.adjGrade) document.getElementById('cfg-adj-grade').value = p.adjGrade;
    if (p.adjNom) document.getElementById('cfg-adj-nom').value = p.adjNom;
    if (p.adjQualite) document.getElementById('cfg-adj-qualite').value = p.adjQualite;
    if (p.adjResidence) document.getElementById('cfg-adj-residence').value = p.adjResidence;
  }
}

// =============================================================================
// CADRE D'ENQUÊTE & INSERTION PHRASES TYPES
// =============================================================================
function setCadre(type) {
  cadreActif = type;
  document.getElementById('btn-flagrance').className = type === 'FLAGRANCE' ? 'active' : '';
  document.getElementById('btn-preliminaire').className = type === 'PRELIMINAIRE' ? 'active' : '';
}

function insererTexte(champId, texte) {
  const el = document.getElementById(champId);
  el.value = el.value ? `${el.value}\n${texte}` : texte;
}

// =============================================================================
// HORODATAGE ET GÉOLOCALISATION
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
  } catch (e) {}
}

// =============================================================================
// DICTÉE CONTINUE AVEC RELANCE
// =============================================================================
function dicter(targetId, btnId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Reconnaissance vocale non prise en charge.");
    return;
  }

  const btn = document.getElementById(btnId);

  if (shouldKeepListening) {
    shouldKeepListening = false;
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
          const transcript = event.results[i][0].transcript.trim();
          el.value = el.value ? `${el.value} ${transcript}` : transcript;
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' && shouldKeepListening) return;
    };

    recognition.onend = () => {
      if (shouldKeepListening) {
        setTimeout(() => {
          try { lancerReconnaissance(); } catch (e) {}
        }, 150);
      }
    };

    try { recognition.start(); } catch (e) {}
  }

  lancerReconnaissance();
}

// =============================================================================
// GESTION DES PHOTOS INTÉGRÉES PAR RUBRIQUE
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
        heure: now.toLocaleTimeString('fr-FR'),
        gps: gpsVal,
        legende: ''
      };

      photosParSection[sectionCiblePhoto].push(photoObj);
      afficherPhotosSection(sectionCiblePhoto);
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
        <button type="button" class="btn-vocal" id="voc-leg-${p.id}" onclick="dicter('leg-${p.id}', 'voc-leg-${p.id}')">🎤 Dictée légende</button>
        <button type="button" class="btn btn-danger" style="font-size:10px; padding:3px 6px;" onclick="supprimerPhotoSection('${section}', ${p.id})">Supprimer</button>
      </div>
    `;
    cont.appendChild(card);
  });
}

function majLegendeSection(section, id, val) {
  const p = photosParSection[section].find(x => x.id === id);
  if (p) p.legende = val;
}

function supprimerPhotoSection(section, id) {
  photosParSection[section] = photosParSection[section].filter(x => x.id !== id);
  afficherPhotosSection(section);
}

// =============================================================================
// SIGNATURE PLEIN ÉCRAN
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
  fermerModalSignature();
}

// =============================================================================
// CONTRÔLE ET GÉNÉRATION DU PDF (STRUCTURE TABLEAU CONFORME MODÈLES ODT)
// =============================================================================
function ouvrirModalControle() {
  document.getElementById('modal-cotes').style.display = 'flex';
}

function fermerModal() {
  document.getElementById('modal-cotes').style.display = 'none';
}

async function genererEtEnvoyer() {
  fermerModal();

  // Mise à jour des légendes
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

  const pvNum = document.getElementById('m-pv-num').value;
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
  const adjQualite = document.getElementById('cfg-adj-qualite').value;
  const adjResidence = document.getElementById('cfg-adj-residence').value;

  // Articles CPP
  let articles = cadreActif === 'FLAGRANCE' ? '16 à 19 et 53 à 67' : '16 à 19 et 75 à 78';
  if (adjointActif) {
    articles = cadreActif === 'FLAGRANCE' 
      ? '16 à 19, 21 1° bis, 21-1 et 53 à 67' 
      : '16 à 19, 21 1° bis, 21-1 et 75 à 78';
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

    const pageWidth = 210;
    const pageHeight = 297;
    const leftMargin = 12;
    const rightMargin = 12;
    const usableWidth = pageWidth - leftMargin - rightMargin; // 186 mm
    
    // Colonne de gauche (texte + photos) et colonne de droite (titres)
    const rightColWidth = 35; 
    const leftColWidth = usableWidth - rightColWidth; // 151 mm
    const colSeparatorX = leftMargin + leftColWidth; // Ligne verticale
    const rightMarginX = leftMargin + usableWidth;

    let y = 12;

    // --- EN-TÊTE RÉGLEMENTAIRE CONFORME ---
    doc.setFont("times", "normal");
    doc.setFontSize(8.5);
    doc.text("GENDARMERIE NATIONALE", leftMargin, y);
    doc.text(`Compagnie de ${comp}`, leftMargin, y + 4);
    doc.text(`COB ${cob}`, leftMargin, y + 8);
    doc.text(`BP ${bde}`, leftMargin, y + 12);

    // Titres en haut à droite
    doc.setFont("times", "bold");
    doc.setFontSize(10.5);
    doc.text(`ENQUÊTE ${cadreActif === 'FLAGRANCE' ? 'DE FLAGRANCE' : 'PRÉLIMINAIRE'}`, 130, y + 4, { align: "center" });
    doc.setFontSize(9);
    doc.text("PROCÈS-VERBAL DE TRANSPORT CONSTATATIONS", 130, y + 8.5, { align: "center" });
    doc.text("ET MESURES PRISES", 130, y + 12.5, { align: "center" });

    // CARTOUCHE COMPARTIMENTÉ STRICT
    y += 16;
    const cartoucheH = 12;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(leftMargin, y, usableWidth, cartoucheH);

    // Subdivisions
    const colW1 = 28, colW2 = 32, colW3 = 22, colW4 = 48, colW5 = 26;
    doc.line(leftMargin + colW1, y, leftMargin + colW1, y + cartoucheH);
    doc.line(leftMargin + colW1 + colW2, y, leftMargin + colW1 + colW2, y + cartoucheH);
    doc.line(leftMargin + colW1 + colW2 + colW3, y, leftMargin + colW1 + colW2 + colW3, y + cartoucheH);
    doc.line(leftMargin + colW1 + colW2 + colW3 + colW4, y, leftMargin + colW1 + colW2 + colW3 + colW4, y + cartoucheH);
    doc.line(leftMargin + colW1 + colW2 + colW3 + colW4 + colW5, y, leftMargin + colW1 + colW2 + colW3 + colW4 + colW5, y + cartoucheH);

    // Textes cartouche
    doc.setFontSize(7.5);
    doc.setFont("times", "normal");
    doc.text("Code unité", leftMargin + 2, y + 3.5);
    doc.text("Nmr P.V.", leftMargin + colW1 + 2, y + 3.5);
    doc.text("Année", leftMargin + colW1 + colW2 + 2, y + 3.5);
    doc.text("Nmr dossier justice", leftMargin + colW1 + colW2 + colW3 + 2, y + 3.5);
    doc.text("Nmr pièce", leftMargin + colW1 + colW2 + colW3 + colW4 + 2, y + 3.5);
    doc.text("N° feuillet", leftMargin + colW1 + colW2 + colW3 + colW4 + colW5 + 2, y + 3.5);

    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.text(codeU, leftMargin + 2, y + 8.5);
    doc.text(pvNum, leftMargin + colW1 + 2, y + 8.5);
    doc.text(String(now.getFullYear()), leftMargin + colW1 + colW2 + 2, y + 8.5);
    doc.text(dossierNum, leftMargin + colW1 + colW2 + colW3 + 2, y + 8.5);
    doc.text(pieceNum, leftMargin + colW1 + colW2 + colW3 + colW4 + 2, y + 8.5);

    // Marqueur pour la pagination dynamique finale
    const pageNumY = y + 8.5;
    const pageNumX = leftMargin + colW1 + colW2 + colW3 + colW4 + colW5 + 2;

    // Introduction procédurale
    y += cartoucheH + 5;
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);

    let intro = `Le ${dateFormatee}\nNous soussigné ${gradeOpj} ${nomOpj}, ${qualiteOpj} en résidence à ${residenceU}`;
    if (adjointActif) {
      intro += `\nAssisté du ${adjGrade} ${adjNom}, ${adjQualite} en résidence à ${adjResidence}`;
    }
    intro += `\nVu les articles ${articles} du Code de Procédure Pénale.\nNous trouvant au bureau de notre unité à ${residenceU}, rapportons les opérations suivantes :`;

    const introLines = doc.splitTextToSize(intro, leftColWidth - 4);
    doc.text(introLines, leftMargin + 2, y);
    y += introLines.length * 4.2 + 2;

    // Ligne sous l'intro
    doc.line(leftMargin, y, rightMarginX, y);

    // --- FONCTION D'AJOUT DE RUBRIQUE DANS LE TABLEAU À 2 COLONNES ---
    function ajouterRubrique(titre, texte, listePhotos) {
      const startY = y;
      let curY = y + 4;

      // Impression du texte dans la colonne gauche
      doc.setFont("times", "normal");
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(texte, leftColWidth - 4);
      lines.forEach(line => {
        if (curY > pageHeight - 20) {
          terminerPageTableau(startY, curY, titre);
          curY = y + 4;
        }
        doc.text(line, leftMargin + 2, curY);
        curY += 4.2;
      });

      // Insertion des photos dans la colonne gauche sous le texte
      if (listePhotos && listePhotos.length > 0) {
        listePhotos.forEach((p, i) => {
          const ratio = p.aspectRatio || 1.33;
          const imgW = Math.min(leftColWidth - 10, 130);
          const imgH = Math.min(Math.round(imgW / ratio), 80);

          if (curY + imgH + 12 > pageHeight - 18) {
            terminerPageTableau(startY, curY, titre);
            curY = y + 4;
          }

          try {
            doc.addImage(p.data, 'JPEG', leftMargin + 4, curY, imgW, imgH);
            curY += imgH + 3.5;
            doc.setFontSize(8);
            doc.setFont("times", "italic");
            const legTxt = p.legende ? `Cliché n° ${i + 1} : ${p.legende}` : `Cliché n° ${i + 1} (${p.date} à ${p.heure})`;
            doc.text(legTxt, leftMargin + 4, curY);
            curY += 5;
          } catch (e) {}
        });
      }

      curY += 2;
      const blockHeight = curY - startY;

      // Dessin des bordures du bloc
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.line(leftMargin, startY, leftMargin, curY); // Bord gauche
      doc.line(rightMarginX, startY, rightMarginX, curY); // Bord droit
      doc.line(colSeparatorX, startY, colSeparatorX, curY); // Séparateur vertical
      doc.line(leftMargin, curY, rightMarginX, curY); // Ligne horizontale basse

      // Titre en colonne droite (BLEU GENDARMERIE EXACT #002060)
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 32, 96); // #002060

      const titleLines = doc.splitTextToSize(titre, rightColWidth - 4);
      const titleTotalHeight = titleLines.length * 4;
      const titleY = startY + (blockHeight / 2) - (titleTotalHeight / 2) + 3;

      doc.text(titleLines, colSeparatorX + (rightColWidth / 2), titleY, { align: "center" });

      doc.setTextColor(0, 0, 0); // Remise au noir
      y = curY;
    }

    function terminerPageTableau(startY, curY, titre) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.2);
      doc.line(leftMargin, startY, leftMargin, curY);
      doc.line(rightMarginX, startY, rightMarginX, curY);
      doc.line(colSeparatorX, startY, colSeparatorX, curY);
      doc.line(leftMargin, curY, rightMarginX, curY);

      // Titre sur la page en cours
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setTextColor(0, 32, 96);
      const titleLines = doc.splitTextToSize(titre, rightColWidth - 4);
      const titleTotalHeight = titleLines.length * 4;
      doc.text(titleLines, colSeparatorX + (rightColWidth / 2), startY + ((curY - startY) / 2) - (titleTotalHeight / 2) + 3, { align: "center" });
      doc.setTextColor(0, 0, 0);

      doc.addPage();
      y = 14;
    }

    // Ajout des rubriques séquentielles
    ajouterRubrique("SAISINE", saisine, []);
    ajouterRubrique("SITUATION À L'ARRIVÉE DES ENQUÊTEURS", `Transport sur les lieux le ${arriveeTime} sis à ${adr} ${gps ? `(GPS : ${gps})` : ''}.\n\n${situation}`, photosParSection.situation);
    ajouterRubrique("MESURES PRISES", mesures, photosParSection.mesures);
    ajouterRubrique("ÉTAT DES LIEUX", etatLieux, photosParSection.etat);
    ajouterRubrique("CORPS DU DÉLIT", corpsDelit, photosParSection.corps);
    ajouterRubrique("MESURES DIVERSES", mesuresDiv, []);

    // Formule de clôture & Signature dans la colonne gauche
    if (y > pageHeight - 35) { doc.addPage(); y = 14; }
    
    y += 4;
    doc.setFont("times", "normal");
    doc.setFontSize(9.5);
    doc.text(`Nos constatations prennent fin le ${dateFormatee}.`, leftMargin + 2, y);
    y += 5;
    doc.text(`Dont procès verbal fait et clos à ${residenceU}, le ${dateFormatee}`, leftMargin + 2, y);
    y += 6;

    doc.setFont("times", "bold");
    doc.text("L'Officier de Police Judiciaire", leftMargin + (leftColWidth / 2), y, { align: "center" });
    y += 4;
    doc.setFont("times", "normal");
    doc.text(`${gradeOpj} ${nomOpj}`, leftMargin + (leftColWidth / 2), y, { align: "center" });
    
    if (signatureBlobData) {
      doc.addImage(signatureBlobData, 'PNG', leftMargin + (leftColWidth / 2) - 25, y + 2, 50, 22);
    }

    // --- MISE À JOUR DE LA PAGINATION RÉELLE SUR TOUTES LES PAGES ---
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFont("times", "bold");
      doc.setFontSize(8.5);
      doc.text(`${p}/ ${totalPages}`, pageNumX, pageNumY);
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
      if (confirm("Transmission effectuée.\n\nSouhaitez-vous PURGER DÉFINITIVEMENT les clichés et données locales du terminal ?")) {
        nettoyerTerminal();
      }
    }, 1200);

  } catch (err) {
    alert('Erreur lors de la génération du document : ' + err.message);
  }
}

function nettoyerTerminal() {
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
  alert('Nettoyage sécurisé effectué. Aucune donnée ne subsiste sur le terminal.');
}
