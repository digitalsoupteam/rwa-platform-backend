function handlePriceUpdate(priceUpdate, intervalValue) {
    if (!priceUpdate) {
        console.warn('handlePriceUpdate received null or undefined priceUpdate');
        return;
    }
    const price = parseFloat(formatPrice(priceUpdate.price));

    document.getElementById('lastPrice').textContent = price.toFixed(8);

    const intervalSeconds = getIntervalSeconds(intervalValue);
    const currentTime = Math.floor(priceUpdate.timestamp / intervalSeconds) * intervalSeconds;

    const candleData = getCandleSeriesData();
    if (!candleData) return;

    const lastCandle = candleData.length > 0 ? candleData[candleData.length - 1] : null;

    if (lastCandle && lastCandle.time === currentTime) {
        lastCandle.high = Math.max(lastCandle.high, price);
        lastCandle.low = Math.min(lastCandle.low, price);
        lastCandle.close = price;
        updateCandleSeries(lastCandle);
    } else {
        const newCandle = {
            time: currentTime,
            open: lastCandle ? lastCandle.close : price,
            high: price,
            low: price,
            close: price
        };
        updateCandleSeries(newCandle);
    }
    updatePriceInfo(); 
}

function handleTransactionUpdate(transaction) {
    if (!transaction) {
        console.warn('handleTransactionUpdate received null or undefined transaction');
        return;
    }
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;

    const row = document.createElement('tr');

    const time = new Date(transaction.timestamp * 1000).toLocaleString();
    const type = transaction.transactionType.toLowerCase();
    const userAddress = transaction.userAddress.slice(0, 6) + '...' + transaction.userAddress.slice(-4);
    const rwaAmount = transaction.rwaAmount; 
    const holdAmount = formatPrice(transaction.holdAmount);
    const bonusAmount = formatPrice(transaction.bonusAmount);

    row.innerHTML = `
                <td>${time}</td>
                <td><span class="transaction-type ${type}">${type.toUpperCase()}</span></td>
                <td>${userAddress}</td>
                <td>${rwaAmount}</td>
                <td>${holdAmount}</td>
                <td>${bonusAmount}</td>
            `;

    tbody.insertBefore(row, tbody.firstChild);

    
    while (tbody.children.length > 50) {
        tbody.removeChild(tbody.lastChild);
    }
}


function updatePriceInfo() {
    try {
        const data = getCandleSeriesData();
        if (!data || !data.length) return;

        const lastCandle = data[data.length - 1];
        
        const last24hCandles = data.filter(candle => candle.time >= lastCandle.time - 86400);

        if (last24hCandles.length) {
            const high24h = Math.max(...last24hCandles.map(c => c.high));
            const low24h = Math.min(...last24hCandles.map(c => c.low));
            const firstCandleOfPeriod = last24hCandles[0]; 
            
            
            const openPriceForChangeCalc = (firstCandleOfPeriod && typeof firstCandleOfPeriod.open === 'number' && firstCandleOfPeriod.open !== 0)
                ? firstCandleOfPeriod.open
                : (lastCandle.open !== 0 ? lastCandle.open : 1); 

            const priceChange = ((lastCandle.close - openPriceForChangeCalc) / openPriceForChangeCalc) * 100;

            document.getElementById('lastPrice').textContent = lastCandle.close.toFixed(8);
            document.getElementById('highPrice').textContent = high24h.toFixed(8);
            document.getElementById('lowPrice').textContent = low24h.toFixed(8);

            const priceChangeElement = document.getElementById('priceChange');
            priceChangeElement.textContent = `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`;
            priceChangeElement.className = `price-value ${priceChange >= 0 ? 'up' : 'down'}`;
        } else if (lastCandle) {
            
            document.getElementById('lastPrice').textContent = lastCandle.close.toFixed(8);
            document.getElementById('highPrice').textContent = lastCandle.high.toFixed(8);
            document.getElementById('lowPrice').textContent = lastCandle.low.toFixed(8);
            document.getElementById('priceChange').textContent = '0.00%';
            document.getElementById('priceChange').className = 'price-value';
        }
    } catch (error) {
        console.error('Error updating price info:', error);
    }
}

function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;

    tbody.innerHTML = ''; 

    transactions.forEach(tx => {
        const row = document.createElement('tr');
        const time = new Date(tx.timestamp * 1000).toLocaleString();
        const type = tx.transactionType.toLowerCase();
        const userAddress = tx.userAddress.slice(0, 6) + '...' + tx.userAddress.slice(-4);
        const rwaAmount = tx.rwaAmount;
        const holdAmount = formatPrice(tx.holdAmount);
        const bonusAmount = formatPrice(tx.bonusAmount);

        row.innerHTML = `
                    <td>${time}</td>
                    <td><span class="transaction-type ${type}">${type.toUpperCase()}</span></td>
                    <td>${userAddress}</td>
                    <td>${rwaAmount}</td>
                    <td>${holdAmount}</td>
                    <td>${bonusAmount}</td>
                `;
        
        tbody.appendChild(row);
    });
}
