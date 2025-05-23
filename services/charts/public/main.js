let currentPoolAddress = null;


const STORE = {
    ohlc: [], // Array of { time: number, open: BigInt, high: BigInt, low: BigInt, close: BigInt }
    volume: [], // Array of { time: number, mintVolume: BigInt, burnVolume: BigInt }
    transactions: [], // Array of transaction objects with amounts as BigInt
    meta: {
        poolAddress: null,
        interval: null,
        timeRange: { startTime: null, endTime: null }
    }
};

// Utility to convert API string values to BigInt, handling null/undefined
function toBigInt(value) {
    if (value === null || typeof value === 'undefined' || value === '' || value === '0') return 0n;
    try {
        return BigInt(value);
    } catch (e) {
        console.error(`Failed to convert "${value}" to BigInt:`, e);
        return 0n; // Fallback
    }
}

// Utility to format BigInt for display
function formatBigIntForDisplay(bigIntValue, decimals = 18, displayFixed = 8) {
    if (bigIntValue === null || typeof bigIntValue === 'undefined') return (0).toFixed(displayFixed);
    
    const divisor = 10n ** BigInt(decimals);
    const sign = bigIntValue < 0n ? "-" : "";
    const absValue = bigIntValue < 0n ? -bigIntValue : bigIntValue;

    const integerPart = absValue / divisor;
    const fractionalPart = absValue % divisor;

    const fractionalString = fractionalPart.toString().padStart(decimals, '0');
    const fullNumberString = `${sign}${integerPart}.${fractionalString}`;
    
    const numValue = parseFloat(fullNumberString);
    return numValue.toFixed(displayFixed);
}


function alignCandleData(ohlcData) {
    if (!ohlcData || ohlcData.length < 2) {
        
        return ohlcData.map(candle => ({ ...candle }));
    }

    
    
    const alignedData = ohlcData.map(candle => ({ ...candle }));

    for (let i = 1; i < alignedData.length; i++) {
        const prevCandle = alignedData[i - 1];
        const currentCandle = alignedData[i];

        
        if (currentCandle.open !== prevCandle.close) {
            currentCandle.open = prevCandle.close;

            
            if (currentCandle.open > currentCandle.high) {
                currentCandle.high = currentCandle.open;
            }
            
            if (currentCandle.open < currentCandle.low) {
                currentCandle.low = currentCandle.open;
            }
            
            
            
            
        }
    }
    return alignedData;
}


function triggerUiUpdate() {
    
    const alignedOhlcData = alignCandleData(STORE.ohlc); 
    const candleDataForChart = alignedOhlcData.map(d => ({ 
        time: d.time,
        open: parseFloat(formatBigIntForDisplay(d.open)),
        high: parseFloat(formatBigIntForDisplay(d.high)),
        low: parseFloat(formatBigIntForDisplay(d.low)),
        close: parseFloat(formatBigIntForDisplay(d.close))
    }));

    const volumeBarsForChart = STORE.volume.map(d => {
        // Assuming volume values (mintVolume, burnVolume) from API are full token units (not scaled by 10^18)
        // and stored as BigInt. For chart, convert to Number.
        const displayMintVolume = Number(d.mintVolume);
        const displayBurnVolume = Number(d.burnVolume);
        const totalVolume = displayMintVolume + displayBurnVolume;
        return {
            time: d.time,
            value: totalVolume,
            color: displayMintVolume >= displayBurnVolume ? '#26a69a' : '#ef5350'
        };
    });
    
    const transactionsForTable = STORE.transactions.map(tx => ({
        ...tx, // id, poolAddress, transactionType, userAddress, timestamp
        rwaAmount: tx.rwaAmount,
        holdAmount: tx.holdAmount, 
        bonusAmount: tx.bonusAmount
    }));

    
    setCandleSeriesData(candleDataForChart);
    setVolumeSeriesData(volumeBarsForChart);
    updateTransactionsTable(transactionsForTable); // from uiUpdater.js
    updatePriceInfo(); // from uiUpdater.js
}



async function updateChartData() {
    try {
        const poolAddressInput = document.getElementById('poolAddress');
        const intervalInput = document.getElementById('interval');

        if (!poolAddressInput || !intervalInput) {
            console.error('Pool address or interval input not found');
            return;
        }

        const poolAddress = poolAddressInput.value;
        if (!poolAddress) {
            alert('Please enter a pool address');
            return;
        }

        const interval = intervalInput.value;
        const { startTime, endTime } = getTimeRange(); // from utils.js

        STORE.meta.poolAddress = poolAddress;
        STORE.meta.interval = interval;
        STORE.meta.timeRange = { startTime, endTime };

        
        const [ohlcDataFromApi, volumeDataFromApi, transactionsFromApi] = await Promise.all([
            fetchOhlcData(poolAddress, interval, startTime, endTime),
            fetchVolumeData(poolAddress, interval, startTime, endTime),
            fetchTransactions(poolAddress)
        ]);

        
        STORE.ohlc = ohlcDataFromApi.map(d => ({
            time: d.timestamp,
            open: toBigInt(d.open),
            high: toBigInt(d.high),
            low: toBigInt(d.low),
            close: toBigInt(d.close)
        })).sort((a, b) => a.time - b.time);

        STORE.volume = volumeDataFromApi.map(d => ({
            time: d.timestamp,
            mintVolume: toBigInt(d.mintVolume),
            burnVolume: toBigInt(d.burnVolume)
        })).sort((a, b) => a.time - b.time);
        
        STORE.transactions = transactionsFromApi.map(tx => ({
            id: tx.id,
            poolAddress: tx.poolAddress,
            transactionType: tx.transactionType,
            userAddress: tx.userAddress,
            timestamp: tx.timestamp,
            rwaAmount: toBigInt(tx.rwaAmount),
            holdAmount: toBigInt(tx.holdAmount),
            bonusAmount: toBigInt(tx.bonusAmount)
        })).sort((a,b) => b.timestamp - a.timestamp); // Newest first for transactions

        
        if (!currentPoolAddress || currentPoolAddress !== poolAddress) {
            console.log(`Pool address changed from ${currentPoolAddress} to ${poolAddress}. Reinitializing EventSources.`);
            initEventSources(
                poolAddress,
                handleStorePriceUpdate,
                handleStoreTransactionUpdate
            );
            currentPoolAddress = poolAddress;
        }
        
        triggerUiUpdate();
        
        if (STORE.ohlc.length > 0) {
            const firstDataPointTime = STORE.ohlc[0].time;
            const lastDataPointTime = STORE.ohlc[STORE.ohlc.length - 1].time;
            const displayStartTime = STORE.meta.timeRange.startTime > firstDataPointTime ? STORE.meta.timeRange.startTime : firstDataPointTime;
            const displayEndTime = STORE.meta.timeRange.endTime < lastDataPointTime ? STORE.meta.timeRange.endTime : lastDataPointTime;
            setVisibleTimeRange(displayStartTime, displayEndTime);
        } else {
             setVisibleTimeRange(STORE.meta.timeRange.startTime, STORE.meta.timeRange.endTime);
        }

    } catch (error) {
        console.error('Error updating chart data and populating STORE:', error);
        alert('Error initializing chart: ' + error.message);
    }
}


function handleStorePriceUpdate(priceUpdate) {
    const newPrice = toBigInt(priceUpdate.price);
    const updateTimestamp = priceUpdate.timestamp;
    const intervalSeconds = getIntervalSeconds(STORE.meta.interval);
    const candleTime = Math.floor(updateTimestamp / intervalSeconds) * intervalSeconds;

    let candle = STORE.ohlc.find(c => c.time === candleTime);

    if (candle) {
        candle.close = newPrice;
        if (newPrice > candle.high) candle.high = newPrice;
        if (newPrice < candle.low) candle.low = newPrice;
    } else {
        let openPrice = newPrice;
        if (STORE.ohlc.length > 0) {
            const lastCandleInStore = STORE.ohlc[STORE.ohlc.length - 1]; // Assumes STORE.ohlc is sorted
            if (candleTime > lastCandleInStore.time) {
                openPrice = lastCandleInStore.close;
            } else if (candleTime < STORE.ohlc[0].time) { // New candle before all known data
                openPrice = newPrice; // Or handle as an anomaly
            } else { // New candle fits in a gap or is out of order
                 // Try to find previous candle to determine open price
                let prevCandle = null;
                for (let i = STORE.ohlc.length - 1; i >= 0; i--) {
                    if (STORE.ohlc[i].time < candleTime) {
                        prevCandle = STORE.ohlc[i];
                        break;
                    }
                }
                if (prevCandle) {
                    openPrice = prevCandle.close;
                } else {
                    openPrice = newPrice; // Fallback if no strictly previous candle found
                }
            }
        }
        
        const newCandleData = {
            time: candleTime,
            open: openPrice,
            high: newPrice,
            low: newPrice,
            close: newPrice
        };
        STORE.ohlc.push(newCandleData);
        STORE.ohlc.sort((a, b) => a.time - b.time);
    }
    triggerUiUpdate();
}

function handleStoreTransactionUpdate(transactionUpdate) {
    const newTransaction = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Temporary ID
        poolAddress: transactionUpdate.poolAddress,
        timestamp: transactionUpdate.timestamp,
        transactionType: transactionUpdate.transactionType,
        userAddress: transactionUpdate.userAddress,
        rwaAmount: toBigInt(transactionUpdate.rwaAmount),
        holdAmount: toBigInt(transactionUpdate.holdAmount),
        bonusAmount: toBigInt(transactionUpdate.bonusAmount),
        // holdFee: toBigInt(transactionUpdate.holdFee), // If needed
        // bonusFee: toBigInt(transactionUpdate.bonusFee), // If needed
    };

    STORE.transactions.unshift(newTransaction); // Add to beginning (newest first)
    if (STORE.transactions.length > 200) {
        STORE.transactions.length = 200; // Keep last 200
    }

    const intervalSeconds = getIntervalSeconds(STORE.meta.interval);
    const volumeBarTime = Math.floor(newTransaction.timestamp / intervalSeconds) * intervalSeconds;
    let volumeBar = STORE.volume.find(v => v.time === volumeBarTime);

    if (!volumeBar) {
        volumeBar = { time: volumeBarTime, mintVolume: 0n, burnVolume: 0n };
        STORE.volume.push(volumeBar);
        STORE.volume.sort((a, b) => a.time - b.time);
    }

    if (newTransaction.transactionType.toUpperCase() === 'MINT') {
        volumeBar.mintVolume += newTransaction.rwaAmount;
    } else if (newTransaction.transactionType.toUpperCase() === 'BURN') {
        volumeBar.burnVolume += newTransaction.rwaAmount;
    }
    triggerUiUpdate();
}



document.addEventListener('DOMContentLoaded', () => {
    initChart('priceChart', () => {
        // Callback for when user manually scrolls/zooms the chart.
        // Can be used to update UI elements based on visible range if needed,
        // but main data updates are via triggerUiUpdate.
        console.log("Chart time range changed by user interaction.");
    });

    window.updateChart = updateChartData;

    const urlParams = new URLSearchParams(window.location.search);
    const poolAddressFromUrl = urlParams.get('poolAddress');
    const poolAddressInput = document.getElementById('poolAddress');

    if (poolAddressFromUrl && poolAddressInput) {
        poolAddressInput.value = poolAddressFromUrl;
        updateChartData();
    } else if (poolAddressInput && poolAddressInput.placeholder && poolAddressInput.placeholder !== "Enter pool address") {
        poolAddressInput.value = poolAddressInput.placeholder;
        updateChartData();
    } else {
        triggerUiUpdate(); // Show empty state
    }
});