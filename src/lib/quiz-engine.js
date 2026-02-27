/**
 * Quiz Engine - Client-side logica voor het vlaggen-quizspel.
 * Object-georiënteerd ontwerp met gescheiden verantwoordelijkheden.
 */

/** Hoeveel vragen per ronde */
const QUESTIONS_PER_ROUND = 10;
/** Hoeveel antwoordopties per vraag */
const OPTIONS_COUNT = 4;

/**
 * Shuffle een array in-place (Fisher-Yates).
 * @param {any[]} array
 * @returns {any[]}
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Representeert een enkele quizvraag met correct antwoord en afleiders.
 */
export class Question {
  /**
   * @param {object} country - Het land dat geraden moet worden
   * @param {object[]} options - Alle antwoordopties (inclusief correct)
   */
  constructor(country, options) {
    this.country = country;
    this.options = options;
    this.correctCode = country.code;
  }

  /** Controleer of het gegeven antwoord correct is */
  isCorrect(selectedCode) {
    return selectedCode === this.correctCode;
  }
}

/**
 * Genereert quizvragen op basis van een pool van landen.
 */
export class QuestionGenerator {
  /**
   * Genereer een set vragen.
   * @param {object[]} pool - Beschikbare landen
   * @param {number} count - Aantal vragen
   * @returns {Question[]}
   */
  static generate(pool, count = QUESTIONS_PER_ROUND) {
    const shuffled = shuffle([...pool]);
    const selected = shuffled.slice(0, count);

    return selected.map((country) => {
      const distractors = shuffle(
        pool.filter((c) => c.code !== country.code)
      ).slice(0, OPTIONS_COUNT - 1);

      const options = shuffle([country, ...distractors]);
      return new Question(country, options);
    });
  }
}

/**
 * Beheert de spelstatus: score, huidige vraag, voortgang.
 */
export class QuizGame {
  /**
   * @param {object[]} allCountries - Volledige lijst van landen
   */
  constructor(allCountries) {
    this.allCountries = allCountries;
    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.answered = false;
  }

  /**
   * Start een nieuw spel, optioneel gefilterd op continent.
   * @param {string|null} continent - Continentnaam of null/\"all\" voor alles
   */
  start(continent = null) {
    const pool =
      continent && continent !== "all"
        ? this.allCountries.filter((c) => c.continent === continent)
        : [...this.allCountries];

    if (pool.length < OPTIONS_COUNT) {
      throw new Error(
        `Te weinig landen (${pool.length}) voor continent "${continent}"`
      );
    }

    this.questions = QuestionGenerator.generate(pool);
    this.currentIndex = 0;
    this.score = 0;
    this.answered = false;
  }

  /** Haal de huidige vraag op, of null als het spel voorbij is */
  get currentQuestion() {
    if (this.currentIndex >= this.questions.length) return null;
    return this.questions[this.currentIndex];
  }

  /** Huidige vraagnummer (1-based) */
  get questionNumber() {
    return this.currentIndex + 1;
  }

  /** Totaal aantal vragen in deze ronde */
  get totalQuestions() {
    return this.questions.length;
  }

  /** Is het spel voorbij? */
  get isGameOver() {
    return this.currentIndex >= this.questions.length;
  }

  /** Alle unieke continenten (zonder Antarctica) */
  get continents() {
    return [...new Set(this.allCountries.map((c) => c.continent))]
      .filter((c) => c !== "Antarctica")
      .sort();
  }

  /**
   * Verwerk een gegeven antwoord.
   * @param {string} selectedCode - De code van het gekozen land
   * @returns {{ correct: boolean, correctCode: string } | null}
   */
  submitAnswer(selectedCode) {
    if (this.answered) return null;
    this.answered = true;

    const question = this.questions[this.currentIndex];
    const correct = question.isCorrect(selectedCode);
    if (correct) this.score++;

    return { correct, correctCode: question.correctCode };
  }

  /**
   * Ga naar de volgende vraag.
   * @returns {boolean} true als er nog een vraag is
   */
  nextQuestion() {
    this.currentIndex++;
    this.answered = false;
    return !this.isGameOver;
  }
}

/**
 * Beheert alle audio: geluidseffecten en landnaam-uitspraak.
 */
export class AudioManager {
  constructor() {
    this.currentAudio = null;

    /** Paden naar geluidseffecten */
    this.sounds = {
      success: "/sounds/success_sound.mp3",
      error: "/sounds/error_sound.mp3",
      complete: "/sounds/mission_complete_sound.mp3",
    };
  }

  /** Stop huidige audio */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  /**
   * Speel een audiobestand af.
   * @param {string} src - Pad naar het audiobestand
   * @param {number} volume - Volume (0-1)
   */
  play(src, volume = 0.5) {
    this.stop();
    try {
      const audio = new Audio(src);
      audio.volume = volume;
      this.currentAudio = audio;
      audio.play().catch(() => {});
    } catch {
      // Audio niet beschikbaar
    }
  }

  /**
   * Speel een geluidseffect af.
   * @param {'success' | 'error' | 'complete'} type
   */
  playSound(type) {
    const src = this.sounds[type];
    if (src) this.play(src, 0.5);
  }

  /**
   * Speel de landnaam-uitspraak af.
   * @param {string} code - Alpha-2 landcode (lowercase)
   */
  playCountryName(code) {
    this.play(`/audio/${code.toUpperCase()}.mp3`, 0.7);
  }
}
