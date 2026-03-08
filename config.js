// config.js - ALL EDITABLE SETTINGS FOR SCREAM RUNNER
// Edit this file to customize game behavior, audio sensitivity, and integrations.

const GAME_CONFIG = {

  // ─── Audio Settings ──────────────────────────────────────────────────────────
  AUDIO: {
    SAMPLE_RATE: 44100,
    FFT_SIZE: 2048,
    SMOOTHING_TIME_CONSTANT: 0.8,
    MIN_DECIBELS: -90,
    MAX_DECIBELS: -10,
    NOISE_FLOOR_DB: 30,        // Anything below this is silence
    SCREAM_THRESHOLD_DB: 45,   // Must exceed this to move (post-calibration)
    VOLUME_MULTIPLIER: 0.55,   // speed = (dB - threshold) * multiplier
    MAX_SPEED: 120,            // km/h cap
    DECAY_RATE: 3.5,           // Speed loss per second when silent
    CALIBRATION_DURATION: 3000, // ms to sample ambient noise during calibration
    PEAK_HOLD_MS: 1500,        // How long the peak indicator stays visible
  },

  // ─── Game Settings ────────────────────────────────────────────────────────────
  GAME: {
    TARGET_FPS: 60,
    DISTANCE_MULTIPLIER: 1.0,      // Scale total distance
    SESSION_TIMEOUT_MS: 8000,      // Auto-end after X ms of silence while running
    GROUND_SPEED_RATIO: 0.003,     // pixels scrolled per km/h per frame
    OBSTACLE_START_DISTANCE: 10,  // meters before first obstacle appears
    OBSTACLE_INTERVAL_MIN: 10,     // min meters between obstacles
    OBSTACLE_INTERVAL_MAX: 40,    // max meters between obstacles
    PARTICLE_COUNT: 40,            // max dust particles
  },

  // ─── Discord Integration ──────────────────────────────────────────────────────
  DISCORD: {
    WEBHOOK_URL: 'https://discord.com/api/webhooks/1344778308352479394/1bEeWcf2wTGgunnwnrRnfYn3LZvFVYydnR8Zm191z9l5UMFyjRntLV8ZJEsIINSk5U9n',
    ENABLED: true,                // Set true + fill URL to activate
    MIN_DISTANCE_TO_POST: 3,      // Only post if distance > this many metres
    EMBED_COLOR: 0xFF6B6B,         // Decimal int for embed sidebar colour
    BOT_USERNAME: 'Scream Runner Bot',
    COOLDOWN_MS: 5000,             // Min ms between webhook calls (throttle)
  },

  // ─── Visual Settings ──────────────────────────────────────────────────────────
  VISUAL: {
    SOUND_BAR_THRESHOLDS: {
      LOW_MAX: 60,    // dB ─ below this → LOW colour
      MED_MAX: 75,    // dB ─ between LOW_MAX and this → MEDIUM colour
    },
    SOUND_BAR_COLORS: {
      LOW: '#4ECDC4',
      MEDIUM: '#FFE66D',
      HIGH: '#FF6B6B',
    },
    BACKGROUND_SCROLL_SPEED: 1.0,
    PARTICLE_EFFECTS: true,
    SHOW_DEBUG_OVERLAY: false,    // Mirrors DEBUG flag below
    RUNNER_SPRITE_FRAMES: 8,      // frames in the sprite sheet strip
  },

  // ─── Leaderboard / Stats ──────────────────────────────────────────────────────
  STATS: {
    MAX_STORED_RUNS: 50,      // Per-character run history limit
    TOP_SCORES_SHOWN: 10,     // Rows shown in personal records table
  },

  // ─── Localization ─────────────────────────────────────────────────────────────
  DEFAULT_LANG: 'RO',

  LANGUAGES: {
    EN: {
      // Start screen
      START_BUTTON: 'PRESS TO START',
      // Intro modal
      INTRO_TITLE: 'Release Your Energy',
      INTRO_TEXT: 'Everyone needs a moment of release. Take this game as one — scream as loud as you can to achieve the best distance. The longer you scream, the farther you go. The louder you scream, the faster you go.',
      INTRO_BEGIN: 'Begin Screaming',
      // HUD
      SPEED_LABEL: 'Speed',
      DISTANCE_LABEL: 'Distance',
      DB_LABEL: 'dB Level',
      // Game over
      GAME_OVER: 'Game Over',
      BEST_SCORE: 'Best Score',
      SCREAM_AGAIN: 'Scream Again',
      SAVE_SCORE: 'Save to Leaderboard',
      MAX_SPEED_LABEL: 'Max Speed',
      AVG_DB_LABEL: 'Avg Volume',
      SESSION_TIME_LABEL: 'Scream Time',
      // Character
      CHARACTER_SELECT: 'Choose Character',
      CREATE_CHARACTER: 'Create New Character',
      ENTER_NAME: 'Enter character name…',
      CREATE_BTN: 'Create',
      // Stats page
      STATS_TITLE: 'Your Statistics',
      PERSONAL_RECORDS: 'Personal Records',
      RECENT_RUNS: 'Recent Runs',
      TOTAL_SCREAMS: 'Total Sessions',
      TOTAL_DISTANCE: 'Total Distance',
      TOTAL_TIME: 'Total Scream Time',
      NO_DATA: 'No data yet — scream something!',
      // Settings
      SETTINGS: 'Settings',
      LANGUAGE: 'Language',
      WEBHOOK_URL: 'Discord Webhook URL',
      DISCORD_ENABLED: 'Discord Posting',
      CALIBRATE_BTN: 'Calibrate Microphone',
      CALIBRATING: 'Calibrating… keep quiet',
      CALIBRATION_DONE: 'Calibration complete!',
      // Mic
      MICROPHONE_ACCESS: 'Microphone Access Required',
      MIC_DENIED: 'Microphone access was denied. Please allow mic access in your browser settings.',
      MIC_PROMPT: 'Click below to allow microphone access.',
      ALLOW_MIC: 'Allow Microphone',
      // Misc
      METERS_UNIT: 'm',
      KMH_UNIT: 'km/h',
      SECONDS_UNIT: 's',
      HOME: 'Home',
      BACK: 'Back',
      CLOSE: 'Close',
    },
    RO: {
      // Start screen
      START_BUTTON: 'APASĂ PENTRU START',
      // Intro modal
      INTRO_TITLE: 'Eliberează-ți Energia',
      INTRO_TEXT: 'Toată lumea are nevoie de un moment de eliberare. Ia acest joc ca pe unul — țipă cât poți de tare pentru a obține cea mai mare distanță. Cu cât țipi mai mult, cu atât mergi mai departe. Cu cât țipi mai tare, cu atât mergi mai repede.',
      INTRO_BEGIN: 'Începe să Țipi',
      // HUD
      SPEED_LABEL: 'Viteză',
      DISTANCE_LABEL: 'Distanță',
      DB_LABEL: 'Nivel dB',
      // Game over
      GAME_OVER: 'Joc Terminat',
      BEST_SCORE: 'Cel Mai Bun Scor',
      SCREAM_AGAIN: 'Țipă Din Nou',
      SAVE_SCORE: 'Salvează în Clasament',
      MAX_SPEED_LABEL: 'Viteză Maximă',
      AVG_DB_LABEL: 'Volum Mediu',
      SESSION_TIME_LABEL: 'Timp Țipat',
      // Character
      CHARACTER_SELECT: 'Alege Personajul',
      CREATE_CHARACTER: 'Creează Personaj Nou',
      ENTER_NAME: 'Introdu numele personajului…',
      CREATE_BTN: 'Creează',
      // Stats page
      STATS_TITLE: 'Statisticile Tale',
      PERSONAL_RECORDS: 'Recorduri Personale',
      RECENT_RUNS: 'Rulări Recente',
      TOTAL_SCREAMS: 'Total Sesiuni',
      TOTAL_DISTANCE: 'Total Distanță',
      TOTAL_TIME: 'Total Timp Țipat',
      NO_DATA: 'Nicio dată — țipă ceva!',
      // Settings
      SETTINGS: 'Setări',
      LANGUAGE: 'Limbă',
      WEBHOOK_URL: 'URL Webhook Discord',
      DISCORD_ENABLED: 'Postare Discord',
      CALIBRATE_BTN: 'Calibrează Microfonul',
      CALIBRATING: 'Calibrare… stai liniștit',
      CALIBRATION_DONE: 'Calibrare completă!',
      // Mic
      MICROPHONE_ACCESS: 'Acces la Microfon Necesar',
      MIC_DENIED: 'Accesul la microfon a fost refuzat. Permite accesul la microfon în setările browserului tău.',
      MIC_PROMPT: 'Apasă mai jos pentru a permite accesul la microfon.',
      ALLOW_MIC: 'Permite Microfonul',
      // Misc
      METERS_UNIT: 'm',
      KMH_UNIT: 'km/h',
      SECONDS_UNIT: 's',
      HOME: 'Acasă',
      BACK: 'Înapoi',
      CLOSE: 'Închide',
    },
  },

  // ─── Debug ────────────────────────────────────────────────────────────────────
  DEBUG: false,
};
