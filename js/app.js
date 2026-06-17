(() => {
  "use strict";

  const VERSION = "qr-quiz-pwa-v3";
  const DEMO_QR_PARTS = [
  "EMQZ|v1|id=demo-offline-abcd|part=1/2|sum=a61098c1|data=eyJpZCI6ImRlbW8tb2ZmbGluZS1hYmNkIiwidGl0bGUiOiJNaW5pIFF1aXogUVIgT2ZmbGluZSIsImRlc2NyaXB0aW9uIjoiUXVpeiBBQkNEIGxlw61kbyBkZXNkZSAyIGPDs2RpZ29zIFFSLiIsInRpbWVMaW1pdCI6MzAsInNjb3JlTW9kZSI6ImN1cnZlIiwiaXRlbXMiOlt7InR5cGUiOiJhYmNkIiwicXVlc3Rpb24iOiLCv0N1w6FudG8gZXMgNyB4IDg_Iiwib3B0aW9",
  "EMQZ|v1|id=demo-offline-abcd|part=2/2|sum=a61098c1|data=ucyI6WyI1NCIsIjU2IiwiNjQiLCI1OCJdLCJjb3JyZWN0IjoxLCJ0aW1lTGltaXQiOjMwLCJwb2ludHMiOjEwMDB9LHsidHlwZSI6ImFiY2QiLCJxdWVzdGlvbiI6IsK_Q3XDoWwgZnJhY2Npw7NuIGVxdWl2YWxlIGEgMS8yPyIsIm9wdGlvbnMiOlsiMi8zIiwiMy82IiwiNC81IiwiNS84Il0sImNvcnJlY3QiOjEsInRpbWVMaW1pdCI6MjUsInBvaW50cyI6MTAwMH1dfQ"
];

  const $ = (id) => document.getElementById(id);

  const els = {
    scannerCard: $("scannerCard"),
    quizCard: $("quizCard"),
    video: $("video"),
    html5qrReader: $("html5qrReader"),
    scanOverlay: $("scanOverlay"),
    startBtn: $("startBtn"),
    altReaderBtn: $("altReaderBtn"),
    permissionBtn: $("permissionBtn"),
    stopBtn: $("stopBtn"),
    resetBtn: $("resetBtn"),
    refreshCamerasBtn: $("refreshCamerasBtn"),
    cameraSelect: $("cameraSelect"),
    status: $("status"),
    diagnostic: $("diagnostic"),
    partsBox: $("partsBox"),
    manualInput: $("manualInput"),
    manualBtn: $("manualBtn"),
    demo1Btn: $("demo1Btn"),
    demo2Btn: $("demo2Btn"),
    quizTitle: $("quizTitle"),
    quizDesc: $("quizDesc"),
    progress: $("progress"),
    timer: $("timer"),
    questionText: $("questionText"),
    questionMeta: $("questionMeta"),
    options: $("options"),
    feedback: $("feedback"),
    nextBtn: $("nextBtn"),
    againBtn: $("againBtn"),
    finishBox: $("finishBox")
  };

  const STORAGE_PREFIX = "emqz.parts.";
  const CDN_HTML5_QRCODE = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";

  let stream = null;
  let detector = null;
  let scanning = false;
  let lastScan = "";
  let lastScanAt = 0;
  let html5QrCode = null;
  let html5Active = false;

  let currentQuiz = null;
  let currentIndex = 0;
  let score = 0;
  let timerId = null;
  let timeLeft = 0;
  let locked = false;

  function setStatus(html, mode = "") {
    els.status.className = "status" + (mode ? " " + mode : "");
    els.status.innerHTML = html;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[ch]));
  }

  function secureHint() {
    const secure = window.isSecureContext;
    if (secure) return "";
    return "\nAVISO: no es secureContext. Camara suele requerir HTTPS o localhost.";
  }

  function showDiagnostic(extra = "") {
    const media = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const barcode = "BarcodeDetector" in window;
    els.diagnostic.textContent =
`version: ${VERSION}
protocol: ${location.protocol}
origin: ${location.origin || "sin origin"}
href: ${location.href}
secureContext: ${window.isSecureContext ? "si" : "no"}
getUserMedia: ${media ? "si" : "no"}
BarcodeDetector: ${barcode ? "si" : "no"}
serviceWorker: ${"serviceWorker" in navigator ? "si" : "no"}
userAgent: ${navigator.userAgent}
${extra}${secureHint()}`;
  }

  async function getCameraPermissionState() {
    try {
      if (!navigator.permissions || !navigator.permissions.query) return "no disponible";
      const result = await navigator.permissions.query({ name: "camera" });
      return result.state;
    } catch {
      return "no disponible";
    }
  }

  function explainCameraError(err) {
    const name = err && err.name ? err.name : "Error";
    const msg = err && err.message ? err.message : String(err || "");

    if (name === "NotAllowedError" || /denied|permission/i.test(msg)) {
      return `<strong>Chrome nego la camara.</strong><br>
      No se puede forzar desde JavaScript, pero este ZIP ya intenta varias configuraciones.<br>
      Revisa: candado de la URL → Configuracion del sitio → Camara → Permitir, luego recarga.<br>
      Abre desde GitHub Pages HTTPS o localhost, no desde vista previa embebida.<br>
      Detalle: <code>${escapeHtml(name)}: ${escapeHtml(msg)}</code>`;
    }

    if (name === "NotFoundError") {
      return `<strong>No encontre camara.</strong> Revisa que el dispositivo tenga camara o selecciona otra. <code>${escapeHtml(msg)}</code>`;
    }

    if (name === "NotReadableError") {
      return `<strong>La camara existe, pero esta ocupada.</strong> Cierra Zoom, Meet u otra app que la use. <code>${escapeHtml(msg)}</code>`;
    }

    if (name === "OverconstrainedError") {
      return `<strong>La camara no acepta esa configuracion.</strong> El prototipo ya intenta otra configuracion mas simple. <code>${escapeHtml(msg)}</code>`;
    }

    if (name === "SecurityError") {
      return `<strong>Bloqueo de seguridad.</strong> Usa HTTPS o localhost. <code>${escapeHtml(msg)}</code>`;
    }

    return `<strong>Error de camara:</strong> <code>${escapeHtml(name)}: ${escapeHtml(msg)}</code>`;
  }

  function base64UrlToText(base64url) {
    let b64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  }

  function fnv1aHex(text) {
    const bytes = new TextEncoder().encode(text);
    let h = 0x811c9dc5;
    for (const b of bytes) {
      h ^= b;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  }

  function parseKvPayload(raw) {
    const text = String(raw || "").trim();
    const parts = text.split("|");

    if (parts.length < 6 || parts[0] !== "EMQZ" || parts[1] !== "v1") {
      throw new Error("Este texto no tiene formato EMQZ v1.");
    }

    const data = {};
    for (let i = 2; i < parts.length; i++) {
      const eq = parts[i].indexOf("=");
      if (eq < 0) continue;
      const key = parts[i].slice(0, eq).trim();
      const val = parts[i].slice(eq + 1).trim();
      data[key] = val;
    }

    if (!data.id) throw new Error("Falta id del quiz.");
    if (!data.part || !/^\d+\/\d+$/.test(data.part)) throw new Error("Falta part tipo 1/2.");
    if (!data.data) throw new Error("Falta data.");

    const [n, total] = data.part.split("/").map(Number);
    if (!Number.isInteger(n) || !Number.isInteger(total) || n < 1 || total < 1 || n > total) {
      throw new Error("Numero de parte invalido.");
    }

    return {
      id: data.id,
      n,
      total,
      sum: data.sum || "",
      data: data.data
    };
  }

  function loadPartState(id) {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_PREFIX + id)) || null;
    } catch {
      return null;
    }
  }

  function savePartState(id, state) {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(state));
  }

  function clearAllParts() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));

    renderParts();
    setStatus("Partes borradas. Puedes volver a escanear.");
  }

  function renderParts(activeId) {
    els.partsBox.innerHTML = "";

    const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));

    if (!keys.length) {
      els.partsBox.innerHTML = '<div class="part-pill">Todavia no hay partes leidas.</div>';
      return;
    }

    keys.forEach((key) => {
      const state = JSON.parse(localStorage.getItem(key));
      const id = key.replace(STORAGE_PREFIX, "");
      const got = Object.keys(state.parts || {}).length;

      const wrap = document.createElement("div");
      wrap.className = "part-pill" + (activeId === id ? " done" : "");
      wrap.textContent = `${id}: ${got}/${state.total} partes leidas`;
      els.partsBox.appendChild(wrap);

      for (let i = 1; i <= state.total; i++) {
        const pill = document.createElement("div");
        pill.className = "part-pill" + (state.parts[i] ? " done" : "");
        pill.textContent = `QR ${i}/${state.total}: ${state.parts[i] ? "listo" : "pendiente"}`;
        els.partsBox.appendChild(pill);
      }
    });
  }

  function validateQuiz(quiz) {
    if (!quiz || typeof quiz !== "object") throw new Error("El quiz no es un objeto valido.");
    if (!Array.isArray(quiz.items) || quiz.items.length === 0) throw new Error("El quiz no tiene items.");

    for (const [idx, item] of quiz.items.entries()) {
      if (item.type !== "abcd") throw new Error(`El item ${idx + 1} no es ABCD.`);
      if (!item.question) throw new Error(`El item ${idx + 1} no tiene pregunta.`);
      if (!Array.isArray(item.options) || item.options.length !== 4) {
        throw new Error(`El item ${idx + 1} debe tener 4 opciones.`);
      }
      if (!Number.isInteger(item.correct) || item.correct < 0 || item.correct > 3) {
        throw new Error(`El item ${idx + 1} tiene correct invalido.`);
      }
    }
  }

  function handleQrText(raw) {
    try {
      const packet = parseKvPayload(raw);
      const previous = loadPartState(packet.id);
      const state = previous || {
        id: packet.id,
        total: packet.total,
        sum: packet.sum,
        parts: {}
      };

      if (state.total !== packet.total) throw new Error("Ese id ya existe con otro total de partes.");
      if (state.sum && packet.sum && state.sum !== packet.sum) throw new Error("Ese id ya existe con otro checksum.");

      state.parts[packet.n] = packet.data;
      state.sum = packet.sum || state.sum;

      savePartState(packet.id, state);
      renderParts(packet.id);

      const count = Object.keys(state.parts).length;

      if (count < state.total) {
        setStatus(
          `<strong>Este quiz requiere ${state.total} QR.</strong><br>` +
          `QR ${packet.n}/${state.total} leido. Faltan ${state.total - count}.`,
          "ok"
        );
        return;
      }

      let joined = "";
      for (let i = 1; i <= state.total; i++) {
        if (!state.parts[i]) throw new Error(`Falta la parte ${i}/${state.total}.`);
        joined += state.parts[i];
      }

      const jsonText = base64UrlToText(joined);

      if (state.sum) {
        const got = fnv1aHex(jsonText);
        if (got !== state.sum) {
          throw new Error(`Checksum no coincide. Esperado ${state.sum}, obtenido ${got}.`);
        }
      }

      const quiz = JSON.parse(jsonText);
      validateQuiz(quiz);

      localStorage.removeItem(STORAGE_PREFIX + packet.id);
      renderParts();
      setStatus(`<strong>Quiz completo:</strong> ${escapeHtml(quiz.title || packet.id)}. Iniciando...`, "ok");
      startQuiz(quiz);
    } catch (err) {
      setStatus(`<strong>Error:</strong> ${escapeHtml(err.message)}`, "warning");
    }
  }

  async function refreshCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");

      els.cameraSelect.innerHTML = "";
      const auto = document.createElement("option");
      auto.value = "";
      auto.textContent = "Camara automatica / trasera";
      els.cameraSelect.appendChild(auto);

      cams.forEach((cam, idx) => {
        const opt = document.createElement("option");
        opt.value = cam.deviceId;
        opt.textContent = cam.label || `Camara ${idx + 1}`;
        els.cameraSelect.appendChild(opt);
      });

      showDiagnostic(`camaras detectadas: ${cams.length}`);
    } catch (err) {
      showDiagnostic(`enumerateDevices error: ${err.name} ${err.message}`);
    }
  }

  async function tryOpenCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Este navegador no permite navigator.mediaDevices.getUserMedia.");
    }

    const selectedId = els.cameraSelect.value;

    const attempts = selectedId ? [
      { audio: false, video: { deviceId: { exact: selectedId }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { audio: false, video: { deviceId: selectedId } },
      { audio: false, video: true }
    ] : [
      { audio: false, video: { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { audio: false, video: { facingMode: "environment" } },
      { audio: false, video: true }
    ];

    let lastErr = null;

    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastErr = err;

        if (err.name === "NotAllowedError" || /denied|permission/i.test(err.message || "")) {
          throw err;
        }
      }
    }

    throw lastErr || new Error("No se pudo abrir camara.");
  }

  async function testPermission() {
    showDiagnostic("probando permiso...");
    try {
      const permBefore = await getCameraPermissionState();
      const temp = await tryOpenCamera();
      temp.getTracks().forEach((t) => t.stop());
      await refreshCameras();
      const permAfter = await getCameraPermissionState();

      setStatus(
        `<strong>Permiso OK.</strong> Estado antes: <code>${permBefore}</code>. ` +
        `Estado despues: <code>${permAfter}</code>. Ahora toca Escanear QR.`,
        "ok"
      );
    } catch (err) {
      const perm = await getCameraPermissionState();
      showDiagnostic(`permission state: ${perm}\nerror: ${err.name} ${err.message}`);
      setStatus(explainCameraError(err), "warning");
    }
  }

  async function setupNativeDetector() {
    if (!("BarcodeDetector" in window)) return false;

    const supported = await BarcodeDetector.getSupportedFormats().catch(() => []);
    if (supported.length && !supported.includes("qr_code")) return false;

    detector = new BarcodeDetector({ formats: ["qr_code"] });
    return true;
  }

  async function startNativeScanner() {
    try {
      stopScanner();

      if (!window.isSecureContext) {
        setStatus(
          `<strong>Aviso:</strong> el origen no es seguro. Intentare abrir la camara, ` +
          `pero si falla, sube esto a GitHub Pages o usa localhost.`,
          "warning"
        );
      }

      const okDetector = await setupNativeDetector();
      if (!okDetector) {
        setStatus(
          `<strong>El detector nativo QR no esta disponible.</strong><br>` +
          `Toca "Lector alternativo online" para cargar html5-qrcode desde CDN.`,
          "warning"
        );
        return;
      }

      stream = await tryOpenCamera();
      els.html5qrReader.classList.add("hidden");
      els.video.classList.remove("hidden");
      els.scanOverlay.classList.remove("hidden");
      els.video.srcObject = stream;
      await els.video.play();
      await refreshCameras();

      scanning = true;
      setStatus("Camara activa con lector nativo. Apunta al QR.", "ok");
      scanLoop();
    } catch (err) {
      const perm = await getCameraPermissionState();
      showDiagnostic(`permission state: ${perm}\nerror: ${err.name} ${err.message}`);
      setStatus(explainCameraError(err), "warning");
    }
  }

  async function scanLoop() {
    if (!scanning || !detector) return;

    try {
      if (els.video.readyState >= 2) {
        const codes = await detector.detect(els.video);
        const now = Date.now();

        for (const code of codes) {
          const raw = code.rawValue || "";
          if (raw && (raw !== lastScan || now - lastScanAt > 1500)) {
            lastScan = raw;
            lastScanAt = now;
            handleQrText(raw);
          }
        }
      }
    } catch (err) {
      setStatus(`<strong>Error leyendo QR:</strong> ${escapeHtml(err.message)}`, "warning");
    }

    requestAnimationFrame(scanLoop);
  }

  function loadScriptOnce(src, globalName) {
    return new Promise((resolve, reject) => {
      if (globalName && window[globalName]) {
        resolve(window[globalName]);
        return;
      }

      const existing = document.querySelector(`script[data-dynamic-src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", () => resolve(globalName ? window[globalName] : true), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.dynamicSrc = src;
      script.onload = () => resolve(globalName ? window[globalName] : true);
      script.onerror = () => reject(new Error("No se pudo cargar " + src));
      document.head.appendChild(script);
    });
  }

  async function startAlternativeScanner() {
    try {
      stopScanner();

      if (!window.isSecureContext) {
        setStatus(
          `<strong>Aviso:</strong> el origen no es seguro. El lector alternativo tambien necesita permiso de camara.`,
          "warning"
        );
      }

      setStatus("Cargando lector alternativo html5-qrcode desde CDN...");
      await loadScriptOnce(CDN_HTML5_QRCODE, "Html5Qrcode");

      if (!window.Html5Qrcode) {
        throw new Error("La libreria html5-qrcode no quedo disponible.");
      }

      els.video.classList.add("hidden");
      els.html5qrReader.classList.remove("hidden");
      els.scanOverlay.classList.add("hidden");

      html5QrCode = new Html5Qrcode("html5qrReader", false);

      const selectedId = els.cameraSelect.value;
      const cameraConfig = selectedId
        ? { deviceId: { exact: selectedId } }
        : { facingMode: "environment" };

      await html5QrCode.start(
        cameraConfig,
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
            return { width: size, height: size };
          },
          aspectRatio: 1.7777778
        },
        (decodedText) => {
          const now = Date.now();
          if (decodedText && (decodedText !== lastScan || now - lastScanAt > 1500)) {
            lastScan = decodedText;
            lastScanAt = now;
            handleQrText(decodedText);
          }
        },
        () => {}
      );

      html5Active = true;
      await refreshCameras();
      setStatus("Camara activa con lector alternativo. Apunta al QR.", "ok");
    } catch (err) {
      const perm = await getCameraPermissionState();
      showDiagnostic(`permission state: ${perm}\nerror: ${err.name || "Error"} ${err.message || err}`);
      setStatus(explainCameraError(err), "warning");
    }
  }

  function stopScanner() {
    scanning = false;

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }

    els.video.srcObject = null;

    if (html5QrCode && html5Active) {
      html5QrCode.stop()
        .then(() => html5QrCode.clear())
        .catch(() => {})
        .finally(() => {
          html5Active = false;
          html5QrCode = null;
        });
    }

    els.video.classList.remove("hidden");
    els.html5qrReader.classList.add("hidden");
    els.scanOverlay.classList.remove("hidden");
  }

  function startQuiz(quiz) {
    stopScanner();

    currentQuiz = quiz;
    currentIndex = 0;
    score = 0;

    els.scannerCard.classList.add("hidden");
    els.quizCard.classList.remove("hidden");
    els.finishBox.classList.add("hidden");
    els.againBtn.classList.add("hidden");

    showQuestion();
  }

  function showQuestion() {
    clearInterval(timerId);
    locked = false;

    const item = currentQuiz.items[currentIndex];

    els.quizTitle.textContent = currentQuiz.title || "Quiz QR";
    els.quizDesc.textContent = currentQuiz.description || "ABCD leido desde QR";
    els.progress.textContent = `Item ${currentIndex + 1}/${currentQuiz.items.length}`;
    els.questionText.textContent = item.question;
    els.questionMeta.textContent = `Tipo ABCD · ${item.points || 1000} puntos`;
    els.feedback.className = "feedback hidden";
    els.nextBtn.classList.add("hidden");
    els.finishBox.classList.add("hidden");
    els.options.innerHTML = "";

    item.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.className = "option";
      btn.textContent = `${"ABCD"[idx]}. ${opt}`;
      btn.onclick = () => answer(idx);
      els.options.appendChild(btn);
    });

    timeLeft = Number(item.timeLimit || currentQuiz.timeLimit || 30);
    els.timer.textContent = timeLeft;
    els.timer.classList.toggle("danger", timeLeft <= 10);

    timerId = setInterval(() => {
      timeLeft--;
      els.timer.textContent = Math.max(0, timeLeft);
      els.timer.classList.toggle("danger", timeLeft <= 10);

      if (timeLeft <= 0) {
        clearInterval(timerId);
        answer(null, true);
      }
    }, 1000);
  }

  function answer(selected, timeout = false) {
    if (locked) return;
    locked = true;
    clearInterval(timerId);
    els.timer.classList.remove("danger");

    const item = currentQuiz.items[currentIndex];
    const correct = selected === item.correct;
    const buttons = Array.from(els.options.children);

    buttons.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === item.correct) btn.classList.add("correct");
      if (selected === idx && !correct) btn.classList.add("wrong");
    });

    if (correct) {
      score++;
      els.feedback.textContent = "¡Correcto!";
      els.feedback.className = "feedback ok";
    } else if (timeout) {
      els.feedback.textContent = `¡Tiempo! La respuesta era ${"ABCD"[item.correct]}.`;
      els.feedback.className = "feedback bad";
    } else {
      els.feedback.textContent = `Incorrecto. La respuesta era ${"ABCD"[item.correct]}.`;
      els.feedback.className = "feedback bad";
    }

    els.nextBtn.textContent = currentIndex < currentQuiz.items.length - 1 ? "Siguiente" : "Ver resultado";
    els.nextBtn.classList.remove("hidden");
  }

  function next() {
    if (currentIndex < currentQuiz.items.length - 1) {
      currentIndex++;
      showQuestion();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    clearInterval(timerId);
    els.options.innerHTML = "";
    els.feedback.className = "feedback hidden";
    els.nextBtn.classList.add("hidden");
    els.questionText.textContent = "Resultado";
    els.questionMeta.textContent = "Quiz terminado";
    els.progress.textContent = "Final";
    els.timer.textContent = "✓";
    els.timer.classList.remove("danger");

    const total = currentQuiz.items.length;
    const pct = Math.round((score / total) * 100);

    els.finishBox.innerHTML = `<strong>${score}/${total}</strong><p>${pct}% de aciertos</p>`;
    els.finishBox.classList.remove("hidden");
    els.againBtn.classList.remove("hidden");
  }

  function backToScanner() {
    currentQuiz = null;
    els.quizCard.classList.add("hidden");
    els.scannerCard.classList.remove("hidden");
    renderParts();
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js")
        .then(() => showDiagnostic("service worker registrado"))
        .catch((err) => showDiagnostic("service worker error: " + err.message));
    });
  }

  els.startBtn.addEventListener("click", startNativeScanner);
  els.altReaderBtn.addEventListener("click", startAlternativeScanner);
  els.permissionBtn.addEventListener("click", testPermission);
  els.stopBtn.addEventListener("click", stopScanner);
  els.resetBtn.addEventListener("click", clearAllParts);
  els.refreshCamerasBtn.addEventListener("click", refreshCameras);
  els.manualBtn.addEventListener("click", () => handleQrText(els.manualInput.value));
  els.demo1Btn.addEventListener("click", () => {
    els.manualInput.value = DEMO_QR_PARTS[0];
    handleQrText(DEMO_QR_PARTS[0]);
  });
  els.demo2Btn.addEventListener("click", () => {
    els.manualInput.value = DEMO_QR_PARTS[1];
    handleQrText(DEMO_QR_PARTS[1]);
  });
  els.nextBtn.addEventListener("click", next);
  els.againBtn.addEventListener("click", backToScanner);

  showDiagnostic();
  renderParts();
  refreshCameras();
  registerServiceWorker();
})();
