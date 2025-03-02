/*
 * https://github.com/morethanwords/tweb
 * Copyright (C) 2019-2021 Eduard Kuzmenko
 * https://github.com/morethanwords/tweb/blob/master/LICENSE
 */

import {createEffect, createRoot, createSignal, onCleanup} from 'solid-js';
import {animate} from '../../helpers/animation';
import eachSecond from '../../helpers/eachSecond';
import tsNow from '../../helpers/tsNow';
import I18n, {i18n} from '../../lib/langPack';
import {SEND_PAID_REACTION_DELAY} from '../../lib/mtproto/mtproto_config';
import showTooltip from '../tooltip';
import type {PendingPaidReaction} from './reactions';
import type ReactionsElement from './reactions';

export default function showPaidReactionTooltip(props: {
  reactionsElement: ReactionsElement,
  reactionElement: HTMLElement,
  pending: PendingPaidReaction
}) {
  createRoot((dispose) => {
    const [secondsLeft, setSecondsLeft] = createSignal<number>();
    const [progressCircumference, setProgressCircumference] = createSignal<number>();

    const title = new I18n.IntlElement({key: 'PaidReaction.Sent'});
    const subtitle = new I18n.IntlElement({key: 'StarsSentText'});
    title.element.classList.add('text-bold');

    createEffect(() => {
      [title, subtitle].forEach((el) => {
        el.compareAndUpdate({args: [props.pending.count()]});
      });
    });

    createEffect(() => {
      if(!(props.reactionsElement.hasPaidTooltip = !!props.pending.sendTime())) {
        dispose();
        close();
      } else {
        const disposeTimer = eachSecond(() => {
          setSecondsLeft((props.pending.sendTime() - Date.now()) / 1000 | 0);
        });

        animate(() => {
          const progress = (props.pending.sendTime() - Date.now()) / SEND_PAID_REACTION_DELAY;
          setProgressCircumference(progress * circumference);
          return !cleaned;
        });

        let cleaned = false;
        onCleanup(() => {
          cleaned = true;
          disposeTimer();
        });
      }
    });

    const size = 24;
    const radius = 10;
    const circumference = radius * 2 * Math.PI;

    const {close} = showTooltip({
      element: props.reactionElement,
      container: props.reactionsElement,
      vertical: 'top',
      textElement: title.element,
      subtitleElement: subtitle.element,
      rightElement: (
        <span
          class="tooltip-undo"
          onClick={() => props.pending.cancel()}
        >
          {i18n('StarsSentUndo')}
          <span class="tooltip-undo-timer">
            <svg class="tooltip-undo-timer-svg" width={size + 'px'} height={size + 'px'}>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                class="tooltip-undo-timer-circle"
                transform={`rotate(-90, ${size / 2}, ${size / 2})`}
                stroke-dasharray={`${progressCircumference()} ${circumference}`}
              ></circle>
            </svg>
            <span class="tooltip-undo-timer-number">{'' + secondsLeft()}</span>
          </span>
        </span>
      ),
      icon: 'star',
      mountOn: props.reactionElement,
      relative: true
    });
  });
}
