import { LitElement, html, css, unsafeCSS } from 'lit';
import '@polymer/paper-input/paper-input.js';
import '@cloudware-casper/casper-icons/casper-icon.js';
import '@cloudware-casper/casper-virtual-scroller/casper-virtual-scroller.js';

import CasperPopoverBehaviour from './casper-popover-behaviour.js';

class CasperSelectLit extends LitElement {
  static styles = css`
    :host {
      height: fit-content;
    }
    .cs-suffix-icons {
      display: inline-flex;
    }
    .cs-down-icon {
      width: 15px;
      height: 15px;
      cursor: pointer;
      transition: transform 0.25s linear;
    }
    .cs-down-icon-up {
      transform: rotate(-180deg);
    }
    .cs-times-icon {
      width: 15px;
      height: 15px;
      font-size: 0.3em;
      cursor: pointer;
      transition: transform 0.2s linear;
    }
    .cs-times-icon:hover {
      transform: rotate(-90deg);
    }
    #cvs {
      overflow: auto;
      border: 1px solid #AAA;
      background-color: white;
      border-radius: 0 0 3px 3px;
      transition: width 250ms linear;
      box-shadow: rgb(25 59 103 / 5%) 0px 0px 0px 1px, rgb(28 55 90 / 16%) 0px 2px 6px -1px, rgb(28 50 79 / 38%) 0px 8px 24px -4px;
    }
    #cvs[open] {
    }
  `;

  static get properties() {
    return {
      value: {
        type: String
      },
      label: {
        type: String
      },
      minHeight: {
        type: Number
      },
      height: {
        type: Number
      },
      minWidth: {
        type: Number
      },
      maxWidth: {
        type: Number
      },
      width: {
        type: Number
      },
      initialId: {
        type: Number
      },
      dataSize: {
        type: Number
      },
      textProp: {
        type: String
      },
      lazyLoadResource: {
        type: String
      },
      tableName: {
        type: String
      },
      tableSchema: {
        type: String
      },
      idColumn: {
        type: String
      },
      sortColumn: {
        type: String
      },
      lineCss: {
        type: String
      },
      unsafeRender: {
        type: Boolean
      },
      highlight: {
        type: Boolean
      },
      disableClear: {
        type: Boolean
      },
      loading: {
        type: Boolean
      },
      lazyLoadFilterFields: {
        type: Array
      },
      items: {
        type: Array
      },
      lazyLoadCustomFilters: {
        type: Object
      },
      customInput: {
        type: Object
      },
      socket: {
        type: Object
      },
      fitInto: {
        type: Object
      },
      page: {
        type: Object
      },
      resourceFormatter: {
        type: Function
      },
      renderPlaceholder: {
        type: Function
      },
      renderLine: {
        type: Function
      },
      _lazyload: {
        type: Boolean,
        attribute: false
      },
      _requested: {
        type: Boolean,
        attribute: false
      },
      _originalResource: {
        type: String,
        attribute: false
      },
      _initialItems: {
        type: Array,
        attribute: false
      },
      _freshItems: {
        type: Array,
        attribute: false
      },
      _inputString: {
        type: String,
        attribute: false
      },
      _searchValue: {
        type: String,
        attribute: false
      },
      _initialIdx: {
        type: Number,
        attribute: false
      }
    }
  }

  constructor () {
    super();
    this._csInputIcon = 'cs-down-icon-down';
    this._dataReady = false;
    this.loading = false;

    this.idColumn = 'id';
    this.tableSchema = 'sharded';
    this.textProp = 'name';
    this.dataSize = 100;
    this.minHeight = 200;
  }

  connectedCallback () {
    super.connectedCallback();
  }

  disconnectedCallback () {
    super.disconnectedCallback();
    if (this._popover) {
      this._popover.clear();
    }
    if (this.socket) {
      this.socket.unsubscribeAllLazyload(3000);
    }
  }

  updated (changedProperties) {
    if (changedProperties.has('fitInto')) {
      // Fit into has changed, update popover
      this._popover.fitInto = this.fitInto;
      this._popover.maxWidth = (this.maxWidth || this.fitInto.getBoundingClientRect().width);
      this._popover.resetOpts();
    }

    if (changedProperties.has('initialId')) {
      this._initialIdChanged();
    }

    if (changedProperties.has('items')) {
      this._itemsChanged();
    }
  }

  /*
   * Clears the input
   */
  clearValue (event) {
    this.value = undefined;
    this._cvs.selectedItem = undefined;
    this._searchValue = undefined;
    this._searchInput.value = this._searchValue;

    this._popover.hide();
    this.requestUpdate();
    this.blur();
    event.stopPropagation();
  }

  /*
   * Sets a new value
   */
  setValue (id) {
    this.value = id;
    this._cvs.selectedItem = this.value;
    this._popover.hide();
  }

  /*
   * Toggles the popover
   */
  togglePopover (event) {
    if (this._popover) {
      this._popover.open ? this._popover.hide() : this._popover.show();
      event.stopPropagation();
    }
  }

  /*
   * Gets called when users scrolls to fetch more items from the server
   */
  async _fetchItems (dir, index) {
    console.log(`%c Requested -> ${index}`, 'background: red; color: white');
    if (dir === 'up') {
      const requestPayload = {
                              idColumn: this.idColumn,
                              activeId: +this.items[this.items.length-1].id,
                              nrOfItems: this.dataSize,
                              activeIndex: Math.max(0, index-this.dataSize+1),
                              ratio: 1
                             };
      try {
        const response = await this.socket.getLazyload(this.lazyLoadResource, requestPayload, 3000);
        const responseIncluded = response.included;
        let responseData = response.data;
        responseData.forEach(item => { if (this.resourceFormatter) { this.resourceFormatter.call(this.page || {}, item, responseIncluded); }});
        this._freshItems = responseData;
        this._cvs.appendBeginning(Math.max(0, index-this.dataSize+1), responseData);
      } catch (error) {
        debugger;
        console.error(error);
      }
    } else if (dir === 'down' || dir === 'none') {
      const requestPayload = {
                              idColumn: this.idColumn,
                              activeId: +this.items[this.items.length-1].id,
                              nrOfItems: this.dataSize,
                              activeIndex: index,
                              ratio: 1
                             };

      try {
        const response = await this.socket.getLazyload(this.lazyLoadResource, requestPayload, 3000);
        const responseIncluded = response.included;
        let responseData = response.data;
        responseData.forEach(item => { if (this.resourceFormatter) { this.resourceFormatter.call(this.page || {}, item, responseIncluded); }});
        this._freshItems = responseData;
        this._cvs.appendEnd(index, responseData);
      } catch (error) {
        debugger;
        console.error(error);
      }
    }

    if (this._requestQueue !== undefined) {
      if (this._requestQueue.dir !== dir && this._requestQueue.index !== index) {
        this._fetchItems(this._requestQueue.dir, this._requestQueue.index);
      } else {
        this._requested = false;
      }
      this._requestQueue = undefined;
    } else {
      this._requested = false;
    }
  }

  /*
   * Debounce function, useful to avoid spamming the server with requests
   */
  _debounce (func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };


  /*
   * More or less the same code that was in the old casper-select
   * Applies filters to the resource
   */
  _applyFiltersURL () {
    let resourceUrlParams = [];
    let filterParams = Object.values(this.lazyLoadCustomFilters || {}).filter(field => field).join(' AND ');

    if (this._searchValue && this.lazyLoadFilterFields) {
      // Escape the % characters that have a special meaning in the ILIKE clause.
      let escapedSearchInputValue = this._searchValue.replace(/[%\\]/g, '\$&');
      escapedSearchInputValue = escapedSearchInputValue.replace(/[&]/g, '_');

      // Build the filter parameters.
      const customFilterParams = this.lazyLoadFilterFields
        .filter(filterField => !Object.keys(this.lazyLoadCustomFilters || {}).includes(filterField.constructor === String ? filterField : filterField.field))
        .map(filterField => {
          if (filterField.constructor === String) {
            return `unaccent(${filterField})::TEXT ILIKE unaccent('%${escapedSearchInputValue}%')`;
          }

          if (filterField.constructor === Object && filterField.field && filterField.filterType) {
            switch (filterField.filterType) {
              case 'exact': return `unaccent(${filterField.field})::TEXT ILIKE unaccent('${escapedSearchInputValue}')`;
              case 'endsWith': return `unaccent(${filterField.field})::TEXT ILIKE unaccent('%${escapedSearchInputValue}')`;
              case 'contains': return `unaccent(${filterField.field})::TEXT ILIKE unaccent('%${escapedSearchInputValue}%')`;
              case 'startsWith': return `unaccent(${filterField.field})::TEXT ILIKE unaccent('${escapedSearchInputValue}%')`;
            }
          }
        }).join(' OR ');

      if (customFilterParams) {
        filterParams
          ? filterParams += ` AND (${customFilterParams})`
          : filterParams += customFilterParams;
      }
    }

    if (filterParams) {
      resourceUrlParams.push(`filter="(${filterParams})"`);
    }

    // Check if the resource URL already contains a ? which indicates some parameters were already given.
    let modifiedResource = this._originalResource.includes('?')
      ? `${this._originalResource}&${resourceUrlParams.join('&')}`
      : `${this._originalResource}?${resourceUrlParams.join('&')}`;
    // Encode % and '
    modifiedResource = modifiedResource.replace(/%/g, "%25");
    modifiedResource = modifiedResource.replace(/'/g, "%27");
    return modifiedResource;
  }

  /*
   * Subscribes to the new filtered resource and changes the items
   */
  async _filterLazyLoad () {
    this.loading = true;
    this.requestUpdate();

    if (this._searchValue === "") {
      this.lazyLoadResource = this._originalResource;
    } else {
      this.lazyLoadResource = this._applyFiltersURL();
    }
    this._initialIdx = 0;

    let subscribeResponse;
    try {
      console.time('subscribe');

      const subscribeData =  {idColumn: this.idColumn,
                              parentColumn: 'NULL',
                              sortColumn: this.sortColumn};

      subscribeResponse = await this.socket.subscribeLazyload(this.lazyLoadResource, subscribeData, 15000);
      console.timeEnd('subscribe');
    } catch (error) {
      debugger;
      console.error(error);
    }
    this._dataLength = subscribeResponse.user_ids_size;
    const activeId = subscribeResponse.user_first_id;

    if (this._dataLength > 0) {
      const response = await this.socket.getLazyload(this.lazyLoadResource, {idColumn: this.idColumn, activeId: +activeId, activeIndex: +this._initialIdx, ratio: 1}, 3000);
      this.items = response.data;
      const responseIncluded = response.included;
      this.items.forEach(item => { if (this.resourceFormatter) { this.resourceFormatter.call(this.page || {}, item, responseIncluded); }});
      this._freshItems = JSON.parse(JSON.stringify(this.items));
    } else {
      this.items = [];
    }

    this.loading = false;

    await this._updateScroller();
  }

  async _filterItems () {
    if ((!this._lazyload || this.lazyLoadFilterFields) && this._dataReady) {
      this._debouncedFilter();
    }
  }

  /*
   * Asks the socket for the index of a given id
   */
  async _getIndexForId (id) {
    try {
      const getIdxResponse = await this.socket.getIndexLazyload(this.lazyLoadResource, +id, 3000);
      return getIdxResponse.found_index;
    } catch (error) {
      debugger;
      // TODO: deal with errors
      console.error(error);
    }
    return -1;
  }

  /*
   * Gets called when the search input value changes through user input
   */
  _userInput (e) {
    if (e && e.inputType) {
      this._searchValue = this._searchInput.value;
      this._filterItems();
    }
  }

  async _setupData () {
    if (this._lazyload) {
      this.loading = true;
      this.requestUpdate();

      // Subscribe to the resource
      let subscribeResponse;
      try {
        console.time('subscribe');

        const subscribeData =  {idColumn: this.idColumn,
                                parentColumn: 'NULL',
                                sortColumn: this.sortColumn,
                                tableSchema: this.tableSchema,
                                tableName: this.tableName};

        subscribeResponse = await this.socket.subscribeLazyload(this.lazyLoadResource, subscribeData, 15000);
        console.timeEnd('subscribe');
      } catch (error) {
        debugger;
        // TODO: deal with subscribe errors
        console.error(error);
      }
      this._dataLength = subscribeResponse.user_ids_size;

      // Find the index of the initial id
      const initialIndex = await this._getIndexForId(+this.initialId);
      if (initialIndex > -1) {
        this._initialIdx = initialIndex;
      } else {
        this._initialIdx = 0;
      }

      let getResponse;
      try {
        getResponse = await this.socket.getLazyload(this.lazyLoadResource, {idColumn: this.idColumn, activeId: +this.initialId, activeIndex: this._initialIdx, ratio: 1}, 3000);
      } catch (error) {
        debugger;
        // TODO: deal with errors
        console.error(error);
      }
      this.items = getResponse.data;
      const responseIncluded = getResponse.included;
      this.items.forEach(item => { if (this.resourceFormatter) { this.resourceFormatter.call(this.page || {}, item, responseIncluded); }});
      this._freshItems = JSON.parse(JSON.stringify(this.items));
      this.loading = false;
    } else {
      this._initialItems = JSON.parse(JSON.stringify(this.items));
    }

    // Update dom with the changes
    this.requestUpdate();
    await this.updateComplete;

    // Since we are delaying the cvs setup we have to do it manually
    await this._cvs.initialSetup();
  }

  /*
   * Setup the popover that contains the scroller
   */
  _setupPopover () {
    this.fitInto = this.fitInto || this.parentElement || document.documentElement;

    this._popover = new CasperPopoverBehaviour(this._searchInput,
                                               this._cvs,
                                               this.fitInto,
                                               {
                                                 minWidth: this.minWidth,
                                                 maxWidth: this.maxWidth,
                                                 minHeight: this.minHeight
                                               });

    this._popover.flipped = (placement) => {
      // Callback when popover changes from below the input to above the input
      this._cvs.refreshHeight();
    };
    this._popover.opened = async () => {
      // Callback when popover is opened
      this._csInputIcon = 'cs-down-icon-up';

      // When popover opens restore search value
      this._searchInput.value = this._searchValue === undefined ? '' : this._searchValue;

      // Reset minimum list width to be the same as the input width
      // We wont have the final searchInput width in firstUpdated
      this._popover.minWidth = (this.minWidth || this._searchInput.getBoundingClientRect().width);
      this._popover.initialMinWidth = this._popover.minWidth;

      if (!this._dataReady) {
        // First time opening the popover setup data
        await this._setupData();
        this._dataReady = true;
      } else {
        if (this.value) {
          if (this._lazyload) {
            if (!this._searchValue) {
              // We need to ask the socket for the index because we might not have the item in memory
              const valueIndex = await this._getIndexForId(this.value);
              if (valueIndex > -1) this._cvs.scrollToIndex(valueIndex);
            }

          } else {
            // If we are not lazyloading we should have the item in memory
            this._cvs.selectedItem = this.value;
            this._cvs.scrollToId(this.value);
          }
        }
      }
      await this._updateScroller();
    };
    this._popover.closed = () => {
      // Callback when popover is closed
      this._csInputIcon = 'cs-down-icon-down';

      // When popover closes clear search input if no value
      if (this.value !== undefined) {
        if (this._lazyload) {
          this._searchInput.value = this._freshItems.filter(e=>e.id == this.value)[0]?.[this.textProp];
          if (this._searchInput.value === undefined) this._searchInput.value = this._inputString;
        } else {
          this._searchInput.value = this._initialItems.filter(e=>e.id == this.value)[0]?.[this.textProp];
        }
      } else {
        this._searchInput.value = '';
      }
      this.requestUpdate();
    };
  }

  async _setupLazyLoad () {
    this._originalResource = this.lazyLoadResource;

    this._debouncedFilter = this._debounce(() => {
      this._filterLazyLoad();
    }, 250);

    this._cvs.addEventListener('cvs-request-items', async (event) => {
      const dir = event.detail.direction;
      const index = event.detail.index;

      console.log(`%c Received request ${dir} -> ${index}`, 'background: white; color: blue');
      if (!this._requested) {
        this._requested = true;
        await this._fetchItems(dir, index);
        this._updateScroller();
      } else {
        this._requestQueue = {dir: dir, index: index};
      }
    });

    await this._initialIdChanged();

    this._requested = false;
    this._requestQueue = undefined;
  }

  async _initialIdChanged () {
    if (this.initialId !== undefined) {
      // Set initial value
      this.setValue(this.initialId);

      if (this._lazyload) {
        try {
          await this.updateComplete;

          // TODO: inject id more gracefuly
          const response = await this.socket.jget(`${this.lazyLoadResource}/${this.value}`, 3000);
          this._inputString = response.data?.[this.textProp];
          this._searchInput.value = response.data?.[this.textProp];
        } catch (error) {
          // TODO solve issue with socket 2 connecting state
          if (error.code == 11) {
            setTimeout(async () => {
              try {
                const response = await this.socket.jget(`${this.lazyLoadResource}/${this.value}`, 3000);
                this._inputString = response.data?.[this.textProp];
                this._searchInput.value = response.data?.[this.textProp];
              } catch (error) {
                debugger;
                console.error(error);
              }
            }, 200);
          } else {
            debugger;
            console.error(error);
          }
        }
      } else {
        for (let idx = 0; idx < this.items.length; idx++) {
          if (this.items[idx].id === this.initialId) {
            this._initialIdx = idx;
            this._inputString = this.items[idx][this.textProp];
            this._searchInput.value = this.items[idx][this.textProp];
            break;
          }
        }
      }
    }
  }

  _itemsChanged () {
    // Reset Width
    this._popover.resetMinWidth = true;
  }

  async _updateScroller () {
    console.log('-- Updating Scroller --');
    this.requestUpdate();
    await this.updateComplete;
    this._cvs.requestUpdate();
    await this._cvs.updateComplete;
    await this._popover.update();
  }

  _specialRegex (value) {
    return new RegExp(this._normalizeValue(value), 'i');
  };

  _includesNormalized (value, search) {
    return (this._normalizeValue(value)).match(this._specialRegex(search));
  }

  _normalizeValue (value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  }

  /*
   * Lit function thats called when component finishes the first render
   */
  firstUpdated () {

    this._searchInput = this.customInput || this.shadowRoot.getElementById('cs-input');
    this._cvs = this.shadowRoot.getElementById('cvs');

    this._setupPopover();

    this.lazyLoadResource ? this._lazyload = true : this._lazyload = false;

    if (this._lazyload) {
      this._setupLazyLoad();
    } else {
      this._initialIdChanged();

      if (!this.items) {
        // If we don't have items and we are not lazyloading use classic HTML options
        const options = this.querySelectorAll('option');
        let tmpItems = [];
        if (options.length > 0) {
          options.forEach(item => {
            if (item.value && item.innerText) {
              tmpItems.push({id: item.value, name: item.innerText});
            }
          });
        }
        this.items = tmpItems;
      } else if (this.items.length > 0 && typeof this.items[0] !== 'object') {
        // If we are not using an array of objects use simple array with item index as id
        for (let idx = 0; idx < this.items.length; idx++) {
          const item = this.items[idx];
          this.items[idx] = {id: idx+1, name: item};
        }
      }

      this._debouncedFilter = this._debounce(async () => {
        // Normal filtering
        this.items = this._initialItems.filter(item => this._includesNormalized(item[this.textProp],this._searchValue));
        this._dataLength = this.items.length;
        await this._updateScroller();
      }, 250);

      this._dataLength = this.items.length;
    }

    this._searchInput.addEventListener('input', this._userInput.bind(this));
    this._cvs.addEventListener('cvs-line-selected', (event) => {
      if (event && event.detail) {
        this._inputString = event.detail.name;
        this.setValue(event.detail.id);
      }
    });

    this._searchInput.addEventListener('keydown', async (event) => {
      await this._popover.show();
      // Forward event to cvs
      this._cvs.dispatchEvent(new KeyboardEvent('keydown', {key: event.key}));
    });

    this.renderLine = this.renderLine.bind(this, this);
  }

  renderLine (cs, item) {
    const highlightValue = cs._searchValue;
    const renderHighlight = (highlightValue) => {
                              const normalizedValue = this._normalizeValue(item[this.textProp]);
                              const indexOfHighlight = normalizedValue.search(this._specialRegex(highlightValue));
                              const valueLength = this._normalizeValue(highlightValue).length;
                              const originalHighlight = item[this.textProp].substr(indexOfHighlight, valueLength);
                              const replacedName = item[this.textProp].replace(originalHighlight, '__CS2HERE__');
                              const splitName = replacedName.split('__CS2HERE__');
                              return html`${splitName[0]}<span class="cvs-item-highlight">${originalHighlight}</span>${splitName[1]}`;
                            };
    return html`
      <style>
        .cvs-item-highlight {
          border: 1px solid #CCC;
          font-weight: bold;
          border-radius: 4px;
        }
        .item-row {
          font-size: 14px;
        }
        .item-row:hover {
          background-color: var(--primary-color);
          color: white;
          cursor: pointer;
        }
        .item-row[active] {
          background-color: var(--dark-primary-color);
          color: white;
        }
        .item-row[active]:hover {
          background-color: var(--primary-color);
          color: white;
          cursor: pointer;
        }
      </style>
      <span>
        ${(highlightValue && item[this.textProp] && this._includesNormalized(item[this.textProp],highlightValue) && this.highlight)
          ? renderHighlight(highlightValue)
          : item[this.textProp]
        }
      </span>
    `;
  }

  render() {
    return html`
      <div class="main-container" style="width: ${this.width}px">
        ${this.customInput ? '' : html `
          <paper-input label="${this.label}" id="cs-input">
            <div slot="suffix" class="cs-suffix-icons">
              ${this.value !== undefined && !this.disableClear ? html`<casper-icon @click="${this.clearValue}" class="cs-times-icon" icon="fa-light:times"></casper-icon>` : ''}
              <casper-icon @click="${this.togglePopover}" class="cs-down-icon ${this._csInputIcon}" icon="fa-regular:angle-down"></casper-icon>
            </div>
          </paper-input>
        `}
        <casper-virtual-scroller
          id="cvs"
          delaySetup
          .items="${this.items}"
          .height="${this.height}"
          ?loading="${this.loading}"
          .lineCss="${this.lineCss}"
          .textProp="${this.textProp}"
          .dataSize="${this._dataLength}"
          .renderLine="${this.renderLine}"
          .startIndex="${this._initialIdx}"
          .unsafeRender="${this.unsafeRender}"
          .renderNoItems="${this.renderNoItems}"
          .renderPlaceholder="${this.renderPlaceholder}">
        </casper-virtual-scroller>
      </div>
    `;
  }
}

window.customElements.define('casper-select-lit', CasperSelectLit);