const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');

const app = express();
const port = 3000;

// Set up middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/models', express.static(path.join(__dirname, 'models')));

// Spotify credentials: you can hardcode your client id/secret here
// Replace the placeholder strings below with your actual credentials
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '0b7cdbcd9614456798ab1816a2490600';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || 'be4004a751514627bb4e24eacee2980f';

const spotifyApi = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
});

if (SPOTIFY_CLIENT_ID.startsWith('YOUR_') || SPOTIFY_CLIENT_SECRET.startsWith('YOUR_')) {
  console.warn('Warning: Spotify client ID/secret are using placeholder values in server.js. Replace them with real credentials.');
}

async function spotifyAuth() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('Spotify access token acquired');
    // Refresh token shortly before expiry
    setTimeout(spotifyAuth, (data.body['expires_in'] - 60) * 1000);
  } catch (err) {
    console.error('Failed to get Spotify access token', err.message || err);
  }
}

spotifyAuth();


// Route to get all music tracks
app.get('/', async (req, res) => {
  try {
    // Default: fetch some popular tracks (search by keyword)
    const result = await spotifyApi.searchTracks('pop', { limit: 20 });
    const musicTracks = result.body.tracks.items.map(t => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      preview_url: t.preview_url,
      spotify_url: t.external_urls && t.external_urls.spotify,
    }));
    res.render('index', { musicTracks });
  } catch (err) {
    res.status(500).send('Error fetching music tracks.');
  }
});

// Route to stream the music
app.get('/music/:id', async (req, res) => {
  try {
    const trackId = req.params.id;
    const data = await spotifyApi.getTrack(trackId);
    const track = data.body;
    if (track.preview_url) {
      // Redirect to preview URL (Spotify CDN)
      return res.redirect(track.preview_url);
    }
    // If no preview available, redirect to Spotify track page
    if (track.external_urls && track.external_urls.spotify) {
      return res.redirect(track.external_urls.spotify);
    }
    res.status(404).send('Track preview not available');
  } catch (err) {
    res.status(500).send('Error fetching track from Spotify.');
  }
});

app.get('/photo', (req, res) => {
  res.render('photo'); // Renders the capture.ejs view
});

app.post('/analyzeEmotion', async (req, res) => {
  try {
    const { emotion } = req.body; // Get the emotion from req.body

    // Select appropriate genre based on the detected emotion
    let genre;
    switch (emotion) {
      case 'happy':
        genre = 'Rock';
        break;
      case 'neutral':
        genre = 'Pop';
        break;
      case 'angry':
        genre = 'Rock';
        break;
      case 'sad':
        genre = 'Blues';
        break;
      default:
        genre = 'Pop'; // Default genre
        break;
    }

    // Fetch suggested songs from Spotify based on genre keyword
    const q = genre || 'pop';
    const results = await spotifyApi.searchTracks(q, { limit: 12 });
    const suggestedSongs = results.body.tracks.items.map(t => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      preview_url: t.preview_url,
      spotify_url: t.external_urls && t.external_urls.spotify,
    }));
    res.json(suggestedSongs);
  } catch (err) {
    res.status(500).send('Error analyzing emotion.');
  }
});
// No DB connection required; using Spotify API instead

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

