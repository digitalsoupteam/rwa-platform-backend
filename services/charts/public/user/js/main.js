// Add ethers.js script
const ethersScript = document.createElement('script');
ethersScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.7.0/ethers.umd.min.js';
document.head.appendChild(ethersScript);

async function init() {
    if (isAuthenticated()) {
        uiUpdater.showAuthorizedView();
        await loadUserData();
    } else {
        uiUpdater.showUnauthorizedView();
    }
}

async function loadUserData() {
    try {
        const wallet = localStorage.getItem('wallet');
        const userId = localStorage.getItem('userId');

        // Get balances
        const balancesResult = await api.getBalances(
            { owner: wallet },
            { updatedAt: -1 }
        );
        uiUpdater.updateBalances(balancesResult.getBalances);

        // Get transactions
        const transactionsResult = await api.getTransactions(
            { 
                $or: [
                    { from: wallet },
                    { to: wallet }
                ]
            },
            { createdAt: -1 },
            100
        );
        uiUpdater.updateTransactions(transactionsResult.getTransactions);

        // Update user info using the first transaction's createdAt as member since date
        const memberSince = transactionsResult.getTransactions.length > 0 
            ? transactionsResult.getTransactions[transactionsResult.getTransactions.length - 1].createdAt
            : Math.floor(Date.now() / 1000);
            
        uiUpdater.updateUserInfo(wallet, userId, memberSince);
    } catch (error) {
        console.error('Failed to load user data:', error);
        uiUpdater.showError('Failed to load user data. Please try again later.');
    }
}

async function connectWallet() {
    try {
        await api.connectWallet();
        uiUpdater.showAuthorizedView();
        await loadUserData();
    } catch (error) {
        console.error('Failed to connect wallet:', error);
        uiUpdater.showError(error.message || 'Failed to connect wallet. Please try again.');
    }
}

// Initialize app when ethers.js is loaded
ethersScript.onload = init;

// Handle refresh token
let refreshTokenPromise = null;

async function handleTokenRefresh() {
    if (refreshTokenPromise) return refreshTokenPromise;

    try {
        refreshTokenPromise = api.refreshToken(localStorage.getItem('refreshToken'));
        const result = await refreshTokenPromise;
        
        localStorage.setItem('accessToken', result.refreshToken.accessToken);
        localStorage.setItem('refreshToken', result.refreshToken.refreshToken);
        
        return result;
    } catch (error) {
        clearAuthData();
        uiUpdater.showUnauthorizedView();
        throw error;
    } finally {
        refreshTokenPromise = null;
    }
}

// Auto refresh data every 30 seconds if authenticated
setInterval(() => {
    if (isAuthenticated()) {
        loadUserData();
    }
}, 30000);