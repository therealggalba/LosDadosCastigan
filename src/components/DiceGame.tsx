import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, UserMinus, Play, RotateCcw, Trophy, Flame, Swords, User, Sparkles, ArrowLeft, HelpCircle } from 'lucide-react';
import { GamePlayer, DiceGameRecord, DicePointsResult } from '@galbahub/domain';
import styles from './DiceGame.module.scss';
import bgHorizontal from '../assets/LosDadosCastigan_Horizontal_01.png';
import bgVertical from '../assets/LosDadosCastigan_Vertical_01.png';

// --- COLOR MATH UTILITIES (Exported for unit testing) ---

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function calculateRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const { r, g, b } = rgb;
  const [rN, gN, bN] = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return rN * 0.2126 + gN * 0.7152 + bN * 0.0722;
}

export function calculateContrastRatio(color1: string, color2: string): number {
  const l1 = calculateRelativeLuminance(color1);
  const l2 = calculateRelativeLuminance(color2);
  const brightest = Math.max(l1, l2);
  const darkest = Math.min(l1, l2);
  return (brightest + 0.05) / (darkest + 0.05);
}

export function calculateColorDistance(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) return 999;
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  );
}

// --- VOICE AND AUDIO SERVICE ---

export function playAudioOrSpeak(audioPathBase: string, text: string, lang: string) {
  const m4aPath = `${audioPathBase}.m4a`;
  const mp3Path = `${audioPathBase}.mp3`;

  const playFile = (path: string, nextFallback: () => void) => {
    const audio = new Audio(path);
    audio.play()
      .then(() => {
        console.log(`Playing pre-recorded audio: ${path}`);
      })
      .catch((err) => {
        console.warn(`Audio play failed for: ${path}`, err);
        nextFallback();
      });
  };

  // Try M4A, then MP3, then Speech Synthesis fallback
  playFile(m4aPath, () => {
    playFile(mp3Path, () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop any ongoing speech
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
        window.speechSynthesis.speak(utterance);
      }
    });
  });
}

// --- DICE POINTS LOGIC ---

export function calculatePoints(diceValues: number[], isFirstRoll: boolean): DicePointsResult {
  let points = 0;
  const scoringDice: number[] = [];
  let cancelRound = false;

  const counts: Record<number, number> = {};
  diceValues.forEach(val => {
    counts[val] = (counts[val] || 0) + 1;
  });

  // Paso 1: Combinaciones especiales solo si es primera tirada de 5 dados
  if (isFirstRoll && diceValues.length === 5) {
    if (counts[6] >= 3) {
      points += 1000;
      let used = 0;
      diceValues.forEach(val => {
        if (val === 6 && used < 3) {
          scoringDice.push(val);
          used++;
        }
      });
      // Añadir dados puntuables restantes
      diceValues.forEach(val => {
        if (val === 6 && scoringDice.filter(v => v === 6).length < counts[6]) {
          points += 100;
          scoringDice.push(val);
        } else if (val === 5) {
          points += 50;
          scoringDice.push(val);
        }
      });
      return { points, scoringDice, cancelRound };
    }

    if (counts[5] >= 3) {
      points += 500;
      let used = 0;
      diceValues.forEach(val => {
        if (val === 5 && used < 3) {
          scoringDice.push(val);
          used++;
        }
      });
      // Añadir dados puntuables restantes
      diceValues.forEach(val => {
        if (val === 5 && scoringDice.filter(v => v === 5).length < counts[5]) {
          points += 50;
          scoringDice.push(val);
        } else if (val === 6) {
          points += 100;
          scoringDice.push(val);
        }
      });
      return { points, scoringDice, cancelRound };
    }

    if (counts[1] >= 4) {
      cancelRound = true;
      return { points: 0, scoringDice: [], cancelRound };
    }
  }

  // Paso 2: Evaluar dado por dado si no hay combinación especial
  diceValues.forEach(val => {
    if (val === 6) {
      points += 100;
      scoringDice.push(val);
    } else if (val === 5) {
      points += 50;
      scoringDice.push(val);
    }
  });

  return { points, scoringDice, cancelRound };
}

// --- CONTEXT INTERFACE FOR TOASTS ---

interface ToastContext {
  isFirstRoll: boolean;
  diceValues: number[];
  pointsThisRoll: number;
  roundScoreBeforeRoll: number;
  hadStandOpportunity: boolean;
  isPunished: boolean;
}

interface ToastMessage {
  text: string;
  voiceText: string;
}

interface ToastTrigger {
  id: string;
  condition: (ctx: ToastContext) => boolean;
  es: ToastMessage;
  en: ToastMessage;
  audioFile: string;
}

// Configurable trigger list for toast messages
export const toastTriggers: ToastTrigger[] = [
  {
    id: 'buenaMano',
    condition: (ctx) => ctx.isFirstRoll && ctx.pointsThisRoll === 50 && ctx.diceValues.length === 5,
    es: { text: '¡La buena mano!', voiceText: 'La buena mano' },
    en: { text: 'Good hand!', voiceText: 'Good hand' },
    audioFile: 'buena_mano'
  },
  {
    id: 'dadosCastigan',
    condition: (ctx) => ctx.hadStandOpportunity && ctx.isPunished,
    es: { text: '¡Los dados castigan!', voiceText: 'Los dados castigan' },
    en: { text: 'The dice punish!', voiceText: 'The dice punish' },
    audioFile: 'dados_castigan'
  }
];

// --- MAIN REACT COMPONENT ---

const DiceGame: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeBg = isMobile ? bgVertical : bgHorizontal;

  // Game step
  const [step, setStep] = useState<'setup' | 'game' | 'tiebreaker'>('setup');

  // Player configurations (Custom BG and Text colors)
  const [setupPlayers, setSetupPlayers] = useState<Array<{ name: string; color: string; textColor: string }>>([
    { name: '', color: '#E11D48', textColor: '#FFFFFF' }, // Ruby Pink
    { name: '', color: '#2563EB', textColor: '#FFFFFF' }, // Royal Blue
    { name: '', color: '#16A34A', textColor: '#FFFFFF' }, // Emerald Green
    { name: '', color: '#EAB308', textColor: '#000000' }  // Golden Yellow
  ]);

  // Main game state
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [roundScore, setRoundScore] = useState(0);
  const [savedDice, setSavedDice] = useState<number[]>([]);
  const [diceValues, setDiceValues] = useState<number[]>([]);
  const [scoringFlags, setScoringFlags] = useState<boolean[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [showPlantarse, setShowPlantarse] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const [allDiceScored, setAllDiceScored] = useState(false);

  // Temporary popup/toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Muerte súbita state
  const [suddenDeath, setSuddenDeath] = useState(false);
  const [suddenDeathTrigger, setSuddenDeathTrigger] = useState<GamePlayer | null>(null);
  const [suddenDeathPlayers, setSuddenDeathPlayers] = useState<GamePlayer[]>([]);
  const [suddenDeathTiebreakers, setSuddenDeathTiebreakers] = useState<GamePlayer[]>([]);

  // Tiebreaker state
  const [tiebreakQueue, setTiebreakQueue] = useState<GamePlayer[]>([]);
  const [tiebreakResults, setTiebreakResults] = useState<Array<{ player: GamePlayer; score: number }>>([]);
  const [currentTiebreakIndex, setCurrentTiebreakIndex] = useState(0);
  const [tiebreakWinner, setTiebreakWinner] = useState<GamePlayer | null>(null);

  const [gameOver, setGameOver] = useState(false);
  const [record, setRecord] = useState<DiceGameRecord | null>(null);
  const [newRecordSet, setNewRecordSet] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Load record on mount
  useEffect(() => {
    const savedRecord = localStorage.getItem('dice_game_record');
    if (savedRecord) {
      try {
        setRecord(JSON.parse(savedRecord));
      } catch (e) {
        console.error('Failed to parse record', e);
      }
    }
  }, []);

  // Auto-clear toast message
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleAddPlayer = () => {
    if (setupPlayers.length < 8) {
      const presets = [
        { color: '#7C3AED', textColor: '#FFFFFF' }, // Indigo Violet
        { color: '#EA580C', textColor: '#FFFFFF' }, // Burning Orange
        { color: '#06B6D4', textColor: '#000000' }, // Neon Cyan
        { color: '#DB2777', textColor: '#FFFFFF' }  // Neon Pink
      ];
      const preset = presets[(setupPlayers.length - 4) % presets.length];
      setSetupPlayers([...setupPlayers, { name: '', color: preset.color, textColor: preset.textColor }]);
    }
  };

  const handleRemovePlayer = () => {
    if (setupPlayers.length > 4) {
      setSetupPlayers(setupPlayers.slice(0, -1));
    }
  };

  const handleSetupPlayerChange = (index: number, name: string) => {
    const newPlayers = [...setupPlayers];
    newPlayers[index].name = name;
    setSetupPlayers(newPlayers);
  };

  const handleSetupColorChange = (index: number, color: string) => {
    const newPlayers = [...setupPlayers];
    newPlayers[index].color = color;
    setSetupPlayers(newPlayers);
  };

  const handleSetupTextColorChange = (index: number, textColor: string) => {
    const newPlayers = [...setupPlayers];
    newPlayers[index].textColor = textColor;
    setSetupPlayers(newPlayers);
  };

  // Compare background colors of all players to find similarities
  const getColorConflicts = () => {
    const conflicts: string[] = [];
    for (let i = 0; i < setupPlayers.length; i++) {
      for (let j = i + 1; j < setupPlayers.length; j++) {
        const dist = calculateColorDistance(setupPlayers[i].color, setupPlayers[j].color);
        if (dist < 75) {
          const nameI = setupPlayers[i].name.trim() || `${t('common.player', 'Jugador')} ${i + 1}`;
          const nameJ = setupPlayers[j].name.trim() || `${t('common.player', 'Jugador')} ${j + 1}`;
          conflicts.push(
            t('gameHub.losDadosCastigan.similarColorWarning', {
              player1: nameI,
              player2: nameJ,
              defaultValue: `Los colores de fondo de ${nameI} y ${nameJ} se confunden por similitud.`
            })
          );
        }
      }
    }
    return conflicts;
  };

  // Strict check: if any player has low contrast (< 3.0:1), we strictly block game initialization
  const hasContrastErrors = setupPlayers.some(player => {
    const contrast = calculateContrastRatio(player.color, player.textColor);
    return contrast < 3.0;
  });

  const startGame = () => {
    if (hasContrastErrors) return; // Strict guard

    const validPlayers: GamePlayer[] = setupPlayers.map((p, i) => {
      return {
        name: p.name.trim() || `Jugador ${i + 1}`,
        color: p.color,
        textColor: p.textColor,
        score: 0,
        eliminated: false,
        roundScore: 0
      };
    });

    setPlayers(validPlayers);
    setCurrentPlayerIndex(0);
    setRoundNumber(1);
    setRoundScore(0);
    setSavedDice([]);
    setDiceValues([]);
    setScoringFlags([]);
    setGameOver(false);
    setSuddenDeath(false);
    setSuddenDeathTrigger(null);
    setSuddenDeathPlayers([]);
    setSuddenDeathTiebreakers([]);
    setNewRecordSet(false);
    setMessage('');
    setShowPlantarse(false);
    setShowContinue(false);
    setAllDiceScored(false);
    setToastMessage(null);
    setShowExitConfirm(false);
    setShowHelp(false);
    setStep('game');
  };

  const rollDice = () => {
    if (gameOver || isRolling) return;

    setIsRolling(true);
    setMessage('');
    setShowPlantarse(false);
    setShowContinue(false);

    let counter = 0;
    const diceToRollCount = 5 - (allDiceScored ? 0 : savedDice.length);
    
    const interval = setInterval(() => {
      const tempVals = Array.from({ length: diceToRollCount }, () => Math.floor(Math.random() * 6) + 1);
      setDiceValues(tempVals);
      setScoringFlags(Array(diceToRollCount).fill(false));
      counter++;
      if (counter > 8) {
        clearInterval(interval);
        finalizeRoll(diceToRollCount);
      }
    }, 80);
  };

  const finalizeRoll = (rolledCount: number) => {
    const finalVals = Array.from({ length: rolledCount }, () => Math.floor(Math.random() * 6) + 1);
    setDiceValues(finalVals);

    const isFirst = allDiceScored || savedDice.length === 0;
    const result = calculatePoints(finalVals, isFirst);

    // Track parameters for conditional toast triggers
    const hadStandOpportunity = roundScore > 0 && roundScore % 100 === 0;
    const isPunished = !finalVals.includes(5) && !finalVals.includes(6) && !result.cancelRound;

    const toastContext: ToastContext = {
      isFirstRoll: isFirst,
      diceValues: finalVals,
      pointsThisRoll: result.points,
      roundScoreBeforeRoll: roundScore,
      hadStandOpportunity: hadStandOpportunity,
      isPunished: isPunished
    };

    // Apply highlights to scoring dice
    const flags = Array(rolledCount).fill(false);
    const scoringCopy = [...result.scoringDice];
    finalVals.forEach((val, idx) => {
      const sIdx = scoringCopy.indexOf(val);
      if (sIdx !== -1) {
        flags[idx] = true;
        scoringCopy.splice(sIdx, 1);
      }
    });
    setScoringFlags(flags);

    // Check for conditional toasts and speak them
    const matchedTrigger = toastTriggers.find(t => t.condition(toastContext));
    if (matchedTrigger) {
      const activeLang = i18n.language === 'en' ? 'en' : 'es';
      const toastContent = matchedTrigger[activeLang];
      setToastMessage(toastContent.text);
      
      const audioPathBase = `/audio/${matchedTrigger.audioFile}_${activeLang}`;
      playAudioOrSpeak(audioPathBase, toastContent.voiceText, activeLang);
    }

    if (result.cancelRound) {
      const updatedPlayers = [...players];
      if (updatedPlayers[currentPlayerIndex]) {
        updatedPlayers[currentPlayerIndex].score = 0;
        updatedPlayers[currentPlayerIndex].roundScore = 0;
      }
      setPlayers(updatedPlayers);
      setRoundScore(0);
      setMessage(t('gameHub.losDadosCastigan.cancelRoundMsg', '¡4 o más ★! Tus puntos totales se han reseteado a 0.'));
      setIsRolling(false);
      setTimeout(() => {
        proceedToNextPlayer(updatedPlayers);
      }, 2000);
      return;
    }

    if (isPunished) {
      setRoundScore(0);
      setMessage(t('gameHub.losDadosCastigan.punishedMsg', 'Los dados castigan. No has obtenido puntuación.'));
      setIsRolling(false);
      setShowContinue(true);
      return;
    }

    const nextRoundScore = roundScore + result.points;
    setRoundScore(nextRoundScore);

    const nextSavedDice = allDiceScored ? [...result.scoringDice] : [...savedDice, ...result.scoringDice];
    setSavedDice(nextSavedDice);

    if (nextSavedDice.length === 5) {
      setMessage(t('gameHub.losDadosCastigan.allScoredMsg', '🎲 ¡Todos los dados han puntuado! Puedes volver a lanzar los 5 dados.'));
      setAllDiceScored(true);
    } else {
      setAllDiceScored(false);
    }

    if (nextRoundScore % 100 === 0 && nextRoundScore > 0) {
      setShowPlantarse(true);
    }

    setIsRolling(false);
  };

  const handlePlantarse = () => {
    endTurn(roundScore);
  };

  const handleContinuePunishment = () => {
    setShowContinue(false);
    endTurn(0);
  };

  const endTurn = (finalRoundScore: number) => {
    const updatedPlayers = [...players];
    const player = updatedPlayers[currentPlayerIndex];

    player.roundScore = finalRoundScore;
    player.score += finalRoundScore;

    // Check bust (> 3000)
    if (player.score > 3000) {
      player.score -= finalRoundScore;
      player.roundScore = 0;
      setMessage(t('gameHub.losDadosCastigan.bustMsg', '¡Has superado los 3000 puntos! Tu puntuación vuelve a la ronda anterior.'));
      setTimeout(() => proceedToNextPlayer(updatedPlayers), 2000);
      return;
    }

    // Check sudden death activation
    if (player.score === 3000 && !suddenDeath) {
      setSuddenDeath(true);
      setSuddenDeathTrigger(player);
      const remaining = updatedPlayers.filter((_, i) => i !== currentPlayerIndex);
      setSuddenDeathPlayers(remaining);
      setSuddenDeathTiebreakers([]);

      setMessage(`${player.name} ${t('gameHub.losDadosCastigan.suddenDeathBanner', 'ha alcanzado exactamente 3000 puntos. ¡Comienza la muerte súbita!')}`);
      
      setPlayers(updatedPlayers);
      setTimeout(() => {
        const nextRem = [...remaining];
        const nextPlayer = nextRem.shift()!;
        setSuddenDeathPlayers(nextRem);
        setCurrentPlayerIndex(updatedPlayers.indexOf(nextPlayer));
        resetTurnState();
      }, 3000);
      return;
    }

    if (suddenDeath) {
      if (player.score === 3000) {
        setSuddenDeathTiebreakers([...suddenDeathTiebreakers, player]);
      } else {
        player.eliminated = true;
      }
      
      setPlayers(updatedPlayers);

      if (suddenDeathPlayers.length > 0) {
        const nextRem = [...suddenDeathPlayers];
        const nextPlayer = nextRem.shift()!;
        setSuddenDeathPlayers(nextRem);
        setCurrentPlayerIndex(updatedPlayers.indexOf(nextPlayer));
        resetTurnState();
      } else {
        resolveSuddenDeath();
      }
      return;
    }

    proceedToNextPlayer(updatedPlayers);
  };

  const proceedToNextPlayer = (currentPlayers: GamePlayer[]) => {
    let nextIndex = (currentPlayerIndex + 1) % currentPlayers.length;
    
    if (nextIndex === 0 && !suddenDeath) {
      setRoundNumber(prev => prev + 1);
    }

    setPlayers(currentPlayers);
    setCurrentPlayerIndex(nextIndex);
    resetTurnState();
  };

  const resetTurnState = () => {
    setRoundScore(0);
    setSavedDice([]);
    setDiceValues([]);
    setScoringFlags([]);
    setMessage('');
    setShowPlantarse(false);
    setShowContinue(false);
    setAllDiceScored(false);
  };

  const resolveSuddenDeath = () => {
    const trigger = suddenDeathTrigger!;
    const tiebreakers = suddenDeathTiebreakers;

    if (tiebreakers.length === 0) {
      declareWinner(trigger);
    } else if (tiebreakers.length === 1) {
      declareWinner(tiebreakers[0]);
    } else {
      const allTied = [trigger, ...tiebreakers];
      startTiebreaker(allTied);
    }
  };

  const declareWinner = (winner: GamePlayer) => {
    setGameOver(true);
    
    const prevRecord = record;
    if (!prevRecord || roundNumber < prevRecord.round) {
      const newRec: DiceGameRecord = {
        name: winner.name,
        round: roundNumber
      };
      localStorage.setItem('dice_game_record', JSON.stringify(newRec));
      setRecord(newRec);
      setNewRecordSet(true);
    }
  };

  const startTiebreaker = (tiedPlayers: GamePlayer[]) => {
    setStep('tiebreaker');
    setTiebreakQueue(tiedPlayers);
    setTiebreakResults([]);
    setCurrentTiebreakIndex(0);
    setTiebreakWinner(null);
  };

  const rollTiebreaker = () => {
    if (isRolling) return;

    setIsRolling(true);
    const player = tiebreakQueue[currentTiebreakIndex];

    let counter = 0;
    const interval = setInterval(() => {
      setDiceValues(Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1));
      counter++;
      if (counter > 8) {
        clearInterval(interval);
        finalizeTiebreakRoll(player);
      }
    }, 80);
  };

  const finalizeTiebreakRoll = (player: GamePlayer) => {
    const finalVals = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
    setDiceValues(finalVals);

    const result = calculatePoints(finalVals, true);
    
    const results = [...tiebreakResults, { player, score: result.points }];
    setTiebreakResults(results);

    setIsRolling(false);

    setTimeout(() => {
      if (currentTiebreakIndex + 1 < tiebreakQueue.length) {
        setCurrentTiebreakIndex(prev => prev + 1);
        setDiceValues([]);
      } else {
        const maxScore = Math.max(...results.map(r => r.score));
        const winners = results.filter(r => r.score === maxScore);

        if (winners.length === 1) {
          setTiebreakWinner(winners[0].player);
          declareWinner(winners[0].player);
        } else {
          setMessage(t('gameHub.losDadosCastigan.newTiebreak', '¡Empate en el desempate! Otra ronda...'));
          setTimeout(() => {
            startTiebreaker(winners.map(w => w.player));
            setDiceValues([]);
            setMessage('');
          }, 2000);
        }
      }
    }, 2000);
  };

  const resetGame = () => {
    setStep('setup');
    setPlayers([]);
    setCurrentPlayerIndex(0);
    setRoundNumber(1);
    resetTurnState();
    setGameOver(false);
    setTiebreakWinner(null);
    setToastMessage(null);
    setShowExitConfirm(false);
    setShowHelp(false);
  };

  const renderDieFace = (val: number) => {
    const faceTextMap: Record<number, string> = {
      1: '★',
      2: '9',
      3: '10',
      4: 'J',
      5: 'Q',
      6: 'K'
    };

    const text = faceTextMap[val] || '';
    const fontSize = text === '10' ? '46px' : '54px';
    const dy = text === '★' ? '0.33em' : '0.36em';

    return (
      <svg viewBox="0 0 100 100" className={styles.dieSvg} fill="currentColor">
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fontWeight="900"
          fontFamily="'Outfit', 'Inter', system-ui, -apple-system, sans-serif"
          dy={dy}
        >
          {text}
        </text>
      </svg>
    );
  };

  const getTableCompactnessClass = () => {
    const count = players.length;
    if (count >= 8) return styles.compactMax;
    if (count >= 7) return styles.compactHigh;
    if (count >= 6) return styles.compactMed;
    return '';
  };

  const getRankings = () => {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return sorted.map(p => p.name);
  };

  const colorConflicts = getColorConflicts();

  return (
    <div className={styles.container} style={{ backgroundImage: `url(${activeBg})` }}>
      {/* TOAST POPUP NOTIFICATION */}
      {toastMessage && (
        <div className={styles.toastOverlay}>
          <div className={styles.toastCard}>
            <div className={styles.toastGlow} />
            <span className={styles.toastText}>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* EXIT GAME CONFIRMATION BUTTON */}
      {(step === 'game' || step === 'tiebreaker') && (
        <>
          {!showExitConfirm ? (
            <button
              className={styles.exitBtn}
              onClick={() => setShowExitConfirm(true)}
              title={t('gameHub.losDadosCastigan.exitGame', 'Volver al menú')}
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <div className={styles.exitConfirmWrapper}>
              <span className={styles.exitConfirmText}>
                {t('gameHub.losDadosCastigan.confirmExitQuestion', '¿Abandonar partida?')}
              </span>
              <button className={styles.exitConfirmYes} onClick={resetGame}>
                {t('common.yes', 'Sí')}
              </button>
              <button className={styles.exitConfirmNo} onClick={() => setShowExitConfirm(false)}>
                {t('common.no', 'No')}
              </button>
            </div>
          )}

          {/* HELP BUTTON AND POPUP */}
          <button
            className={styles.helpBtn}
            onClick={() => setShowHelp(!showHelp)}
            title={t('gameHub.losDadosCastigan.helpTitle', 'Instrucciones')}
          >
            <HelpCircle size={18} />
          </button>

          {showHelp && (
            <>
              <div className={styles.helpBackdrop} onClick={() => setShowHelp(false)} />
              <div className={styles.helpPopup}>
                <h3>{t('gameHub.losDadosCastigan.rulesTitle', 'Reglas del Juego')}</h3>
                
                <div className={styles.rulesSection}>
                  <h4>{t('gameHub.losDadosCastigan.cardScoresTitle', 'Puntuación de Cartas')}</h4>
                  <ul>
                    <li><strong>K:</strong> 100 pts</li>
                    <li><strong>Q:</strong> 50 pts</li>
                    <li><strong>★, 9, 10, J:</strong> 0 pts</li>
                  </ul>
                </div>

                <div className={styles.rulesSection}>
                  <h4>{t('gameHub.losDadosCastigan.specialCombosTitle', 'Combinaciones (1ª tirada de 5 dados)')}</h4>
                  <ul>
                    <li><strong>3 o más K:</strong> 1000 pts base</li>
                    <li><strong>3 o más Q:</strong> 500 pts base</li>
                    <li><strong>4 o más ★:</strong> ⚠ RESET de puntos (Tus puntos totales acumulados van a 0)</li>
                  </ul>
                </div>

                <div className={styles.rulesSection}>
                  <h4>{t('gameHub.losDadosCastigan.gameplayRulesTitle', 'Reglas de Juego')}</h4>
                  <ul>
                    <li><strong>Plantarse:</strong> Solo con acumulados múltiplos de 100.</li>
                    <li><strong>¡Los dados castigan!:</strong> Si tiras y no sale ninguna K o Q, pierdes el acumulado del turno.</li>
                  </ul>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* SETUP SCREEN */}
      {step === 'setup' && (
        <div className={styles.setupScreenWrapper}>
          
          {record ? (
            <div className={styles.recordDisplayMini}>
              <Trophy size={12} />
              <span>
                {t('gameHub.losDadosCastigan.recordTitle', 'Récord actual')}:{' '}
                <strong>{record.name}</strong> - {t('gameHub.losDadosCastigan.roundCounter', 'Ronda: {{round}}', { round: record.round })}
              </span>
            </div>
          ) : (
            <div className={styles.recordDisplayMini}>
              <Trophy size={12} />
              <span>{t('gameHub.losDadosCastigan.noRecord', 'Aún no hay récord')}.</span>
            </div>
          )}

          <div className={styles.setupGrid}>
            
            {/* Left Column: Odd Players */}
            <div className={styles.setupColumnOdd}>
              {setupPlayers
                .map((player, idx) => ({ player, idx }))
                .filter(({ idx }) => idx % 2 === 0)
                .map(({ player, idx }) => {
                  const contrast = calculateContrastRatio(player.color, player.textColor);
                  const isLowContrast = contrast < 3.0;

                  return (
                    <div key={idx} className={styles.playerInputRow}>
                      <div className={styles.playerHeaderCompact}>
                        <span>{t('common.player', 'Jugador')} {idx + 1}</span>
                      </div>
                      
                      <div className={styles.playerFieldsRow}>
                        <div className={styles.inputWrapper}>
                          <User size={16} className={styles.inputIcon} />
                          <input
                            type="text"
                            placeholder={t('common.name', 'Nombre')}
                            value={player.name}
                            onChange={(e) => handleSetupPlayerChange(idx, e.target.value)}
                          />
                        </div>

                        <div className={styles.colorPickersCompact}>
                          <div className={styles.colorInputWrapper} style={{ backgroundColor: player.color }} title={t('gameHub.losDadosCastigan.bgColor', 'Fondo')}>
                            <input
                              type="color"
                              value={player.color}
                              onChange={(e) => handleSetupColorChange(idx, e.target.value)}
                            />
                          </div>
                          <div className={styles.colorInputWrapper} style={{ backgroundColor: player.textColor }} title={t('gameHub.losDadosCastigan.textColor', 'Texto')}>
                            <input
                              type="color"
                              value={player.textColor}
                              onChange={(e) => handleSetupTextColorChange(idx, e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {isLowContrast && (
                        <span className={styles.contrastWarning}>
                          ⚠ {t('gameHub.losDadosCastigan.lowContrastWarning', 'Contraste insuficiente (mínimo 3.0:1)')}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Right Column: Even Players */}
            <div className={styles.setupColumnEven}>
              {setupPlayers
                .map((player, idx) => ({ player, idx }))
                .filter(({ idx }) => idx % 2 === 1)
                .map(({ player, idx }) => {
                  const contrast = calculateContrastRatio(player.color, player.textColor);
                  const isLowContrast = contrast < 3.0;

                  return (
                    <div key={idx} className={styles.playerInputRow}>
                      <div className={styles.playerHeaderCompact}>
                        <span>{t('common.player', 'Jugador')} {idx + 1}</span>
                      </div>
                      
                      <div className={styles.playerFieldsRow}>
                        <div className={styles.inputWrapper}>
                          <User size={16} className={styles.inputIcon} />
                          <input
                            type="text"
                            placeholder={t('common.name', 'Nombre')}
                            value={player.name}
                            onChange={(e) => handleSetupPlayerChange(idx, e.target.value)}
                          />
                        </div>

                        <div className={styles.colorPickersCompact}>
                          <div className={styles.colorInputWrapper} style={{ backgroundColor: player.color }} title={t('gameHub.losDadosCastigan.bgColor', 'Fondo')}>
                            <input
                              type="color"
                              value={player.color}
                              onChange={(e) => handleSetupColorChange(idx, e.target.value)}
                            />
                          </div>
                          <div className={styles.colorInputWrapper} style={{ backgroundColor: player.textColor }} title={t('gameHub.losDadosCastigan.textColor', 'Texto')}>
                            <input
                              type="color"
                              value={player.textColor}
                              onChange={(e) => handleSetupTextColorChange(idx, e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      {isLowContrast && (
                        <span className={styles.contrastWarning}>
                          ⚠ {t('gameHub.losDadosCastigan.lowContrastWarning', 'Contraste insuficiente (mínimo 3.0:1)')}
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>

          </div>

          {/* Warnings & Alerts */}
          {(colorConflicts.length > 0 || hasContrastErrors) && (
            <div className={styles.setupWarningsContainer}>
              {colorConflicts.length > 0 && (
                <div className={styles.conflictList}>
                  {colorConflicts.map((conflict, cIdx) => (
                    <div key={cIdx} className={styles.conflictWarning}>
                      <span>⚠ {conflict}</span>
                    </div>
                  ))}
                </div>
              )}

              {hasContrastErrors && (
                <div className={styles.strictContrastError}>
                  <span>⚠ {t('gameHub.losDadosCastigan.strictContrastError', 'Bloqueado: corrige las combinaciones de bajo contraste para jugar.')}</span>
                </div>
              )}
            </div>
          )}

          {/* Bottom Action Buttons */}
          <div className={styles.setupButtonsRow}>
            <button
              onClick={handleAddPlayer}
              disabled={setupPlayers.length >= 8}
              className={styles.secondaryBtn}
            >
              <UserPlus size={20} />
              <span>{t('gameHub.losDadosCastigan.addPlayer', 'Añadir Jugador')}</span>
            </button>

            <button 
              onClick={startGame} 
              disabled={hasContrastErrors}
              className={`${styles.startGameBtn} ${hasContrastErrors ? styles.disabledBtn : ''}`}
            >
              <Play size={20} />
              <span>{t('gameHub.losDadosCastigan.startGame', 'Nueva Partida')}</span>
            </button>

            <button
              onClick={handleRemovePlayer}
              disabled={setupPlayers.length <= 4}
              className={styles.secondaryBtn}
            >
              <UserMinus size={20} />
              <span>{t('gameHub.losDadosCastigan.removePlayer', 'Eliminar Jugador')}</span>
            </button>
          </div>
        </div>
      )}

      {/* GAME SCREEN */}
      {step === 'game' && (
        <div className={styles.gameLayout}>
          
          {/* PANEL 1: INFO DE TIRADA (LEFT COLUMN) */}
          <div className={`${styles.card} ${styles.infoPanel}`}>
            <div className={styles.gameHeader}>
              <div className={styles.turnInfo} style={{ borderLeftColor: players[currentPlayerIndex]?.color }}>
                <h3>
                  {t('gameHub.losDadosCastigan.turnOf', 'Turno de: {{name}}', {
                    name: players[currentPlayerIndex]?.name
                  })}
                </h3>
              </div>
              <div className={styles.roundCounter}>
                <span>{t('gameHub.losDadosCastigan.roundCounter', 'Ronda: {{round}}', { round: roundNumber })}</span>
              </div>
            </div>

            <div className={styles.roundScoreboard}>
              <div className={styles.scoreRow}>
                <span>{t('gameHub.losDadosCastigan.accumulatedScore', 'Acumulado de ronda')}:</span>
                <strong className={styles.pulsingScore}>{roundScore}</strong>
              </div>
              <div className={styles.scoreDetail}>
                <span>{t('gameHub.losDadosCastigan.savedDiceCount', 'Dados guardados')}: {savedDice.length}</span>
                <span>{t('gameHub.losDadosCastigan.diceToRollCount', 'Dados por lanzar')}: {5 - (allDiceScored ? 0 : savedDice.length)}</span>
              </div>

              <div className={styles.messageContainer}>
                <div className={`${styles.actionMessage} ${!message ? styles.hidden : ''}`}>
                  {message || ''}
                </div>
              </div>

              <div className={styles.actions}>
                {showPlantarse && (
                  <button onClick={handlePlantarse} className={styles.plantarseBtn}>
                    {t('gameHub.losDadosCastigan.plantarse', 'Plantarse')}
                  </button>
                )}

                {showContinue && (
                  <button onClick={handleContinuePunishment} className={styles.continueBtn}>
                    {t('gameHub.losDadosCastigan.continue', 'Continuar')}
                  </button>
                )}
              </div>
            </div>

            {/* Sudden Death alert banner */}
            {suddenDeath && !gameOver && (
              <div className={styles.suddenDeathBanner}>
                <Flame className={styles.pulseIcon} />
                <div>
                  <strong>{t('gameHub.losDadosCastigan.suddenDeathTitle', '¡MUERTE SÚBITA!')}</strong>
                  <p>
                    {t('gameHub.losDadosCastigan.suddenDeathDescription', 'Todos los jugadores tienen un último turno para empatar a 3000.')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* PANEL 2: ACTIVE PLAY AREA (CENTER COLUMN) */}
          <div className={`${styles.card} ${styles.playPanel}`}>
            {/* Tapete area (Felt) */}
            <div className={styles.tableMat}>
              
              <div className={styles.diceContainer}>
                {diceValues.length > 0 ? (
                  diceValues.map((val, idx) => (
                    <div
                      key={idx}
                      className={`${styles.die} ${scoringFlags[idx] ? styles.highlighted : ''} ${
                        isRolling ? styles.rolling : ''
                      }`}
                      style={{
                        backgroundColor: players[currentPlayerIndex]?.color,
                        color: players[currentPlayerIndex]?.textColor
                      }}
                    >
                      {renderDieFace(val)}
                    </div>
                  ))
                ) : (
                  <div className={styles.placeholderDice}>
                    <p>{t('gameHub.losDadosCastigan.emptyTable', 'Lanza los dados para comenzar tu turno')}</p>
                  </div>
                )}
              </div>

              {!gameOver && (
                <button
                  onClick={rollDice}
                  disabled={isRolling || showContinue}
                  className={styles.rollBtn}
                >
                  <Sparkles size={16} />
                  <span>{t('gameHub.losDadosCastigan.rollDice', 'Lanzar Dados')}</span>
                </button>
              )}
            </div>

            {/* Game Over Screen / Declaration */}
            {gameOver && (
              <div className={styles.gameOverSection}>
                <Trophy size={48} className={styles.winnerIcon} />
                <h2>
                  {t('gameHub.losDadosCastigan.winnerDeclaration', '🏆 ¡{{name}} ha ganado! 🏆', {
                    name: players[currentPlayerIndex]?.name
                  })}
                </h2>
                
                {newRecordSet && (
                  <p className={styles.newRecordText}>
                    {t('gameHub.losDadosCastigan.newRecordAlert', '🎉 ¡Nuevo récord establecido en la ronda {{round}}! 🎉', {
                      round: roundNumber
                    })}
                  </p>
                )}

                <button onClick={resetGame} className={styles.restartBtn}>
                  <RotateCcw size={20} />
                  <span>{t('gameHub.losDadosCastigan.newGame', 'Nueva Partida')}</span>
                </button>
              </div>
            )}
          </div>

          {/* PANEL 3: SCOREBOARD (RIGHT COLUMN) */}
          <div className={`${styles.card} ${styles.scoresPanel}`}>
            <div className={styles.scoreboardWrapper}>
              <table className={`${styles.scoreTable}  ${getTableCompactnessClass()}`}>
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>{t('common.name', 'Nombre')}</th>
                    <th>{t('common.color', 'Color')}</th>
                    <th>{t('gameHub.losDadosCastigan.ptsRound', 'Pts Ronda')}</th>
                    <th>{t('gameHub.losDadosCastigan.ptsTotal', 'Pts Totales')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, idx) => {
                    const rankings = getRankings();
                    const position = rankings.indexOf(player.name) + 1;
                    const isActive = idx === currentPlayerIndex && !gameOver;

                    return (
                      <tr
                        key={idx}
                        className={`${isActive ? styles.activeRow : ''} ${
                          player.eliminated ? styles.eliminatedRow : ''
                        }`}
                      >
                        <td>{position}º</td>
                        <td className={styles.playerName}>{player.name}</td>
                        <td>
                          <div
                            className={styles.colorDot}
                            style={{ backgroundColor: player.color }}
                          />
                        </td>
                        <td>{player.roundScore || 0}</td>
                        <td className={styles.totalPoints}>{player.score}</td>
                        <td>{player.eliminated ? '❌' : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TIEBREAKER SCREEN */}
      {step === 'tiebreaker' && (
        <div className={styles.card}>
          <div className={styles.tiebreakerHeader}>
            <Swords size={32} className={styles.swordsIcon} />
            <h2>
              {t('gameHub.losDadosCastigan.tiebreakerTitle', '⚔️ Desempate entre: {{names}} ⚔️', {
                names: tiebreakQueue.map(p => p.name).join(', ')
              })}
            </h2>
          </div>

          <div className={styles.tiebreakPlayground}>
            <h3>
              {t('gameHub.losDadosCastigan.tiebreakerTurn', 'Turno de desempate: {{name}}', {
                name: tiebreakQueue[currentTiebreakIndex]?.name
              })}
            </h3>

            <div className={styles.tableMat}>
              <div className={styles.diceContainer}>
                {diceValues.length > 0 ? (
                  diceValues.map((val, idx) => (
                    <div
                      key={idx}
                      className={`${styles.die} ${isRolling ? styles.rolling : ''}`}
                      style={{
                        backgroundColor: tiebreakQueue[currentTiebreakIndex]?.color,
                        color: tiebreakQueue[currentTiebreakIndex]?.textColor
                      }}
                    >
                      {renderDieFace(val)}
                    </div>
                  ))
                ) : (
                  <div className={styles.placeholderDice}>
                    <p>{t('gameHub.losDadosCastigan.emptyTable', 'Lanza los dados para el desempate')}</p>
                  </div>
                )}
              </div>

              {!tiebreakWinner && (
                <button
                  onClick={rollTiebreaker}
                  disabled={isRolling}
                  className={styles.rollBtn}
                >
                  {t('gameHub.losDadosCastigan.rollDice', 'Lanzar Dados')}
                </button>
              )}
            </div>

            {message && <div className={styles.actionMessage}>{message}</div>}

            <div className={styles.resultsGrid}>
              <h4>Resultados de la ronda:</h4>
              <ul className={styles.resultsList}>
                {tiebreakResults.map((res, rIdx) => (
                  <li key={rIdx}>
                    <span className={styles.resultPlayerName}>{res.player.name}:</span>
                    <strong className={styles.resultScore}>{res.score} pts</strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiceGame;
