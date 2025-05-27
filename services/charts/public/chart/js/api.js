
// const graphqlSse = window.graphqlSse; 

let priceSubscriptionDisposer = null;
let transactionSubscriptionDisposer = null;

const sseClient = graphqlSse.createClient({
    url: 'https://localhost/gateway/graphql/stream',
    headers: {
        'X-HTTP2-Support': '1'
    }
});


function initEventSources(poolAddress, priceUpdateHandler, transactionUpdateHandler) {
    subscribeToPriceUpdates(poolAddress, priceUpdateHandler);
    subscribeToTransactionUpdates(poolAddress, transactionUpdateHandler);
}

function subscribeToPriceUpdates(poolAddress, handlePriceUpdateCallback) {
    if (priceSubscriptionDisposer) {
        priceSubscriptionDisposer();
        priceSubscriptionDisposer = null;
        console.log('Previous price subscription disposed.');
    }

    const query = `subscription PriceUpdates($poolAddress: String!) {
                priceUpdates(poolAddress: $poolAddress) {
                    poolAddress
                    timestamp
                    price
                    realHoldReserve
                    virtualHoldReserve
                    virtualRwaReserve
                }
            }`;

    console.log(`Subscribing to price updates for ${poolAddress}`);
    priceSubscriptionDisposer = sseClient.subscribe(
        {
            query,
            variables: { poolAddress },
        },
        {
            next: (result) => {
                if (result.data && result.data.priceUpdates) {
                    handlePriceUpdateCallback(result.data.priceUpdates);
                } else if (result.errors) {
                    console.error('Price subscription data error:', result.errors);
                }
            },
            error: (err) => {
                console.error('Price subscription connection error:', err);
                if (priceSubscriptionDisposer) {
                    priceSubscriptionDisposer();
                    priceSubscriptionDisposer = null;
                }
            },
            complete: () => {
                console.log('Price subscription complete');
                if (priceSubscriptionDisposer) {
                    priceSubscriptionDisposer();
                    priceSubscriptionDisposer = null;
                }
            },
        }
    );
}

function subscribeToTransactionUpdates(poolAddress, handleTransactionUpdateCallback) {
    if (transactionSubscriptionDisposer) {
        transactionSubscriptionDisposer();
        transactionSubscriptionDisposer = null;
        console.log('Previous transaction subscription disposed.');
    }

    const query = `subscription TransactionUpdates($poolAddress: String!) {
                transactionUpdates(poolAddress: $poolAddress) {
                    poolAddress
                    timestamp
                    transactionType
                    userAddress
                    rwaAmount
                    holdAmount
                    bonusAmount
                    holdFee
                    bonusFee
                }
            }`;

    console.log(`Subscribing to transaction updates for ${poolAddress}`);
    transactionSubscriptionDisposer = sseClient.subscribe(
        {
            query,
            variables: { poolAddress },
        },
        {
            next: (result) => {
                if (result.data && result.data.transactionUpdates) {
                    handleTransactionUpdateCallback(result.data.transactionUpdates);
                } else if (result.errors) {
                    console.error('Transaction subscription data error:', result.errors);
                }
            },
            error: (err) => {
                console.error('Transaction subscription connection error:', err);
                if (transactionSubscriptionDisposer) {
                    transactionSubscriptionDisposer();
                    transactionSubscriptionDisposer = null;
                }
            },
            complete: () => {
                console.log('Transaction subscription complete');
                if (transactionSubscriptionDisposer) {
                    transactionSubscriptionDisposer();
                    transactionSubscriptionDisposer = null;
                }
            },
        }
    );
}


async function fetchOhlcData(poolAddress, interval, startTime, endTime) {
    const query = `
                query GetOhlcPriceData($input: GetOhlcPriceDataInput!) {
                    getOhlcPriceData(input: $input) {
                        timestamp
                        open
                        high
                        low
                        close
                    }
                }
            `;
    const response = await fetch('https://localhost/gateway/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-HTTP2-Support': '1'
        },
        body: JSON.stringify({ query, variables: { input: { poolAddress, interval, startTime, endTime } } })
    });
    const result = await response.json();
    if (result.errors) { throw new Error(result.errors[0].message); }
    return result.data.getOhlcPriceData;
}


async function fetchVolumeData(poolAddress, interval, startTime, endTime) {
    const query = `
                query GetVolumeData($input: GetVolumeDataInput!) {
                    getVolumeData(input: $input) {
                        timestamp
                        mintVolume
                        burnVolume
                    }
                }
            `;
    const response = await fetch('https://localhost/gateway/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-HTTP2-Support': '1'
        },
        body: JSON.stringify({ query, variables: { input: { poolAddress, interval, startTime, endTime } } })
    });
    const result = await response.json();
    if (result.errors) { throw new Error(result.errors[0].message); }
    return result.data.getVolumeData;
}


async function fetchTransactions(poolAddress) {
    const query = `
                query GetPoolTransactions($input: GetPoolTransactionsInput!) {
                    getPoolTransactions(input: $input) {
                        id
                        poolAddress
                        transactionType
                        userAddress
                        timestamp
                        rwaAmount
                        holdAmount
                        bonusAmount
                    }
                }
            `;
    const response = await fetch('https://localhost/gateway/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-HTTP2-Support': '1'
        },
        body: JSON.stringify({ query, variables: { input: { filter: { poolAddress }, sort: { timestamp: 'desc' }, limit: 50 } } })
    });
    const result = await response.json();
    if (result.errors) { throw new Error(result.errors[0].message); }
    return result.data.getPoolTransactions;
}