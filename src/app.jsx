import 'core-js/es/array/find-index';
import 'core-js/es/array/from';

import { Howl, Howler } from 'howler';
import { pinyin } from 'pinyin-pro/lib/pinyin';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import Switch from 'rc-switch';
import { Toaster, toast, useToasterStore } from 'react-hot-toast';
import { Trans, useTranslation } from 'react-i18next';

import { ALL_IDIOMS, DEFINITIONS, GAMES } from './game-data';

import keypressDeleteMp3 from '../sounds/keypress-delete.mp3';
import keypressReturnMp3 from '../sounds/keypress-return.mp3';
import keypressStandardMp3 from '../sounds/keypress-standard.mp3';

import CloseIcon from './components/CloseIcon';
import CodeInput from './components/CodeInput';
import Countdown from './components/Countdown';
import CurrentPlaying from './components/CurrentPlaying';
import FacebookIcon from './components/FacebookIcon';
import GameBoard from './components/GameBoard';
import GameKeyboard from './components/GameKeyboard';
import InfoIcon from './components/InfoIcon';
import KebabIcon from './components/KebabIcon';
import PlayIcon from './components/PlayIcon';
import ShareIcon from './components/ShareIcon';
import ShareImageButton from './components/ShareImageButton';
import Tile from './components/Tile';
import TwitterIcon from './components/TwitterIcon';
import VolumeSlider from './components/VolumeSlider';
import { KEY_PREFIX } from './constants';
import LS from './utils/LS';
import alert from './utils/alert';
import blastConfetti from './utils/blastConfetti';
import compareWords from './utils/compareWords';
import copy from './utils/copy';
import fireEvent from './utils/fireEvent';
import prefersColorSchemeSupported from './utils/prefersColorSchemeSupported';
import usePageVisibility from './utils/usePageVisibility';
import getBoardGameState from './utils/getBoardGameState';
import getTodayGame from './utils/getTodayGame';

const py = pinyin;
window.pinyin = pinyin;

const MAX_GAMES_BEFORE_SHOW_DASHBOARD = 5000;
const MAX_LETTERS = 4;
const MAX_STEPS = 6;

Howler.volume(JSON.parse(LS.getItem(`${KEY_PREFIX}volume`)) || 0.5);
const keypressStandard = new Howl({
  src: [keypressStandardMp3],
  preload: false,
});
const keypressDelete = new Howl({
  src: [keypressDeleteMp3],
  preload: false,
});
const keypressReturn = new Howl({
  src: [keypressReturnMp3],
  preload: false,
});

window.clearGames = () => {
  try {
    const { length } = localStorage;
    for (let i = 0; i < length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {}
};

window.allGames = () => {
  const allGames = new Map();
  const { length } = localStorage;
  for (let i = 0; i < length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(KEY_PREFIX)) {
      const game = JSON.parse(localStorage.getItem(key));
      allGames.set(key.replace(KEY_PREFIX, ''), game);
    }
  }
  return allGames;
};

const exportGameData = () => {
  try {
    const gameData = Object.entries(localStorage)
      .filter(([k, v]) => {
        const isPrefixed = k.startsWith(KEY_PREFIX);
        if (!isPrefixed) return false;
        const gameID = k.slice(KEY_PREFIX.length);
        return isPrefixed && GAMES.find((g) => g.id === gameID);
      })
      .map(([k, v]) => {
        const id = k.slice(KEY_PREFIX.length);
        const data = JSON.parse(v);
        return {
          id,
          ...data,
        };
      });
    return gameData;
  } catch (e) {}
};
const importGameData = (gameData, overrides = false) => {
  try {
    gameData.forEach((game) => {
      const { id, ...data } = game;
      if (overrides || !localStorage.getItem(`${KEY_PREFIX}${id}`)) {
        LS.setItem(`${KEY_PREFIX}${id}`, JSON.stringify(data));
      }
    });
  } catch (e) {}
};

// v = letter values of the row
// s = submitted state of the row (after user press enter)
const blankBoard = () =>
  Array.from({ length: MAX_STEPS }, () => ({
    v: Array.from({ length: MAX_LETTERS }, () => ''),
    s: false,
  }));

const getIdiomsKeys = (
  idiom,
  maxKeys,
  minIdioms,
  prevPassedIdioms,
  prevKeys,
  depth = 0,
) => {
  let passedIdioms = prevPassedIdioms || new Set();
  passedIdioms.add(idiom);
  let keys = prevKeys || new Set();
  const idiomLetters = idiom.split('');
  idiomLetters.forEach((letter) => keys.add(letter));
  let consecutiveFailures = 0;
  lettersCycle: for (let i = 0; i < GAMES.length; i++) {
    const letter = idiomLetters[(i + 1) % MAX_LETTERS];
    const anotherIdiom = GAMES.find(
      ({ idiom }) => !passedIdioms.has(idiom) && idiom.includes(letter),
    );
    if (anotherIdiom) {
      for (let j = 0; j < anotherIdiom.idiom.length; j++) {
        keys.add(anotherIdiom.idiom[j]);

        if (keys.size >= maxKeys) {
          break lettersCycle;
        }
      }
      passedIdioms.add(anotherIdiom.idiom);
      consecutiveFailures = 0;
    } else {
      if (consecutiveFailures >= MAX_LETTERS + 1) {
        // Too many failures, stop
        break lettersCycle;
      }
      consecutiveFailures += 1;
    }
  }

  // Try the next idiom
  if (keys.size < maxKeys || passedIdioms.size < minIdioms) {
    const nextIdiom = [...passedIdioms][++depth];
    if (nextIdiom) {
      const { passedIdioms: _passedIdioms, keys: _keys } = getIdiomsKeys(
        nextIdiom,
        maxKeys,
        minIdioms,
        passedIdioms,
        keys,
        depth,
      );
      passedIdioms = _passedIdioms;
      keys = _keys;
    }
  }

  // Still not enough keys, choose a random idiom
  if (keys.size < maxKeys || passedIdioms.size < minIdioms) {
    const randomIdiom = GAMES[Math.floor(Math.random() * GAMES.length)].idiom;
    if (randomIdiom) {
      const { passedIdioms: _passedIdioms, keys: _keys } = getIdiomsKeys(
        randomIdiom,
        maxKeys,
        minIdioms,
        passedIdioms,
        keys,
        0,
      );
      passedIdioms = _passedIdioms;
      keys = _keys;
    }
  }

  // Something very wrong happened
  if (keys.size < maxKeys || passedIdioms.size < minIdioms) {
    const gameID = GAMES.find((g) => g.idiom === idiom)?.id;
    console.error(gameID, {
      possibleIdioms: passedIdioms.size,
      keySize: keys.size,
      consecutiveFailures,
    });
  }

  return {
    passedIdioms,
    keys,
  };
};



const IdiomsDashboard = () => {
  const { t } = useTranslation();
  let wonCount = 0;
  let lostCount = 0;
  const idioms = GAMES.map((game) => {
    // Get board from localStorage
    const boardGame = JSON.parse(LS.getItem(`${KEY_PREFIX}${game.id}`));
    if (boardGame && boardGame.gameState) {
      const { board, gameState } = boardGame;
      if (gameState === 'won') {
        wonCount++;
      } else if (gameState === 'lost') {
        lostCount++;
      }
      return (
        <a
          href={`/#${game.id}`}
          class={`board ${gameState}`}
          title={`${game.id} (${gameState})`}
        >
          {gameState === 'won' ? '🟩' : '🟧'}
        </a>
      );
    } else {
      return (
        <a href={`/#${game.id}`} class="board" title={`${game.id}`}>
          ⬜
        </a>
      );
    }
  });

  useEffect(() => {
    blastConfetti();
  }, []);

  return (
    <>
      <h2>
        {t('dashboard.heading', {
          gamesCount: MAX_GAMES_BEFORE_SHOW_DASHBOARD,
        })}
      </h2>
      <p>{t('dashboard.subheading')}</p>
      <p>
        <Trans
          i18nKey="dashboard.totalGamesPlayed"
          values={{
            gamesCountOverTotal: `${wonCount + lostCount} / ${GAMES.length}`,
          }}
          components={[<b />]}
        />
        <br />
        <Trans
          i18nKey="dashboard.wonLost"
          values={{
            wonCount,
            lostCount,
          }}
          components={[<b />, <b />]}
        />
      </p>
      <div class="boards">{idioms}</div>
    </>
  );
};

export function App() {
  const { t, i18n } = useTranslation();

  const [showDashboard, setShowDashboard] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showModal, setShowModal] = useState(false); // false | won | lost
  const [showInfoModal, setShowInfoModal] = useState(false);

  const [colorScheme, setColorScheme] = useState(
    LS.getItem(`${KEY_PREFIX}colorScheme`) || 'auto',
  );
  useEffect(() => {
    if (!prefersColorSchemeSupported) return;
    const html = document.querySelector('html');
    if (colorScheme === 'dark') {
      html.classList.add('dark-mode');
      html.classList.remove('light-mode');
    } else if (colorScheme === 'light') {
      html.classList.add('light-mode');
      html.classList.remove('dark-mode');
    } else {
      html.classList.remove('dark-mode', 'light-mode');
    }
  }, [colorScheme]);

  const [skipFirstTime, setSkipFirstTime] = useState(
    LS.getItem(`${KEY_PREFIX}skipFirstTime`) || false,
  );

  const [hardMode, setHardMode] = useState(
    JSON.parse(LS.getItem(`${KEY_PREFIX}hardMode`) || false),
  );
  const maxKeys = hardMode ? 40 : 20;
  const minIdioms = hardMode ? 10 : 6;

  useEffect(() => {
    if (hardMode) fireEvent('Hard mode');
  }, []);

  const [currentGame, setCurrentGame] = useState(
    GAMES.find((g) => g.id === location.hash.slice(1)) || getTodayGame(),
  );
  useEffect(() => {
    window.addEventListener('hashchange', () => {
      setCurrentGame(
        GAMES.find((g) => g.id === location.hash.slice(1)) || getTodayGame(),
      );
      setShowDashboard(false);
    });
  }, []);

  useEffect(() => {
    keypressStandard.load();
    keypressDelete.load();
    keypressReturn.load();
  }, []);

  const [board, setBoard] = useState(
    JSON.parse(LS.getItem(`${KEY_PREFIX}${currentGame.id}`))?.board ||
      blankBoard(),
  );
  useEffect(() => {
    const cachedGame = LS.getItem(`${KEY_PREFIX}${currentGame.id}`);
    if (cachedGame) {
      setBoard(JSON.parse(cachedGame).board);
    } else {
      setBoard(blankBoard());
    }
  }, [currentGame.id]);

  const boardStates = useMemo(() => {
    return board.map((row, i) => {
      if (row.s) {
        return compareWords(currentGame.idiom, row.v);
      }
      return [];
    });
  }, [board]);

  // Save to localStorage every time board changes
  useEffect(() => {
    // Only store in localStorage if board has some values
    if (board && board.some((row) => row.v.some((v) => v))) {
      LS.setItem(
        `${KEY_PREFIX}${currentGame.id}`,
        JSON.stringify({
          board,
          gameState: getBoardGameState(boardStates),
        }),
      );
    }
  }, [boardStates]);

  const definition = useMemo(() => {
    return DEFINITIONS[currentGame.idiom] || null;
  }, [currentGame.idiom]);

  const currentStep = board?.findIndex((row) => row.s === false) || 0;

  const [currentGameKeys, currentGameKeysPinyin] = useMemo(() => {
    const { keys } = getIdiomsKeys(currentGame.idiom, maxKeys, minIdioms);
    const allPossibleIdioms = ALL_IDIOMS.filter((idiom) => {
      // check if idiom contains 4 letters from keys
      return idiom.split('').every((letter) => keys.has(letter));
    });

    // Pinyin mappings
    const keysPinyin = new Map();
    allPossibleIdioms.forEach((idiom) => {
      const idiomPinyin = pinyin(idiom, { type: 'array' });
      idiomPinyin.forEach((pinyin, i) => {
        if (keysPinyin.has(idiom[i])) {
          keysPinyin.get(idiom[i]).add(pinyin);
        } else {
          keysPinyin.set(idiom[i], new Set([pinyin]));
        }
      });
    });
    keysPinyin.forEach((pinyinSet, letter) => {
      pinyinSet.add(py(letter)); // Add its own individual-letter pinyin
    });

    // SPOILER inside console.log!
    const possibleIdioms = allPossibleIdioms
      .map((idiom) => {
        return `${idiom} (${py(idiom)})`;
      })
      .sort((a, b) => a.localeCompare(b, 'zh'));
    // Dev-only spoiler debugging helpers — stripped from production builds
    if (import.meta.env.DEV) {
      if (console.groupCollapsed) {
        console.groupCollapsed(
          `${possibleIdioms.length} Possible Idioms [${currentGame.id}] (${keys.size} keys):`,
        );
        console.log(`${possibleIdioms
          .map((idiom, i) => `${i + 1}. ${idiom}`)
          .join('\n')}

🚨SPOILER🚨 Type 'HINTS' to see all hints. Type 'ANSWER' to see the answer.`);
        console.groupEnd();
      }
      window.ANSWER = `${currentGame.idiom} (${py(currentGame.idiom)})`;
    }

    const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b, 'zh'));
    return [sortedKeys, keysPinyin];
  }, [currentGame.idiom]);

  const handleLetter = (letter, overwrite = false) => {
    if (!board[currentStep]) return;
    if (gameState) return;
    setShowError(false);

    const newBoard = [...board];
    let columnIndex = newBoard[currentStep].v.findIndex((v) => v === '');
    if (overwrite) {
      if (columnIndex === -1) {
        columnIndex = 3;
      } else {
        columnIndex--;
      }
    }
    if (columnIndex !== -1) {
      newBoard[currentStep].v[columnIndex] = letter;
      setBoard(newBoard);
    }
  };

  const correctKeys = new Set();
  const presentKeys = new Set();
  const absentKeys = new Set();
  board.forEach((row, i) => {
    if (!row.s) return;
    row.v.forEach((letter, j) => {
      const state = boardStates[i][j];
      if (state === '🟩') {
        correctKeys.add(letter);
      } else if (state === '🟧') {
        presentKeys.add(letter);
      } else if (state === '⬜') {
        absentKeys.add(letter);
      }
    });
  });

  const handleEnter = () => {
    if (gameState) return;
    console.log('handleEnter');
    setShowError(false);

    const row = board[currentStep];
    if (!row) return;
    const currentIdiom = row.v.join('');
    const valid = ALL_IDIOMS.includes(currentIdiom);
    if (valid) {
      row.s = true;
      setBoard([...board]);
      fireEvent('submit_guess', { props: { attempt: currentStep + 1 } });
    } else {
      setTimeout(() => {
        setShowError(true);
      }, 10);
      fireEvent('invalid_guess', { props: { word: currentIdiom } });
    }
    console.log({ currentIdiom, valid });
  };

  const gameState = useMemo(() => {
    return getBoardGameState(boardStates);
  }, [boardStates]);

  useEffect(() => {
    let timeout;
    if (gameState === 'won') {
      timeout = setTimeout(() => {
        setShowModal('won');
      }, 600);
      const attempts = board.filter((row) => row.s).length;
      fireEvent('game_completed', { props: { status: 'won', attempts: attempts } });
    } else if (gameState === 'lost') {
      setShowModal('lost');
      fireEvent('game_completed', { props: { status: 'lost', attempts: MAX_STEPS } });
    } else {
      setShowModal(false);
    }
    return () => {
      clearTimeout(timeout);
    };
  }, [gameState, board]);

  const confettiFired = useRef(false);
  useEffect(() => {
    if (gameState === 'won') {
      const filledRows = boardStates.filter((row) => row.length > 0).length;
      if (filledRows >= 5 && !confettiFired.current) {
        confettiFired.current = true;
        blastConfetti();
      }
    } else {
      confettiFired.current = false;
    }
  }, [gameState, boardStates]);

  const cachedTodayGame = useRef(getTodayGame());
  const pageLoad = useRef(true);
  const isPageVisible = usePageVisibility();
  useEffect(() => {
    let timeout;
    if (isPageVisible) {
      // Only show when NOT on first page load
      if (!pageLoad.current) {
        const todayGame = getTodayGame();
        if (
          todayGame.id !== cachedTodayGame.current?.id &&
          /(won|lost)/i.test(gameState)
        ) {
          timeout = setTimeout(() => {
            setShowModal(gameState);
          }, 600);
        }
      }
      pageLoad.current = false;
    }
    return () => {
      clearTimeout(timeout);
    };
  }, [isPageVisible, gameState]);

  const handleBackspace = () => {
    if (gameState) return;
    const newBoard = [...board];
    // Get last column with value
    const row = newBoard[currentStep];
    if (!row || row.s) return;
    let columnIndex = -1;
    for (let i = row.v.length - 1; i >= 0; i--) {
      if (row.v[i] !== '') {
        columnIndex = i;
        break;
      }
    }
    if (columnIndex !== -1) {
      row.v[columnIndex] = '';
      setBoard(newBoard);
    }
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (gameState) return;
      if (e.metaKey || e.ctrlKey || !e.key) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === 'enter') {
        e.preventDefault();
        e.stopPropagation();
        handleEnter();
      } else if (key === 'backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (/^arrow(left|right)/i.test(key)) {
        // This will cycle through all letters with same starting pinyin letter
        const row = board[currentStep];
        const value = [...row.v].reverse().find((v) => v !== '');
        if (value) {
          const pinyinLetter = py(value)[0];

          const possibleLettersSet = new Set();
          currentGameKeysPinyin.forEach((pinyins, letter) => {
            pinyins.forEach((pinyin) => {
              const firstPinyinChar = pinyin[0];
              if (
                firstPinyinChar.localeCompare(pinyinLetter, 'en', {
                  sensitivity: 'base',
                }) === 0
              ) {
                possibleLettersSet.add(letter);
              }
            });
          });
          const possibleLetters = [...possibleLettersSet];

          if (possibleLetters.length <= 1) return;
          const letterIndex = possibleLetters.indexOf(value);
          const nextLetter =
            key === 'arrowright'
              ? possibleLetters[(letterIndex + 1) % possibleLetters.length]
              : possibleLetters[
                  (letterIndex + possibleLetters.length - 1) %
                    possibleLetters.length
                ];
          if (nextLetter) {
            handleLetter(nextLetter, true);
          }
        }
      } else if (/[a-z]/i.test(key)) {
        // Type "a" will trigger the first letter pinyin that starts with "ā"
        let breakLoop = false;
        currentGameKeysPinyin.forEach((pinyins, letter) => {
          if (breakLoop) return;
          pinyins.forEach((pinyin) => {
            if (breakLoop) return;
            const firstPinyinChar = pinyin[0];
            if (
              firstPinyinChar.localeCompare(key, 'en', {
                sensitivity: 'base',
              }) === 0
            ) {
              e.preventDefault();
              breakLoop = true;
              handleLetter(letter);
            }
          });
        });
      }

      const $board = document.getElementById('board');
      if ($board?.querySelector) {
        const $currentRow = $board.querySelector(
          `.row:nth-child(${currentStep + 1})`,
        );
        if ($currentRow?.scrollIntoView) {
          $currentRow.scrollIntoView({
            behavior: 'smooth',
          });
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [currentGameKeys, currentGameKeysPinyin, board, currentStep, gameState]);

  const permalink = location.origin + location.pathname + '#' + currentGame.id;
  const shortPermalink =
    location.host + location.pathname + '#' + currentGame.id;
  const emojiResults = boardStates
    .map((row) => row.join(''))
    .join('\n')
    .trim();
  const attempts = gameState === 'won' ? emojiResults.split('\n').length : 'X';
  const attemptsText = `${attempts}/${MAX_STEPS}`;
  const shareText = `${t('app.title')} [${currentGame.id}]${
    hardMode ? ' 🔥' : ''
  } ${attemptsText}\n\n${emojiResults}`;
  const shareTextWithLink = `${shareText}\n\n${shortPermalink}`;

  const hints = useMemo(() => {
    const hints = [];
    const letters = currentGame.idiom.split('');

    // 1. Absent letters hints
    const absentHints = currentGameKeys
      .filter((k) => {
        return !letters.includes(k) && !absentKeys.has(k);
      })
      .slice(0, -1) // Don't reveal at least one letter
      .slice(0, 3) // But still max 3 letters
      .map((letter) => {
        return t('hints.absentLetter', {
          letter,
          pinyin: py(letter),
        });
      })
      .sort(() => Math.random() - 0.5);
    hints.push(...absentHints);

    // 2. Definition hints
    if (
      definition?.zh &&
      letters.filter((c) => definition.zh.includes(c)).length <= 2
      // Only show hint if definition contains 2 or less of the characters in the idiom
      // Else, the definition basically revealed the answer
    ) {
      hints.push(`ℹ️ ${definition.zh}`);
    }
    if (definition?.en) hints.push(`ℹ️ ${definition.en}`);

    // 3. Letter hints
    const letterHints = letters
      .filter((c) => !correctKeys.has(c) && !presentKeys.has(c))
      .slice(0, -1) // Don't reveal at least one letter
      .map((letter) => {
        return t('hints.presentLetter', {
          letter,
          pinyin: py(letter),
        });
      })
      .sort(() => Math.random() - 0.5);
    hints.push(...letterHints);

    // 4. Pinyin hints
    const pinyinHint = py(currentGame.idiom, {
      pattern: 'first',
      type: 'array',
    }).join('');
    hints.push(t('hints.abbreviatedPinyin', { pinyinHint }));

    if (import.meta.env.DEV) {
      window.HINTS = hints;
    }

    return hints;
  }, [currentGame.idiom, definition]);
  const hintIndex = useRef(0);
  useEffect(() => {
    hintIndex.current = 0;
  }, [currentGame.idiom]);
  const showHint = () => {
    if (gameState) return;
    const hint = hints[hintIndex.current];
    hintIndex.current = (hintIndex.current + 1) % hints.length;
    alert(hint);

    let hintType = 'other';
    if (hint.indexOf('ℹ️') !== -1) hintType = 'definition';
    else if (hint.indexOf('Absent') !== -1 || hint.indexOf('absent') !== -1) hintType = 'absent_letter';
    else if (hint.indexOf('Present') !== -1 || hint.indexOf('present') !== -1) hintType = 'present_letter';
    else if (hint.indexOf('Pinyin') !== -1 || hint.indexOf('pinyin') !== -1 || hint.indexOf('initials') !== -1) hintType = 'pinyin';

    fireEvent('view_hint', { props: { hint_type: hintType } });
  };

  // Limit number of toasts
  // https://github.com/timolins/react-hot-toast/issues/31#issuecomment-803359550
  const { toasts } = useToasterStore();
  const TOAST_LIMIT = 1;
  useEffect(() => {
    toasts
      .filter((t, i) => t.visible && i >= TOAST_LIMIT)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  const gamesPlayedCount = useMemo(() => {
    // Only count games played if info modal is open
    if (!showInfoModal) return;
    try {
      const keys = Object.keys(localStorage).filter((k) => {
        const isPrefixed = k.startsWith(KEY_PREFIX);
        if (!isPrefixed) return false;
        const gameID = k.slice(KEY_PREFIX.length);
        return isPrefixed && GAMES.find((g) => g.id === gameID);
      });
      return keys.length;
    } catch (e) {}
  }, [showInfoModal]);

  useEffect(() => {
    if (!gamesPlayedCount || gamesPlayedCount < 10) return;
    const precision = gamesPlayedCount < 100 ? 1 : 2;
    const count = +gamesPlayedCount.toPrecision(precision);
    fireEvent('Games Played', {
      props: {
        count,
      },
    });
  }, [gamesPlayedCount]);

  const GamesCount = useCallback(
    () => (
      <b>
        {gamesPlayedCount}
        {gamesPlayedCount >= MAX_GAMES_BEFORE_SHOW_DASHBOARD && (
          <>
            {' '}
            /{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setShowInfoModal(false);
                setShowDashboard(true);
              }}
            >
              {GAMES.length}
            </a>
          </>
        )}
      </b>
    ),
    [gamesPlayedCount],
  );

  return (
    <>
      {currentGame.isArchive && (
        <div class="archive-banner">
          <span>
            📅 {t('ui.playingArchiveDate', 'Playing archived puzzle from {{date}}', {
              date: currentGame.dateStr,
            })}
          </span>
          <a href="./" class="back-home-btn">
            {t('ui.playTodayGame', "Play Today's Game")}
          </a>
        </div>
      )}
      <header>
        <div class="inner">
          <button
            type="button"
            onClick={() => {
              setShowInfoModal(true);
            }}
          >
            <InfoIcon width="16" height="16" />
          </button>
          <span>
            <h1>{t('app.title')}</h1>
            <CurrentPlaying />
          </span>
          <button
            type="button"
            onClick={() => {
              setShowModal(gameState || 'play');
            }}
          >
            {gameState ? (
              t('common.play')
            ) : (
              <KebabIcon width="16" height="16" />
            )}
          </button>
        </div>
      </header>
      <GameBoard
        board={board}
        boardStates={boardStates}
        currentStep={currentStep}
        showError={showError}
        gameState={gameState}
        hardMode={hardMode}
      />
      <GameKeyboard
        currentGameKeys={currentGameKeys}
        currentGameKeysPinyin={currentGameKeysPinyin}
        correctKeys={correctKeys}
        presentKeys={presentKeys}
        absentKeys={absentKeys}
        gameState={gameState}
        hardMode={hardMode}
        t={t}
        onLetter={handleLetter}
        onEnter={handleEnter}
        onBackspace={handleBackspace}
        onHint={showHint}
        onKeypressStandard={() => keypressStandard.play()}
        onKeypressReturn={() => keypressReturn.play()}
        onKeypressDelete={() => keypressDelete.play()}
      />
      <div
        id="modal"
        class={showModal ? 'appear' : ''}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowModal(null);
        }}
      >
        <CloseIcon
          height="24"
          width="24"
          class="close"
          onClick={() => {
            setShowModal(null);
          }}
        />
        <div class="content">
          <h2>
            {showModal === 'won'
              ? '🎉🎉🎉'
              : showModal === 'lost'
              ? '😭😭😭'
              : '🐯🐯🐯'}
          </h2>
          {showModal === 'play' && (
            <p class="block">
              {t('ui.idiomId')}{' '}
              <CodeInput code={currentGame.id} url={permalink} />
            </p>
          )}
          {/(won|lost)/i.test(showModal) && (
            <>
              <p class="block">
                <b class="answer">
                  <ruby>
                    {currentGame.idiom}
                    <rp>(</rp>
                    <rt>{py(currentGame.idiom)}</rt>
                    <rp>)</rp>
                  </ruby>
                </b>
                <div class="definition">
                  {definition?.zh
                    ? definition.zh.split('').map((c) => {
                        const p = py(c);
                        if (p === c) return c;
                        return (
                          <ruby>
                            {c}
                            <rp>(</rp>
                            <rt>{py(c)}</rt>
                            <rp>)</rp>
                          </ruby>
                        );
                      })
                    : ''}
                  {definition?.zh && definition?.en && <br />}
                  {definition?.en}
                </div>
                <small>
                  <a
                    href={`https://hanyu.baidu.com/s?wd=${currentGame.idiom}&from=zici`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    📖 {t('glossary.baidu')}
                  </a>
                  &nbsp; &nbsp;
                  <a
                    href={`https://www.zdic.net/hans/${currentGame.idiom}`}
                    target="_blank" rel="noopener noreferrer"
                  >
                    📖 {t('glossary.zdic')}
                  </a>
                </small>
              </p>
              <p class="block warning">{t('ui.avoidSpoilers')}</p>
              <div class="block">
                <div>
                  <button
                    id="share"
                    onClick={async () => {
                      try {
                        if (
                          // Edge/ or Edg/
                          /edge?\//i.test(navigator.userAgent) ||
                          // Windows
                          /windows/.test(navigator.userAgent)
                        ) {
                          throw new Error(
                            'Web Share API not working well here',
                          );
                        }
                        copy(shareTextWithLink);
                        await navigator.share({ text: shareTextWithLink });
                      } catch (e) {
                        copy(shareTextWithLink, () => {
                          alert(t('ui.copiedResults'));
                        });
                      }
                      fireEvent('Click: Share', {
                        props: {
                          type: 'share',
                        },
                      });
                    }}
                  >
                    {t('common.share')} <ShareIcon width="16" height="16" />
                  </button>
                  &nbsp;
                  <ShareImageButton
                    id={currentGame.id}
                    header={t('app.title')}
                    footer={`[${currentGame.id}]${
                      hardMode ? ' 🔥' : ''
                    } ${attemptsText}`}
                    boardStates={boardStates}
                  />
                  &nbsp;
                  <a
                    class="button facebook"
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                      permalink,
                    )}&hashtag=${encodeURIComponent('#wordlechinese')}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={() => {
                      copy(shareTextWithLink);
                      fireEvent('Click: Share', {
                        props: {
                          type: 'facebook',
                        },
                      });
                    }}
                  >
                    <FacebookIcon width="16" height="16" />
                  </a>
                  &nbsp;
                  <a
                    class="button tweet"
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                      shareTextWithLink,
                    )}`}
                    target="_blank" rel="noopener noreferrer"
                    onClick={() => {
                      fireEvent('Click: Share', {
                        props: {
                          type: 'twitter',
                        },
                      });
                    }}
                  >
                    <TwitterIcon
                      width="16"
                      height="16"
                      title={t('common.tweet')}
                    />
                  </a>
                </div>
                <p>
                  {t('ui.idiomId')}{' '}
                  <CodeInput code={currentGame.id} url={permalink} />
                </p>
              </div>
            </>
          )}
          {gameState === 'won' && attempts <= 2 && !hardMode && (
            <p
              class="block alert"
              onClick={() => {
                setShowModal(null);
                setTimeout(() => {
                  setShowInfoModal(true);
                }, 300);
              }}
            >
              {t('ui.easyEnableHardMode')}
            </p>
          )}
          <div class="block">
            {/won|lost/i.test(gameState) &&
              getTodayGame().id === currentGame.id && (
                <>
                  <p>
                    <big>
                      <Trans
                        i18nKey="ui.nextIdiom"
                        components={[<Countdown />]}
                      />
                    </big>
                  </p>
                  <p style={{fontSize:'13px',margin:'8px 0'}}>
                    <a
                      href={`/#${currentGame.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        location.reload();
                      }}
                      style={{fontWeight:'bold',color:'var(--primary-color)'}}
                    >
                      ▶ {t('ui.playAgain', 'Play Again')}
                    </a>
                  </p>
                </>
              )}
            <div>
              {getTodayGame().id !== currentGame.id && (
                <>
                  <a href="./" class="button strong">
                    <PlayIcon width={20} height={20} /> {t('ui.playTodayGame')}
                  </a>
                  <br />
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  fireEvent('Click: Random');
                  const yes = confirm(t('ui.confirmRandom'));
                  if (yes) {
                    const rand = Math.round(Math.random() * (GAMES.length - 1));
                    const randGame = GAMES[rand];
                    location.hash = `#${randGame.id}`;
                    setShowModal(null);
                    fireEvent('Game load: Random');
                  }
                }}
              >
                <PlayIcon width={20} height={20} /> {t('common.random')}
              </button>{' '}
              <button
                type="button"
                onClick={() => {
                  fireEvent('Click: Idiom ID');
                  // Ask user for idiom ID, load game if ID is valid
                  let id = prompt(t('ui.promptIdiom'));
                  try {
                    id = new URL(id).hash.slice(1);
                  } catch (e) {}
                  if (id) {
                    const game = GAMES.find((g) => g.id === id);
                    if (game) {
                      location.hash = `#${game.id}`;
                      setShowModal(null);
                      fireEvent('Game load: Idiom ID');
                    } else {
                      alert('Invalid idiom ID');
                    }
                  }
                }}
              >
                <PlayIcon width={20} height={20} /> {t('common.choose')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        id="info-modal"
        class={showInfoModal || !skipFirstTime ? 'appear' : ''}
      >
        {skipFirstTime && (
          <CloseIcon
            height="32"
            width="32"
            class="close"
            onClick={() => {
              setShowInfoModal(false);
            }}
          />
        )}
        <div class="content">
          {prefersColorSchemeSupported && (
            <p class="color-scheme-selector">
              <button
                type="button"
                class={colorScheme === 'dark' ? 'active' : ''}
                onClick={() => {
                  LS.setItem(`${KEY_PREFIX}colorScheme`, 'dark');
                  setColorScheme('dark');
                }}
              >
                🌑
              </button>{' '}
              <button
                type="button"
                class={colorScheme === 'auto' ? 'active' : ''}
                onClick={() => {
                  LS.removeItem(`${KEY_PREFIX}colorScheme`);
                  setColorScheme('auto');
                }}
              >
                🌓
              </button>{' '}
              <button
                type="button"
                class={colorScheme === 'light' ? 'active' : ''}
                onClick={() => {
                  LS.setItem(`${KEY_PREFIX}colorScheme`, 'light');
                  setColorScheme('light');
                }}
              >
                🌕
              </button>
            </p>
          )}{' '}
          <p class="locale-selector">
            🌐{' '}
            <a
              href="./?lng=en"
              hreflang="en"
              rel={i18n.resolvedLanguage === 'en' ? undefined : 'alternate'}
              class={`${i18n.resolvedLanguage === 'en' ? 'selected' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                i18n.changeLanguage('en');
              }}
            >
              English
            </a>{' '}
            &#8901;{' '}
            <a
              href="./?lng=zh-CN"
              hreflang="zh-CN"
              rel={i18n.resolvedLanguage === 'zh' ? undefined : 'alternate'}
              class={`${i18n.resolvedLanguage === 'zh' ? 'selected' : ''}`}
              onClick={(e) => {
                e.preventDefault();
                i18n.changeLanguage('zh-CN');
              }}
            >
              中文
            </a>
          </p>
          {skipFirstTime && (
            <div id="return-user-prompt" class="block" style={{background:'var(--primary-bg-color)',borderRadius:'8px',padding:'12px',margin:'12px 0',textAlign:'center'}}>
              <p style={{margin:'0 0 8px',fontWeight:'bold',fontSize:'15px'}}>
                👋 欢迎回来！ / Welcome back!
              </p>
              <p style={{margin:'0 0 10px',fontSize:'13px',color:'var(--text-insignificant-color)'}}>
                Did you play today's puzzle? Come back tomorrow for a new idiom!
                <br/>你今天玩过今天的成语了吗？明天再来猜新成语！
              </p>
              <form onSubmit={(e) => {
                e.preventDefault();
                const email = e.target.email.value;
                if (email) {
                  fireEvent('Email Subscribe', { props: { email } });
                  alert(t('ui.subscribeSuccess', 'Thanks! We will notify you when a new puzzle is available.'));
                  e.target.reset();
                }
              }}>
                <input
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  required
                  style={{
                    padding:'6px 12px',borderRadius:'4px',border:'1px solid var(--border-color)',
                    fontSize:'14px',width:'200px',marginRight:'6px'
                  }}
                />
                <button type="submit" style={{
                  padding:'6px 16px',borderRadius:'4px',border:'none',
                  background:'var(--button-strong-bg-color)',color:'white',
                  fontWeight:'bold',cursor:'pointer',fontSize:'14px'
                }}>
                  {t('ui.notifyMe', 'Notify Me 🔔')}
                </button>
              </form>
              <p style={{margin:'8px 0 0',fontSize:'11px',color:'var(--text-insignificant-color)'}}>
                Get daily reminders. Unsubscribe anytime.
              </p>
            </div>
          )}
          {skipFirstTime && gamesPlayedCount > 0 && (
            <div id="stats">
              <p>
                <Trans i18nKey="ui.gamesPlayed" components={[<GamesCount />]} />
              </p>
              <div id="config">
                <p>
                  <label>
                    {t('ui.hardMode')}
                    <Switch
                      checked={hardMode}
                      onChange={(checked) => {
                        LS.setItem(
                          `${KEY_PREFIX}hardMode`,
                          checked ? 'true' : 'false',
                        );
                        setHardMode(checked);
                      }}
                    />
                  </label>
                </p>
                <p>
                  <label>
                    {t('ui.soundEffects')}
                    <VolumeSlider class="config-slider" />
                  </label>
                </p>
              </div>
            </div>
          )}
          <h2>{t('howToPlay.heading')}</h2>
          <p>{t('howToPlay.how1')}</p>
          <p>{t('howToPlay.how2')}</p>
          <p>{t('howToPlay.how3')}</p>
          <div class="example-idiom">
            {'九牛一毛'.split('').map((letter, i) => (
              <Tile key={letter} letter={letter} state={i === 0 ? '🟩' : ''} />
            ))}
          </div>
          <p>{t('howToPlay.spotCorrect')}</p>
          <div class="example-idiom">
            {'理所当然'.split('').map((letter, i) => (
              <Tile key={letter} letter={letter} state={i === 1 ? '🟧' : ''} />
            ))}
          </div>
          <p>{t('howToPlay.spotPresent')}</p>
          <div class="example-idiom">
            {'爱不释手'.split('').map((letter, i) => (
              <Tile key={letter} letter={letter} state={i === 2 ? '⬜' : ''} />
            ))}
          </div>
          <p>{t('howToPlay.spotAbsent')}</p>
          <p>{t('howToPlay.how4')}</p>
          {skipFirstTime ? (
            <>
              <h2>{t('about.heading')}</h2>
              <p>
                <Trans
                  i18nKey="about.about1"
                  components={[
                    <a
                      href="https://github.com/fds2003/wordlechinese/"
                      target="_blank" rel="noopener noreferrer"
                    />,
                    <a href="https://cheeaun.com/projects/" target="_blank" rel="noopener noreferrer" />,
                    <a
                      href="https://www.nytimes.com/games/wordle/"
                      target="_blank" rel="noopener noreferrer"
                    />,
                  ]}
                />
              </p>
              <p>
                <Trans
                  i18nKey="about.about2"
                  components={[
                    <a
                      href="https://www.buymeacoffee.com/cheeaun"
                      target="_blank" rel="noopener noreferrer"
                    />,
                  ]}
                />
              </p>
              <h2>{t('feedback.heading')}</h2>
              <ul>
                <li>
                  <a href="https://t.me/+ykuhfiImLd1kNjk1" target="_blank" rel="noopener noreferrer">
                    {t('feedback.telegramGroup')}
                  </a>
                </li>
                <li>
                  <Trans
                    i18nKey="feedback.githubDiscussions"
                    components={[
                      <a
                        href="https://github.com/fds2003/wordlechinese/discussions"
                        target="_blank" rel="noopener noreferrer"
                      />,
                    ]}
                  />
                </li>
                <li>
                  <Trans
                    i18nKey="feedback.githubIssues"
                    components={[
                      <a
                        href="https://github.com/fds2003/wordlechinese/issues"
                        target="_blank" rel="noopener noreferrer"
                      />,
                    ]}
                  />
                </li>
                <li>
                  <a href="https://twitter.com/cheeaun" target="_blank" rel="noopener noreferrer">
                    {t('feedback.twitter')}
                  </a>
                </li>
                <li>
                  <a href="https://t.me/cheeaun" target="_blank" rel="noopener noreferrer">
                    {t('feedback.telegram')}
                  </a>
                </li>
              </ul>
              <details id="debugging-container">
                <summary>
                  {t('debugging.heading')} ({__COMMIT_HASH__})
                </summary>
                <div>
                  Game data:{' '}
                  <button
                    type="button"
                    onClick={() => {
                      // Construct URL
                      const data = exportGameData();
                      const str = JSON.stringify({
                        version: 1,
                        exportDate: new Date(),
                        data,
                      });
                      const bytes = new TextEncoder().encode(str);
                      const blob = new Blob([bytes], {
                        type: 'application/json;charset=utf-8',
                      });
                      const url = URL.createObjectURL(blob);

                      // Trigger download
                      const $a = document.createElement('a');
                      document.body.appendChild($a);
                      $a.style = 'display: none';
                      $a.href = url;
                      $a.download = 'wordlechinese.gamedata.json';
                      $a.click();

                      // Clean up
                      URL.revokeObjectURL(url);
                      $a.remove();
                    }}
                  >
                    Export
                  </button>{' '}
                  <label class="input-file-button">
                    <input
                      type="file"
                      accept=".json"
                      onChange={(event) => {
                        if (window.FileReader) {
                          if (confirm('Are you sure you want to import?')) {
                            try {
                              const fileList = event.target.files;
                              const file = fileList[0];
                              const reader = new FileReader();
                              reader.addEventListener('load', (e) => {
                                const gameData = JSON.parse(
                                  e.target.result,
                                ).data;
                                const overrides = confirm(
                                  'If there are conflicting games data, override them? (Cancel to keep them)',
                                );
                                importGameData(gameData, overrides);
                              });
                              reader.readAsText(file);
                            } catch (e) {
                              alert('Unable to import.');
                            }
                          }
                        } else {
                          alert(
                            'Import feature is not supported by the current browser.',
                          );
                        }
                      }}
                    />
                    <button type="button">Import</button>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t('debugging.confirmResetGame'))) {
                      LS.removeItem(KEY_PREFIX + currentGame.id);
                      location.reload();
                    }
                  }}
                >
                  {t('debugging.resetGame')}
                </button>
                &nbsp;
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t('debugging.confirmClearDB'))) {
                      clearGames();
                      location.reload();
                    }
                  }}
                >
                  {t('debugging.clearDB')}
                </button>
              </details>
              <p style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border-color,#e5e7eb)">
                <a href="/learn-chinese-with-wordle.html">
                  📖 How to Learn Chinese with Wordle
                </a>
              </p>
            </>
          ) : (
            <p>
              <button
                type="button"
                class="large"
                onClick={() => {
                  setShowInfoModal(false);
                  LS.setItem(KEY_PREFIX + 'skipFirstTime', 1);
                  setSkipFirstTime(true);
                }}
              >
                <PlayIcon width="20" height="20" /> {t('ui.startPlay')}
              </button>
            </p>
          )}
        </div>
      </div>
      {showDashboard && (
        <div id="dashboard-modal">
          <CloseIcon
            height="24"
            width="24"
            class="close"
            onClick={() => {
              setShowDashboard(false);
            }}
          />
          <IdiomsDashboard />
        </div>
      )}
      <Toaster
        containerStyle={{
          top: '3.5em',
        }}
        toastOptions={{
          className: 'toast',
          style: {
            pointerEvents: 'none',
          },
        }}
      />
    </>
  );
}
