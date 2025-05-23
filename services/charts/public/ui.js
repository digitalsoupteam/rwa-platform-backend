let chart = null;
let candlestickSeries = null;
let volumeSeries = null;


let lastState = {
    candlesSize: 0,
    volumesSize: 0,
    transactionsLength: 0
};


function initializeChart() {
    const chartElement = document.getElementById('priceChart');
    
    chart = LightweightCharts.createChart(chartElement, {
        width: chartElement.offsetWidth,
        height: chartElement.offsetHeight,
        layout: {
            background: { type: 'solid', color: '#131722' },
            textColor: '#d1d4dc',
            fontSize: 11,
        },
        grid: {
            vertLines: { color: '#1e222d' },
            horzLines: { color: '#1e222d' }
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                width: 1,
                color: '#2962FF',
                style: LightweightCharts.LineStyle.Dashed,
            },
            horzLine: {
                width: 1,
                color: '#2962FF',
                style: LightweightCharts.LineStyle.Dashed,
            },
        },
        rightPriceScale: {
            borderColor: '#2a2e39',
            textColor: '#d1d4dc',
        },
        timeScale: {
            borderColor: '#2a2e39',
            textColor: '#d1d4dc',
            timeVisible: true,
            secondsVisible: false,
        },
    });

    candlestickSeries = chart.addSeries(LightweightCharts.CandlestickSeries,{
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
    });

    volumeSeries = chart.addSeries(
                LightweightCharts.HistogramSeries,{
        color: '#26a69a',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: '',
        scaleMargins: {
            top: 0.8,
            bottom: 0,
        },
    });

    window.addEventListener('resize', () => {
        chart.applyOptions({
            width: chartElement.offsetWidth,
            height: chartElement.offsetHeight,
        });
    });
}


function formatPrice(price) {
    if (price === null || typeof price === 'undefined' || price === '') return '0.00000000';
    const value = parseFloat(price) / Math.pow(10, 18);
    return value.toFixed(8);
}


function updatePriceInfo(candles) {
    if (!candles || !candles.length) return;

    const lastCandle = candles[candles.length - 1];
    const last24hCandles = candles.filter(c => c.time >= lastCandle.time - 86400);

    if (last24hCandles.length) {
        const high24h = Math.max(...last24hCandles.map(c => c.high));
        const low24h = Math.min(...last24hCandles.map(c => c.low));
        const firstCandle = last24hCandles[0];
        const priceChange = ((lastCandle.close - firstCandle.open) / firstCandle.open) * 100;

        document.getElementById('lastPrice').textContent = lastCandle.close.toFixed(8);
        document.getElementById('highPrice').textContent = high24h.toFixed(8);
        document.getElementById('lowPrice').textContent = low24h.toFixed(8);

        const priceChangeElement = document.getElementById('priceChange');
        priceChangeElement.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
        priceChangeElement.className = `price-value ${priceChange >= 0 ? 'up' : 'down'}`;
    }
}


function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    tbody.innerHTML = transactions.map(tx => {
        const time = new Date(tx.timestamp * 1000).toLocaleString();
        const type = tx.transactionType.toLowerCase();
        const userAddress = tx.userAddress.slice(0, 6) + '...' + tx.userAddress.slice(-4);
        const rwaAmount = tx.rwaAmount;
        const holdAmount = formatPrice(tx.holdAmount);
        const bonusAmount = formatPrice(tx.bonusAmount);

        return `
            <tr>
                <td>${time}</td>
                <td><span class="transaction-type ${type}">${type.toUpperCase()}</span></td>
                <td>${userAddress}</td>
                <td>${rwaAmount}</td>
                <td>${holdAmount}</td>
                <td>${bonusAmount}</td>
            </tr>
        `;
    }).join('');
}


function checkStoreChanges() {
    const currentState = {
        candlesSize: store.candles.size,
        volumesSize: store.volumes.size,
        transactionsLength: store.transactions.length
    };

    
    if (JSON.stringify(currentState) !== JSON.stringify(lastState)) {
        
        const candleData = Array.from(store.candles.values()).map(candle => ({
            time: candle.time || candle.timestamp,
            open: parseFloat(formatPrice(candle.open)),
            high: parseFloat(formatPrice(candle.high)),
            low: parseFloat(formatPrice(candle.low)),
            close: parseFloat(formatPrice(candle.close))
        }));

        const volumeData = Array.from(store.volumes.values()).map(volume => {
            const mintVolume = parseFloat(formatPrice(volume.mintVolume));
            const burnVolume = parseFloat(formatPrice(volume.burnVolume));
            return {
                time: volume.time || volume.timestamp,
                value: mintVolume + burnVolume,
                color: mintVolume >= burnVolume ? '#26a69a' : '#ef5350'
            };
        });

        
        candlestickSeries.setData(candleData);
        volumeSeries.setData(volumeData);

        
        updatePriceInfo(candleData);

        
        updateTransactionsTable(store.transactions);

        
        lastState = currentState;
    }
}


function initializeUI() {
    initializeChart();
    
    setInterval(checkStoreChanges, 1000);
}


window.addEventListener('load', initializeUI);