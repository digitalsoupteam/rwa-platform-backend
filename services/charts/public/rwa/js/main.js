
function startOfDay(date) {
    const newDate = new Date(date);
    newDate.setUTCHours(0, 0, 0, 0);
    return newDate;
}


let outTranches = [];
let inTranches = [];


function applyPreset() {
    const preset = document.getElementById('preset').value;
    
    
    document.getElementById('outTranches').innerHTML = '';
    document.getElementById('inTranches').innerHTML = '';
    outTranches = [];
    inTranches = [];

    
    resetChart();

    const presetConfigs = {
        simple: {
            out: [{percentage: 1, dayOffset: 1}],
            in: [{percentage: 1, dayOffset: 0}]
        },
        threeOut: {
            out: [
                {percentage: 0.5, dayOffset: 1},
                {percentage: 0.1, dayOffset: 30},
                {percentage: 0.1, dayOffset: 60},
                {percentage: 0.1, dayOffset: 90},
                {percentage: 0.1, dayOffset: 120},
                {percentage: 0.1, dayOffset: 150}
            ],
            in: [
                {percentage: 0.8, dayOffset: 0},
                {percentage: 0.2, dayOffset: -90}
            ]
        },
        threeOutIn: {
            out: [
                {percentage: 0.4, dayOffset: 1},
                {percentage: 0.2, dayOffset: 30},
                {percentage: 0.4, dayOffset: 60}
            ],
            in: [
                {percentage: 0.4, dayOffset: -60},
                {percentage: 0.2, dayOffset: -30},
                {percentage: 0.4, dayOffset: 0}
            ]
        }
    };

    const config = presetConfigs[preset];
    if (!config) return;

    const expectedHoldAmount = parseFloat(document.getElementById('expectedHoldAmount').value);
    const rewardsPercent = parseFloat(document.getElementById('rewardsPercent').value);
    const entryExpiredDate = flatpickr("#entryPeriodExpired").selectedDates[0];
    const completionExpiredDate = flatpickr("#completionPeriodExpired").selectedDates[0];
    const inAmount = expectedHoldAmount * (1 + rewardsPercent / 100);

    
    function createTranche(type, {percentage, dayOffset}, baseDate) {
        const trancheDate = new Date(startOfDay(baseDate));
        trancheDate.setDate(trancheDate.getDate() + dayOffset);
        
        const tranche = {
            id: Date.now() + Math.random(),
            date: trancheDate.toISOString().slice(0, 16),
            amount: (type === 'out' ? expectedHoldAmount : inAmount) * percentage
        };

        const tranchesArray = type === 'out' ? outTranches : inTranches;
        tranchesArray.push(tranche);

        const tranchDiv = document.createElement('div');
        tranchDiv.className = 'tranche-item';
        tranchDiv.innerHTML = `
            <input type="datetime-local" class="tranche-date" value="${tranche.date}" onchange="update${type.charAt(0).toUpperCase() + type.slice(1)}Tranche(${tranche.id})">
            <input type="number" class="tranche-amount" value="${tranche.amount}" onchange="update${type.charAt(0).toUpperCase() + type.slice(1)}Tranche(${tranche.id})">
            <button type="button" class="delete-tranche-btn" onclick="delete${type.charAt(0).toUpperCase() + type.slice(1)}Tranche(${tranche.id})">Delete</button>
        `;
        document.getElementById(`${type}Tranches`).appendChild(tranchDiv);
    }

    
    config.out.forEach(tranche => createTranche('out', tranche, entryExpiredDate));
    config.in.forEach(tranche => createTranche('in', tranche, completionExpiredDate));

    validateTranches();
    onCalculatePrice();
}

async function populateBusinessSelect() {
    try {
        
        const companiesResult = await getUserCompanies();
        const companies = companiesResult.getCompanies;
        
        
        const businessesResult = await getBusinesses({
            filter: {
                ownerId: { $in: companies.map(c => c.id) },
                ownerType: 'company'
            }
        });
        const businesses = businessesResult.getBusinesses;

        
        const select = document.getElementById('businessId');
        select.innerHTML = '<option value="">Select business</option>';
        
        businesses.forEach(business => {
            const option = document.createElement('option');
            option.value = business.id;
            option.textContent = `${business.name} (${business.id})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load businesses:', error);
        alert('Failed to load businesses. Please try refreshing the page.');
    }
}


function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}


function setQueryParam(param, value) {
    const url = new URL(window.location.href);
    url.searchParams.set(param, value);
    window.history.pushState({}, '', url);
}


async function loadExistingPool(poolId) {
    try {
        const result = await getPool(poolId);
        const pool = result.getPool;

        
        if (pool.approvalSignaturesTaskId) {
            document.getElementById('deployBtn').style.display = 'block';
        }

        
        document.getElementById('businessId').value = pool.businessId;
        document.getElementById('expectedHoldAmount').value = Number(BigInt(pool.expectedHoldAmount) / BigInt(10 ** 18));
        document.getElementById('expectedRwaAmount').value = pool.expectedRwaAmount;
        document.getElementById('priceImpact').value = pool.priceImpactPercent;
        document.getElementById('rewardsPercent').value = Number(BigInt(pool.rewardPercent) / BigInt(100));
        document.getElementById('fixedSell').checked = pool.fixedSell;
        document.getElementById('allowEntryBurn').checked = pool.allowEntryBurn;
        document.getElementById('description').value = pool.description || '';
        document.getElementById('tags').value = pool.tags?.join(', ') || '';
        document.getElementById('awaitCompletionExpired').checked = pool.awaitCompletionExpired;
        document.getElementById('floatingOutTranchesTimestamps').checked = pool.floatingOutTranchesTimestamps;

        
        flatpickr("#entryPeriodStart").setDate(new Date(pool.entryPeriodStart * 1000));
        flatpickr("#entryPeriodExpired").setDate(new Date(pool.entryPeriodExpired * 1000));
        flatpickr("#completionPeriodExpired").setDate(new Date(pool.completionPeriodExpired * 1000));

        
        document.getElementById('outTranches').innerHTML = '';
        document.getElementById('inTranches').innerHTML = '';
        outTranches = [];
        inTranches = [];

        
        pool.outgoingTranches.forEach(tranche => {
            const tranchDiv = document.createElement('div');
            tranchDiv.className = 'tranche-item';
            const trancheId = Date.now() + Math.random();
            
            tranchDiv.innerHTML = `
                <input type="datetime-local" class="tranche-date" value="${new Date(parseInt(tranche.timestamp) * 1000).toISOString().slice(0, 16)}" onchange="updateOutTranche(${trancheId})">
                <input type="number" class="tranche-amount" value="${Number(BigInt(tranche.amount) / BigInt(10 ** 18))}" onchange="updateOutTranche(${trancheId})">
                <button type="button" class="delete-tranche-btn" onclick="deleteOutTranche(${trancheId})">Delete</button>
            `;
            
            document.getElementById('outTranches').appendChild(tranchDiv);
            outTranches.push({
                id: trancheId,
                date: new Date(parseInt(tranche.timestamp) * 1000).toISOString().slice(0, 16),
                amount: Number(BigInt(tranche.amount) / BigInt(10 ** 18))
            });
        });

        
        pool.incomingTranches.forEach(tranche => {
            const tranchDiv = document.createElement('div');
            tranchDiv.className = 'tranche-item';
            const trancheId = Date.now() + Math.random();
            
            tranchDiv.innerHTML = `
                <input type="datetime-local" class="tranche-date" value="${new Date(parseInt(tranche.expiredAt) * 1000).toISOString().slice(0, 16)}" onchange="updateInTranche(${trancheId})">
                <input type="number" class="tranche-amount" value="${Number(BigInt(tranche.amount) / BigInt(10 ** 18))}" onchange="updateInTranche(${trancheId})">
                <button type="button" class="delete-tranche-btn" onclick="deleteInTranche(${trancheId})">Delete</button>
            `;
            
            document.getElementById('inTranches').appendChild(tranchDiv);
            inTranches.push({
                id: trancheId,
                date: new Date(parseInt(tranche.expiredAt) * 1000).toISOString().slice(0, 16),
                amount: Number(BigInt(tranche.amount) / BigInt(10 ** 18))
            });
        });

        validateTranches();
        onCalculatePrice();
    } catch (error) {
        console.error('Failed to load pool:', error);
        alert('Failed to load pool data. Please try refreshing.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        
        initChart('priceChart');
        chartInit = true;

        await populateBusinessSelect();
        populatePriceImpactSelect();
        
        
        const poolId = getQueryParam('pool_id');
        if (poolId) {
            
            document.getElementById('createPoolBtn').style.display = 'none';
            document.getElementById('updatePoolBtn').style.display = 'block';
            document.getElementById('updateRiskBtn').style.display = 'block';
            document.getElementById('requestApprovalBtn').style.display = 'block';
            await loadExistingPool(poolId);
        } else {
            
            document.getElementById('createPoolBtn').style.display = 'block';
            initializeDatepickers();
        }
    } catch (error) {
        console.error('Failed to initialize page:', error);
        alert('Failed to initialize page. Please try refreshing.');
    }
    
    
    const inputs = ['expectedHoldAmount', 'expectedRwaAmount'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        input.addEventListener('input', () => {
            validateTranches();
            onCalculatePrice();
        });
    });

    
    document.getElementById('rewardsPercent').addEventListener('input', validateTranches);

    
    const checkboxes = ['fixedSell', 'allowEntryBurn'];
    checkboxes.forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            validateTranches();
            onCalculatePrice();
        });
    });

    
    validateTranches();
    onCalculatePrice();
});

function initializeDatepickers() {
    
    const now = startOfDay(new Date());
    const entryExpiredDate = startOfDay(new Date(now));
    entryExpiredDate.setMonth(now.getMonth() + 1);
    const completionExpiredDate = new Date(entryExpiredDate);
    completionExpiredDate.setMonth(entryExpiredDate.getMonth() + 6);

    
    const commonConfig = {
        enableTime: false,
        dateFormat: "Y-m-d",
        time_24hr: true,
        theme: "dark",
        closeOnSelect: true
    };

    
    const entryStartPicker = flatpickr("#entryPeriodStart", {
        ...commonConfig,
        defaultDate: now,
        onChange: function(selectedDates) {
            if (selectedDates[0]) {
                
                const newEntryExpired = startOfDay(new Date(selectedDates[0]));
                newEntryExpired.setMonth(newEntryExpired.getMonth() + 1);
                entryExpiredPicker.set("minDate", selectedDates[0]);
                entryExpiredPicker.setDate(newEntryExpired);
                resetChart();
                onCalculatePrice();
            }
        }
    });

    
    const entryExpiredPicker = flatpickr("#entryPeriodExpired", {
        ...commonConfig,
        defaultDate: entryExpiredDate,
        onChange: function(selectedDates) {
            if (selectedDates[0]) {
                
                const newCompletionExpired = startOfDay(new Date(selectedDates[0]));
                newCompletionExpired.setMonth(newCompletionExpired.getMonth() + 6);
                completionExpiredPicker.set("minDate", selectedDates[0]);
                completionExpiredPicker.setDate(newCompletionExpired);
                resetChart();
                onCalculatePrice();
                
                
                outTranches = [];
                document.getElementById('outTranches').innerHTML = '';
                const outTranche = {
                    id: Date.now(),
                    date: startOfDay(selectedDates[0]).toISOString().slice(0, 16),
                    amount: parseFloat(document.getElementById('expectedHoldAmount').value) || 0
                };
                outTranches.push(outTranche);
                
                
                const outTranchDiv = document.createElement('div');
                outTranchDiv.className = 'tranche-item';
                outTranchDiv.innerHTML = `
                    <input type="datetime-local" class="tranche-date" value="${outTranche.date}" onchange="updateOutTranche(${outTranche.id})">
                    <input type="number" class="tranche-amount" value="${outTranche.amount}" onchange="updateOutTranche(${outTranche.id})">
                    <button type="button" class="delete-tranche-btn" onclick="deleteOutTranche(${outTranche.id})">Delete</button>
                `;
                document.getElementById('outTranches').appendChild(outTranchDiv);
                
                
                inTranches = [];
                document.getElementById('inTranches').innerHTML = '';
                const rewardsPercent = parseFloat(document.getElementById('rewardsPercent').value) || 0;
                const expectedHoldAmount = parseFloat(document.getElementById('expectedHoldAmount').value) || 0;
                const inAmount = expectedHoldAmount * (1 + rewardsPercent / 100);
                
                const inTranche = {
                    id: Date.now() + 1,
                    date: startOfDay(completionExpiredPicker.selectedDates[0]).toISOString().slice(0, 16),
                    amount: inAmount
                };
                inTranches.push(inTranche);
                
                
                const inTranchDiv = document.createElement('div');
                inTranchDiv.className = 'tranche-item';
                inTranchDiv.innerHTML = `
                    <input type="datetime-local" class="tranche-date" value="${inTranche.date}" onchange="updateInTranche(${inTranche.id})">
                    <input type="number" class="tranche-amount" value="${inTranche.amount}" onchange="updateInTranche(${inTranche.id})">
                    <button type="button" class="delete-tranche-btn" onclick="deleteInTranche(${inTranche.id})">Delete</button>
                `;
                document.getElementById('inTranches').appendChild(inTranchDiv);
                
                validateTranches();
            }
        }
    });

    
    const completionExpiredPicker = flatpickr("#completionPeriodExpired", {
        ...commonConfig,
        defaultDate: completionExpiredDate,
        onChange: function(selectedDates) {
            if (selectedDates[0]) {
                resetChart();
                onCalculatePrice();
            }
        }
    });

    
    applyPreset();
}

let chartInit = false;

function onCalculatePrice() {
    const expectedHoldAmount = parseFloat(document.getElementById('expectedHoldAmount').value);
    const expectedRwaAmount = parseFloat(document.getElementById('expectedRwaAmount').value);
    const priceImpact = parseInt(document.getElementById('priceImpact').value);

    if (isNaN(expectedHoldAmount) || isNaN(expectedRwaAmount) || isNaN(priceImpact)) {
        alert('Please enter valid numbers for all fields');
        return;
    }

    if (expectedHoldAmount <= 0 || expectedRwaAmount <= 0) {
        alert('Amounts must be greater than 0');
        return;
    }

    const liquidityCoefficient = priceImpactCoefficients[priceImpact];
    const { virtualHoldReserve, virtualRwaReserve, k, realHoldReserve } = calculateInitialReserves(
        expectedHoldAmount,
        expectedRwaAmount,
        liquidityCoefficient
    );

    const initialPrice = calculatePrice(virtualHoldReserve, virtualRwaReserve, realHoldReserve, k, 0.000001);
    const finalPrice = calculatePrice(virtualHoldReserve, virtualRwaReserve, realHoldReserve, k, expectedRwaAmount);

    // Generate price points for the chart
    const chartData = generatePricePoints(
        expectedHoldAmount,
        expectedRwaAmount
    );

    // Update chart
    setChartData(chartData);

    
    chart.timeScale().fitContent();
}

function populatePriceImpactSelect() {
    const select = document.getElementById('priceImpact');
    if (!select) return;

    select.innerHTML = '';
    const impacts = Object.entries(priceImpactCoefficients)
        .sort((a, b) => parseInt(b[0]) - parseInt(a[0])); 
    impacts.forEach(([impact, coefficient]) => {
        const option = document.createElement('option');
        option.value = impact;
        option.textContent = `${(impact / 100).toFixed(2)}%`;
        select.appendChild(option);
    });

    
    select.addEventListener('wheel', (event) => {
        event.preventDefault(); 

        const currentIndex = Array.from(select.options)
            .findIndex(option => option.value === select.value);
        
        let newIndex;
        if (event.deltaY < 0) {
            
            newIndex = Math.max(0, currentIndex - 1);
        } else {
            
            newIndex = Math.min(select.options.length - 1, currentIndex + 1);
        }

        if (newIndex !== currentIndex) {
            select.selectedIndex = newIndex;
            
            resetChart();
            onCalculatePrice();
        }
    });
}

function validateTranches() {
    const expectedHoldAmount = parseFloat(document.getElementById('expectedHoldAmount').value);
    const rewardsPercent = parseFloat(document.getElementById('rewardsPercent').value);
    const entryExpiredDate = startOfDay(flatpickr("#entryPeriodExpired").selectedDates[0]);
    const completionExpiredDate = startOfDay(flatpickr("#completionPeriodExpired").selectedDates[0]);

    let outTranchesError = '';
    let inTranchesError = '';

    if (!entryExpiredDate || !completionExpiredDate) {
        outTranchesError = "Please select all required dates";
        inTranchesError = "Please select all required dates";
    } else {
        
        let outSum = 0;
        for (const tranche of outTranches) {
            outSum += parseFloat(tranche.amount) || 0;
            const trancheDate = startOfDay(new Date(tranche.date));
            
            console.log(trancheDate, trancheDate.getTime())
            console.log(entryExpiredDate, entryExpiredDate.getTime())
            if (trancheDate.getTime() < entryExpiredDate.getTime()) {
                outTranchesError = "Out tranche date must be after Entry Period Expired";
                break;
            }
            
        }

        if (!outTranchesError && Math.abs(outSum - expectedHoldAmount) > 0.000001) {
            outTranchesError = `Total out amount must equal Expected HOLD Amount (${expectedHoldAmount})`;
        }

        
        let inSum = 0;
        const expectedInAmount = expectedHoldAmount * (1 + rewardsPercent / 100);
        
        for (const tranche of inTranches) {
            inSum += parseFloat(tranche.amount) || 0;
            const trancheDate = startOfDay(new Date(tranche.date));
            
            if (trancheDate.getTime() > completionExpiredDate.getTime()) {
                inTranchesError = "In tranche date cannot be after Completion Period Expired";
                break;
            }
        }

        if (!inTranchesError && Math.abs(inSum - expectedInAmount) > 0.000001) {
            inTranchesError = `Total in amount must equal Expected HOLD Amount + ${rewardsPercent}% (${expectedInAmount.toFixed(2)})`;
        }
    }

    document.getElementById('outTranchesValidation').textContent = outTranchesError;
    document.getElementById('inTranchesValidation').textContent = inTranchesError;

    return !outTranchesError && !inTranchesError;
}

function addOutTranche() {
    const trancheDiv = document.createElement('div');
    trancheDiv.className = 'tranche-item';
    const trancheId = Date.now();
    
    trancheDiv.innerHTML = `
        <input type="datetime-local" class="tranche-date" onchange="updateOutTranche(${trancheId})">
        <input type="number" class="tranche-amount" placeholder="Amount" onchange="updateOutTranche(${trancheId})">
        <button type="button" class="delete-tranche-btn" onclick="deleteOutTranche(${trancheId})">Delete</button>
    `;
    
    document.getElementById('outTranches').appendChild(trancheDiv);
    outTranches.push({ id: trancheId, date: '', amount: 0 });
    validateTranches();
}

function addInTranche() {
    const trancheDiv = document.createElement('div');
    trancheDiv.className = 'tranche-item';
    const trancheId = Date.now();
    
    trancheDiv.innerHTML = `
        <input type="datetime-local" class="tranche-date" onchange="updateInTranche(${trancheId})">
        <input type="number" class="tranche-amount" placeholder="Amount" onchange="updateInTranche(${trancheId})">
        <button type="button" class="delete-tranche-btn" onclick="deleteInTranche(${trancheId})">Delete</button>
    `;
    
    document.getElementById('inTranches').appendChild(trancheDiv);
    inTranches.push({ id: trancheId, date: '', amount: 0 });
    validateTranches();
}

function updateOutTranche(id) {
    const trancheElement = document.querySelector(`#outTranches .tranche-item:has(button[onclick*="${id}"])`);
    const dateInput = trancheElement.querySelector('.tranche-date');
    const amountInput = trancheElement.querySelector('.tranche-amount');
    
    const trancheIndex = outTranches.findIndex(t => t.id === id);
    if (trancheIndex !== -1) {
        outTranches[trancheIndex] = {
            id,
            date: dateInput.value,
            amount: parseFloat(amountInput.value) || 0
        };
        if (validateTranches()) {
            resetChart();
            onCalculatePrice();
        }
    }
}

function updateInTranche(id) {
    const trancheElement = document.querySelector(`#inTranches .tranche-item:has(button[onclick*="${id}"])`);
    const dateInput = trancheElement.querySelector('.tranche-date');
    const amountInput = trancheElement.querySelector('.tranche-amount');
    
    const trancheIndex = inTranches.findIndex(t => t.id === id);
    if (trancheIndex !== -1) {
        inTranches[trancheIndex] = {
            id,
            date: dateInput.value,
            amount: parseFloat(amountInput.value) || 0
        };
        if (validateTranches()) {
            resetChart();
            onCalculatePrice();
        }
    }
}

function deleteOutTranche(id) {
    const trancheElement = document.querySelector(`#outTranches .tranche-item:has(button[onclick*="${id}"])`);
    if (trancheElement) {
        trancheElement.remove();
        outTranches = outTranches.filter(t => t.id !== id);
        if (validateTranches()) {
            resetChart();
            onCalculatePrice();
        }
    }
}

function deleteInTranche(id) {
    const trancheElement = document.querySelector(`#inTranches .tranche-item:has(button[onclick*="${id}"])`);
    if (trancheElement) {
        trancheElement.remove();
        inTranches = inTranches.filter(t => t.id !== id);
        if (validateTranches()) {
            resetChart();
            onCalculatePrice();
        }
    }
}

function getFormData() {
    return {
        name: "RWA Pool", // TODO: Add name input field
        businessId: document.getElementById('businessId').value,
        entryFeePercent: '100',
        exitFeePercent: '100',
        expectedHoldAmount: `${BigInt(document.getElementById('expectedHoldAmount').value) * BigInt(10 ** 18)}`,
        expectedRwaAmount: document.getElementById('expectedRwaAmount').value,
        rewardPercent: `${BigInt(document.getElementById('rewardsPercent').value) * BigInt(100)}`,
        entryPeriodStart: Math.floor(flatpickr("#entryPeriodStart").selectedDates[0].getTime() / 1000),
        entryPeriodExpired: Math.floor(flatpickr("#entryPeriodExpired").selectedDates[0].getTime() / 1000),
        completionPeriodExpired: Math.floor(flatpickr("#completionPeriodExpired").selectedDates[0].getTime() / 1000),
        awaitCompletionExpired: document.getElementById('awaitCompletionExpired').checked,
        floatingOutTranchesTimestamps: document.getElementById('floatingOutTranchesTimestamps').checked,
        fixedSell: document.getElementById('fixedSell').checked,
        allowEntryBurn: document.getElementById('allowEntryBurn').checked,
        priceImpactPercent: document.getElementById('priceImpact').value,
        description: document.getElementById('description').value,
        tags: document.getElementById('tags').value.split(',').map(tag => tag.trim()).filter(tag => tag),
        outgoingTranches: outTranches.map(tranche => ({
            amount: `${BigInt(tranche.amount) * BigInt(10 ** 18)}`,
            timestamp: Math.floor(new Date(tranche.date).getTime() / 1000),
            executedAmount: "0"
        })),
        incomingTranches: inTranches.map(tranche => ({
            amount: `${BigInt(tranche.amount) * BigInt(10 ** 18)}`,
            expiredAt: Math.floor(new Date(tranche.date).getTime() / 1000),
            returnedAmount: "0"
        }))
    };
}

async function handleCreatePool() {
    try {
        const data = getFormData();
        const result = await createPool(data);
        const poolId = result.createPool.id;
        
        
        setQueryParam('pool_id', poolId);
        
        alert('Pool created successfully! ID: ' + poolId);
    } catch (error) {
        alert('Error creating pool: ' + error.message);
    }
}

async function handleUpdatePool() {
    try {
        const poolId = getQueryParam('pool_id');
        if (!poolId) {
            alert('Pool ID not found in URL');
            return;
        }
        
        const data = getFormData();
        const result = await updatePool(poolId, data);
        alert('Pool updated successfully!');
    } catch (error) {
        alert('Error updating pool: ' + error.message);
    }
}

async function handleUpdateRiskScore() {
    try {
        const poolId = getQueryParam('pool_id');
        if (!poolId) {
            alert('Pool ID not found in URL');
            return;
        }
        
        const result = await updatePoolRiskScore(poolId);
        alert('Risk score updated successfully! New score: ' + result.updatePoolRiskScore.riskScore);
    } catch (error) {
        alert('Error updating risk score: ' + error.message);
    }
}

async function handleRequestApproval() {
    try {
        const poolId = getQueryParam('pool_id');
        if (!poolId) {
            alert('Pool ID not found in URL');
            return;
        }

        // Get wallet from MetaMask
        const wallet = await window.ethereum.request({
            method: 'eth_requestAccounts'
        }).then(accounts => accounts[0]);

        const result = await requestPoolApprovalSignatures({
            id: poolId,
            ownerWallet: wallet,
            deployerWallet: wallet,
            createPoolFeeRatio: "100"
        });
        alert('Approval signatures requested successfully! Task ID: ' + result.requestPoolApprovalSignatures.taskId);
    } catch (error) {
        alert('Error requesting approval signatures: ' + error.message);
    }
}

async function handleDeploy() {
    try {
        const poolId = getQueryParam('pool_id');
        if (!poolId) {
            alert('Pool ID not found in URL');
            return;
        }

        // Get wallet from MetaMask
        const wallet = await window.ethereum.request({
            method: 'eth_requestAccounts'
        }).then(accounts => accounts[0]);

        // Get pool details including approval signatures task
        const pool = await getPool(poolId);
        if (!pool.getPool.approvalSignaturesTaskId) {
            throw new Error('No approval signatures task found');
        }

        // Get signatures from task
        const taskResult = await getSignatureTask(pool.getPool.approvalSignaturesTaskId);
        const task = taskResult.getSignatureTask;
        
        if (!task.completed) throw new Error('Signatures task not completed');

        const signatures = task.signatures;
        const signers = signatures.map(sig => sig.signer);
        const signatureValues = signatures.map(sig => sig.signature);

        // Initialize Web3
        const web3 = new Web3(window.ethereum);

        // Contract addresses
        const HOLD_TOKEN_ADDRESS = '0x66670d16331dc923Ff095f5B0A658F01e6794216';
        const FACTORY_ADDRESS = '0xD1b0e186A2B0d602f27cE2e046Fa95BBe9FE6d84';

        // Contract ABIs
        const holdTokenABI = [{
            "inputs": [
                {"name": "spender", "type": "address"},
                {"name": "amount", "type": "uint256"}
            ],
            "name": "approve",
            "outputs": [{"name": "", "type": "bool"}],
            "stateMutability": "nonpayable",
            "type": "function"
        }];

        const factoryABI = [{
            "inputs": [
                {"name": "createPoolFeeRatio", "type": "uint256"},
                {"name": "entityId", "type": "string"},
                {"name": "rwa", "type": "address"},
                {"name": "expectedHoldAmount", "type": "uint256"},
                {"name": "expectedRwaAmount", "type": "uint256"},
                {"name": "priceImpactPercent", "type": "uint256"},
                {"name": "rewardPercent", "type": "uint256"},
                {"name": "entryPeriodStart", "type": "uint256"},
                {"name": "entryPeriodExpired", "type": "uint256"},
                {"name": "completionPeriodExpired", "type": "uint256"},
                {"name": "entryFeePercent", "type": "uint256"},
                {"name": "exitFeePercent", "type": "uint256"},
                {"name": "fixedSell", "type": "bool"},
                {"name": "allowEntryBurn", "type": "bool"},
                {"name": "awaitCompletionExpired", "type": "bool"},
                {"name": "floatingOutTranchesTimestamps", "type": "bool"},
                {"name": "outgoingTranches", "type": "uint256[]"},
                {"name": "outgoingTranchTimestamps", "type": "uint256[]"},
                {"name": "incomingTranches", "type": "uint256[]"},
                {"name": "incomingTrancheExpired", "type": "uint256[]"},
                {"name": "signers", "type": "address[]"},
                {"name": "signatures", "type": "bytes[]"},
                {"name": "expired", "type": "uint256"}
            ],
            "name": "deployPool",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }];

        // Create contract instances
        const holdToken = new web3.eth.Contract(holdTokenABI, HOLD_TOKEN_ADDRESS);
        const factory = new web3.eth.Contract(factoryABI, FACTORY_ADDRESS);

        // // Approve HOLD tokens for factory
        // await holdToken.methods.approve(
        //     FACTORY_ADDRESS,
        //     web3.utils.toTwosComplement('-1') // Max uint256
        // ).send({ from: wallet });
console.log(BigInt(pool.getPool.expectedRwaAmount))
        // Deploy pool contract
        await factory.methods.deployPool(
            '100', // createPoolFeeRatio
            poolId, // entityId
            pool.getPool.rwaAddress,
            BigInt(pool.getPool.expectedHoldAmount),
            BigInt(pool.getPool.expectedRwaAmount),
            BigInt(pool.getPool.priceImpactPercent),
            BigInt(pool.getPool.rewardPercent),
            BigInt(pool.getPool.entryPeriodStart),
            BigInt(pool.getPool.entryPeriodExpired),
            BigInt(pool.getPool.completionPeriodExpired),
            BigInt(pool.getPool.entryFeePercent),
            BigInt(pool.getPool.exitFeePercent),
            pool.getPool.fixedSell,
            pool.getPool.allowEntryBurn,
            pool.getPool.awaitCompletionExpired,
            pool.getPool.floatingOutTranchesTimestamps,
            pool.getPool.outgoingTranches.map(t => BigInt(t.amount)),
            pool.getPool.outgoingTranches.map(t => BigInt(t.timestamp)),
            pool.getPool.incomingTranches.map(t => BigInt(t.amount)),
            pool.getPool.incomingTranches.map(t => BigInt(t.expiredAt)),
            signers,
            signatureValues,
            task.expired
        ).send({
            from: wallet,
            gas: 2500000,
            gasPrice: '1000000000'
        });

        // Wait for backend to process the event
        await new Promise(resolve => setTimeout(resolve, 10000));

        alert('Pool contract deployed successfully!');
    } catch (error) {
        console.error('Deploy error:', error);
        alert('Error deploying pool contract: ' + error.message);
    }
}