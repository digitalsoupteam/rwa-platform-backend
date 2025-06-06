let chart;
let lineSeries;
let waveSeries;
let startLine;
let endLine;
let completionLine;
let initialPriceLine;
let targetPriceLine;
let outTranchesSeries;
let inTranchesSeries;
let postCompletionSeries;
let sinusoidSeries;

function initChart(chartElementId) {
    const chartElement = document.getElementById(chartElementId);
    if (!chartElement) {
        console.error(`Chart element with id "${chartElementId}" not found.`);
        return;
    }

    chart = LightweightCharts.createChart(chartElement, {
        width: chartElement.offsetWidth,
        height: chartElement.offsetHeight,
        layout: {
            background: { type: 'solid', color: '#131722' },
            textColor: '#d1d4dc',
        },
        grid: {
            vertLines: { color: '#1e222d' },
            horzLines: { color: '#1e222d' }
        },
        rightPriceScale: {
            borderColor: '#2a2e39',
            textColor: '#d1d4dc',
            mode: LightweightCharts.PriceScaleMode.Normal,
            formatter: (value) => `${value.toFixed(8)} HOLD/RWA`,
        },
        timeScale: {
            borderColor: '#2a2e39',
            textColor: '#d1d4dc',
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: (time) => {
                const date = new Date(time * 1000);
                return formatDate(date);
            }
        },
    });

    outTranchesSeries = chart.addSeries(LightweightCharts.BaselineSeries, {
        baseValue: { type: 'price', price: 0 },
        topLineColor: 'rgb(166, 38, 38)',
        topFillColor1: 'rgba(166, 38, 38, 0.28)',
        topFillColor2: 'rgba(166, 38, 38, 0.05)',
        bottomLineColor: 'rgb(166, 38, 38)',
        bottomFillColor1: 'rgba(166, 38, 38, 0.05)',
        bottomFillColor2: 'rgba(166, 38, 38, 0.28)',
        lineWidth: 2,
        lastValueVisible: false
    });

    inTranchesSeries = chart.addSeries(LightweightCharts.BaselineSeries, {
        baseValue: { type: 'price', price: 0 },
        topLineColor: 'rgba(39, 176, 66, 0)',
        topFillColor1: 'rgba(39, 176, 66, 0)',
        topFillColor2: 'rgba(39, 176, 66, 0)',
        bottomLineColor: 'rgba(39, 176, 66, 1)',
        bottomFillColor1: 'rgba(39, 176, 66, 0.28)',
        bottomFillColor2: 'rgba(39, 176, 66, 0.05)',
        lineWidth: 2,
        lastValueVisible: false
    });

    sinusoidSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#FF9800',
        lineWidth: 1,
        priceFormat: {
            type: 'price',
            precision: 8,
            minMove: 0.00000001,
        },
        lastValueVisible: false
    });

    postCompletionSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#E91E63',
        lineWidth: 2,
        priceFormat: {
            type: 'price',
            precision: 8,
            minMove: 0.00000001,
        },
        lastValueVisible: true
    });

    lineSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#2962FF',
        lineWidth: 2,
        priceFormat: {
            type: 'price',
            precision: 8,
            minMove: 0.00000001,
        },
        lastValueVisible: false,
    });

    waveSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: 'rgba(255, 152, 0, 0.6)',
        lineWidth: 1,
        priceFormat: {
            type: 'price',
            precision: 8,
            minMove: 0.00000001,
        },
        lastValueVisible: false,
    });

    startLine = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#4CAF50', 
        lineWidth: 1,
        lineStyle: 1, 
        lastValueVisible: false,
    });

    endLine = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#F44336', 
        lineWidth: 1,
        lineStyle: 1, 
        lastValueVisible: false,
    });

    completionLine = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#9C27B0', 
        lineWidth: 1,
        lineStyle: 1, 
        lastValueVisible: false,
    });

    
    initialPriceLine = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#4CAF50', 
        lineWidth: 1,
        lineStyle: 2, 
        lastValueVisible: true,
        title: 'Initial Price',
    });

    targetPriceLine = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#FF9800', 
        lineWidth: 1,
        lineStyle: 2, 
        lastValueVisible: true,
        title: 'Target Price',
    });

    window.addEventListener('resize', () => {
        if (chart && chartElement) {
            chart.applyOptions({
                width: chartElement.offsetWidth,
                height: chartElement.offsetHeight,
            });
        }
    });
}

function generateWavePoints(startDate, endDate, completionDate, expectedHoldAmount, expectedRwaAmount, liquidityCoefficient, targetPrice) {
    let points = [];
    const numPoints = 100;
    const timeRange = endDate.getTime() - startDate.getTime();
    const timeStep = timeRange / (numPoints - 1);
    const isEntryBurn = document.getElementById('allowEntryBurn').checked;

    
    const virtualHoldReserve = expectedHoldAmount * liquidityCoefficient;
    const virtualRwaReserve = expectedRwaAmount * (liquidityCoefficient + 1);
    const k = virtualHoldReserve * virtualRwaReserve;
    const realHoldReserve = 0;

    
    const startPrice = (virtualHoldReserve + realHoldReserve) / virtualRwaReserve;

    if (isEntryBurn) {
        
        const wavePoints = 10;
        const waveTimeStep = timeRange / wavePoints;
        const pointsPerWave = Math.floor(numPoints / wavePoints);
        const rwaAmountPerWave = expectedRwaAmount / wavePoints;

        let currentRwaAmount = 0;
        let lastRwaAmount = 0;

        
        points.push({
            time: Math.floor(startDate.getTime() / 1000),
            value: startPrice
        });

        
        for (let wave = 0; wave < wavePoints; wave++) {
            const waveStartTime = startDate.getTime() + (wave * waveTimeStep);
            const isLastWave = wave === wavePoints - 1;
            
            for (let i = 0; i < pointsPerWave; i++) {
                const progress = i / pointsPerWave;
                const currentTime = waveStartTime + (waveTimeStep * progress);

                
                if (isLastWave && i === pointsPerWave - 1) {
                    points.push({
                        time: Math.floor(currentTime / 1000),
                        value: targetPrice
                    });
                } else {
                    
                    const waveProgress = wave / wavePoints;
                    const amplitudeFactor = 1 + waveProgress; 
                    const waveRwaChange = rwaAmountPerWave * Math.sin(progress * Math.PI) * amplitudeFactor;
                    currentRwaAmount = Math.max(0, Math.min(expectedRwaAmount, lastRwaAmount + waveRwaChange));
                    
                    
                    const remainingRwaReserve = virtualRwaReserve - currentRwaAmount;
                    const requiredHoldReserve = k / remainingRwaReserve;
                    const currentHoldAmount = requiredHoldReserve - (virtualHoldReserve + realHoldReserve);
                    
                    const totalHold = virtualHoldReserve + realHoldReserve + currentHoldAmount;
                    const totalRwa = virtualRwaReserve - currentRwaAmount;
                    const currentPrice = totalHold / totalRwa;

                    points.push({
                        time: Math.floor(currentTime / 1000),
                        value: currentPrice
                    });
                }
            }
            lastRwaAmount += rwaAmountPerWave;
        }
    } else {
        
        const rwaStep = expectedRwaAmount / (numPoints - 1);
        
        for (let i = 0; i < numPoints; i++) {
            const currentTime = startDate.getTime() + (timeStep * i);
            const currentRwaAmount = Math.min(expectedRwaAmount, rwaStep * i);
            
            const remainingRwaReserve = virtualRwaReserve - currentRwaAmount;
            const requiredHoldReserve = k / remainingRwaReserve;
            const currentHoldAmount = requiredHoldReserve - (virtualHoldReserve + realHoldReserve);
            
            const totalHold = virtualHoldReserve + realHoldReserve + currentHoldAmount;
            const totalRwa = virtualRwaReserve - currentRwaAmount;
            const currentPrice = totalHold / totalRwa;

            points.push({
                time: Math.floor(currentTime / 1000),
                value: currentPrice
            });
        }
    }

    
    const extraTimeRange = completionDate.getTime() - endDate.getTime();
    const numExtraPoints = Math.ceil(extraTimeRange / timeStep);

    for (let i = 1; i <= numExtraPoints; i++) {
        const time = endDate.getTime() + (timeStep * i);
        if (time <= completionDate.getTime()) {
            points.push({
                time: Math.floor(time / 1000),
                value: targetPrice
            });
        }
    }

    return points;
}

function setChartData() {
    if (!lineSeries || !waveSeries || !startLine || !endLine || !completionLine || !initialPriceLine || !targetPriceLine || !outTranchesSeries || !inTranchesSeries) {
        console.error('Series not initialized');
        return;
    }

    
    const expectedHoldAmount = parseFloat(document.getElementById('expectedHoldAmount').value);
    const expectedRwaAmount = parseFloat(document.getElementById('expectedRwaAmount').value);
    const priceImpact = parseInt(document.getElementById('priceImpact').value);
    const startDate = flatpickr("#entryPeriodStart").selectedDates[0];
    const endDate = flatpickr("#entryPeriodExpired").selectedDates[0];
    const completionDate = flatpickr("#completionPeriodExpired").selectedDates[0];

    if (!startDate || !endDate || !completionDate || isNaN(expectedHoldAmount) || isNaN(expectedRwaAmount)) {
        return;
    }

    
    const liquidityCoefficient = priceImpactCoefficients[priceImpact];
    const virtualHoldReserve = expectedHoldAmount * liquidityCoefficient;
    const virtualRwaReserve = expectedRwaAmount * (liquidityCoefficient + 1);
    const k = virtualHoldReserve * virtualRwaReserve;
    const realHoldReserve = 0;

    
    const initialPrice = (virtualHoldReserve + realHoldReserve) / virtualRwaReserve;

    
    const remainingRwaReserve = virtualRwaReserve - expectedRwaAmount;
    const requiredHoldReserve = k / remainingRwaReserve;
    const targetHoldAmount = requiredHoldReserve - (virtualHoldReserve + realHoldReserve);
    const targetTotalHold = virtualHoldReserve + realHoldReserve + targetHoldAmount;
    const targetTotalRwa = virtualRwaReserve - expectedRwaAmount;
    const targetPrice = targetTotalHold / targetTotalRwa;

    
    const straightPoints = [
        { time: Math.floor(startDate.getTime() / 1000), value: initialPrice },
        { time: Math.floor(completionDate.getTime() / 1000), value: targetPrice }
    ];

    
    const wavePoints = generateWavePoints(startDate, endDate, completionDate, expectedHoldAmount, expectedRwaAmount, liquidityCoefficient, targetPrice);

    
    lineSeries.applyOptions({
        color:  'rgba(41, 98, 255, 0)'
    });
    lineSeries.setData(straightPoints);
    waveSeries.setData(wavePoints);

    
    outTranchesSeries.applyOptions({
        baseValue: { type: 'price', price: targetPrice }
    });
    inTranchesSeries.applyOptions({
        baseValue: { type: 'price', price: targetPrice }
    });

    
    if (outTranches && outTranches.length > 0) {
        const sortedTranches = [...outTranches].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const outTranchePoints = [];
        let currentHoldAmount = 0;

        for (let i = 0; i < sortedTranches.length; i++) {
            const tranche = sortedTranches[i];
            const holdAmount = parseFloat(tranche.amount);

            if (holdAmount <= 0) continue;

            currentHoldAmount += holdAmount;
            const percentHold = currentHoldAmount / expectedHoldAmount * 100;
            const priceDiff = (targetPrice - initialPrice) / 100;
            const price = targetPrice - priceDiff * percentHold;
            const trancheTime = Math.floor(new Date(tranche.date).getTime() / 1000);

            if (i === 0) {
                outTranchePoints.push({
                    time: trancheTime - 1,
                    value: targetPrice
                });
            } else {
                outTranchePoints.push({
                    time: trancheTime - 1,
                    value: outTranchePoints[outTranchePoints.length - 1].value
                });
            }

            outTranchePoints.push({
                time: trancheTime,
                value: price
            });
        }

        
        outTranchePoints.push({
            time: Math.floor(completionDate.getTime() / 1000),
            value: initialPrice
        });

        outTranchesSeries.setData(outTranchePoints);
    }

    
    if (inTranches && inTranches.length > 0 && outTranches && outTranches.length > 0) {
        const firstOutTranche = [...outTranches].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        )[0];

        const firstOutTime = Math.floor(new Date(firstOutTranche.date).getTime() / 1000);
        const sortedInTranches = [...inTranches].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const inTranchePoints = [];
        inTranchePoints.push({
            time: firstOutTime,
            value: targetPrice
        });

        let totalHold = 0;
        sortedInTranches.forEach(tranche => {
            const holdAmount = parseFloat(tranche.amount);
            totalHold += holdAmount;
            if (totalHold > expectedHoldAmount) {
                totalHold = expectedHoldAmount;
            }

            const percentHold = totalHold / expectedHoldAmount * 100;
            const priceDiff = (targetPrice - initialPrice) / 100;
            const price = targetPrice - priceDiff * percentHold;

            inTranchePoints.push({
                time: Math.floor(new Date(tranche.date).getTime() / 1000),
                value: price
            });
        });

        inTranchesSeries.setData(inTranchePoints);
    }

    
    const isFixedSell = document.getElementById('fixedSell').checked;
    
    {
    
    sinusoidSeries.applyOptions({
        color: !isFixedSell ? '#FF9800' : 'rgba(255, 152, 0, 0)'
    });

    
    const sinusoidPoints = [];
        const timeRange = completionDate.getTime() - endDate.getTime();
        const numPoints = 200; 
        const timeStep = timeRange / numPoints;
        
        
        const areaHeight = (targetPrice - initialPrice) * 0.2;
        const amplitude = areaHeight / 4; 
        
        
        const frequency1 = 2 * Math.PI / timeRange * 5; 
        const frequency2 = frequency1 * 1.5; 
        
        for (let i = 0; i <= numPoints; i++) {
            const time = endDate.getTime() + (i * timeStep);
            
            const wave1 = Math.abs(Math.sin(frequency1 * (time - endDate.getTime())));
            const wave2 = Math.abs(Math.sin(frequency2 * (time - endDate.getTime())));
            const combinedWave = (wave1 + wave2) * amplitude;
            
            sinusoidPoints.push({
                time: Math.floor(time / 1000),
                value: targetPrice + combinedWave
            });
        }
        
        sinusoidSeries.setData(sinusoidPoints);
        }

    
    const completionTime = completionDate.getTime();
    const oneMonthLater = new Date(completionDate);
    oneMonthLater.setDate(oneMonthLater.getDate() + 1); 

    const postCompletionPoints = [];
    const numPoints = 5;
    const timeStep = (oneMonthLater.getTime() - completionTime) / (numPoints - 1);
    const rwaStep = expectedRwaAmount / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
        const currentTime = completionTime + (timeStep * i);
        const currentRwaAmount = Math.max(0, expectedRwaAmount - (rwaStep * i));
        
        const remainingRwaReserve = virtualRwaReserve - currentRwaAmount;
        const requiredHoldReserve = k / remainingRwaReserve;
        const currentHoldAmount = requiredHoldReserve - (virtualHoldReserve + realHoldReserve);
        
        const totalHold = virtualHoldReserve + realHoldReserve + currentHoldAmount;
        const totalRwa = virtualRwaReserve - currentRwaAmount;
        const currentPrice = totalHold / totalRwa;

        postCompletionPoints.push({
            time: Math.floor(currentTime / 1000),
            value: currentPrice
        });
    }

    postCompletionSeries.setData(postCompletionPoints);

    
    const minPrice = initialPrice;
    const maxPrice = targetPrice;

    
    startLine.setData([
        { time: Math.floor(startDate.getTime() / 1000), value: minPrice },
        { time: Math.floor(startDate.getTime() / 1000), value: maxPrice }
    ]);

    endLine.setData([
        { time: Math.floor(endDate.getTime() / 1000), value: minPrice },
        { time: Math.floor(endDate.getTime() / 1000), value: maxPrice }
    ]);

    completionLine.setData([
        { time: Math.floor(completionDate.getTime() / 1000), value: minPrice },
        { time: Math.floor(completionDate.getTime() / 1000), value: maxPrice }
    ]);

    
    const timeStart = Math.floor(startDate.getTime() / 1000);
    const timeEnd = Math.floor(completionDate.getTime() / 1000);
    
    initialPriceLine.setData([
        { time: timeStart, value: initialPrice },
        { time: timeEnd, value: initialPrice }
    ]);

    targetPriceLine.setData([
        { time: timeStart, value: targetPrice },
        { time: timeEnd, value: targetPrice }
    ]);

    
    const timeRange = completionDate.getTime() - startDate.getTime();
    const padding = timeRange * 0.05;
    
    chart.timeScale().setVisibleRange({
        from: Math.floor((startDate.getTime() - padding) / 1000),
        to: Math.floor((completionDate.getTime() + padding) / 1000)
    });
}

function resetChart() {
    if (chart) {
        chart.remove();
        chart = null;
        lineSeries = null;
        waveSeries = null;
        startLine = null;
        endLine = null;
        completionLine = null;
        initialPriceLine = null;
        targetPriceLine = null;
        outTranchesSeries = null;
        inTranchesSeries = null;
        postCompletionSeries = null;
        sinusoidSeries = null;
    }
    initChart('priceChart');
}

function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}
