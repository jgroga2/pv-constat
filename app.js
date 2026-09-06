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
// PROFIL ENQUÊTEUR (STOCKAGE LOCAL HORS-LIGNE)
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
// DICTÉE VOCALE CONTINUE AVEC RELANCE SUR SILENCE
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
      if (event.error === 'no-speech' && shouldKeepListening) {
        return;
      }
    };

    recognition.onend = () => {
      if (shouldKeepListening) {
        setTimeout(() => {
          try {
            lancerReconnaissance();
          } catch (e) {}
        }, 150);
      }
    };

    try {
      recognition.start();
    } catch (e) {}
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
}

function ouvrirModalSignature() {
  const modal = document.getElementById('modal-signature');
  modal.style.display = 'flex';

  sigCanvas.width = sigCanvas.offsetWidth;
  sigCanvas.height = sigCanvas.offsetHeight;
  sigCtx.lineWidth = 3;
  sigCtx.strokeStyle = '#000';
  sigCtx.lineCap = 'round';
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
// CONTRÔLE ET GÉNÉRATION PDF
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

  const sigSrc = signatureBlobData || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

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
          <img src="${sigSrc}" class="signature-img">
        </div>
      </div>
    </div>

    ${photosAnnexeHtml}
  `;

  const imgElements = renderDiv.querySelectorAll('img');
  await Promise.all(Array.from(imgElements).map(img => img.decode().catch(() => {})));

  const nomFichier = `PV_Constatations_${now.toISOString().slice(0, 10)}.pdf`;
  const opt = {
    margin: [10, 10, 10, 10],
    filename: nomFichier,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    const pdfBlob = await html2pdf().set(opt).from(renderDiv).outputPdf('blob');
    const fichierPdf = new File([pdfBlob], nomFichier, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [fichierPdf] })) {
      await navigator.share({
        title: `PV de Constatations - ${pvNum}`,
        text: `PV de transport, constatations et mesures prises (${cadreActif}). Destinataire : ${destEmail}`,
        files: [fichierPdf]
      });
    } else {
      const mailto = `mailto:${encodeURIComponent(destEmail)}?subject=${encodeURIComponent(`PV de Constatations - ${pvNum}`)}`;
      window.location.href = mailto;
    }

    setTimeout(() => {
      if (confirm("Transmission terminée.\n\nSouhaitez-vous PURGER DÉFINITIVEMENT les clichés et données du terminal ?")) {
        nettoyerTerminal();
      }
    }, 1200);

  } catch (err) {
    alert('Erreur de génération : ' + err.message);
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
