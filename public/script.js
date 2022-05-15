const ctx = document.getElementById('chart').getContext('2d');

let latestPurchases = [];
let oldToastType = 'text-bg-secondary';

function getUrl(endpoint) {

  return `http://localhost:5000${endpoint}`;

}

function newToast(message, type='secondary') {

  const toast = document.getElementById('toast');

  toast.classList.replace(oldToastType, `text-bg-${type}`);
  oldToastType = `text-bg-${type}`;
  document.getElementById('toastBody').innerText = message;

  new bootstrap.Toast(toast).show()

}

function createGradient(height) {

  const gradient = ctx.createLinearGradient(0, 0, 0, height * .6);

  gradient.addColorStop(0, 'rgba(206, 255, 206, .75)');
  gradient.addColorStop(1, 'rgba(206, 255, 206, 0)');

  return gradient;

}

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

let chart = null;

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
          minUnit: 'hour',
          tooltipFormat: 'LLL dd, yyyy / HH:mm',
          displayFormats: {
            'hour': 'LLL dd, yyyy / HH:mm',
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
        enter: context => {

          annotations[context.id].label.enabled = true;
          chart.update();

        },
        leave: context => {

          annotations[context.id].label.enabled = false;
          chart.update();

        },
        annotations
      }
    }
  }
};

chart = new Chart(document.getElementById('chart'), config);

function updateAnnotations(bittrexData) {

  annotations.bittrexLine.value = bittrexData.lastTradeRate;
  annotations.bittrexLine.label.content = `Bid (${(+bittrexData.bidRate).toFixed(2)}), Ask (${(+bittrexData.askRate).toFixed(2)}), Last (${(+bittrexData.lastTradeRate).toFixed(2)})`;
  annotations.bittrexLine.display = true;

  chart.update();

}

function updateDataset() {

  config.options.scales.x.display = !! latestPurchases.length;

  data.datasets[0].data = latestPurchases.map(p => ({
    y: p.bitcoin_price,
    x: p._created_at
  }));
  data.datasets[0].metadata = latestPurchases.map(p => ({
    'Bitcoin Price': p.bitcoin_price,
    'Bitcoin Volume': p.bitcoin_volume,
    'Dollar Value': p.dollar_value,
    'Euro Value': p.euro_value
  }));

  chart.update();

}

function fetchPurchases(updateView) {

  return new Promise(resolve => {

    fetch(getUrl('/purchases'))
    .then(res => res.json())
    .then(purchases => {

      latestPurchases = purchases;

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

  while ( tableBody.firstChild && tableBody.firstChild.id !== 'addButton' )
    tableBody.removeChild(tableBody.firstChild);

  for ( let i = 0; i < latestPurchases.length; i++ ) {

    const purchase = latestPurchases[i];
    const row = template.content.cloneNode(true);

    for ( const td of row.children[0].children )
      if ( ! td.classList.contains('row-controls') )
        td.innerText = purchase[td.dataset.key];
      else
        td.dataset.index = i;

    tableBody.insertBefore(row, addButton);

  }

  addButton.classList.remove('d-none');

}

function onEditPurchase(parentTd) {

  const template = document.getElementById('editableRow');
  const tableBody = document.getElementById('purchasesTableBody');
  const addButton = document.getElementById('addButton');
  const row = template.content.cloneNode(true);

  addButton.classList.add('d-none');
  parentTd.parentElement.classList.add('d-none');
  row.firstElementChild.lastElementChild.dataset.index = parentTd.dataset.index;

  for ( const td of row.firstElementChild.children ) {

    const input = td.firstElementChild;

    if ( input.tagName !== 'INPUT' ) continue;

    input.value = latestPurchases[+parentTd.dataset.index][td.dataset.key];

  }

  tableBody.insertBefore(row, parentTd.parentElement);

}

function onAddPurchase() {

  const template = document.getElementById('editableRow');
  const tableBody = document.getElementById('purchasesTableBody');
  const addButton = document.getElementById('addButton');
  const row = template.content.cloneNode(true);

  row.firstElementChild.lastElementChild.dataset.mode = 'add';

  addButton.classList.add('d-none');
  tableBody.insertBefore(row, addButton);

}

function onCancelPurchase(td) {

  const addButton = document.getElementById('addButton');
  const tableBody = document.getElementById('purchasesTableBody');

  if ( td.dataset.mode === 'add' ) {

    tableBody.removeChild(addButton.previousElementSibling);

  }
  else {

    td.parentElement.nextElementSibling.classList.remove('d-none');
    tableBody.removeChild(td.parentElement);

  }

  addButton.classList.remove('d-none');

}

function onSubmitPurchase(parentTd) {

  const tableBody = document.getElementById('purchasesTableBody');
  const inputData = {};

  for ( const td of parentTd.parentElement.children ) {

    const input = td.firstElementChild;

    if ( input.tagName !== 'INPUT' ) continue;

    inputData[td.dataset.key] = td.dataset.type === 'number' ? +input.value : input.value.trim();

  }

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

    })
    .catch(error => {

      console.error(error);
      newToast(error.message, 'danger');

    });

  }

}

function onDeletePurchase(index) {

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

window.addEventListener('load', () => {

  const fetchBitcoinPrice = () => {

    fetch(getUrl('/bitcoin'))
    .then(res => res.json())
    .then(updateAnnotations)
    .catch(error => {

      console.error(error);
      newToast(error.message, 'danger');

    });

  };

  // Fetch Bitcoin price every 5 seconds
  setInterval(fetchBitcoinPrice, 5000);

  fetchBitcoinPrice();

  // Fetch purchases
  fetchPurchases(true);

});
