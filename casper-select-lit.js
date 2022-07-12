import { LitElement, html, css, unsafeCSS } from 'lit';
import '@polymer/paper-input/paper-input.js';
import '@cloudware-casper/casper-icons/casper-icon.js';
import '@cloudware-casper/casper-virtual-scroller/casper-virtual-scroller.js';
import './components/casper-highlightable.js';

import CasperPopoverBehaviour from './components/casper-popover-behaviour.js';

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

    this.idColumn    = 'id';
    this.tableSchema = 'sharded';
    this.textProp    = 'name';
    this.extraColumn = 'NULL'
    this.dataSize    = 100;
    this.minHeight   = 200;
    this._dataReady  = false;
    this.loading     = false;
    this.autoOpen    = true;
    this._itemsFiltered = true;
    this._resubscribeAttempts = 10;
    this._csInputIcon         = 'cs-down-icon-down';
  }

  connectedCallback () {
    super.connectedCallback();

    this._renderLine = this._renderLine.bind(this);
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
  async clearValue (event) {
    event.stopPropagation();

    await this.showPopover();
    this.value = undefined;
    this._cvs.selectedItem = undefined;
    this._searchValue = '';
    this._searchInput.value = this._searchValue;
    
    this._filterItems();
    await this.itemsFiltered;
    
    this.hidePopover();
    this.requestUpdate();
    this.blur();
  }

  /*
   * Sets a new value
   */
  setValue (id, item) {
    this.value = id;
    this._cvs.selectedItem = this.value;
    this.hidePopover();

    // If we dont have an item try to look for it
    !item ? item = this.items?.filter(it => it?.[this.idColumn] == id)?.[0] : true;

    this.dispatchEvent(new CustomEvent('change', {
      detail: { 
        value: id,
        item: item
      },
      bubbles: true,
      composed: true
    }));
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
  
  /*
   * Subscribes a resource using table or jsonapi if we have filters
   */
  async _subscribeResource () {
    let subscribeData =  { idColumn: this.idColumn,
                           parentColumn: 'NULL',
                           sortColumn: this.sortColumn };


    if (this._searchValue === undefined || this._searchValue.trim() === '') {
      this.lazyLoadResource     = this._originalResource;
      subscribeData.tableSchema = this.tableSchema;
      subscribeData.tableName   = this.tableName;
      console.log(`Subscribing ${this.lazyLoadResource} using table`);
    } else {
      this.lazyLoadResource      = this._applyFiltersURL();
      subscribeData.parentColumn = this.extraColumn;
      console.log(`Subscribing ${this.lazyLoadResource} using jsonapi`);
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

    console.log(`Session died, resubscribing... ${this._resubscribeAttempts} attempts left`);

    if (this._resubscribeAttempts > 0) {
      await this._subscribeResource();
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

    if (this._searchValue && this.lazyLoadFilterFields) {
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

    this._initialIdx = 0;
    const subscribeResponse = await this._subscribeResource();
    const activeId = subscribeResponse.user_first_id;

    if (subscribeResponse.resource !== this.lazyLoadResource) {
      // Jump out if lazyLoadResource has already been changed
      this._resolveItemsFilteredPromise();
      return;
    }

    if (this._dataLength > 0) {
      const response = await this.socket.getLazyload(this.lazyLoadResource, {idColumn: this.idColumn, activeId: +activeId, activeIndex: +this._initialIdx, ratio: 1}, 3000);
      this.items = response.data;
      const responseIncluded = response.included;
      this.items.forEach(item => { if (this.resourceFormatter) { this.resourceFormatter.call(this.page || {}, item, responseIncluded, this._searchValue); }});
      this._freshItems = JSON.parse(JSON.stringify(this.items));
    } else {
      this.items = [];
    }

    this.loading = false;

    await this._updateScroller();
    this._cvs.scrollToIndex(0);
    this._resolveItemsFilteredPromise();
  }

  _filterItems () {
    if ((!this._lazyload || this.lazyLoadFilterFields) && this._dataReady) {
      this._itemsFiltered = false;
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
      this._searchValue = this._searchInput.value;
      this._filterItems();
    }
  }

  async _setupData () {
    if (this._lazyload) {
      this.loading = true;
      this.requestUpdate();

      // Subscribe to the resource
      await this._subscribeResource();

      // Find the index of the initial id
      const initialIndex = await this._getIndexForId(+this.initialId);
      if (initialIndex > -1) {
        this._initialIdx = initialIndex;
      } else {
        this._initialIdx = 0;
      }

      let getResponse;
      try {
        const getData = { idColumn: this.idColumn,
                          activeId: +this.initialId,
                          activeIndex: this._initialIdx,
                          ratio: 1 };

        getResponse = await this.socket.getLazyload(this.lazyLoadResource, getData, 3000);
      } catch (error) {
        console.error(error);
        return;
      }
      this.items = getResponse.data;
      const responseIncluded = getResponse.included;
      this.items.forEach(item => { if (this.resourceFormatter) { this.resourceFormatter.call(this.page || {}, item, responseIncluded, this._searchValue); }});
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
      this.dispatchEvent(new CustomEvent('popover-opened', {
        bubbles: true,
        composed: true
      }));
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

  /*
   * Called when initialId prop changes
   * Sets searchInput value accordingly
   */
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

  _normalizeValue (value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
  }

  _includesNormalized (value, search) {
    return (this._normalizeValue(value)).match(new RegExp(this._normalizeValue(search), 'i'));
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
        this.items = this._searchValue 
          ? this._initialItems.filter(item => this._includesNormalized(item[this.textProp],this._searchValue)) 
          : JSON.parse(JSON.stringify(this._initialItems));
        this._dataLength = this.items.length;
        await this._updateScroller();
        this._resolveItemsFilteredPromise();
      }, 250);

      this._dataLength = this.items.length;
    }

    this._searchInput.addEventListener('input', this._userInput.bind(this));
    this._cvs.addEventListener('cvs-line-selected', (event) => {
      if (event && event.detail) {
        this._inputString = event.detail.name;
        this.setValue(event.detail.id, event.detail.item);
      }
    });

    this._searchInput.addEventListener('keydown', async (event) => {
      if ( this.autoOpen ) {
        await this.showPopover();
      }
      // Forward event to cvs
      this._cvs.dispatchEvent(new KeyboardEvent('keydown', {key: event.key}));
    });
  }

  _renderLine (item) {
    const highlightValue = this.highlight ? this._searchValue : '';

    if (this.renderLine) {
      return this.renderLine(item, highlightValue);
    } else {
      return html`
        <style>
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
          <casper-highlightable highlight="${highlightValue}">
            ${item[this.textProp]}
          </casper-highlightable>
        </span>
      `;
    }
  }

  render () {
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
          .renderLine="${this._renderLine}"
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