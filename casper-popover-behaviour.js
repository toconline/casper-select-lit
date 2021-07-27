import { createPopper } from '@popperjs/core';
import maxSize from 'popper-max-size-modifier';

export default class CasperPopoverBehaviour {

	constructor (target, element, fitInto, customOpts={}) {

    this.flipped = () => {};
    this.opened = () => {};
    this.closed = () => {};
    this.open = false;

    this.target = target;
    this.element = element;
    this.fitInto = (fitInto || target.parentElement);

    this.padding = customOpts.padding     || 10;
    this.placement = customOpts.placement || 'bottom';
    this.strategy =  customOpts.strategy  || 'fixed';
    this.minWidth = customOpts.minWidth   || 100;
    this.minHeight = customOpts.minHeight || 100;
    this.maxWidth = customOpts.maxWidth;
    this.maxHeight  = customOpts.maxHeight;

    this._opts = this.getPopperOpts();
    this.popperInstance = createPopper(this.target, this.element, this._opts);

    this.eventCloseFunc = (event) => {
      if (event.composedPath().includes(this.target) && !this.open) {
        this.show();
      } else if (!event.composedPath().includes(this.element)) {
        this.hide();
      }
    };
    this.eventCloseFunc = this.eventCloseFunc.bind(this);
    document.addEventListener("click", this.eventCloseFunc);

    this.element.style.display = 'none';
	}

  clear () {
    this.popperInstance.destroy();
    document.removeEventListener("click", this.eventCloseFunc);
  }

  getPopperOpts () {
    const maxSizeFunc = (state) => {
      const {width, height} = state.modifiersData.maxSize;
      if (state.rects.popper.width > this.minWidth) this.minWidth = state.rects.popper.width;

      state.styles.popper = {
        ...state.styles.popper,
        minWidth: `${this.minWidth - (this.padding)}px`,
        maxWidth: `${this.maxWidth - (this.padding)}px`,
        maxHeight:`${(this.maxHeight || Math.max(this.minHeight, height))}px`,
      };
    };

    const flipFunc = (state) => {
      if (state.placement !== 'bottom') {
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

      this.closed();
    }
  }
}