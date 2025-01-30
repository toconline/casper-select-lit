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

import { LitElement, html, css } from 'lit';

class CasperHighlightable extends LitElement {

  static styles = css`
    .ch-highlight {
      border: 1px solid #CCC;
      font-weight: bold;
      border-radius: 4px;
    }
  `;

  static get properties() {
    return {
      highlight: {
        type: String
      }
    }
  }

  constructor () {
    super();
    this._firstRender = true;
  }

  _specialRegex (value) {
    return new RegExp(this._normalizeValue(value, true), 'ig');
  };

  _includesNormalized (value, search) {
    return (this._normalizeValue(value)).match(this._specialRegex(search));
  }

  _normalizeValue (value, escape=false) {
    let normalizedValue = value.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    if (escape) normalizedValue = normalizedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return normalizedValue;
  }

  firstUpdated () {
    this._firstRender = false;
    this._originalText = this.textContent;
    this.requestUpdate();
  }

  render () {
    if (this._firstRender || !this.highlight || !this._includesNormalized(this._originalText, this.highlight)) {
      return html`
        <slot id="main-slot"></slot>
      `;
    } else {

      let match;
      let htmlFinal = html``;
      let text      = this._originalText;

      const normalizedValue = this._normalizeValue(this._originalText);
      const valueLength     = this._normalizeValue(this.highlight).length;
      const highlightRegex  = this._specialRegex(this.highlight);

      while ((match = highlightRegex.exec(normalizedValue)) !== null) {
        const originalHighlight = this._originalText.substr(match.index, valueLength);
        const replacedName      = text.replace(originalHighlight, '__CHIGHLIGHT__');
        const splitName         = replacedName.split('__CHIGHLIGHT__');

        text = splitName[1];
        htmlFinal = html`${htmlFinal}${splitName[0]}<span class="ch-highlight">${originalHighlight}</span>`
      }

      return html`${htmlFinal}${text}`;
    }
  }
}

window.customElements.define('casper-highlightable', CasperHighlightable);
