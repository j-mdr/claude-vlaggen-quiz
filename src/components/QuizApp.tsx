import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { QuizGame, AudioManager } from "../lib/quiz-engine.js";
import countriesData from "../data/countries.json";

/** Nederlandse labels voor continenten */
const CONTINENT_LABELS: Record<string, string> = {
  Africa: "Afrika",
  Asia: "Azië",
  Europe: "Europa",
  "North America": "Noord-Amerika",
  Oceania: "Oceanië",
  "South America": "Zuid-Amerika",
};

/** Delay in ms voordat automatisch naar volgende vraag wordt gegaan */
const AUTO_ADVANCE_MS = 2500;

// ─── Subcomponenten ─────────────────────────────────────────────

/** Scorebord met voortgangsbalk */
function ScoreBoard({
  score,
  questionNumber,
  total,
}: {
  score: number;
  questionNumber: number;
  total: number;
}) {
  const progress = ((questionNumber - 1) / total) * 100;

  return (
    <div className="flex justify-between items-center gap-4 mb-6 px-4 py-3 bg-surface border border-border rounded-lg max-sm:px-3 max-sm:py-2 max-sm:gap-2">
      <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
        <span className="text-[0.7rem] text-slate-400 uppercase tracking-wide">Score</span>
        <span className="text-base font-bold tabular-nums">{score} / {total}</span>
      </div>
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-[width] duration-400 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
        <span className="text-[0.7rem] text-slate-400 uppercase tracking-wide">Vraag</span>
        <span className="text-base font-bold tabular-nums">{questionNumber} / {total}</span>
      </div>
    </div>
  );
}

/** Toont de landnaam als vraag + audio knop */
function QuestionDisplay({
  name,
  onPlayAudio,
}: {
  name: string;
  onPlayAudio: () => void;
}) {
  return (
    <div className="relative bg-surface border border-border rounded-xl p-6 flex flex-col items-center justify-center min-h-[120px] mb-6 animate-scale-in">
      <p className="text-slate-400 text-sm mb-2">Welke vlag hoort bij</p>
      <h2 className="text-2xl sm:text-3xl font-extrabold text-center leading-tight">{name}</h2>
      <button
        onClick={onPlayAudio}
        className="absolute top-3 right-3 bg-blue-500 hover:bg-blue-600 text-white border-none rounded-full w-9 h-9 flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110"
        title="Luister naar de landnaam"
        aria-label="Speel landnaam af"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      </button>
    </div>
  );
}

/** Vlag-antwoord knop */
function FlagOption({
  code,
  name,
  status,
  disabled,
  onClick,
  index,
}: {
  code: string;
  name: string;
  status: "idle" | "correct" | "wrong" | "dimmed";
  disabled: boolean;
  onClick: () => void;
  index: number;
}) {
  const base =
    "option-btn rounded-xl p-3 cursor-pointer transition-all duration-300 flex items-center justify-center aspect-[3/2]";
  const stateClasses = {
    idle: "bg-surface border-2 border-border hover:bg-surface-hover hover:border-blue-500 hover:-translate-y-0.5",
    correct: "bg-emerald-500/20 border-3 border-emerald-400 ring-2 ring-emerald-400/40 scale-[1.02] shadow-lg shadow-emerald-500/20",
    wrong: "bg-red-500/20 border-3 border-red-400 ring-2 ring-red-400/40 animate-shake",
    dimmed: "bg-surface/50 border-2 border-border opacity-40",
  };

  return (
    <button
      className={`${base} ${stateClasses[status]} disabled:cursor-default`}
      disabled={disabled}
      onClick={onClick}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <img
        src={`/flags/${code}.svg`}
        alt={name}
        className="max-w-full max-h-full rounded-md object-contain"
      />
    </button>
  );
}

/** Grid met 4 vlag-antwoorden */
function AnswerGrid({
  options,
  correctCode,
  selectedCode,
  answered,
  onSelect,
}: {
  options: Array<{ code: string; name: string }>;
  correctCode: string;
  selectedCode: string | null;
  answered: boolean;
  onSelect: (code: string) => void;
}) {
  function getStatus(code: string): "idle" | "correct" | "wrong" | "dimmed" {
    if (!answered) return "idle";
    if (code === correctCode) return "correct";
    if (code === selectedCode) return "wrong";
    return "dimmed";
  }

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      {options.map((opt, i) => (
        <FlagOption
          key={opt.code}
          code={opt.code}
          name={opt.name}
          status={getStatus(opt.code)}
          disabled={answered}
          onClick={() => onSelect(opt.code)}
          index={i}
        />
      ))}
    </div>
  );
}

/** Continent selectie startscherm */
function ContinentSelector({
  continents,
  onSelect,
}: {
  continents: string[];
  onSelect: (continent: string) => void;
}) {
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 bg-gradient-to-br from-blue-500 to-purple-500 bg-clip-text text-transparent">
          Vlaggen Quiz
        </h1>
        <p className="text-slate-400 text-base">Test je kennis van landenvlaggen!</p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        {/* Alle landen knop */}
        <button
          onClick={() => onSelect("all")}
          className="col-span-2 max-sm:col-span-1 bg-gradient-to-br from-blue-500/15 to-purple-500/15 text-slate-100 border-2 border-blue-500 rounded-xl py-4 px-4 text-base font-bold cursor-pointer transition-all duration-200 hover:from-blue-500/25 hover:to-purple-500/25 hover:-translate-y-0.5"
        >
          Alle landen
        </button>

        {continents.map((c) => (
          <button
            key={c}
            onClick={() => onSelect(c)}
            className="bg-surface text-slate-100 border-2 border-border rounded-xl py-4 px-4 text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 hover:bg-surface-hover hover:border-blue-500 hover:-translate-y-0.5"
          >
            {CONTINENT_LABELS[c] || c}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Eindscherm met score */
function GameOver({
  score,
  total,
  onReplay,
  onMenu,
}: {
  score: number;
  total: number;
  onReplay: () => void;
  onMenu: () => void;
}) {
  const pct = Math.round((score / total) * 100);

  let title: string, message: string, emoji: string;
  if (pct === 100) {
    title = "Perfect!";
    message = "Ongelooflijk, alles goed!";
    emoji = "🏆";
  } else if (pct >= 70) {
    title = "Goed gedaan!";
    message = "Je kent je vlaggen goed!";
    emoji = "🎉";
  } else if (pct >= 40) {
    title = "Niet slecht!";
    message = "Er is nog ruimte voor verbetering.";
    emoji = "💪";
  } else {
    title = "Blijf oefenen!";
    message = "Oefening baart kunst!";
    emoji = "📚";
  }

  return (
    <div className="text-center py-8 px-4 animate-slide-up">
      <div className="text-6xl mb-4 animate-pulse-infinite">{emoji}</div>
      <h2 className="text-2xl font-extrabold mb-2">{title}</h2>
      <p className="text-4xl font-extrabold bg-gradient-to-br from-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
        {score} / {total}
      </p>
      <p className="text-slate-400 text-base mb-8">{message}</p>
      <div className="flex flex-col gap-3">
        <button
          onClick={onReplay}
          className="py-3.5 px-6 bg-blue-500 hover:bg-blue-600 text-white border-none rounded-lg text-base font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
        >
          Opnieuw spelen
        </button>
        <button
          onClick={onMenu}
          className="py-3.5 px-6 bg-surface hover:bg-surface-hover text-slate-100 border border-border rounded-lg text-base font-semibold cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
        >
          Ander continent
        </button>
      </div>
    </div>
  );
}

// ─── Voortgangsbalk na beantwoording ────────────────────────────

function AutoAdvanceBar({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div className="w-full h-1 bg-border rounded-full overflow-hidden mb-2">
      <div
        className="h-full bg-blue-500 rounded-full"
        style={{
          animation: `shrink ${AUTO_ADVANCE_MS}ms linear forwards`,
        }}
      />
    </div>
  );
}

// ─── Hoofd quiz component ───────────────────────────────────────

type Screen = "menu" | "quiz" | "gameover";

export default function QuizApp() {
  const gameRef = useRef(new QuizGame(countriesData));
  const audioRef = useRef(new AudioManager());

  const [screen, setScreen] = useState<Screen>("menu");
  const [lastContinent, setLastContinent] = useState<string>("all");

  // Quiz state
  const [questionKey, setQuestionKey] = useState(0); // force re-render per vraag
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [correctCode, setCorrectCode] = useState("");

  // Huidige vraag data
  const [countryName, setCountryName] = useState("");
  const [options, setOptions] = useState<Array<{ code: string; name: string }>>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const continents = useMemo(() => gameRef.current.continents, []);

  /** Sync state vanuit de game engine */
  const syncState = useCallback(() => {
    const game = gameRef.current;
    const q = game.currentQuestion;
    if (!q) return;

    setCountryName(q.country.name);
    setOptions(q.options.map((o: any) => ({ code: o.code, name: o.name })));
    setCorrectCode(q.correctCode);
    setScore(game.score);
    setQuestionNumber(game.questionNumber);
    setTotalQuestions(game.totalQuestions);
    setSelectedCode(null);
    setAnswered(false);
    setQuestionKey((k) => k + 1);
  }, []);

  /** Start een nieuw spel */
  const startGame = useCallback(
    (continent: string) => {
      setLastContinent(continent);
      gameRef.current.start(continent);
      syncState();
      setScreen("quiz");
    },
    [syncState]
  );

  /** Verwerk antwoord */
  const handleAnswer = useCallback(
    (code: string) => {
      if (answered) return;

      const result = gameRef.current.submitAnswer(code);
      if (!result) return;

      setSelectedCode(code);
      setAnswered(true);
      setScore(gameRef.current.score);
      audioRef.current.playSound(result.correct ? "success" : "error");

      // Auto-advance na 2.5 seconden
      timerRef.current = setTimeout(() => {
        const hasMore = gameRef.current.nextQuestion();
        if (hasMore) {
          syncState();
        } else {
          audioRef.current.playSound("complete");
          setScreen("gameover");
        }
      }, AUTO_ADVANCE_MS);
    },
    [answered, syncState]
  );

  /** Speel landnaam audio af */
  const playAudio = useCallback(() => {
    const q = gameRef.current.currentQuestion;
    if (q) audioRef.current.playCountryName(q.country.code);
  }, []);

  // Cleanup timer bij unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ─── Render ─────────────────────────────────────────────────

  if (screen === "menu") {
    return <ContinentSelector continents={continents} onSelect={startGame} />;
  }

  if (screen === "gameover") {
    return (
      <GameOver
        score={score}
        total={totalQuestions}
        onReplay={() => startGame(lastContinent)}
        onMenu={() => setScreen("menu")}
      />
    );
  }

  return (
    <div key={questionKey}>
      <ScoreBoard score={score} questionNumber={questionNumber} total={totalQuestions} />
      <QuestionDisplay name={countryName} onPlayAudio={playAudio} />
      <AnswerGrid
        options={options}
        correctCode={correctCode}
        selectedCode={selectedCode}
        answered={answered}
        onSelect={handleAnswer}
      />
      <AutoAdvanceBar active={answered} />
    </div>
  );
}
