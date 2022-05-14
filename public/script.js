const ctx = document.getElementById('chart').getContext('2d');

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
      },
      y: {
        display: false
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
  annotations.bittrexLine.label.content = `Bid (${bittrexData.bidRate}), Ask (${bittrexData.askRate}), Last (${bittrexData.lastTradeRate})`;
  annotations.bittrexLine.display = true;

  chart.update();

}

function updateDataset(purchases) {

  config.options.scales.x.display = true;
  config.options.scales.y.display = true;

  data.datasets[0].data = purchases.map(p => ({
    y: p.bitcoin_price,
    x: p._created_at
  }));
  data.datasets[0].metadata = purchases.map(p => ({
    'Bitcoin Price': p.bitcoin_price,
    'Bitcoin Volume': p.bitcoin_volume,
    'Dollar Value': p.dollar_value,
    'Euro Value': p.euro_value
  }));

  chart.update();

}

window.addEventListener('load', () => {

  const fetchBitcoinPrice = () => {

    fetch('http://localhost:5000/bitcoin')
    .then(res => res.json())
    .then(updateAnnotations)
    .catch(console.error);

  };

  // Fetch Bitcoin price every 5 seconds
  setInterval(fetchBitcoinPrice, 5000);

  fetchBitcoinPrice();

  // Fetch purchases
  fetch('http://localhost:5000/purchases')
  .then(res => res.json())
  .then(updateDataset)
  .catch(console.error);

});
