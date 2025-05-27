function getIntervalSeconds(interval) {
    const units = { 'm': 60, 'h': 3600, 'd': 86400, 'w': 604800 };
    const value = parseInt(interval);
    const unit = interval.slice(-1);
    return value * units[unit];
}

function formatPrice(price) {
    if (price === null || typeof price === 'undefined' || price === '') return '0.00000000';
    const value = parseFloat(price) / Math.pow(10, 18);
    return value.toFixed(8);
}

function getTimeRange() {
    const range = document.getElementById('timeRange').value;
    const now = Math.floor(Date.now() / 1000);
    let startTime;

    switch (range) {
        case '1h': startTime = now - 3600; break;
        case '4h': startTime = now - 14400; break;
        case '12h': startTime = now - 43200; break;
        case '1d': startTime = now - 86400; break;
        case '7d': startTime = now - 604800; break;
        case '30d': startTime = now - 2592000; break;
        default: startTime = now - 3600;
    }
    return { startTime, endTime: now };
}