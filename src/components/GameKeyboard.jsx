import { pinyin } from 'pinyin-pro/lib/pinyin';

import BackspaceIcon from './BackspaceIcon';

const py = pinyin;

const GameKeyboard = ({
  currentGameKeys,
  currentGameKeysPinyin,
  correctKeys,
  presentKeys,
  absentKeys,
  gameState,
  hardMode,
  t,
  onLetter,
  onEnter,
  onBackspace,
  onHint,
  onKeypressStandard,
  onKeypressReturn,
  onKeypressDelete,
}) => (
  <div id="keyboard" class={`${gameState} ${hardMode ? 'hard-mode' : ''}`}>
    <div class="inner">
      <div class="keys">
        {currentGameKeys.map((key, i) => (
          <button
            class={`${correctKeys.has(key) ? '🟩' : ''} ${
              presentKeys.has(key) ? '🟧' : ''
            } ${absentKeys.has(key) ? '⬜' : ''}`}
            type="button"
            tabIndex={-1}
            onPointerDown={() => {
              onKeypressStandard?.();
            }}
            onClick={() => {
              onLetter(key);
            }}
          >
            <ruby>
              {key}
              <rp>(</rp>
              <rt>
                {currentGameKeysPinyin.has(key)
                  ? [...currentGameKeysPinyin.get(key)]
                      .sort((a, b) => a.localeCompare(b, 'zh'))
                      .join(' ⸱ ')
                  : py(key)}
              </rt>
              <rp>)</rp>
            </ruby>
          </button>
        ))}
      </div>
      <div class="row">
        <button
          type="button"
          onPointerDown={() => {
            onKeypressReturn?.();
          }}
          onClick={() => {
            onEnter();
          }}
          tabIndex={-1}
        >
          {t('common.enter')}
        </button>
        {hardMode ? (
          <b class="hard">{t('ui.hardMode')}</b>
        ) : (
          <button
            type="button"
            class="stuck"
            aria-label="Hint"
            onPointerDown={(e) => {
              e.stopPropagation();
              onHint?.();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onHint?.();
            }}
          >
            {t('ui.hint')}
          </button>
        )}
        <button
          type="button"
          onPointerDown={() => {
            onKeypressDelete?.();
          }}
          onClick={() => {
            onBackspace();
          }}
          tabIndex={-1}
        >
          <BackspaceIcon width="24" height="24" />
        </button>
      </div>
    </div>
  </div>
);

export default GameKeyboard;
