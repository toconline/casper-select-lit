import { LitElement, html, css, unsafeCSS } from 'lit';
import { CasperSelectLit } from './casper-select-lit.js';

class CasperMultiSelect extends CasperSelectLit {
  constructor () {
    super();

    this.valueSeparator = ';';
  }

  render () {
    return html`
      ${this.customInput ? '' : html `
        <paper-input label="${this.label}" ?no-label-float="${this.noLabelFloat}" ?always-float-label="${this.alwaysFloatLabel}" id="cs-input">
          <slot name="cs-prefix" slot="prefix"></slot>
          <div slot="suffix" class="cs__suffix">
            ${this.value !== undefined && !this.disableClear ? html`<casper-icon @click="${this.clearValue}" class="cs__times-icon" icon="fa-light:times"></casper-icon>` : ''}
            <casper-icon class="cs__down-icon ${this._csInputIcon}" icon="fa-regular:angle-down"></casper-icon>
          </div>
        </paper-input>
      `}
      <casper-virtual-scroller
        id="cvs"
        part="virtual-scroller"
        delaySetup
        multiSelect
        .items="${this.items}"
        .height="${this.listHeight}"
        ?loading="${this.loading}"
        .idProp="${this.idProp}"
        .lineCss="${this.lineCss}"
        .textProp="${this.textProp}"
        .dataSize="${this._dataLength}"
        .renderLine="${this._renderLine}"
        .startIndex="${this._initialIdx}"
        .unlistedItem="${this._unlistedItem}"
        .unsafeRender="${this.unsafeRender}"
        .renderNoItems="${this._renderNoItems}"
        .renderSeparator="${this.renderSeparator}"
        .renderPlaceholder="${this.renderPlaceholder}">
      </casper-virtual-scroller>
      ${this.error ? html`<p class="cs__error-label">${this.error}</p>` : ''}
    `;
  }

  /*
   * Adds new value to array of values
   */
  async addValue (id) {
    if (this.value) {
      await this.setValue(`${this.value};${id}`);
    } else {
      await this.setValue(id);
    }
  }

  /*
   * Removes a value from array of values
   */
  async removeValue (id) {
    if (this.value) {
      await this.setValue(this.value.split(this.valueSeparator).filter(e => e !== id).join(this.valueSeparator));
    }
  }

  /*
   * Sets a new array of values
   */
  async setValue (id, item, force = false) {
    if (id != this.value || force) {
      this.value = id;
      const ids = this.value.split(this.valueSeparator);
      this._cvs.selectedItems = ids;

      if (!item && this.items && this.items.length > 0) {
        item = [];
        ids.forEach(singleId => {
          // If we dont have an item try to look for it
          item.push(this.items?.filter(it => it?.[this.idProp] == singleId)?.[0]);
        });
      }

      this.error = undefined;
      if (this.searchInput.invalid) this.searchInput.invalid = false;

      if (force === false) {
        this.dispatchEvent(new CustomEvent('change', {
          detail: {
            value: this.value,
            items: item
          },
          bubbles: true,
          composed: true
        }));
      }
    }
  }

  /*
   * Clears the input
   */
  async clearValue (event) {
    this._cvs.selectedItems = [];
    await super.clearValue();
  }

  /*
   * Setup the popover that contains the scroller
   */
  _setupPopover () {
    super._setupPopover();

    // We only need to override open function
    this._popover.opened = async () => {
      // Callback when popover is opened
      this._csInputIcon = 'cs__down-icon--rotate-up';

      // When popover opens restore search value
      this.searchInput.value = this._searchValue === undefined ? '' : this._searchValue;

      // Reset minimum list width to be the same as the input width
      // We wont have the final searchInput width in firstUpdated
      this._popover.minWidth = (this.listMinWidth || this.searchInput.getBoundingClientRect().width);
      this._popover.initialMinWidth = this._popover.minWidth;

      await this._setupData();

      await this._updateScroller();
      this.dispatchEvent(new CustomEvent('popover-opened', {
        bubbles: true,
        composed: true
      }));
    };
  }

  _selectLine (event) {
    if (event && event.detail) {
      if (this.value && this.value.split(this.valueSeparator).includes(event.detail.id)) {
        this.removeValue(event.detail.id);
      } else {
        this.addValue(event.detail.id);
      }
    }
  }

}

window.customElements.define('casper-multi-select', CasperMultiSelect);