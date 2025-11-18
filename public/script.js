const video = document.getElementById('video');

async function loadModels() {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models')
  ]);
}
async function startVideo() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
    await new Promise((resolve) => (video.onloadedmetadata = resolve));
    await video.play();
    return stream;
  } catch (err) {
    console.error('Could not start video', err);
    throw err;
  }
}

function stopVideo(stream) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
}

// Analyze for a short period (ms) and return the computed dominant emotion
async function analyzeForDuration(ms = 3000) {
  const stream = await startVideo();

  // Create overlay canvas
  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);
<<<<<<< Updated upstream
  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors()
      .withFaceExpressions();
    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resizedDetections);
    faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
    faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

    // Analyze the dominant emotion
    let dominantEmotion = '';
    let highestProbability = 0;
    for (const expression in detections[0].expressions) {
      if (detections[0].expressions[expression] > highestProbability) {
        dominantEmotion = expression;
        highestProbability = detections[0].expressions[expression];
      }
    }
  
    // Send the dominant emotion to the server
    fetch('/analyzeEmotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emotion: dominantEmotion }),
    })
    .then(response => response.json())
    .then(suggestedSongs => {
      // Update the suggested songs section in the HTML
      const suggestedSongsList = document.getElementById('suggested-songs');
      const songsHTML = suggestedSongs.map(song => `
        <li>
          <h3>${song.title}</h3>
          <p>Artist: ${song.artist}</p>
          <p>Genre: ${song.genre}</p>
          <audio controls>
            <source src="/music/${song._id}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
        </li>
      `).join('');
      suggestedSongsList.querySelector('ul').innerHTML = songsHTML;
    });
  }, 100);
}

=======
  canvas.style.position = 'absolute';
  canvas.style.zIndex = 1000;

  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);

  const samples = [];

  const interval = 250; // sample every 250ms
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 160 });

  return new Promise((resolve) => {
    const timer = setInterval(async () => {
      try {
        const detections = await faceapi
          .detectAllFaces(video, detectorOptions)
          .withFaceLandmarks()
          .withFaceExpressions();

        const resized = faceapi.resizeResults(detections, displaySize);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (resized.length) {
          const det = resized[0];
          const box = det.detection.box;
          ctx.beginPath();
          ctx.rect(box.x, box.y, box.width, box.height);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#00FF88';
          ctx.stroke();

          const emotions = det.expressions;
          const dominant = Object.keys(emotions).reduce((a, b) => (emotions[a] > emotions[b] ? a : b));
          const confidence = emotions[dominant];
          samples.push({ emotion: dominant, confidence });

          // draw label
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(box.x, box.y - 28, box.width, 24);
          ctx.fillStyle = 'white';
          ctx.font = '16px sans-serif';
          ctx.fillText(`${dominant} (${confidence.toFixed(2)})`, box.x + 6, box.y - 8);
        }
      } catch (err) {
        console.error('detect error', err);
      }
    }, interval);

    // Stop after ms
    setTimeout(() => {
      clearInterval(timer);
      // compute weighted scores
      const scores = {};
      for (const s of samples) {
        scores[s.emotion] = (scores[s.emotion] || 0) + s.confidence;
      }
      // get highest
      const finalEmotion = Object.keys(scores).length ? Object.keys(scores).reduce((a, b) => (scores[a] > scores[b] ? a : b)) : null;

      // cleanup
      stopVideo(stream);
      canvas.remove();

      resolve(finalEmotion);
    }, ms);
  });
}

function renderSuggested(songs) {
  const container = document.getElementById('suggested-songs');
  const list = container.querySelector('ul');
  if (!songs || !songs.length) {
    list.innerHTML = '<li>No suggestions found</li>';
    return;
  }
  const html = songs
    .map((s) => {
      const title = s.title || 'Untitled';
      const artist = s.artist || '';
      if (s.preview_url) {
        return `
          <li>
            <strong>${title}</strong><br>
            <small>${artist}</small>
            <audio controls src="${s.preview_url}"></audio>
            <button class="play-btn" data-preview="${s.preview_url}">Play</button>
          </li>`;
      }
      // fallback to server redirect which will open preview or spotify page
      if (s.id) {
        return `
          <li>
            <strong>${title}</strong><br>
            <small>${artist}</small>
            <a href="/music/${s.id}" target="_blank">Open on Spotify</a>
            <button class="open-btn" data-id="${s.id}">Open / Play</button>
          </li>`;
      }
      return `
        <li>
          <strong>${title}</strong><br>
          <small>${artist}</small>
        </li>`;
    })
    .join('');
  list.innerHTML = html;
  // Attach behavior: play first audio automatically (caller click counts as user gesture)
  const firstAudio = list.querySelector('audio');
  if (firstAudio) {
    firstAudio.play().catch(() => {
      // Autoplay may be blocked; leave controls for user
    });
  }

  // Attach play button handlers
  list.querySelectorAll('.play-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const preview = btn.getAttribute('data-preview');
      // create or reuse audio element
      let a = btn.previousElementSibling;
      if (!a || a.tagName !== 'AUDIO') {
        a = document.createElement('audio');
        a.controls = true;
        a.src = preview;
        btn.parentNode.insertBefore(a, btn);
      }
      a.play().catch(() => {});
    });
  });

  list.querySelectorAll('.open-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      // open in new tab which will redirect to preview or spotify
      window.open(`/music/${id}`, '_blank');
    });
  });
}

async function initUI() {
  const analyzeBtn = document.getElementById('analyze-button');
  analyzeBtn.addEventListener('click', async () => {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    try {
      const emotion = await analyzeForDuration(3000); // 3 seconds
      if (!emotion) {
        alert('No face detected. Try again.');
      } else {
        // send to server
        const resp = await fetch('/analyzeEmotion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emotion }),
        });
        const suggested = await resp.json();
        renderSuggested(suggested);
      }
    } catch (err) {
      console.error(err);
      alert('Error during analysis. See console.');
    }
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze Emotion (3s)';
  });
}

// Initialize models and UI only; camera will start on button click
>>>>>>> Stashed changes
async function setup() {
  await loadModels();
  await initUI();
}

setup();
