let chart;
let candleSeries, volumeSeries;


function initChart(chartElementId, onTimeRangeChangeCallback) {
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
            tickMarkFormatter: (time) => {
                const date = new Date(time * 1000);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        },
    });

    
    candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: true,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        priceFormat: {
            type: 'price',
            precision: 8,
            minMove: 0.00000001,
        },
    });

    candleSeries.priceScale().applyOptions({
        scaleMargins: {
            top: 0.1,
            bottom: 0.4,
        },
    });

    
    volumeSeries = chart.addSeries(
        LightweightCharts.HistogramSeries, {
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: '', 
    });

    volumeSeries.priceScale().applyOptions({
        scaleMargins: {
            top: 0.7, 
            bottom: 0,  
        },
    });

    window.addEventListener('resize', () => {
        if (chart && chartElement) {
            chart.applyOptions({
                width: chartElement.offsetWidth,
                height: chartElement.offsetHeight,
            });
        }
    });

    if (onTimeRangeChangeCallback) {
        chart.timeScale().subscribeVisibleTimeRangeChange(onTimeRangeChangeCallback);
    }
}


function setCandleSeriesData(data) {
    if (candleSeries) {
        candleSeries.setData(data);
    }
}

function updateCandleSeries(candleData) {
    if (candleSeries) {
        candleSeries.update(candleData);
    }
}

function getCandleSeriesData() {
    return candleSeries ? candleSeries.data() : null;
}


function setVolumeSeriesData(data) {
    if (volumeSeries) {
        volumeSeries.setData(data);
    }
}

function setVisibleTimeRange(startTime, endTime) {
    if (chart) {
        chart.timeScale().setVisibleRange({ from: startTime, to: endTime });
    }
}