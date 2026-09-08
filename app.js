// =============================================================================
// ÉTAT GLOBAL DE L'APPLICATION
// =============================================================================
let cadreActif = 'FLAGRANCE';
let photos = [];
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
// PROFIL ENQUÊTEUR
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
// HORODATAGE ET GPS
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
// DICTÉE VOCALE CONTINUE
// =============================================================================
function dicter(targetId, btnId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Reconnaissance vocale non prise en charge sur ce navigateur.");
    return;
  }

  const btn = document.getElementById(btnId);

  if (shouldKeepListening) {
    shouldKeepListening = false;
    if (recognition) recognition.stop();
    btn.classList.remove('recording');
    btn.innerText = '🎤 Dictée vocale';
    return;
  }

  shouldKeepListening = true;
  btn.classList.add('recording');
  btn.innerText = '⏹️ Arrêter la dictée';

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
// CLICHÉS ET COMPRESSION (< 5 Mo)
// =============================================================================
function ajouterPhoto(event) {
  const file = event.target.files[0];
  if (!file) return;

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
      const gpsVal = document.getElementById('f-arrivee-gps').value || 'Coordonnées non relevées';

      photos.push({
        id: Date.now(),
        data: compressedData,
        width: width,
        height: height,
        aspectRatio: width / height,
        date: now.toLocaleDateString('fr-FR'),
        heure: now.toLocaleTimeString('fr-FR'),
        gps: gpsVal,
        legende: ''
      });
      afficherPhotos();
    };
    img.src = e.target.result;
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
        <button type="button" class="btn-vocal" id="btn-voc-ph-${p.id}" onclick="dicter('legende-${p.id}', 'btn-voc-ph-${p.id}')">🎤 Dictée vocale</button>
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
// CONTRÔLE ET GÉNÉRATION DU PDF (CONFORME MODÈLE EXACT)
// =============================================================================
function ouvrirModalControle() {
  document.getElementById('modal-cotes').style.display = 'flex';
}

function fermerModal() {
  document.getElementById('modal-cotes').style.display = 'none';
}

async function genererEtEnvoyer() {
  fermerModal();

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
  const destEmail = document.getElementById('cfg-email').value;

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

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    let y = 14;
    const pageBottomLimit = 270;
    const leftMargin = 14;
    const contentWidth = 182;

    // --- EN-TÊTE RÉGLEMENTAIRE (STYLE EXACT DU MODÈLE ODT) ---
    doc.setFont("times", "bold");
    doc.setFontSize(8.5);
    doc.text("GENDARMERIE NATIONALE", leftMargin, y);
    doc.text(comp.toUpperCase(), leftMargin, y + 3.8);
    doc.text(cob.toUpperCase(), leftMargin, y + 7.6);
    doc.text(bde.toUpperCase(), leftMargin, y + 11.4);

    // Titres centrés
    doc.setFontSize(10.5);
    doc.text(`ENQUÊTE DE ${cadreActif}`, 135, y + 3.8, { align: "center" });
    doc.setFontSize(9.5);
    doc.text("PROCÈS-VERBAL DE TRANSPORT CONSTATATIONS", 135, y + 8, { align: "center" });
    doc.text("ET MESURES PRISES", 135, y + 12, { align: "center" });

    // CARTOUCHE COMPARTIMENTÉ EN 2 BOÎTES CONFORME MODÈLE ODT
    y += 16;
    const cartoucheX = leftMargin;
    const b1W = 55; // Boîte gauche
    const b2W = 40; // Boîte droite
    const boxH = 26;

    doc.rect(cartoucheX, y, b1W, boxH);
    doc.rect(cartoucheX + b1W, y, b2W, boxH);

    doc.setFontSize(7.5);
    doc.setFont("times", "normal");
    // Boîte 1
    doc.text("Code Unité", cartoucheX + 2, y + 4);
    doc.setFont("times", "bold");
    doc.text(codeU, cartoucheX + 2, y + 7.5);

    doc.setFont("times", "normal");
    doc.text("P.V.", cartoucheX + 2, y + 11);
    doc.setFont("times", "bold");
    doc.text(pvNum, cartoucheX + 2, y + 14.5);

    doc.setFont("times", "normal");
    doc.text("Année", cartoucheX + 32, y + 11);
    doc.setFont("times", "bold");
    doc.text(String(now.getFullYear()), cartoucheX + 32, y + 14.5);

    doc.setFont("times", "normal");
    doc.text("Nmr Dossier Justice", cartoucheX + 2, y + 18.5);
    doc.setFont("times", "bold");
    doc.text(dossierNum, cartoucheX + 2, y + 22.5);

    // Boîte 2
    doc.setFont("times", "normal");
    doc.text("N° pièce", cartoucheX + b1W + 2, y + 4);
    doc.setFont("times", "bold");
    doc.text(pieceNum, cartoucheX + b1W + 2, y + 8);

    doc.setFont("times", "normal");
    doc.text("N° feuillet", cartoucheX + b1W + 2, y + 15);
    doc.setFont("times", "bold");
    const totalFeuilletsEstime = photos.length > 4 ? Math.ceil(photos.length / 2) + 1 : 1;
    doc.text(`1/${totalFeuilletsEstime}`, cartoucheX + b1W + 2, y + 20);

    // Paragraphe introductif
    y += boxH + 6;
    doc.setFontSize(10);
    doc.setFont("times", "normal");
    const introTxt = `Le ${dateCloture} à ${heureCloture}. Nous soussigné, ${nomOpj}, ${qualiteOpj} en résidence à ${residenceU}. Vu les articles 16 à 19 et ${articles} du Code de Procédure Pénale. Nous trouvant au bureau de notre unité à ${residenceU}, rapportons les opérations suivantes :`;
    const introLines = doc.splitTextToSize(introTxt, contentWidth);
    doc.text(introLines, leftMargin, y);
    y += introLines.length * 4.8 + 2;

    doc.line(leftMargin, y, leftMargin + contentWidth, y);
    y += 5;

    // --- FONCTION SECTION AVEC TITRE CENTRÉ ET SOULIGNÉ ---
    function addSection(title, content) {
      if (y > pageBottomLimit - 20) { doc.addPage(); y = 14; }
      
      doc.setFont("times", "bold");
      doc.setFontSize(10.5);
      // Titre centré
      doc.text(title, 105, y, { align: "center" });
      const titleW = doc.getTextWidth(title);
      doc.line(105 - (titleW / 2), y + 0.8, 105 + (titleW / 2), y + 0.8);
      y += 6;

      doc.setFont("times", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(content, contentWidth);
      lines.forEach(l => {
        if (y > pageBottomLimit - 10) { doc.addPage(); y = 14; }
        doc.text(l, leftMargin, y);
        y += 4.5;
      });
      y += 3;
    }

    addSection("SAISINE", saisine);
    addSection("SITUATION A L'ARRIVÉE DES ENQUÊTEURS", `Transport sur les lieux le ${arriveeTime} sis à ${adr} (GPS : ${gps}).\n\n${situation}`);
    addSection("MESURES PRISES", mesures);
    addSection("ETAT DES LIEUX", etatLieux);

    // Intégration directe si <= 4 photos
    if (photos.length > 0 && photos.length <= 4) {
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const ratio = p.aspectRatio || 1.33;
        const imgW = 125;
        const imgH = Math.min(Math.round(imgW / ratio), 80);

        if (y + imgH + 18 > pageBottomLimit) { doc.addPage(); y = 14; }
        try {
          doc.addImage(p.data, 'JPEG', (210 - imgW) / 2, y, imgW, imgH);
          y += imgH + 4;
          doc.setFontSize(8.5);
          doc.setFont("times", "italic");
          doc.text(`Cliché n° ${i + 1} - ${p.date} à ${p.heure} (GPS : ${p.gps})`, (210 - imgW) / 2, y);
          y += 4;
          doc.setFont("times", "normal");
          doc.text(`Légende : ${p.legende || 'Néant'}`, (210 - imgW) / 2, y);
          y += 6;
        } catch (e) {}
      }
    } else if (photos.length > 4) {
      addSection("CLICHÉS PHOTOGRAPHIQUES", `(Se reporter aux clichés n° 01 à ${photos.length} joints en annexe photographique du présent procès-verbal).`);
    }

    addSection("CORPS DU DELIT", corpsDelit);
    addSection("MESURES DIVERSES", mesuresDiv);

    // Clôture et Signature
    if (y > pageBottomLimit - 38) { doc.addPage(); y = 14; }
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(`Dont procès-verbal fait et clos le ${dateCloture} à ${heureCloture}.`, leftMargin, y);
    y += 7;

    doc.setFont("times", "normal");
    doc.text(qualiteOpj, 130, y);
    doc.text(nomOpj, 130, y + 4);
    if (signatureBlobData) {
      doc.addImage(signatureBlobData, 'PNG', 125, y + 6, 50, 22);
      y += 28;
    } else {
      y += 12;
    }

    // =========================================================================
    // PLANCHE PHOTOGRAPHIQUE (SI > 4 PHOTOS) : STRICTEMENT 2 PAR PAGE
    // =========================================================================
    if (photos.length > 4) {
      for (let i = 0; i < photos.length; i++) {
        if (i % 2 === 0) {
          doc.addPage();
          y = 14;
          const numFeuillet = Math.floor(i / 2) + 2;

          // En-tête annexe
          doc.setFont("times", "bold");
          doc.setFontSize(10.5);
          doc.text("ANNEXE PHOTOGRAPHIQUE CONTINUE", 105, y, { align: "center" });
          doc.setFontSize(8.5);
          doc.setFont("times", "normal");
          doc.text(`P.V. N° : ${pvNum}  —  Feuillet ${numFeuillet}/${totalFeuilletsEstime}`, 105, y + 4.5, { align: "center" });
          y += 12;
        }

        const p = photos[i];
        const ratio = p.aspectRatio || 1.33;
        const imgW = 140;
        const imgH = Math.min(Math.round(imgW / ratio), 82); // 82 mm max : garantit l'insertion de 2 photos complètes avec légendes par page A4

        doc.addImage(p.data, 'JPEG', (210 - imgW) / 2, y, imgW, imgH);
        y += imgH + 4;

        doc.setFontSize(8.5);
        doc.setFont("times", "italic");
        doc.text(`Cliché n° ${i + 1} - ${p.date} à ${p.heure} - GPS : ${p.gps}`, (210 - imgW) / 2, y);
        y += 4;
        doc.setFont("times", "normal");
        doc.text(`Légende : ${p.legende || 'Néant'}`, (210 - imgW) / 2, y);
        y += 12;
      }
    }

    const nomFichier = `PV_Constatations_${now.toISOString().slice(0, 10)}.pdf`;
    const pdfBlob = doc.output('blob');
    const fichierPdf = new File([pdfBlob], nomFichier, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [fichierPdf] })) {
      await navigator.share({
        title: `PV de Constatations - ${pvNum}`,
        text: `PV de transport, constatations et mesures prises (${cadreActif}). Destinataire : ${destEmail}`,
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
      if (confirm("Transmission terminée.\n\nSouhaitez-vous PURGER DÉFINITIVEMENT les clichés et données du terminal ?")) {
        nettoyerTerminal();
      }
    }, 1200);

  } catch (err) {
    alert('Erreur lors de la génération du document : ' + err.message);
  }
}

function nettoyerTerminal() {
  photos = [];
  signatureBlobData = null;
  afficherPhotos();
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
  alert('Nettoyage sécurisé effectué. Aucune trace conservée.');
}
