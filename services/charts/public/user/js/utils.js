function formatAddress(address) {
    if (!address) return '-';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
}

function formatBalance(balance) {
    if (!balance) return '0';
    return balance.toLocaleString();
}

function formatTransactionType(from, to, currentWallet) {
    const wallet = currentWallet.toLowerCase();
    if (from.toLowerCase() === wallet) {
        return 'outgoing';
    }
    if (to.toLowerCase() === wallet) {
        return 'incoming';
    }
    return 'unknown';
}

function getExplorerUrl(chainId, hash) {
    // Add more explorers as needed
    const explorers = {
        1: 'https://etherscan.io',
        5: 'https://goerli.etherscan.io',
        137: 'https://polygonscan.com',
        80001: 'https://mumbai.polygonscan.com'
    };

    const baseUrl = explorers[chainId] || explorers[1];
    return `${baseUrl}/tx/${hash}`;
}

function isAuthenticated() {
    return !!(
        localStorage.getItem('accessToken') &&
        localStorage.getItem('userId') &&
        localStorage.getItem('wallet')
    );
}

function clearAuthData() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('wallet');
}