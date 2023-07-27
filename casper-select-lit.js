import { LitElement, html, css, unsafeCSS } from 'lit';
import '@polymer/paper-input/paper-input.js';
import '@cloudware-casper/casper-icons/casper-icon.js';
import '@cloudware-casper/casper-virtual-scroller/casper-virtual-scroller.js';
import './components/casper-highlightable.js';

import CasperPopoverBehaviour from './components/casper-popover-behaviour.js';

class CasperSelectLit extends LitElement {
  static styles = css`
    :host {
      --cs-font-size: 1rem;
      --cs-prefix-margin: 0.375rem;
      --cs-suffix-margin: 0.375rem;

      font-size: var(--cs-font-size);
      height: fit-content;
    }

    slot[name="cs-prefix"]::slotted(*),
    .cs__suffix {
      display: inline-flex;
      color: var(--paper-input-container-input-color, var(--primary-text-color));
    }

    slot[name="cs-prefix"]::slotted(*:last-child) {
      margin-right: var(--cs-prefix-margin) !important;
    }

    .cs__suffix {
      margin-left: var(--cs-suffix-margin);
    }

    .cs__down-icon,
    .cs__times-icon {
      width: 1rem;
      height: 1rem;
      cursor: pointer;
      transition: transform 0.2s linear;
    }

    .cs__down-icon--rotate-up {
      transform: rotate(-180deg);
    }

    .cs__times-icon:hover {
      transform: rotate(-90deg);
    }

    #cvs {
      --cvs-font-size: calc(var(--cs-font-size) * 0.875);
    }

    .cs__error-label {
      color: var(--error-color);
      font-size: 12px;
      width: 100%;
      min-height: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 0;
      padding: 0;
      margin-top: -5px;
    }
  `;

  static get properties() {
    return {
      items: {},
      value: {
        type: String
      },
      label: {
        type: String
      },
      listHeight: {
        type: Number
      },
      listMinHeight: {
        type: Number
      },
      listMinWidth: {
        type: Number
      },
      listMaxWidth: {
        type: Number
      },
      initialId: {
        type: String
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
      extraColumn: {
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
      noLabelFloat: {
        type: Boolean
      },
      alwaysFloatLabel: {
        type: Boolean
      },
      lazyLoadFilterFields: {
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
      renderSeparator: {
        type: Function
      },
      renderLine: {
        type: Function
      },
      acceptUnlistedValue: {
        type: Boolean
      },
      filterOnly: {
        type: Boolean
      },
      useTsvFilter: {
        type: Boolean
      },
      _unlistedItem: {
        type: Object,
        attribute: false
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
      },
      error: {
        type: String
      }
    }
  }

  _items = [];
  set items(val) {
    let oldVal = this._items;
    if (Array.isArray(val)) {
      this._items = val;
    } else {
      this._items = [];
    }
    this.requestUpdate('items', oldVal);
  }
  get items() { return this._items; }

  get itemsFiltered () {
    if (!this._itemsFilteredPromise)
      this._itemsFilteredPromise = [];
    if (this._itemsFiltered) {
      return new Promise((resolve, reject) => resolve());
    } else {
      return new Promise((resolve, reject) => this._itemsFilteredPromise.push({ resolve: resolve, reject: reject }));
    }
  }

  constructor () {
    super();

    this.idColumn             = 'id';
    this.tableSchema          = 'sharded';
    this.textProp             = 'name';
    this.extraColumn          = 'NULL'
    this.dataSize             = 100;
    this.listMinHeight        = 200;
    this._dataReady           = false;
    this.loading              = false;
    this.autoOpen             = true;
    this.noLabelFloat         = false;
    this.alwaysFloatLabel     = false;
    this.filterOnly           = false;
    this.useTsvFilter         = false;
    this._itemsFiltered       = true;
    this._resubscribeAttempts = 10;
    this._csInputIcon         = '';
    this._resetData           = true;
  }

  connectedCallback () {
    super.connectedCallback();

    this._renderLine = this._renderLine.bind(this);
    this._renderNoItems = this._renderNoItems.bind(this);
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

  //***************************************************************************************//
  //                                ~~~ LIT life cycle ~~~                                 //
  //***************************************************************************************//

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
        .items="${this.items}"
        .height="${this.listHeight}"
        ?loading="${this.loading}"
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
   * Lit function thats called when component finishes the first render
   */
  firstUpdated () {
    this.searchInput = this.customInput || this.shadowRoot.getElementById('cs-input');
    this._cvs = this.shadowRoot.getElementById('cvs');

    this._setupPopover();

    this.lazyLoadResource ? this._lazyload = true : this._lazyload = false;

    if (this._lazyload) {
      this._setupLazyLoad();
    } else {
      if (!this.items || this.items.length === 0) {
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

      // this._initialIdChanged(); // TODO: do we need this?

      this._debouncedFilter = this._debounce(async () => {
        // Normal filtering
        this._resetData = false; // Bypass data reset
        this.items = this._searchValue
          ? this._initialItems.filter(item => !item.separator && this._includesNormalized(item[this.textProp],this._searchValue))
          : JSON.parse(JSON.stringify(this._initialItems));

        if (this.acceptUnlistedValue) this._setUnlistedValue();

        // this._dataLength = this.items.length;
        await this._updateScroller();
        this._resolveItemsFilteredPromise();
      }, 250);

      // this._dataLength = this.items.length;
    }

    this.searchInput.addEventListener('input', this._userInput.bind(this));
    this._cvs.addEventListener('cvs-line-selected', (event) => {
      if (event && event.detail) {
        this._inputString = event.detail.name;
        this.setValue(event.detail.id, event.detail.item);
      }
    });

    this.searchInput.addEventListener('keydown', async (event) => {

      // Avoid messing with the input cursor
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          break;
        case 'ArrowDown':
          event.preventDefault();
          break;
      }

      if ( this.autoOpen ) {
        await this.showPopover();
      }
      // Forward event to cvs
      this._cvs.dispatchEvent(new KeyboardEvent('keydown', {key: event.key}));
    });
  }

  willUpdate (changedProperties) {
    if (changedProperties.has('items')) {
      if (!this._lazyload) {
        this._resetData ? this._dataReady = false : this._resetData = true;

        this._dataLength = this.items.length;
      }
    }
  }

  /*
   * Lit function thats called everytime an attribute changes value
   */
  updated (changedProperties) {
    if (changedProperties.has('fitInto')) {
      // Fit into has changed, update popover
      this._popover.fitInto = this.fitInto;
      this._popover.maxWidth = (this.listMaxWidth || this.fitInto.getBoundingClientRect().width);
      this._popover.resetOpts();
    }

    if (changedProperties.has('initialId')) {
      this._initialIdChanged();
    }

    if (changedProperties.has('items')) {
      this._itemsChanged();
    }

    if (changedProperties.has('_searchValue')) {
      this._filterItems();
    }
  }

  //***************************************************************************************//
  //                               ~~~ Public functions~~~                                 //
  //***************************************************************************************//

  /*
   * Clears the input
   */
  async clearValue (event) {
    event?.stopPropagation();
    this.value = undefined;
    this._cvs.selectedItem = undefined;
    this.searchInput.value = this.value;

    this.dispatchEvent(new CustomEvent('clear-value', {
      detail: {
        value: this.value,
      },
      bubbles: true,
      composed: true
    }));

    this.error = undefined;
    if (this.searchInput.invalid) this.searchInput.invalid = false;
    this.hidePopover();
    this.requestUpdate();
    this.blur();
  }

  /*
   * Sets a new value
   */
  setValue (id, item, force = false) {
    if (id !== this.value || force) {
      this.value = id;
      this._cvs.selectedItem = this.value;

      if (this.items && this.items.length > 0) {
        if (!this._lazyload) {
          this.searchInput.value = this.items.filter(e=>e.id == this.value)[0]?.[this.textProp] || item[this.textProp];
        } else {
          // TODO
        }
        // If we dont have an item try to look for it
        !item ? item = this.items?.filter(it => it?.id == id)?.[0] : true;
      }

      this.error = undefined;
      if (this.searchInput.invalid) this.searchInput.invalid = false;
      this.dispatchEvent(new CustomEvent('change', {
        detail: {
          value: id,
          item: item
        },
        bubbles: true,
        composed: true
      }));
    }

    this.hidePopover();
  }

  /*
   * Toggles the popover
   */
  async togglePopover (event) {
    if ( event ) {
      event.stopPropagation();
    }
    this._popover.open ? this.hidePopover() : await this.showPopover();
  }

  /**
   * Hides the popover
   *
   * @param {Object} event the mouse event
   */
   hidePopover (event) {
    if (!this._popover.open) return;
    if (event) event.stopPropagation();
    this._popover.hide();
  }

  /**
   * Shows the popover
   *
   * @param {Object} event the mouse event
   */
  async showPopover (event) {
    if (this._popover.open) return;
    if (event) event.stopPropagation();
    await this._popover.show();
  }

  //***************************************************************************************//
  //                              ~~~ Private functions~~~                                 //
  //***************************************************************************************//

  _renderLine (item) {
    const highlightValue = this.highlight ? this._searchValue : '';

    if (this.renderLine) {
      return this.renderLine(item, highlightValue);
    } else {
      return html`
        <span>
          ${ item.unlisted
          ? html `${item[this.textProp]} - Não listado`
          : html `<casper-highlightable highlight="${highlightValue}">
                    ${item[this.textProp]}
                  </casper-highlightable>`}
        </span>
      `;
    }
  }

  _renderNoItems () {
    if (this.renderNoItems) {
      return this.renderNoItems();
    } else {
      return this._cvs._renderNoItems();
    }
  }

  /*
   * Subscribes a resource using table or jsonapi if we have filters or don't have a tableName
   */
  async _subscribeResource () {
    if (this.filterOnly && (this._searchValue === undefined || this._searchValue.trim() === '')) return false;

    let subscribeData =  { idColumn: this.idColumn,
                           parentColumn: 'NULL',
                           sortColumn: this.sortColumn };

    if ((this._searchValue === undefined || this._searchValue.trim() === '') && this.tableName) {
      this.lazyLoadResource     = this._originalResource;
      subscribeData.tableSchema = this.tableSchema;
      subscribeData.tableName   = this.tableName;
      // console.log(`Subscribing ${this.lazyLoadResource} using table`);
    } else {
      this.lazyLoadResource      = this._applyFiltersURL();
      subscribeData.parentColumn = this.extraColumn;
      // console.log(`Subscribing ${this.lazyLoadResource} using jsonapi`);
    }

    try {
      console.time('subscribe');
      const subscribedResource = this.lazyLoadResource;  // Save subscribed resource
      const subscribeResponse = await this.socket.subscribeLazyload(this.lazyLoadResource, subscribeData, 15000);
      this._dataLength = subscribeResponse.user_ids_size;
      subscribeResponse.resource = subscribedResource;
      console.timeEnd('subscribe');
      return subscribeResponse;
    } catch (error) {
      console.error(error);
      console.timeEnd('subscribe');
      return;
    }
  }

  async _attemptResubscribe () {

    this._resubscribeAttempts--;

    // console.log(`Session died, resubscribing... ${this._resubscribeAttempts} attempts left`);

    if (this._resubscribeAttempts > 0) {
      await this._subscribeResource();
    }
  }

  /*
   * Gets called when users scrolls to fetch more items from the server
   */
  async _fetchItems (dir, index) {
    // console.log(`%c Requested -> ${index}`, 'background: red; color: white');
    if (dir === 'up') {
      const requestPayload = {
                              idColumn: this.idColumn,
                              activeId: +this.items[this.items.length-1].id,
                              nrOfItems: this.dataSize,
                              activeIndex: Math.max(0, index-this.dataSize+1),
                              ratio: 1
                             };
      try {
        const response         = await this.socket.getLazyload(this.lazyLoadResource, requestPayload, 3000);
        const responseIncluded = response.included;
        const responseData     = response.data;
        responseData.forEach(item => { if (this.resourceFormatter) { this.resourceFormatter.call(this.page || {}, item, responseIncluded, this._searchValue); }});

        this._freshItems = responseData;
        this._cvs.appendBeginning(Math.max(0, index-this.dataSize+1), responseData);
      } catch (error) {
        if (error && error.payload_errors && error.payload_errors[0].internal.why === 'urn not subscribed!') {
          await this._attemptResubscribe();
        } else {
          console.error(error);
        }
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
        const response         = await this.socket.getLazyload(this.lazyLoadResource, requestPayload, 3000);
        const responseIncluded = response.included;
        const responseData     = response.data;
        responseData.forEach(item => { if (this.resourceFormatter) { this.resourceFormatter.call(this.page || {}, item, responseIncluded, this._searchValue); }});

        this._freshItems = responseData;
        this._cvs.appendEnd(index, responseData);
      } catch (error) {
        if (error && error.payload_errors && error.payload_errors[0].internal.why === 'urn not subscribed!') {
          await this._attemptResubscribe();
        } else {
          console.error(error);
        }
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

  _resolveItemsFilteredPromise () {
    this._itemsFiltered = true;
    if (this._itemsFilteredPromise && this._itemsFilteredPromise.length > 0) {
      this._itemsFilteredPromise.forEach(promise => promise.resolve());
      this._itemsFilteredPromise = [];
    }
  }


  /*
   * More or less the same code that was in the old casper-select
   * Applies filters to the resource
   */
  _applyFiltersURL () {
    let resourceUrlParams = [];
    let filterParams = Object.values(this.lazyLoadCustomFilters || {}).filter(field => field).join(' AND ');

    if (this._searchValue && this.lazyLoadFilterFields && !this.useTsvFilter) {
      // Escape the % characters that have a special meaning in the ILIKE clause.
      let escapedSearchInputValue = this._searchValue.replace(/[%\\]/g, '\$&');
      escapedSearchInputValue = escapedSearchInputValue.replace(/[&]/g, '_');

      // Build the filter parameters.
      const customFilterParams = this.lazyLoadFilterFields
        .filter(filterField => !Object.keys(this.lazyLoadCustomFilters || {}).includes(filterField.constructor === String ? filterField : filterField.field))
        .map(filterField => {
          if (filterField.constructor === String) {
            return `unaccent(${filterField}::TEXT) ILIKE unaccent('%${escapedSearchInputValue}%')`;
          }

          if (filterField.constructor === Object && filterField.field && filterField.filterType) {
            switch (filterField.filterType) {
              case 'exact': return `unaccent(${filterField.field}::TEXT) ILIKE unaccent('${escapedSearchInputValue}')`;
              case 'endsWith': return `unaccent(${filterField.field}::TEXT) ILIKE unaccent('%${escapedSearchInputValue}')`;
              case 'contains': return `unaccent(${filterField.field}::TEXT) ILIKE unaccent('%${escapedSearchInputValue}%')`;
              case 'startsWith': return `unaccent(${filterField.field}::TEXT) ILIKE unaccent('${escapedSearchInputValue}%')`;
            }
          }
        }).join(' OR ');

      if (customFilterParams) {
        filterParams
          ? filterParams += ` AND (${customFilterParams})`
          : filterParams += customFilterParams;
      }
    } else if (this._searchValue && this.useTsvFilter) {
      // Escape the % characters that have a special meaning in the ILIKE clause.
      let escapedSearchInputValue = this._searchValue.replace(/[%\\]/g, '\$&');
      escapedSearchInputValue = escapedSearchInputValue.replace(/[&]/g, '_');

      //
      // Add filters of to_tsquery to string coming from user
      //
      escapedSearchInputValue = escapedSearchInputValue.split(' ');
      escapedSearchInputValue.forEach((string, idx) => {
        if (string != '') {
          escapedSearchInputValue[idx] += ':*';
          if (idx < escapedSearchInputValue.length - 1 && escapedSearchInputValue[idx + 1] != '') {
            escapedSearchInputValue[idx] += ' & ';
          }
        }
      });
      filterParams = `tsv @@ to_tsquery('portuguese', unaccent('${escapedSearchInputValue.join('')}'))`;
    }

    if (filterParams) {
      resourceUrlParams.push(`filter="(${filterParams})"`);
    }

    if (resourceUrlParams.length > 0) {
      // Check if the resource URL already contains a ? which indicates some parameters were already given.
      let modifiedResource = this._originalResource.includes('?')
        ? `${this._originalResource}&${resourceUrlParams.join('&')}`
        : `${this._originalResource}?${resourceUrlParams.join('&')}`;
      // Encode % and '
      modifiedResource = modifiedResource.replace(/%/g, "%25");
      modifiedResource = modifiedResource.replace(/'/g, "%27");
      return modifiedResource;
    } else {
      return this._originalResource;
    }
  }

  /*
   * Subscribes to the new filtered resource and changes the items
   */
  async _filterLazyLoad () {
    this.loading = true;
    this.requestUpdate();

    this._initialIdx = 0;
    const subscribeResponse = await this._subscribeResource();

    if (subscribeResponse === false) {
      this.loading = false;
      this._resolveItemsFilteredPromise();
      return;
    }

    if (subscribeResponse.resource !== this.lazyLoadResource) {
      // Jump out if lazyLoadResource has already been changed
      this._resolveItemsFilteredPromise();
      return;
    }

    const activeId = subscribeResponse.user_first_id;

    if (this._dataLength > 0) {
      const response = await this.socket.getLazyload(this.lazyLoadResource, {idColumn: this.idColumn, activeId: +activeId, activeIndex: +this._initialIdx, ratio: 1}, 3000);
      this.items = response.data;
      const responseIncluded = response.included;
      this.items.forEach(item => { if (this.resourceFormatter) { this.resourceFormatter.call(this.page || {}, item, responseIncluded, this._searchValue); }});
      this._freshItems = JSON.parse(JSON.stringify(this.items));
    } else {
      this.items = [];
    }

    if (this.acceptUnlistedValue) this._setUnlistedValue();

    this.loading = false;

    await this._updateScroller();
    this._cvs.scrollToIndex(0);
    this._resolveItemsFilteredPromise();
  }

  _filterItems () {
    if ((!this._lazyload || this.lazyLoadFilterFields || this.useTsvFilter) && this._dataReady) {
      this._itemsFiltered = false;
      this._debouncedFilter();
    }
  }

  /*
   * Asks the socket for the index of a given id
   */
  async _getIndexForId (id) {
    try {
      if (!id) return 0;
      const getIdxResponse = await this.socket.getIndexLazyload(this.lazyLoadResource, +id, 3000);
      return getIdxResponse.found_index;
    } catch (error) {
      if (error && error.payload_errors && error.payload_errors[0].internal.why === 'urn not subscribed!') {
        await this._attemptResubscribe();
      } else {
        console.error(error);
      }
    }
    return -1;
  }

  /*
   * Gets called when the search input value changes through user input
   */
  _userInput (e) {
    if (e && e.inputType) {
      this._searchValue = this.searchInput.value;
    }
  }

  async _setupData () {
    if (this._lazyload) {
      this.loading = true;
      this.requestUpdate();

      // Subscribe to the resource
      const subscribeResponse = await this._subscribeResource();

      if (subscribeResponse === false) {
        this.loading = false;
        await this._cvs.initialSetup();
        return;
      }

      // Find the index of the initial id
      const initialIndex = await this._getIndexForId((+this.initialId || 0));
      if (initialIndex > -1) {
        this._initialIdx = initialIndex;
      } else {
        this._initialIdx = 0;
      }

      let getResponse;
      try {
        const getData = { idColumn: this.idColumn,
                          activeId: (+this.initialId || 0),
                          activeIndex: this._initialIdx,
                          ratio: 1 };

        getResponse = await this.socket.getLazyload(this.lazyLoadResource, getData, 3000);
      } catch (error) {
        console.error(error);
        return;
      }
      this.items = getResponse.data;
      const responseIncluded = getResponse.included;
      this.items.forEach(item => { if (this.resourceFormatter) { this.resourceFormatter.call(this.page || {}, item, responseIncluded, this._searchValue); } });
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
    this.fitInto = this.fitInto || document.documentElement;

    this._popover = new CasperPopoverBehaviour(this.searchInput,
                                               this._cvs,
                                               this.fitInto,
                                               {
                                                 minWidth: this.listMinWidth,
                                                 maxWidth: this.listMaxWidth,
                                                 minHeight: this.listMinHeight
                                               });

    this._popover.flipped = (placement) => {
      // Callback when popover changes from below the input to above the input
      this._cvs.refreshHeight();
    };
    this._popover.opened = async () => {
      // Callback when popover is opened
      this._csInputIcon = 'cs__down-icon--rotate-up';

      // When popover opens restore search value
      this.searchInput.value = this._searchValue === undefined ? '' : this._searchValue;

      // Reset minimum list width to be the same as the input width
      // We wont have the final searchInput width in firstUpdated
      this._popover.minWidth = (this.listMinWidth || this.searchInput.getBoundingClientRect().width);
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
          this.searchInput.value = this._freshItems.filter(e=>e.id == this.value)[0]?.[this.textProp];
          if (this.searchInput.value === undefined) this.searchInput.value = this._inputString;
        } else {
          this.searchInput.value = this._initialItems.filter(e=>e.id == this.value)[0]?.[this.textProp];
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

  /*
   * Setup lazyload functions, listeners, etc
   */
  async _setupLazyLoad () {
    this._originalResource = this.lazyLoadResource;

    this._debouncedFilter = this._debounce(() => {
      this._filterLazyLoad();
    }, 250);

    this._cvs.addEventListener('cvs-request-items', async (event) => {
      const dir = event.detail.direction;
      const index = event.detail.index;

      // console.log(`%c Received request ${dir} -> ${index}`, 'background: white; color: blue');
      if (!this._requested) {
        this._requested = true;
        await this._fetchItems(dir, index);
        this._updateScroller();
      } else {
        this._requestQueue = {dir: dir, index: index};
      }
    });

    // await this._initialIdChanged(); TODO: Do we need this?

    this._requested = false;
    this._requestQueue = undefined;
  }

  /*
   * Called when initialId prop changes
   * Sets searchInput value accordingly
   */
  async _initialIdChanged () {
    if (this.initialId !== undefined) {
      if (this._lazyload) {
        let completeUrl = '';
        try {
          await this.updateComplete;

          const resourceName = this.lazyLoadResource.split('?')[0];
          const resourceParameters = this.lazyLoadResource.split('?')[1];

          completeUrl = `${resourceName}/${this.initialId}${resourceParameters ? `?${resourceParameters}` : ''}`;

          const response = await this.socket.jget(completeUrl, 3000);

          this._inputString = response.data?.[this.textProp];
          this.searchInput.value = response.data?.[this.textProp];

          if (this.resourceFormatter) {
            this.resourceFormatter.call(this.page || {}, response.data,  response.included, this._searchValue);
          }

          this.setValue(this.initialId, response.data);
        } catch (error) {
          // TODO solve issue with socket 2 connecting state
          if (error.code == 11) {
            setTimeout(async () => {
              try {
                const response = await this.socket.jget(completeUrl, 3000);

                this._inputString = response.data?.[this.textProp];
                this.searchInput.value = response.data?.[this.textProp];

                if (this.resourceFormatter) {
                  this.resourceFormatter.call(this.page || {}, response.data,  response.included, this._searchValue);
                }

                this.setValue(this.initialId, response.data);
              } catch (error) {
                console.error(error);
                return;
              }
            }, 200);
          } else {
            console.error(error);
            return;
          }
        }
      } else {
        this.setValue(this.initialId);

        for (let idx = 0; idx < this.items.length; idx++) {
          if (this.items[idx].id === this.initialId) {
            this._initialIdx = idx;
            this._inputString = this.items[idx][this.textProp];
            this.searchInput.value = this.items[idx][this.textProp];
            break;
          }
        }
      }
    }
  }

  _itemsChanged () {
    // Reset Width
    this._popover.resetMinWidth = true;

    if (this.value && !this.lazyload) {
      this.setValue(this.value, null, true);
    }
  }

  _setUnlistedValue () {
    const searchMatchesId = this.items.filter(e => e.id === this._searchValue).length;

    if (this._searchValue !== undefined && this._searchValue !== '' && !searchMatchesId) {
      const unlistedItem = {unlisted: true};
      unlistedItem.id = this._searchValue;
      unlistedItem[this.textProp] = this._searchValue;
      this._unlistedItem = unlistedItem;
    } else {
      this._unlistedItem = undefined;
    }
  }

  async _updateScroller () {
    // console.log('-- Updating Scroller --');
    this.requestUpdate();
    await this.updateComplete;
    this._cvs.requestUpdate();
    await this._cvs.updateComplete;
    await this._popover.update();
  }

  _normalizeValue (value, escape=false) {
    let normalizedValue = value.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    if (escape) normalizedValue = normalizedValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return normalizedValue
  }

  _includesNormalized (value, search) {
    return (this._normalizeValue(value)).match(new RegExp(this._normalizeValue(search, true), 'i'));
  }
}

window.customElements.define('casper-select-lit', CasperSelectLit);
