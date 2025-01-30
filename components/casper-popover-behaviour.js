/* 
 * Copyright (C) 2021 Cloudware S.A. All rights reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createPopper } from '@popperjs/core';
import maxSize from 'popper-max-size-modifier';

export default class CasperPopoverBehaviour {

	constructor (target, element, fitInto, customOpts={}) {

    this.flipped = () => {};
    this.opened  = () => {};
    this.closed  = () => {};

    this.open          = false;
    this.target        = target;
    this.element       = element;
    this.fitInto       = (fitInto || target.parentElement);
    this.resetMinWidth = false;

    this.padding   = customOpts.padding   ?? 10;
    this.placement = customOpts.placement || 'bottom';
    this.strategy  = customOpts.strategy  || 'fixed';
    this.minWidth  = customOpts.minWidth  || this.target.getBoundingClientRect().width || 100;
    this.minHeight = customOpts.minHeight || 100;
    this.maxWidth  = customOpts.maxWidth  || this.fitInto.getBoundingClientRect().width;
    this.maxHeight = customOpts.maxHeight;

    this.initialMinWidth = this.minWidth;

    this._opts = this.getPopperOpts();
    this.popperInstance = createPopper(this.target, this.element, this._opts);

    this._eventCloseFunc = (event) => {
      if (event.composedPath().includes(this.target) && !this.open) {
        this.show();
      } else if (!event.composedPath().includes(this.element)) {
        this.hide();
      }
    };
    this._eventCloseFunc = this._eventCloseFunc.bind(this);
    document.addEventListener("click", this._eventCloseFunc);
    this._closeOnEsc = (event) => {
      if (event && event.key === 'Escape') {
        this.hide();
      }
    };
    this._closeOnEsc = this._closeOnEsc.bind(this);
    document.addEventListener("keydown", this._closeOnEsc);

    this._preventIronOverlayCanceled = (event) => {event.preventDefault()};
    this.element.style.display = 'none';
	}

  clear () {
    this.popperInstance.destroy();
    document.removeEventListener("click", this._eventCloseFunc);
    document.removeEventListener("keydown", this._closeOnEsc);
  }

  getPopperOpts () {
    const maxSizeFunc = (state) => {
      const {width, height} = state.modifiersData.maxSize;

      if (this.resetMinWidth) {
        this.minWidth = this.initialMinWidth;
        this.resetMinWidth = false;
      } else if (state.rects.popper.width > this.minWidth) {
        this.minWidth = state.rects.popper.width;
      }

      state.styles.popper = {
        ...state.styles.popper,
        minWidth: `${this.minWidth - (this.padding)}px`,
        maxWidth: `${this.maxWidth - (this.padding)}px`,
        maxHeight:`${(this.maxHeight || Math.max(this.minHeight, height))}px`,
      };
    };

    const flipFunc = (state) => {
      if (state.placement !== this.placement) {
        this.flipped(state.placement);
      }
    }

    return {
      strategy: this.strategy,
      placement: this.placement,
      modifiers: [
        {
          name: 'flip',
          options: {
            boundary: this.fitInto
          },
        },
        {
          name: 'preventOverflow',
          options: {
            boundary: this.fitInto,
            padding: this.padding
          },
        },
        {
          ...maxSize,
          options: {
            boundary: this.fitInto,
            padding: this.padding
          }
        },
        {
          name: 'applyMaxSize',
          phase: 'beforeWrite',
          enabled: true,
          requires: ['maxSize'],
          fn({state}) {
            maxSizeFunc(state);
          }
        },
        {
          name: 'flipNotifier',
          enabled: true,
          phase: 'afterWrite',
          fn({ state }) {
            flipFunc(state);
          }
        }
      ]
    };
  }

  async resetOpts () {
    await this.popperInstance.setOptions(this.getPopperOpts());
  }

  async update () {
    await this.popperInstance.update();
    this.popperInstance.forceUpdate();
  }

	async show () {
    // Make the element visible
    if (!this.open) {
      this.open = true;
      this.element.style.display = 'block';
      this.element.style.zIndex = 500;

      this.element.setAttribute('open', true);

      // TODO: Do we need to deal with iron-overlay?
      document.addEventListener("iron-overlay-canceled", this._preventIronOverlayCanceled);

      await this.popperInstance.update();
      this.opened();
    }
  }

  hide () {
    // Hide the element
    if (this.open) {
      this.open = false;

      this.element.removeAttribute('open');
      this.element.style.zIndex = 1;

      this.element.style.display = 'none';

      // TODO: Do we need to deal with iron-overlay?
      document.removeEventListener("iron-overlay-canceled", this._preventIronOverlayCanceled);

      this.closed();
    }
  }
}
