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

    this._opts = this.getPopperOpts((customOpts.minWidth || 100),
                                    (customOpts.minHeight || 100),
                                    customOpts.maxWidth,
                                    customOpts.maxHeight);
    this.popperInstance = createPopper(this.target, this.element, this._opts);

    this.eventCloseFunc = (event) => {
      if (event.composedPath().includes(this.target)) {
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

  getPopperOpts (minWidth, minHeight, maxWidth, maxHeight) {
    let flipFunc = (state) => {
      if (state.placement !== 'bottom') {
        this.flipped(state.placement);
      }
    }
    flipFunc = flipFunc.bind(this);

    return {
      placement: 'bottom',
      modifiers: [
        {
          name: 'flip',
          options: {
            // fallbackPlacements: ['bottom-end','bottom-start','top','top-end','top-start'],
            boundary: this.fitInto
          },
        },
        {
          name: 'preventOverflow',
          options: {
            boundary: this.fitInto
          },
        },
        {
          ...maxSize,
          options: {
            boundary: this.fitInto,
            padding: 10
          }
        },
        {
          name: 'applyMaxSize',
          phase: 'beforeWrite',
          enabled: true,
          requires: ['maxSize'],
          fn({state}) {
            const {width, height} = state.modifiersData.maxSize;
            // maxWidth = Math.max(maxWidth,state.modifiersData.maxSize.width) || state.modifiersData.maxSize.width;
            if (state.rects.popper.width > minWidth) minWidth = state.rects.popper.width;

            state.styles.popper = {
              ...state.styles.popper,
              minWidth: `${minWidth}px`,
              maxWidth: `${maxWidth}px`,
              maxHeight:`${(maxHeight || Math.max(minHeight, height))}px`,
            };
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