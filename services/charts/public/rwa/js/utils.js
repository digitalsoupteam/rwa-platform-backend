const priceImpactCoefficients = {
    30000: 1, 12500: 2, 7778: 3, 5625: 4, 4400: 5, 3611: 6, 3061: 7, 2656: 8, 2346: 9, 2100: 10,
    1901: 11, 1736: 12, 1598: 13, 1480: 14, 1378: 15, 1289: 16, 1211: 17, 1142: 18, 1080: 19, 1025: 20,
    975: 21, 930: 22, 888: 23, 851: 24, 816: 25, 784: 26, 754: 27, 727: 28, 702: 29, 678: 30,
    656: 31, 635: 32, 615: 33, 597: 34, 580: 35, 563: 36, 548: 37, 533: 38, 519: 39, 506: 40,
    494: 41, 482: 42, 471: 43, 460: 44, 449: 45, 440: 46, 430: 47, 421: 48, 412: 49, 404: 50,
    396: 51, 388: 52, 381: 53, 374: 54, 367: 55, 360: 56, 354: 57, 348: 58, 342: 59, 336: 60,
    331: 61, 325: 62, 320: 63, 315: 64, 310: 65, 305: 66, 301: 67, 296: 68, 292: 69, 288: 70,
    284: 71, 280: 72, 276: 73, 272: 74, 268: 75, 265: 76, 261: 77, 258: 78, 255: 79, 252: 80,
    248: 81, 245: 82, 242: 83, 240: 84, 237: 85, 234: 86, 231: 87, 229: 88, 226: 89, 223: 90,
    221: 91, 219: 92, 216: 93, 214: 94, 212: 95, 209: 96, 207: 97, 205: 98, 203: 99, 201: 100,
    199: 101, 197: 102, 195: 103, 193: 104, 191: 105, 190: 106, 188: 107, 186: 108, 184: 109, 183: 110,
    181: 111, 179: 112, 178: 113, 176: 114, 175: 115, 173: 116, 172: 117, 170: 118, 169: 119, 167: 120,
    166: 121, 165: 122, 163: 123, 162: 124, 161: 125, 159: 126, 158: 127, 157: 128, 156: 129, 154: 130,
    153: 131, 152: 132, 151: 133, 150: 134, 149: 135, 148: 136, 147: 137, 145: 138, 144: 139, 143: 140,
    142: 141, 141: 142, 140: 143, 139: 144, 138: 145, 137: 146, 136: 148, 135: 149, 134: 150, 133: 151,
    132: 152, 131: 153, 130: 154, 129: 155, 128: 157, 127: 158, 126: 159, 125: 160, 124: 162, 123: 163,
    122: 164, 121: 166, 120: 167, 119: 168, 118: 170, 117: 171, 116: 173, 115: 174, 114: 176, 113: 177,
    112: 179, 111: 180, 110: 182, 109: 184, 108: 185, 107: 187, 106: 189, 105: 191, 104: 192, 103: 194,
    102: 196, 101: 198, 99: 202, 98: 204, 97: 206, 96: 208, 95: 210, 94: 213, 93: 215, 92: 217,
    91: 220, 90: 222, 89: 224, 88: 227, 87: 230, 86: 232, 85: 235, 84: 238, 83: 241, 82: 243,
    81: 246, 80: 249, 79: 253, 78: 256, 77: 259, 76: 262, 75: 266, 74: 269, 73: 273, 72: 277,
    71: 281, 70: 285, 69: 289, 68: 293, 67: 297, 66: 302, 65: 306, 64: 311, 63: 316, 62: 321,
    61: 326, 60: 332, 59: 337, 58: 343, 57: 349, 56: 355, 55: 361, 54: 368, 53: 375, 52: 382,
    51: 389, 50: 397, 49: 405, 48: 413, 47: 422, 46: 431, 45: 441, 44: 450, 43: 461, 42: 472,
    41: 483, 40: 495, 39: 507, 38: 520, 37: 534, 36: 549, 35: 564, 34: 581, 33: 598, 32: 616,
    31: 636, 30: 657, 29: 679, 28: 703, 27: 728, 26: 756, 25: 785, 24: 817, 23: 852, 22: 890,
    21: 931, 20: 977, 19: 1027, 18: 1082, 17: 1144, 16: 1213, 15: 1291, 14: 1380, 13: 1482, 12: 1601,
    11: 1740, 10: 1906, 9: 2106, 8: 2354, 7: 2668, 6: 3078, 5: 3637, 4: 4445, 3: 5715, 2: 8001,
    1: 13334
};

function calculateInitialReserves(expectedHoldAmount, expectedRwaAmount, liquidityCoefficient) {
    const virtualHoldReserve = expectedHoldAmount * liquidityCoefficient;
    const virtualRwaReserve = expectedRwaAmount * (liquidityCoefficient + 1);
    const k = virtualHoldReserve * virtualRwaReserve;
    const realHoldReserve = 0;
    return { virtualHoldReserve, virtualRwaReserve, k, realHoldReserve };
}

function calculatePrice(virtualHoldReserve, virtualRwaReserve, realHoldReserve, k, rwaAmount) {
    // holdAmount = (k / (virtualRwaReserve - rwaAmount)) - (virtualHoldReserve + realHoldReserve)
    const holdAmount = (k / (virtualRwaReserve - rwaAmount)) - (virtualHoldReserve + realHoldReserve);
    return holdAmount / rwaAmount;
}

function generatePricePoints(expectedHoldAmount, expectedRwaAmount) {
    let points = [];
    let numPoints = 100; 
    const isFixedSell = document.getElementById('fixedSell').checked;
    const isEntryBurn = document.getElementById('allowEntryBurn').checked;
    
    
    const startDate = flatpickr("#entryPeriodStart").selectedDates[0];
    const endDate = flatpickr("#entryPeriodExpired").selectedDates[0];
    const completionDate = flatpickr("#completionPeriodExpired").selectedDates[0];
    
    if (!startDate || !endDate || !completionDate) {
        console.error('Dates not selected');
        return { points: [], targetPrice: 0 };
    }

    
    const FIXED_HEIGHT = 100;
    const TARGET_HEIGHT_PERCENT = 0.6; 

    
    const liquidityCoefficient = priceImpactCoefficients[document.getElementById('priceImpact').value];
    const virtualHoldReserve = expectedHoldAmount * liquidityCoefficient;
    const virtualRwaReserve = expectedRwaAmount * (liquidityCoefficient + 1);
    const k = virtualHoldReserve * virtualRwaReserve;
    let realHoldReserve = 0;

    
    const targetRemainingRwaReserve = virtualRwaReserve - expectedRwaAmount;
    const targetRequiredHoldReserve = k / targetRemainingRwaReserve;
    const targetHoldAmount = targetRequiredHoldReserve - (virtualHoldReserve + realHoldReserve);
    const targetTotalHold = virtualHoldReserve + realHoldReserve + targetHoldAmount;
    const targetTotalRwa = virtualRwaReserve - expectedRwaAmount;
    const targetPrice = targetTotalHold / targetTotalRwa;

    
    const scaleFactor = (FIXED_HEIGHT * TARGET_HEIGHT_PERCENT) / targetPrice;

    
    const timeRange = endDate.getTime() - startDate.getTime();
    const timeStep = timeRange / (numPoints - 1); 
    
    
    const startPrice = (virtualHoldReserve + realHoldReserve) / virtualRwaReserve;
    points.push({
        time: startDate.getTime(),
        value: startPrice,
        holdAmount: 0,
        priceChange: 0,
        rwaAmount: 0
    });

    
        const wavePoints = 10; 
        const totalTimeRange = endDate.getTime() - startDate.getTime();
        const waveTimeStep = totalTimeRange / wavePoints;
        const pointsPerWave = Math.floor((numPoints - 1) / wavePoints);
        const rwaAmountPerWave = expectedRwaAmount / wavePoints;
        
        let currentRwaAmount = 0;
        let lastRwaAmount = 0;
        let targetReached = false;

        for (let wave = 0; wave < wavePoints && !targetReached; wave++) {
            const waveStartTime = startDate.getTime() + (wave * waveTimeStep);
            const waveEndTime = waveStartTime + waveTimeStep;
            
            
            for (let i = 0; i < pointsPerWave && !targetReached; i++) {
                const progress = i / pointsPerWave;
                const currentTime = waveStartTime + (waveTimeStep * progress);

                
                const waveRwaChange = rwaAmountPerWave * Math.sin(progress * Math.PI);
                currentRwaAmount = Math.max(0, Math.min(expectedRwaAmount, lastRwaAmount + waveRwaChange));
                
                
                const remainingRwaReserve = virtualRwaReserve - currentRwaAmount;
                const requiredHoldReserve = k / remainingRwaReserve;
                const currentHoldAmount = requiredHoldReserve - (virtualHoldReserve + realHoldReserve);
                
                const totalHold = virtualHoldReserve + realHoldReserve + currentHoldAmount;
                const totalRwa = virtualRwaReserve - currentRwaAmount;
                const currentPrice = totalHold / totalRwa;
                const priceChange = ((currentPrice - startPrice) / startPrice) * 100;

                points.push({
                    time: currentTime,
                    value: currentPrice,
                    holdAmount: currentHoldAmount,
                    priceChange: priceChange,
                    rwaAmount: currentRwaAmount
                });

                
                if (Math.abs(currentPrice - targetPrice) / targetPrice < 0.01) {
                    targetReached = true;
                    
                    points.push({
                        time: currentTime + timeStep,
                        value: targetPrice,
                        holdAmount: targetHoldAmount,
                        priceChange: ((targetPrice - startPrice) / startPrice) * 100,
                        rwaAmount: expectedRwaAmount
                    });
                    break;
                }
            }
            if (!targetReached) {
                lastRwaAmount += rwaAmountPerWave;
            }
        }


    if (!isEntryBurn) {
        currentRwaAmount = 0

        numPoints = points.length
        points = []
        lastRwaAmount = 0;

        
        const rwaStep = expectedRwaAmount / (numPoints - 1);
        let targetReached = false;
        
        for (let i = 1; i <= numPoints - 1 && !targetReached; i++) {
            const currentTime = startDate.getTime() + (timeStep * i);
            const currentRwaAmount = Math.min(expectedRwaAmount, rwaStep * i);
            
            const remainingRwaReserve = virtualRwaReserve - currentRwaAmount;
            const requiredHoldReserve = k / remainingRwaReserve;
            const currentHoldAmount = requiredHoldReserve - (virtualHoldReserve + realHoldReserve);
            
            const totalHold = virtualHoldReserve + realHoldReserve + currentHoldAmount;
            const totalRwa = virtualRwaReserve - currentRwaAmount;
            const currentPrice = totalHold / totalRwa;
            const priceChange = ((currentPrice - startPrice) / startPrice) * 100;

            points.push({
                time: currentTime,
                value: currentPrice,
                holdAmount: currentHoldAmount,
                priceChange: priceChange,
                rwaAmount: currentRwaAmount
            });

            
            if (Math.abs(currentPrice - targetPrice) / targetPrice < 0.01) {
                targetReached = true;
                
                points.push({
                    time: currentTime + timeStep,
                    value: targetPrice,
                    holdAmount: targetHoldAmount,
                    priceChange: ((targetPrice - startPrice) / startPrice) * 100,
                    rwaAmount: expectedRwaAmount
                });
                break;
            }
        }
    }

    
    const lastPoint = points[points.length - 1];
    const extraTimeRange = completionDate.getTime() - endDate.getTime();
    const numExtraPoints = Math.ceil(extraTimeRange / timeStep);
    
    // console.log(points.length)
    for (let i = 1; i <= numExtraPoints - 1; i++) {
        const time = endDate.getTime() + (timeStep * i);
        if (time <= completionDate.getTime()) {
            points.push({
                time: time,
                value: lastPoint.value,
                holdAmount: lastPoint.holdAmount,
                priceChange: lastPoint.priceChange,
                rwaAmount: lastPoint.rwaAmount
            });
        }
    }
//      const time = completionDate.getTime();
//      for(let i = 0; i < 50; i++) {
//  points.push({
//                 time: time + i * 1000 * 60 * 60 * 24,
//                 value: lastPoint.value,
//                 holdAmount: lastPoint.holdAmount,
//                 priceChange: lastPoint.priceChange,
//                 rwaAmount: lastPoint.rwaAmount
//             });
//      }
        
    return {
        points,
        targetPrice
    };
}

function formatPrice(price) {
    return price.toFixed(8);
}

function calculatePriceChange(initialPrice, finalPrice) {
    const change = ((finalPrice - initialPrice) / initialPrice) * 100;
    return change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
}

function populatePriceImpactSelect() {
    const select = document.getElementById('priceImpact');
    if (!select) return;

    select.innerHTML = '';
    Object.entries(priceImpactCoefficients).forEach(([impact, coefficient]) => {
        const option = document.createElement('option');
        option.value = impact;
        option.textContent = `${(impact / 100).toFixed(2)}%`;
        select.appendChild(option);
    });
}