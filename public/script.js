//////////////////////////////////////////////////////////////
////////////////////////// GLOBALS ///////////////////////////
//////////////////////////////////////////////////////////////

const ctx = document.getElementById('chart').getContext('2d');
let chart = null;
let latestPurchases = [];
let oldToastType = 'text-bg-secondary';
let dateFilterStart = null, dateFilterEnd = null;
let lastBitcoinPrice = null;
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

function updateAnnotations(bittrexData) {

  // Update the annotation line and label based on the given bittrex data
  annotations.bittrexLine.value = bittrexData.lastTradeRate;
  annotations.bittrexLine.label.content = `Bid (${(+bittrexData.bidRate).toFixed(2)}), Ask (${(+bittrexData.askRate).toFixed(2)}), Last (${(+bittrexData.lastTradeRate).toFixed(2)})`;
  annotations.bittrexLine.display = true;

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
    y: p.bitcoin_price,
    x: p.created_at
  }));

  // Set the metadata object to be displayed in tooltip of each data point
  data.datasets[0].metadata = latestPurchases
  // Filter out purchases not in the global time range
  .filter(p => isTimestampInRange(p.created_at))
  .map(p => ({
    'Bitcoin Price': p.bitcoin_price,
    'Bitcoin Volume': p.bitcoin_volume,
    'Dollar Value': p.dollar_value,
    'Euro Value': p.euro_value
  }));

  // Update the chart
  chart.update();

}

function fetchBitcoinPrice() {

  fetch(getUrl('/bitcoin'))
  .then(res => res.json())
  .then(data => {

    lastBitcoinPrice = data.lastTradeRate;
    updateAnnotations(data);

  })
  .catch(error => {

    console.error(error);
    newToast(error.message, 'danger');

  });

};

function fetchPurchases(updateView) {

  return new Promise(resolve => {

    fetch(getUrl('/purchases'))
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

    totalVolume += purchase.bitcoin_volume;
    totalDollars += purchase.dollar_value;
    totalEuros += purchase.euro_value;

  }

  profit = ((totalVolume * lastBitcoinPrice) - totalDollars);

  // Update the summary table (use .toFixed to overcome the decimal problems)
  totalVolumeElement.innerText = (+totalVolume.toFixed(10)) + '';
  totalDollarsElement.innerText = totalDollars.toFixed(2);
  totalEurosElement.innerText = totalEuros.toFixed(2);
  profitElement.innerText = profit.toFixed(2);

  // Add color styling
  profitElement.classList.remove('text-success', 'text-danger');

  if ( profit > 0 ) profitElement.classList.add('text-success');
  if ( profit < 0 ) profitElement.classList.add('text-danger');

}

//////////////////////////////////////////////////////////////
////////////////////// Event Handlers ////////////////////////
//////////////////////////////////////////////////////////////

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

window.addEventListener('load', () => {

  // Fetch Bitcoin price every 5 seconds
  setInterval(fetchBitcoinPrice, 5000);

  // ...and right now
  fetchBitcoinPrice();

  // Fetch purchases
  fetchPurchases(true);

  // Register date picker plugin for the range filter
  $('.input-daterange').datepicker(datepickerConfig);

});
