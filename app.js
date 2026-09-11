const { jsPDF } = window.jspdf;

// Persistance continue du formulaire
const form = document.getElementById('tcmpForm');
const inputs = form.querySelectorAll('input, select, textarea');

function saveToStorage() {
  const data = {};
  inputs.forEach(input => {
    if (input.type !== 'file') data[input.id] = input.value;
  });
  localStorage.setItem('tcmp_form_state', JSON.stringify(data));
}

function loadFromStorage() {
  const data = JSON.parse(localStorage.getItem('tcmp_form_state') || '{}');
  inputs.forEach(input => {
    if (data[input.id] !== undefined) input.value = data[input.id];
  });
}

inputs.forEach(input => input.addEventListener('input', saveToStorage));
window.addEventListener('load', loadFromStorage);

function resetForm() {
  if (confirm('Voulez-vous réinitialiser l\'ensemble des rubriques ?')) {
    localStorage.removeItem('tcmp_form_state');
    form.reset();
  }
}

// Gestion des clichés photographiques (compression automatique)
let storedPhotos = [];
function handlePhotos(input, previewId) {
  const preview = document.getElementById(previewId);
  preview.innerHTML = '';
  storedPhotos = [];

  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        let w = img.width, h = img.height;
        if (w > MAX_WIDTH) { h = Math.round((h * MAX_WIDTH) / w); w = MAX_WIDTH; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

        storedPhotos.push({ src: compressedBase64, w, h });
        const thumb = document.createElement('img');
        thumb.src = compressedBase64;
        preview.appendChild(thumb);
      };
    };
    reader.readAsDataURL(file);
  });
}

// Saisie vocale avec nettoyage des tics de langage
let recognition = null;
function toggleVoice(fieldId) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Reconnaissance vocale non disponible hors-ligne sur ce navigateur.');
    return;
  }
  if (recognition) {
    recognition.stop();
    recognition = null;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'fr-FR';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    let transcript = event.results[event.results.length - 1][0].transcript;
    transcript = transcript.replace(/\b(euh|bah|tu sais|tu vois|genre|en fait)\b/gi, '').trim();
    const target = document.getElementById(fieldId);
    target.value += (target.value ? ' ' : '') + transcript;
    saveToStorage();
  };

  recognition.onend = () => { recognition = null; };
  recognition.start();
}

// Générateur vectoriel du tampon officiel haute fidélité
function getTamponGendarmerieDataURL() {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 600, 600);

  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const cx = 300, cy = 300;

  // Cercles concentriques
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.arc(cx, cy, 280, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 235, 0, Math.PI * 2);
  ctx.stroke();

  // Étoiles / Éléments latéraux
  function drawStar(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * r, -Math.sin((18 + i * 72) * Math.PI / 180) * r);
      ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (r / 2), -Math.sin((54 + i * 72) * Math.PI / 180) * (r / 2));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  drawStar(cx - 258, cy, 14);
  drawStar(cx + 258, cy, 14);

  // Textes circulaires
  ctx.font = 'bold 31px "Liberation Sans", Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  function drawCurvedText(text, radius, startAngle, endAngle, inward) {
    const chars = inward ? text.split('').reverse() : text.split('');
    const totalAngle = endAngle - startAngle;
    const step = totalAngle / (chars.length - 1);
    chars.forEach((char, i) => {
      const angle = startAngle + (i * step);
      ctx.save();
      ctx.translate(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
      ctx.rotate(angle + (inward ? -Math.PI / 2 : Math.PI / 2));
      ctx.fillText(char, 0, 0);
      ctx.restore();
    });
  }

  drawCurvedText('GENDARMERIE NATIONALE', 256, -2.60, -0.54, false);
  drawCurvedText('PROCÉDURE NUMÉRIQUE', 256, 2.50, 0.64, true);

  // Sol horizontal sous la grenade
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(130, 465);
  ctx.lineTo(240, 465);
  ctx.moveTo(360, 465);
  ctx.lineTo(470, 465);
  ctx.stroke();

  // Hachures d'assise
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(150, 477); ctx.lineTo(235, 477);
  ctx.moveTo(180, 488); ctx.lineTo(230, 488);
  ctx.stroke();

  // Bombe de la grenade
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, 455, 54, 0, Math.PI * 2);
  ctx.stroke();

  // Reflet interne bombe
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(cx - 5, 460, 43, 0.4 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  // Collet
  ctx.lineWidth = 6;
  ctx.strokeRect(cx - 24, 385, 48, 16);

  // Flammes (grenade à 8 branches stylisée)
  function drawFlameBranch(p0, c1, c2, p1, c3, c4) {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p1.x, p1.y);
    ctx.bezierCurveTo(c3.x, c3.y, c4.x, c4.y, p0.x, p0.y);
    ctx.stroke();
  }

  // Flamme centrale
  drawFlameBranch({x: 295, y: 385}, {x: 275, y: 280}, {x: 285, y: 160}, {x: 300, y: 95}, {x: 315, y: 160}, {x: 325, y: 280});
  // Branche droite supérieure
  drawFlameBranch({x: 308, y: 385}, {x: 345, y: 310}, {x: 385, y: 230}, {x: 355, y: 135}, {x: 340, y: 210}, {x: 308, y: 300});
  // Branche droite médiane
  drawFlameBranch({x: 315, y: 390}, {x: 380, y: 350}, {x: 430, y: 270}, {x: 405, y: 205}, {x: 380, y: 270}, {x: 315, y: 330});
  // Branche droite basse
  drawFlameBranch({x: 310, y: 400}, {x: 390, y: 390}, {x: 435, y: 350}, {x: 395, y: 285}, {x: 380, y: 340}, {x: 310, y: 365});
  // Branche gauche supérieure
  drawFlameBranch({x: 292, y: 385}, {x: 255, y: 310}, {x: 215, y: 230}, {x: 245, y: 135}, {x: 260, y: 210}, {x: 292, y: 300});
  // Branche gauche médiane
  drawFlameBranch({x: 285, y: 390}, {x: 220, y: 350}, {x: 170, y: 270}, {x: 195, y: 205}, {x: 220, y: 270}, {x: 285, y: 330});
  // Branche gauche basse
  drawFlameBranch({x: 290, y: 400}, {x: 210, y: 390}, {x: 165, y: 350}, {x: 205, y: 285}, {x: 220, y: 340}, {x: 290, y: 365});

  return canvas.toDataURL('image/png');
}

// Moteur de rendu PDF
function generatePDF() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const marginX = 12;
  const contentWidth = 186;
  let y = 14;

  // 1. En-tête officiel
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  doc.setFillColor(235, 235, 235);
  doc.rect(marginX, y, 95, 7, 'F');
  doc.rect(marginX, y, 95, 7, 'S');
  doc.text('GENDARMERIE NATIONALE', marginX + 47.5, y + 5, { align: 'center' });

  // Feuillet haut-droit
  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  doc.text('Pièce N° 1', pageWidth - marginX, y + 4, { align: 'right' });
  doc.text('Feuillet N° 1', pageWidth - marginX, y + 8, { align: 'right' });

  y += 7;
  doc.setFontSize(8);
  const unite = document.getElementById('unite').value;
  const splitUnite = doc.splitTextToSize(unite, 95);
  doc.text(splitUnite, marginX, y + 4);
  y += (splitUnite.length * 4) + 3;

  // Cartouche compartimenté
  const cartoucheX = marginX;
  const boxW = 24;
  doc.rect(cartoucheX, y, boxW * 4, 11);
  doc.line(cartoucheX + boxW, y, cartoucheX + boxW, y + 11);
  doc.line(cartoucheX + (boxW * 2), y, cartoucheX + (boxW * 2), y + 11);
  doc.line(cartoucheX + (boxW * 3), y, cartoucheX + (boxW * 3), y + 11);

  doc.setFontSize(7);
  doc.text('Code unité', cartoucheX + 2, y + 3.5);
  doc.text('N° P.V.', cartoucheX + boxW + 2, y + 3.5);
  doc.text('Année', cartoucheX + (boxW * 2) + 2, y + 3.5);
  doc.text('N° Dossier Justice', cartoucheX + (boxW * 3) + 2, y + 3.5);

  doc.setFontSize(9);
  doc.setFont('times', 'bold');
  doc.text(document.getElementById('codeUnite').value, cartoucheX + 2, y + 8.5);
  doc.text(document.getElementById('numPv').value, cartoucheX + boxW + 2, y + 8.5);
  doc.text(document.getElementById('annee').value, cartoucheX + (boxW * 2) + 2, y + 8.5);
  doc.text(document.getElementById('dossierJustice').value, cartoucheX + (boxW * 3) + 2, y + 8.5);

  y += 18;

  // Titre de la pièce
  doc.setFontSize(11);
  doc.text('PROCÈS-VERBAL DE TRANSPORT, CONSTATATIONS ET MESURES PRISES', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Fonction utilitaire pour dessiner les bandeaux de rubrique
  function drawSectionHeader(title) {
    if (y > 260) { doc.addPage(); y = 15; }
    doc.setFillColor(242, 242, 242);
    doc.rect(marginX, y, contentWidth, 6, 'FD');
    doc.setFont('times', 'bold');
    doc.setFontSize(9.5);
    doc.text(title, pageWidth / 2, y + 4.2, { align: 'center' });
    y += 10;
  }

  // Rubrique : Constatations
  const constatTxt = document.getElementById('constatations').value.trim();
  if (constatTxt) {
    drawSectionHeader('ÉTAT DES LIEUX ET CONSTATATIONS');
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(constatTxt, contentWidth);
    doc.text(lines, marginX, y);
    y += (lines.length * 4.8) + 6;
  }

  // Intégration photos
  if (storedPhotos.length > 0) {
    storedPhotos.forEach(p => {
      const maxImgW = 85, maxImgH = 65;
      const ratio = Math.min(maxImgW / p.w, maxImgH / p.h);
      const imgW = p.w * ratio;
      const imgH = p.h * ratio;
      if (y + imgH > 270) { doc.addPage(); y = 15; }
      doc.addImage(p.src, 'JPEG', marginX, y, imgW, imgH);
      y += imgH + 6;
    });
  }

  // Rubrique : Mesures diverses
  const mesuresTxt = document.getElementById('mesures').value.trim();
  if (mesuresTxt) {
    drawSectionHeader('MESURES DIVERSES');
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(mesuresTxt, contentWidth);
    doc.text(lines, marginX, y);
    y += (lines.length * 4.8) + 12;
  }

  // Clôture
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(`Nos constatations prennent fin le ${document.getElementById('dateFin').value}.`, marginX, y);
  y += 6;
  doc.text(`Dont procès verbal fait et clos à ${document.getElementById('residence').value}, le ${document.getElementById('dateClos').value}`, marginX, y);
  y += 12;

  // Bloc signature officiel
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text("L'Officier de Police Judiciaire", pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(document.getElementById('nomOpj').value, pageWidth / 2, y, { align: 'center' });
  y += 3;

  // Tampon rond officiel centré sous l'identité
  const tamponBase64 = getTamponGendarmerieDataURL();
  const tamponSize = 35; // 35 mm conforme au format standard
  doc.addImage(tamponBase64, 'PNG', (pageWidth - tamponSize) / 2, y, tamponSize, tamponSize);

  // Téléchargement sécurisé
  doc.save(`TCMP_${document.getElementById('numPv').value}_${document.getElementById('annee').value}.pdf`);
}
