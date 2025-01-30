/* 
 * Copyright (C) 2023 Cloudware S.A. All rights reserved.
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

import { LitElement, html, css, unsafeCSS } from 'lit';
import { CasperSelectLit } from './casper-select-lit.js';

class CasperMultiSelect extends CasperSelectLit {
  constructor () {
    super();

    this.valueSeparator = ';';
    this.okButtonLabel = 'Concluído';
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
        multi-select
        .items="${this.items}"
        .height="${this.listHeight}"
        ?loading="${this.loading}"
        .idProp="${this.idProp}"
        .lineCss="${this.lineCss}"
        .textProp="${this.textProp}"
        .dataSize="${this._dataLength}"
        .renderLine="${this._renderLine}"
        .startIndex="${this._initialIdx}"
        .unsafeRender="${this.unsafeRender}"
        .unlistedItem="${this._unlistedItem}"
        .renderNoItems="${this._renderNoItems}"
        .renderSeparator="${this.renderSeparator}"
        .renderPlaceholder="${this.renderPlaceholder}"
        .okButtonHandler="${this._okButtonHandler.bind(this)}"
        .okButtonLabel="${this.okButtonLabel}">
      </casper-virtual-scroller>
      ${this.error ? html`<p class="cs__error-label">${this.error}</p>` : ''}
    `;
  }

  /*
   * Adds new value to array of values
   */
  async addValue (id) {
    if (this.value) {
      await this.setValue(`${this.value}${this.valueSeparator}${id}`);
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

    this._popover.closed = () => {
      // Callback when popover is closed
      this._csInputIcon = '';

      // When popover closes clear search input if no value
      if (this.value !== undefined) {
        if (this._lazyload) {
          // TODO
        } else if (this.oldLazyLoad) {
          // TODO
        } else {
          const selectedTextItems = this.items.filter(e => this._cvs.selectedItems.includes(e[this.idProp])).map(e => e[this.textProp]);
          this.searchInput.value = selectedTextItems.join(this.valueSeparator + ' ');
        }
        if (this.acceptUnlistedValue && this.searchInput.value === undefined) {
          this.searchInput.value = this.value
        }
      } else {
        this.searchInput.value = '';
      }
      this.requestUpdate();
      this.dispatchEvent(new CustomEvent('popover-closed', {
        bubbles: true,
        composed: true
      }));
    };
  }

  _selectLine (event) {
    if (event && event.detail) {
      if (this.value && this.value.split(this.valueSeparator).includes(String(event.detail.id))) {
        this.removeValue(String(event.detail.id));
      } else {
        this.addValue(String(event.detail.id));
      }
    }
  }

  _okButtonHandler () {
    this.dispatchEvent(new CustomEvent('ok-button-pressed', {
      detail: {
        value: this.value
      },
      bubbles: true,
      composed: true
    }));
    this.hidePopover();
  } 

}

window.customElements.define('casper-multi-select', CasperMultiSelect);
