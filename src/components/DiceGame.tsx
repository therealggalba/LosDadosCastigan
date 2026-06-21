import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, UserMinus, Play, RotateCcw, Trophy, Swords, User, Sparkles, ArrowLeft, HelpCircle, Volume2, VolumeX, Music } from 'lucide-react';
import styles from './DiceGame.module.scss';

import buenaManoEs from '../assets/audio/buena_mano_es.m4a';
import buenaManoEn from '../assets/audio/buena_mano_en.m4a';
import dadosCastiganEs from '../assets/audio/dados_castigan_es.m4a';
import dadosCastiganEn from '../assets/audio/dados_castigan_en.m4a';


export interface GamePlayer {
  name: string;
  color: string;
  textColor: string;
  score: number;
  eliminated: boolean;
  roundScore: number;
}

export interface DiceGameRecord {
  name: string;
  round: number;
}

export interface DicePointsResult {
  points: number;
  scoringDice: number[];
  cancelRound: boolean;
}
import bgHorizontal from '../assets/LosDadosCastigan_Horizontal_01.png';
import bgVertical from '../assets/LosDadosCastigan_Vertical_01.png';
import bgMuerteSubita from '../assets/LosDadosCastigan_MuerteSubita_01.png';

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

const voiceFiles: Record<string, string> = {
  'buena_mano_es': buenaManoEs,
  'buena_mano_en': buenaManoEn,
  'dados_castigan_es': dadosCastiganEs,
  'dados_castigan_en': dadosCastiganEn
};

export function playAudioOrSpeak(audioKey: string, text: string, lang: string) {
  const fileUrl = voiceFiles[audioKey];
  
  if (!fileUrl) {
    speakText(text, lang);
    return;
  }
  
  const audio = new Audio(fileUrl);
  audio.play()
    .then(() => {
      console.log(`Playing voice audio file: ${audioKey}`);
    })
    .catch((err) => {
      console.warn(`Voice audio file play blocked or failed: ${audioKey}`, err);
      speakText(text, lang);
    });
}

function speakText(text: string, lang: string) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
    window.speechSynthesis.speak(utterance);
  }
}

// --- WEB AUDIO API MUSIC & SFX SYNTHESIZER ---

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private volumeNode: GainNode | null = null;
  private sfxVolumeNode: GainNode | null = null;
  private schedulerInterval: any = null;
  
  private bpm = 120;
  private stepDuration = 0.125; // 16th note duration in seconds (120 BPM -> 120 ms)
  private nextNoteTime = 0.0;
  private currentStep = 0;
  
  private musicEnabled = false;
  private sfxEnabled = true;
  private currentMode: 'menu' | 'game' | 'sudden' | 'off' = 'off';

  public init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      this.ctx = new AudioContextClass();
      
      this.volumeNode = this.ctx.createGain();
      const initialMusicVol = this.musicEnabled ? 0.22 : 0.0;
      this.volumeNode.gain.setValueAtTime(initialMusicVol, this.ctx.currentTime);
      this.volumeNode.gain.value = initialMusicVol;
      this.volumeNode.connect(this.ctx.destination);
      
      this.sfxVolumeNode = this.ctx.createGain();
      const initialSfxVol = this.sfxEnabled ? 0.35 : 0.0;
      this.sfxVolumeNode.gain.setValueAtTime(initialSfxVol, this.ctx.currentTime);
      this.sfxVolumeNode.gain.value = initialSfxVol;
      this.sfxVolumeNode.connect(this.ctx.destination);

      this.startScheduler();
    } catch (e) {
      console.error('Failed to initialize AudioContext', e);
    }
  }

  public unlock() {
    this.init();
    const ctx = this.ctx;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (enabled) {
      this.init();
      const ctx = this.ctx;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (this.volumeNode) {
        this.volumeNode.gain.setValueAtTime(0.22, this.ctx?.currentTime || 0);
        this.volumeNode.gain.value = 0.22;
      }
    } else {
      if (this.volumeNode) {
        this.volumeNode.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
        this.volumeNode.gain.value = 0;
      }
    }
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    if (enabled) {
      this.init();
      const ctx = this.ctx;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (this.sfxVolumeNode) {
        this.sfxVolumeNode.gain.setValueAtTime(0.35, this.ctx?.currentTime || 0);
        this.sfxVolumeNode.gain.value = 0.35;
      }
    } else {
      if (this.sfxVolumeNode) {
        this.sfxVolumeNode.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
        this.sfxVolumeNode.gain.value = 0;
      }
    }
  }

  public setMode(mode: 'menu' | 'game' | 'sudden' | 'off') {
    this.currentMode = mode;
    if (mode !== 'off' && (this.musicEnabled || this.sfxEnabled)) {
      this.init();
      const ctx = this.ctx;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    }
    if (mode === 'sudden') {
      this.bpm = 145;
      this.stepDuration = 60 / this.bpm / 4; // 16th notes
    } else {
      this.bpm = 120;
      this.stepDuration = 60 / this.bpm / 4;
    }
  }
  
  private startScheduler() {
    if (this.schedulerInterval) clearInterval(this.schedulerInterval);
    const ctx = this.ctx;
    if (!ctx) return;
    this.nextNoteTime = ctx.currentTime;
    this.schedulerInterval = setInterval(() => {
      const activeCtx = this.ctx;
      if (!activeCtx) return;
      
      // Reset scheduling time if we fell behind (e.g. context was suspended)
      if (this.nextNoteTime < activeCtx.currentTime) {
        this.nextNoteTime = activeCtx.currentTime + 0.05;
      }
      
      while (this.nextNoteTime < activeCtx.currentTime + 0.1) {
        this.scheduleNote(this.currentStep, this.nextNoteTime);
        this.advanceStep();
      }
    }, 25);
  }
  
  private advanceStep() {
    this.currentStep = (this.currentStep + 1) % 32; // 2 bars of 16 steps
    this.nextNoteTime += this.stepDuration;
  }
  
  private scheduleNote(step: number, time: number) {
    const ctx = this.ctx;
    if (!this.musicEnabled || !ctx || this.currentMode === 'off') return;
    
    if (this.currentMode === 'menu') {
      // Menu: slow ambient chords on sine wave
      const chordIndex = Math.floor(step / 8);
      const stepInChord = step % 8;
      
      const chords = [
        [261.63, 329.63, 392.00, 493.88], // Cmaj7 (C4, E4, G4, B4)
        [220.00, 261.63, 329.63, 392.00], // Am7 (A3, C4, E4, G4)
        [174.61, 220.00, 261.63, 329.63], // Fmaj7 (F3, A3, C4, E4)
        [196.00, 246.94, 293.66, 349.23], // G7 (G3, B3, D4, F4)
      ];
      
      const currentChord = chords[chordIndex] || chords[0];
      
      if (stepInChord === 0 || stepInChord === 2 || stepInChord === 4 || stepInChord === 6) {
        const note = currentChord[stepInChord / 2];
        this.playSynthTone(note, time, 0.35, 'sine', 0.05, 0.4);
      }
    } else if (this.currentMode === 'game') {
      // Game: cheerful walking bassline + simple lead arpeggio
      const chordIndex = Math.floor(step / 8);
      const stepInChord = step % 8;
      
      const roots = [130.81, 110.00, 87.31, 98.00]; // C3, A2, F2, G2
      const thirds = [164.81, 130.81, 110.00, 123.47]; // E3, C3, A2, B2
      const fifths = [196.00, 164.81, 130.81, 146.83]; // G3, E3, C3, D3
      
      if (stepInChord === 0) {
        this.playSynthTone(roots[chordIndex], time, 0.4, 'triangle', 0.01, 0.15);
      } else if (stepInChord === 2) {
        this.playSynthTone(thirds[chordIndex], time, 0.3, 'triangle', 0.01, 0.12);
      } else if (stepInChord === 4) {
        this.playSynthTone(fifths[chordIndex], time, 0.4, 'triangle', 0.01, 0.15);
      } else if (stepInChord === 6) {
        this.playSynthTone(thirds[chordIndex], time, 0.3, 'triangle', 0.01, 0.12);
      }
      
      const melody = [
        392.00, 0, 440.00, 392.00, 0, 523.25, 0, 493.88,
        392.00, 0, 440.00, 392.00, 0, 587.33, 0, 523.25
      ];
      const leadNote = melody[step % 16];
      if (leadNote > 0 && step % 4 !== 1) {
        this.playSynthTone(leadNote, time, 0.07, 'sine', 0.01, 0.1);
      }
    } else if (this.currentMode === 'sudden') {
      // Sudden Death: fast, intense minor-key theme
      const stepInChord = step % 8;
      
      const bassNote = stepInChord % 2 === 0 ? 55.00 : 110.00; // A1 / A2
      this.playSynthTone(bassNote, time, 0.45, 'sawtooth', 0.01, 0.08, 120);
      
      if (stepInChord === 0) {
        this.playSynthTone(880.00, time, 0.1, 'square', 0.005, 0.15);
      } else if (stepInChord === 4) {
        this.playSynthTone(830.61, time, 0.1, 'square', 0.005, 0.15);
      }
    }
  }
  
  private playSynthTone(freq: number, time: number, vol: number, type: OscillatorType, attack: number, decay: number, filterFreq?: number) {
    const ctx = this.ctx;
    const volumeNode = this.volumeNode;
    if (!ctx || !volumeNode) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, time + attack + decay);
    
    if (filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, time);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    
    gain.connect(volumeNode);
    
    osc.start(time);
    osc.stop(time + attack + decay + 0.1);
  }

  public playSfx(type: 'click' | 'roll' | 'success' | 'castigo' | 'winner') {
    if (!this.sfxEnabled) return;
    this.init();
    const ctx = this.ctx;
    const sfxVolumeNode = this.sfxVolumeNode;
    if (!ctx || !sfxVolumeNode) return;
    
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    
    const now = ctx.currentTime;
    
    switch (type) {
      case 'click': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(sfxVolumeNode);
        
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.03);
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.03);
        
        osc.start(now);
        osc.stop(now + 0.04);
        break;
      }
      case 'roll': {
        const duration = 0.5;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.connect(gain);
        gain.connect(sfxVolumeNode);
        
        for (let i = 0; i < 8; i++) {
          const t = now + (i * duration) / 8;
          osc.frequency.setValueAtTime(70 + Math.random() * 60, t);
          gain.gain.setValueAtTime(0.25, t);
          gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
        }
        osc.start(now);
        osc.stop(now + duration + 0.05);
        break;
      }
      case 'success': {
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.connect(gain);
          gain.connect(sfxVolumeNode);
          
          const start = now + idx * 0.07;
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.2, start);
          gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);
          
          osc.start(start);
          osc.stop(start + 0.2);
        });
        break;
      }
      case 'castigo': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(sfxVolumeNode);
        
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(45, now + 0.65);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.65);
        
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
      case 'winner': {
        const melody = [
          { f: 261.63, d: 0.12 },
          { f: 329.63, d: 0.12 },
          { f: 392.00, d: 0.12 },
          { f: 523.25, d: 0.24 },
          { f: 392.00, d: 0.12 },
          { f: 523.25, d: 0.48 }
        ];
        let cumulativeTime = now;
        melody.forEach((note) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.connect(gain);
          gain.connect(sfxVolumeNode);
          
          osc.frequency.setValueAtTime(note.f, cumulativeTime);
          gain.gain.setValueAtTime(0.12, cumulativeTime);
          gain.gain.exponentialRampToValueAtTime(0.01, cumulativeTime + note.d);
          
          osc.start(cumulativeTime);
          osc.stop(cumulativeTime + note.d + 0.05);
          cumulativeTime += note.d;
        });
        break;
      }
    }
  }
}

export const gameAudio = new GameAudioEngine();

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
  const [gameWinner, setGameWinner] = useState<GamePlayer | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const activeBg = suddenDeath ? bgMuerteSubita : (isMobile ? bgVertical : bgHorizontal);

  const [musicMuted, setMusicMuted] = useState(() => {
    return localStorage.getItem('music_muted') === 'true';
  });
  const [sfxMuted, setSfxMuted] = useState(() => {
    return localStorage.getItem('sfx_muted') === 'true';
  });

  // Unlock Audio Helper on click
  const unlockAudio = () => {
    gameAudio.unlock();
  };

  // Sync music state
  useEffect(() => {
    gameAudio.setMusicEnabled(!musicMuted);
    localStorage.setItem('music_muted', String(musicMuted));
  }, [musicMuted]);

  // Sync sfx state
  useEffect(() => {
    gameAudio.setSfxEnabled(!sfxMuted);
    localStorage.setItem('sfx_muted', String(sfxMuted));
  }, [sfxMuted]);

  // Automatic music mode selector
  useEffect(() => {
    if (step === 'setup') {
      gameAudio.setMode('menu');
    } else if (gameOver) {
      gameAudio.setMode('off');
    } else if (suddenDeath) {
      gameAudio.setMode('sudden');
    } else {
      gameAudio.setMode('game');
    }
  }, [step, suddenDeath, gameOver]);

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
    gameAudio.playSfx('click');
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
    gameAudio.playSfx('click');
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
    unlockAudio();
    gameAudio.playSfx('click');

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
    unlockAudio();
    gameAudio.playSfx('roll');

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
      
      const audioKey = `${matchedTrigger.audioFile}_${activeLang}`;
      playAudioOrSpeak(audioKey, toastContent.voiceText, activeLang);
    }

    if (result.cancelRound) {
      gameAudio.playSfx('castigo');
      const updatedPlayers = [...players];
      if (updatedPlayers[currentPlayerIndex]) {
        updatedPlayers[currentPlayerIndex].score = 0;
        updatedPlayers[currentPlayerIndex].roundScore = 0;
      }
      setPlayers(updatedPlayers);
      setRoundScore(0);
      setMessage(t('gameHub.losDadosCastigan.cancelRoundMsg', '¡El diablo!¡Tus puntos totales se han reseteado a 0!.'));
      setIsRolling(false);
      setTimeout(() => {
        proceedToNextPlayer(updatedPlayers);
      }, 2000);
      return;
    }

    if (isPunished) {
      gameAudio.playSfx('castigo');
      setRoundScore(0);
      setMessage(t('gameHub.losDadosCastigan.punishedMsg', 'No has obtenido puntuación.'));
      setIsRolling(false);
      setShowContinue(true);
      return;
    }

    if (result.points > 0) {
      gameAudio.playSfx('success');
    }

    const nextRoundScore = roundScore + result.points;
    setRoundScore(nextRoundScore);

    const nextSavedDice = allDiceScored ? [...result.scoringDice] : [...savedDice, ...result.scoringDice];
    setSavedDice(nextSavedDice);

    if (nextSavedDice.length === 5) {
      setMessage(t('gameHub.losDadosCastigan.allScoredMsg', '¡Todos los dados han puntuado! Puedes volver a lanzar los 5 dados.'));
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
    unlockAudio();
    gameAudio.playSfx('success');
    endTurn(roundScore);
  };

  const handleContinuePunishment = () => {
    unlockAudio();
    gameAudio.playSfx('click');
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
      gameAudio.playSfx('castigo');
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

      setMessage(`${player.name} ${t('gameHub.losDadosCastigan.suddenDeathBanner', 'ha alcanzado 3000 puntos. ¡Comienza la muerte súbita!')}`);
      
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
    gameAudio.playSfx('winner');
    setGameOver(true);
    setGameWinner(winner);
    
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
    unlockAudio();
    gameAudio.playSfx('roll');

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
    gameAudio.playSfx('click');
    setStep('setup');
    setPlayers([]);
    setCurrentPlayerIndex(0);
    setRoundNumber(1);
    resetTurnState();
    setGameOver(false);
    setGameWinner(null);
    setTiebreakWinner(null);
    setToastMessage(null);
    setShowExitConfirm(false);
    setShowHelp(false);
    setSuddenDeath(false);
    setSuddenDeathTrigger(null);
    setSuddenDeathPlayers([]);
    setSuddenDeathTiebreakers([]);
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
      {/* TOP ACTIONS ROW (Sound/Music controls + Help) */}
      <div className={styles.topActionsRow}>
        <button 
          onClick={() => {
            unlockAudio();
            setMusicMuted(!musicMuted);
          }} 
          className={`${styles.actionIconButton} ${musicMuted ? styles.muted : ''}`}
          title={musicMuted ? "Activar música" : "Mutear música"}
        >
          {musicMuted ? <Music size={18} style={{ opacity: 0.5 }} /> : <Music size={18} />}
        </button>
        <button 
          onClick={() => {
            unlockAudio();
            setSfxMuted(!sfxMuted);
            if (sfxMuted) {
              gameAudio.setSfxEnabled(true);
              gameAudio.playSfx('click');
            }
          }} 
          className={`${styles.actionIconButton} ${sfxMuted ? styles.muted : ''}`}
          title={sfxMuted ? "Activar sonido" : "Mutear sonido"}
        >
          {sfxMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <button 
          onClick={() => {
            unlockAudio();
            gameAudio.playSfx('click');
            setShowHelp(!showHelp);
          }} 
          className={styles.actionIconButton}
          title={t('gameHub.losDadosCastigan.helpTitle', 'Instrucciones')}
        >
          <HelpCircle size={18} />
        </button>
      </div>

      {/* TOAST POPUP NOTIFICATION */}
      {toastMessage && (
        <div className={styles.toastOverlay}>
          <div className={styles.toastCard}>
            <div className={styles.toastGlow} />
            <span className={styles.toastText}>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Sudden Death alert banner at top center */}
      {suddenDeath && !gameOver && (
        <div className={styles.suddenDeathOverlay}>
          <div className={styles.suddenDeathCard}>
            <div className={styles.suddenDeathGlow} />
            <span className={styles.suddenDeathTitleText}>
              {t('gameHub.losDadosCastigan.suddenDeathTitle', '¡MUERTE SÚBITA!')}
            </span>
            <span className={styles.suddenDeathDescText}>
              {t('gameHub.losDadosCastigan.suddenDeathDescription', 'Todos los jugadores tienen un último turno para empatar a 3000.')}
            </span>
          </div>
        </div>
      )}

      {/* HELP POPUP (ALWAYS AVAILABLE) */}
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
                <li><strong>3 K:</strong> 1000 pts base</li>
                <li><strong>3 Q:</strong> 500 pts base</li>
                <li><strong>4 ★:</strong> ⚠ RESET de puntos (Tus puntos totales acumulados van a 0)</li>
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

      {/* EXIT GAME CONFIRMATION BUTTON */}
      {(step === 'game' || step === 'tiebreaker') && (
        <>
          {!showExitConfirm ? (
            <button
              className={styles.exitBtn}
              onClick={() => {
                unlockAudio();
                gameAudio.playSfx('click');
                setShowExitConfirm(true);
              }}
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
              <button className={styles.exitConfirmNo} onClick={() => {
                unlockAudio();
                gameAudio.playSfx('click');
                setShowExitConfirm(false);
              }}>
                {t('common.no', 'No')}
              </button>
            </div>
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
                          ⚠ {t('gameHub.losDadosCastigan.lowContrastWarning', 'Contraste insuficiente')}
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
                          ⚠ {t('gameHub.losDadosCastigan.lowContrastWarning', 'Contraste insuficiente')}
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
                  <span>⚠ {t('gameHub.losDadosCastigan.strictContrastError', 'Bloqueado: corrige las combinaciones de color para jugar.')}</span>
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

              {suddenDeath && players[currentPlayerIndex] && (
                <div className={styles.suddenDeathRequiredPoints}>
                  <span>
                    {t('gameHub.losDadosCastigan.pointsNeededNotice', 'Debes conseguir {{needed}} puntos para alcanzar los 3000.', {
                      needed: 3000 - players[currentPlayerIndex].score
                    })}
                  </span>
                </div>
              )}

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
            {gameOver && gameWinner && (
              <div className={styles.gameOverSection}>
                <h2>
                  {t('gameHub.losDadosCastigan.winnerDeclaration', '🏆 ¡{{name}} ha ganado! 🏆', {
                    name: gameWinner.name
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
