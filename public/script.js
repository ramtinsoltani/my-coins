//////////////////////////////////////////////////////////////
////////////////////////// GLOBALS ///////////////////////////
//////////////////////////////////////////////////////////////

const ctx = document.getElementById('chart').getContext('2d');
let chart = null;
let latestPurchases = [];
let oldToastType = 'text-bg-secondary';
let dateFilterStart = null, dateFilterEnd = null;
let lastCoinPrice = null;
let currentMarket = null;
let bittrexMarkets = null;
const selectionMappings = {};

//////////////////////////////////////////////////////////////
/////////////////////////// UTILS ////////////////////////////
//////////////////////////////////////////////////////////////

/** Builds a full URL for the given endpoint */
function getUrl(endpoint) {

  return `http://localhost:5000${endpoint}`;

}

/** Displays a notification message with the given parameters */
function newToast(message, type='secondary') {

  const toast = document.getElementById('toast');

  toast.classList.replace(oldToastType, `text-bg-${type}`);
  oldToastType = `text-bg-${type}`;
  document.getElementById('toastBody').innerText = message;

  new bootstrap.Toast(toast).show()

}

/** Creates a canvas gradient based on the given height */
function createGradient(height) {

  const gradient = ctx.createLinearGradient(0, 0, 0, height * .6);

  gradient.addColorStop(0, 'rgba(206, 255, 206, .75)');
  gradient.addColorStop(1, 'rgba(206, 255, 206, 0)');

  return gradient;

}

/** Formats the given timestamp to dd/mm/yyyy date string */
function formatTimestamp(timestamp) {

  const date = new Date(timestamp);
  const day = (date.getDate() + '').padStart(2, '0');
  const month = (date.getMonth() + 1 + '').padStart(2, '0');
  const year = (date.getFullYear() + '').padStart(4, '0');

  return `${day}/${month}/${year}`;

}

/** Converts a date string in dd/mm/yyyy format to epoch timestamp */
function dateStringToTimestamp(text) {

  const segments = text.split('/');

  return new Date(`${segments[1]}/${segments[0]}/${segments[2]}`).getTime();

}

/** Returns true if the given timestamp is within the global date range */
function isTimestampInRange(timestamp) {

  if ( dateFilterStart && timestamp < dateFilterStart )
    return false;

  if ( dateFilterEnd && timestamp > dateFilterEnd )
    return false;

  return true;

}

//////////////////////////////////////////////////////////////
////////////////////////// CONFIGS ///////////////////////////
//////////////////////////////////////////////////////////////

const data = {
  datasets: [{
    // Shown in tooltip
    metadata: [],
    label: 'Purchases',
    data: [],
    fill: {
      target: 'origin',
      above: createGradient(500)
    },
    borderColor: 'rgb(75, 192, 192)',
    tension: 0.2
  }]
};

const annotations = {
  bittrexLine: {
    display: false,
    type: 'line',
    scaleID: 'y',
    borderWidth: 2,
    borderColor: '#ffc16f',
    borderDash: [6, 6],
    value: 0,
    label: {
      enabled: false,
      content: '',
      backgroundColor: 'rgba(0, 0, 0, .75)'
    }
  },
  breakEvenLine: {
    display: false,
    type: 'line',
    scaleID: 'y',
    borderWidth: 2,
    borderColor: '#33cd39',
    borderDash: [6, 6],
    value: 0,
    label: {
      enabled: false,
      content: '',
      backgroundColor: 'rgba(0, 0, 0, .75)'
    }
  }
};

const config = {
  type: 'line',
  data: data,
  options: {
    scales: {
      x: {
        display: false,
        parsing: false,
        type: 'time',
        time: {
          minUnit: 'day',
          tooltipFormat: 'LLL dd, yyyy',
          displayFormats: {
            'day': 'LLL dd, yyyy',
            'month': 'LLL yyyy',
            'year': 'yyyy'
          }
        }
      }
    },
    animation: {
      duration: 0
    },
    responsive: true,
    // Re-render the gradient based on new chart height on resize
    onResize: () => {

      if ( ! chart ) return;

      const gradient = createGradient(chart.height);

      for ( const dataset of data.datasets )
        dataset.fill.above = gradient;

    },
    plugins: {
      tooltip: {
        displayColors: false,
        callbacks: {
          // Display the metadata object dynamically on tooltip
          label: context => {

            return Object.keys(context.dataset.metadata[context.dataIndex])
            .map(key => `${key}: ${context.dataset.metadata[context.dataIndex][key]}`);

          }
        }
      },
      legend: {
        display: false
      },
      annotation: {
        // Display label on annotation line hover
        enter: context => {

          annotations[context.id].label.enabled = true;
          chart.update();

        },
        // Hide label on annotation line mouse leave
        leave: context => {

          annotations[context.id].label.enabled = false;
          chart.update();

        },
        annotations
      }
    }
  }
};

const datepickerConfig = {
  autoclose: true,
  todayHighlight: true,
  format: 'dd/mm/yyyy',
  clearBtn: true
};

chart = new Chart(document.getElementById('chart'), config);

//////////////////////////////////////////////////////////////
/////////////////////// Global Methods ///////////////////////
//////////////////////////////////////////////////////////////

function updateAnnotations(bittrexData, profit) {

  // Update the annotation line and label based on the given bittrex data
  if ( bittrexData ) {

    annotations.bittrexLine.value = bittrexData.lastTradeRate;
    annotations.bittrexLine.label.content = `Bid (${(+bittrexData.bidRate).toFixed(2)}), Ask (${(+bittrexData.askRate).toFixed(2)}), Last (${(+bittrexData.lastTradeRate).toFixed(2)})`;
    annotations.bittrexLine.display = true;

  }

  const breakEvenPrice = (profit * -1) + (+bittrexData.lastTradeRate);

  annotations.breakEvenLine.value = breakEvenPrice;
  annotations.breakEvenLine.label.content = `Break even point: $${breakEvenPrice.toFixed(2)}`;
  annotations.breakEvenLine.display = true;

  // Update the chart
  chart.update();

}

function updateDataset() {

  // Display the X axis if there's any data
  config.options.scales.x.display = !! latestPurchases.length;

  // Set the data points
  data.datasets[0].data = latestPurchases
  // Filter out purchases not in the global time range and not selected
  .filter(p => !! selectionMappings[p._id] && isTimestampInRange(p.created_at))
  .map(p => ({
    y: p.coin_price,
    x: p.created_at
  }));

  // Set the metadata object to be displayed in tooltip of each data point
  data.datasets[0].metadata = latestPurchases
  // Filter out purchases not in the global time range and not selected
  .filter(p => !! selectionMappings[p._id] && isTimestampInRange(p.created_at))
  .map(p => ({
    'Market': currentMarket,
    'Coin Price': p.coin_price,
    'Coin Volume': p.coin_volume,
    'Dollar Value': p.dollar_value,
    'Euro Value': p.euro_value
  }));

  // Update the chart
  chart.update();

}

function fetchMarketTicker() {

  return new Promise(resolve => {

    // If no market is selected, ignore
    if ( ! currentMarket ) return resolve();

    fetch(getUrl(`/bittrex/${currentMarket}`))
    .then(res => res.json())
    .then(data => {

      lastCoinPrice = data.lastTradeRate;
      updateAnnotations(data, updateSummary());

    })
    .catch(error => {

      console.error(error);
      newToast(error.message, 'danger');

    })
    .finally(resolve);

  });

};

function fetchPurchases(updateView) {

  return new Promise(resolve => {

    fetch(getUrl(`/purchases/${currentMarket}`))
    .then(res => res.json())
    .then(purchases => {

      latestPurchases = purchases;

      // Update selection mappings
      for ( const purchase of purchases ) {

        if ( ! selectionMappings.hasOwnProperty(purchase._id) )
          selectionMappings[purchase._id] = true;

      }

      // Update the table and graph if updateView is set
      if ( updateView ) {

        updateDataset();
        updateTable();

      }

    })
    .catch(error => {

      console.error(error);
      newToast(error.message, 'danger');

    })
    .finally(resolve);

  });

}

function updateTable() {

  const template = document.getElementById('purchaseRow');
  const tableBody = document.getElementById('purchasesTableBody');
  const addButton = document.getElementById('addButton');

  // Remove all rows in the table except for the add button row
  while ( tableBody.firstChild && tableBody.firstChild.id !== 'addButton' )
    tableBody.removeChild(tableBody.firstChild);

  for ( let i = 0; i < latestPurchases.length; i++ ) {

    const purchase = latestPurchases[i];
    const row = template.content.cloneNode(true);

    // Do not render the row if not in the current global time range filter
    if ( ! isTimestampInRange(purchase.created_at) ) {

      // Reset their mappings before ignoring the rendering
      selectionMappings[purchase._id] = true;
      continue;

    }

    for ( const td of row.children[0].children ) {

      // Load the purchase data into the cells
      if ( ! td.classList.contains('row-controls') && ! td.classList.contains('row-selection-controls') ) {

        if ( td.dataset.type === 'date' )
          td.innerText = formatTimestamp(purchase[td.dataset.key]);
        else
          td.innerText = purchase[td.dataset.key];

      }
      // For the row controls cells...
      else {

        // Set the purchase index as data attribute
        td.dataset.index = i;

        // Update selection
        if ( td.classList.contains('row-selection-controls') )
          td.firstElementChild.firstElementChild.checked = !! selectionMappings[purchase._id];

      }

    }

    // Add the row before the add button row
    tableBody.insertBefore(row, addButton);

  }

  // Display the add button row (if hidden)
  addButton.classList.remove('d-none');

  // Update the summary table
  updateSummary();

}

function updateSummary() {

  const totalVolumeElement = document.getElementById('totalVolume');
  const totalDollarsElement = document.getElementById('totalDollars');
  const totalEurosElement = document.getElementById('totalEuros');
  const profitElement = document.getElementById('profit');

  let totalVolume = 0, totalDollars = 0, totalEuros = 0, profit = 0;

  const targetPurchases = latestPurchases
  // Only target the selected purchases that are rendered (within the time range filter)
  .filter(p => !! selectionMappings[p._id] && isTimestampInRange(p.created_at));

  // Calculate the summary
  for ( const purchase of targetPurchases ) {

    totalVolume += purchase.coin_volume;
    totalDollars += purchase.dollar_value;
    totalEuros += purchase.euro_value;

  }

  profit = ((totalVolume * lastCoinPrice) - totalDollars);

  // Update the summary table (use .toFixed to overcome the decimal problems)
  totalVolumeElement.innerText = (+totalVolume.toFixed(10)) + '';
  totalDollarsElement.innerText = totalDollars.toFixed(2);
  totalEurosElement.innerText = totalEuros.toFixed(2);
  profitElement.innerText = isNaN(profit) ? '0.00' : profit.toFixed(2);

  // Add color styling
  profitElement.classList.remove('text-success', 'text-danger');

  if ( profit > 0 ) profitElement.classList.add('text-success');
  if ( profit < 0 ) profitElement.classList.add('text-danger');

  // Update break even line annotation
  updateAnnotations(null, profit);

  return isNaN(profit) ? 0 : profit;

}

function selectMarket(element) {

  // Ignore if market is already selected
  if ( element.dataset.value === currentMarket ) return;

  // Set current market
  currentMarket = element.dataset.value;

  // Deactivate all tabs
  const tabs = document.getElementById('marketTabs');

  for ( const tab of tabs.children )
    tab.firstElementChild.classList.remove('active');

  // Activate current tab
  element.classList.add('active');

  // Fetch purchases
  fetchPurchases(false)
  // Update market graph
  .then(fetchMarketTicker)
  .then(updateDataset)
  .then(updateTable);

}

function fetchMarkets() {

  return new Promise(resolve => {

    // Fetch markets from the backend
    fetch(getUrl('/markets'))
    .then(res => res.json())
    .then(data => {

      // Set current market to the first found market (or undefined)
      currentMarket = data[0];

      // Render the market tabs
      const tabs = document.getElementById('marketTabs');
      const template = document.getElementById('marketTab');

      // For each market in the response array
      for ( const market of data ) {

        const tab = template.content.cloneNode(true);

        // Set data-value attribute with market name
        tab.firstElementChild.firstElementChild.dataset.value = market;
        // Set tab text
        tab.firstElementChild.firstElementChild.innerText = market;
        // Set active class
        if ( market === currentMarket )
          tab.firstElementChild.firstElementChild.classList.add('active');

        // Add tab into tabs
        tabs.appendChild(tab);

      }

    })
    .catch(error => {

      console.error(error);
      newToast(error.message, 'danger');

    })
    .finally(resolve);

  });

}

function fetchBittrexMarkets() {

  return new Promise(resolve => {

    // Ignore if markets have already been fetched
    if ( bittrexMarkets?.length )
      return resolve();

    // Fetch bittrex markets
    fetch(getUrl('/bittrex/markets'))
    .then(res => res.json())
    .then(data => {

      bittrexMarkets = data;

      // Update modal list
      const template = document.getElementById('marketItem');
      const modal = document.getElementById('marketList');

      for ( const market of data ) {

        const item = template.content.cloneNode(true);

        // Set data-value
        item.firstElementChild.dataset.value = market;
        // Set text
        item.firstElementChild.innerText = market;

        // Add to list
        modal.appendChild(item);

      }

    })
    .catch(error => {

      console.error(error);
      newToast(error.message, 'danger');

    })
    .finally(resolve);

  });

}

function toggleNoDataMode(active) {

  if ( ! active ) {

    // Display table
    document.querySelector('table').classList.remove('d-none');
    // Display date filter
    document.querySelector('.input-daterange').classList.remove('d-none');
    // Hide no data element
    document.getElementById('noData').classList.add('d-none');
    // Display tabs
    document.getElementById('tabsContainer').classList.remove('d-none');

  }
  else {

    // Hide table
    document.querySelector('table').classList.add('d-none');
    // Hide date filter
    document.querySelector('.input-daterange').classList.add('d-none');
    // Display no data element
    document.getElementById('noData').classList.remove('d-none');
    // Hide tabs
    document.getElementById('tabsContainer').classList.add('d-none');

  }

}

//////////////////////////////////////////////////////////////
////////////////////// Event Handlers ////////////////////////
//////////////////////////////////////////////////////////////

function onFilterMarketList(value) {

  const list = document.getElementById('marketList');

  // If cleared
  if ( ! value ) {

    for ( const item of list.children )
      item.classList.remove('d-none', 'first-visible', 'last-visible');

  }
  // If searching
  else {

    let firstVisibleItem, lastVisibleItem;

    for ( const item of list.children ) {

      // If item does not match, hide
      if ( ! item.dataset.value.toLowerCase().includes(value.trim().toLowerCase()) ) {

        item.classList.add('d-none');

      }
      // If visible
      else {

        // Set first visible item
        if ( ! firstVisibleItem )
          firstVisibleItem = item;

        // Set last visible item
        lastVisibleItem = item;

      }

    }

    firstVisibleItem?.classList.add('first-visible');
    lastVisibleItem?.classList.add('last-visible');

  }

}

function onAddMarket(market) {

  // Close modal
  $('#marketsModal').modal('hide');

  // Exit no data mode (if already in)
  toggleNoDataMode(false);

  // Add new market
  const tabs = document.getElementById('marketTabs');
  const template = document.getElementById('marketTab');
  const tab = template.content.cloneNode(true);

  // Set tab data arrtibute and text
  tab.firstElementChild.firstElementChild.dataset.value = market;
  tab.firstElementChild.firstElementChild.innerText = market;

  // Append to tabs
  tabs.appendChild(tab);

  // Select this tab
  selectMarket(tabs.lastElementChild.firstElementChild);

}

function onEditPurchase(parentTd) {

  const template = document.getElementById('editableRow');
  const tableBody = document.getElementById('purchasesTableBody');
  const addButton = document.getElementById('addButton');
  const row = template.content.cloneNode(true);

  // Hide the add button row
  addButton.classList.add('d-none');
  // Hide the original row (with data)
  parentTd.parentElement.classList.add('d-none');
  // Set the purchase index of original row as the editable row's data attribute
  row.firstElementChild.lastElementChild.dataset.index = parentTd.dataset.index;

  // Set the value of every input of the editable row from the purchase item
  for ( const td of row.firstElementChild.children ) {

    const input = td.firstElementChild;

    // Ignore if not input
    if ( ! input || input.tagName !== 'INPUT' ) continue;

    if ( td.dataset.type === 'date' )
      input.value = formatTimestamp(latestPurchases[+parentTd.dataset.index][td.dataset.key]);
    else
      input.value = latestPurchases[+parentTd.dataset.index][td.dataset.key];

  }

  // Insert the editable row before the original row
  tableBody.insertBefore(row, parentTd.parentElement);

  // Instantiate the date picker plugin for the date input of the editable row
  $('input.date').datepicker(datepickerConfig);

}

function onAddPurchase() {

  const template = document.getElementById('editableRow');
  const tableBody = document.getElementById('purchasesTableBody');
  const addButton = document.getElementById('addButton');
  const row = template.content.cloneNode(true);

  // Set add mode in data attribute
  row.firstElementChild.lastElementChild.dataset.mode = 'add';

  // Hide the add button row
  addButton.classList.add('d-none');
  // Add the editable row before the add button at the end of the table
  tableBody.insertBefore(row, addButton);

  // Instantiate the date picker plugin for the date input inside the editable row
  $('input.date').datepicker(datepickerConfig);

}

function onCancelPurchase(td) {

  const addButton = document.getElementById('addButton');
  const tableBody = document.getElementById('purchasesTableBody');

  // If was adding a new purchase
  if ( td.dataset.mode === 'add' ) {

    // Remove the editable row
    tableBody.removeChild(addButton.previousElementSibling);

  }
  // If was editting an existing purchase
  else {

    // Remove the editable row
    td.parentElement.nextElementSibling.classList.remove('d-none');
    // Display the original row (with data)
    tableBody.removeChild(td.parentElement);

  }

  // Display the add button row
  addButton.classList.remove('d-none');

}

function onSubmitPurchase(parentTd) {

  const tableBody = document.getElementById('purchasesTableBody');
  const inputData = {};

  // Read the values of inputs
  for ( const td of parentTd.parentElement.children ) {

    const input = td.firstElementChild;

    // If element is not an input, ignore
    if ( ! input || input.tagName !== 'INPUT' ) continue;

    // If empty input
    if ( ! input.value.trim().length )
      return newToast('All fields are required!', 'warning');

    // Sanitize the input based on the data-type attribute of TD parent element
    let sanitized = input.value;

    if ( td.dataset.type === 'number' )
      sanitized = +sanitized;
    else if ( td.dataset.type === 'date' )
      sanitized = dateStringToTimestamp(sanitized);
    else
      sanitized = sanitized.trim();

    inputData[td.dataset.key] = sanitized;

  }

  // Set market
  inputData.market = currentMarket;

  // If adding a new purchase
  if ( parentTd.dataset.mode === 'add' ) {

    fetch(getUrl('/purchase'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(inputData)
    })
    .then(res => res.json())
    .then(result => {

      if ( result.invalid )
        return newToast('Invalid input!', 'warning');

      newToast('Great success!', 'success');
      fetchPurchases(true);

    })
    .catch(error => {

      console.error(error);
      newToast(error.message, 'danger');

    });

  }
  // If editting an axisting purchase
  else {

    fetch(getUrl(`/purchase/${latestPurchases[+parentTd.dataset.index]._id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(inputData)
    })
    .then(res => res.json())
    .then(result => {

      if ( result.success ) {

        newToast('Great success!', 'success');
        fetchPurchases(true);

      }
      else if ( result.invalid )
        newToast('Invalid input!', 'warning');
      // False success usually happens when the data was the same
      else if ( result.success === false )
        newToast('Data has no changes')

    })
    .catch(error => {

      console.error(error);
      newToast(error.message, 'danger');

    });

  }

}

function onDeletePurchase(index) {

  // Send a request to the delete endpoint
  fetch(getUrl(`/purchase/${latestPurchases[index]._id}`), {
    method: 'DELETE'
  })
  .then(res => res.json())
  .then(result => {

    if ( result.success ) {

      newToast('Great success!', 'success');
      fetchPurchases(true);

    }
    else if ( result.invalid )
      newToast('Invalid input!', 'warning');

  })
  .catch(error => {

    console.error(error);
    newToast(error.message, 'danger');

  });

}

function onFilterByDate() {

  // Read the date range input values
  const start = document.getElementById('startDate').value.trim();
  const end = document.getElementById('endDate').value.trim();

  // If both are empty, clear the filter
  if ( ! start && ! end )
    return onClearDateFilter();

  // Convert date strings from input to timestamps
  const startTimestamp = dateStringToTimestamp(start);
  const endTimestamp = dateStringToTimestamp(end);

  // If invalid date string (timestamp conversion returned NaN)
  if ( (isNaN(startTimestamp) && start) || (isNaN(endTimestamp) && end) )
    return newToast('Invalid date range!', 'warning');

  // Set the global time range filter variables
  dateFilterStart = start ? startTimestamp : null;
  dateFilterEnd = end ? endTimestamp : null;

  // Update the table and the chart
  updateTable();
  updateDataset();

}

function onClearDateFilter() {

  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');

  // Reset date picker inputs
  startInput.value = '';
  endInput.value = '';

  // Reset global date range variables
  dateFilterStart = null;
  dateFilterEnd = null;

  // Update the table and the chart
  updateTable();
  updateDataset();

}

function onSelectionChanged(checked, index) {

  selectionMappings[latestPurchases[index]._id] = checked;

  updateSummary();
  updateDataset();

}

function onShowMarketsModal() {

  fetchBittrexMarkets()
  .then(() => {

    $('#marketsModal').modal('show');

  });

}

window.addEventListener('load', () => {

  // Fetch markets
  fetchMarkets()
  .then(() => {

    // Display table and date range filter controls if there's data
    if ( currentMarket ) toggleNoDataMode(false);

    // Fetch current market ticker every 5 seconds
    setInterval(fetchMarketTicker, 5000);

    // ...and right now
    fetchMarketTicker();

    // Fetch purchases
    fetchPurchases(true);

  });

  // Register date picker plugin for the range filter
  $('.input-daterange').datepicker(datepickerConfig);

});
