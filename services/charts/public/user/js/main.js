let currentAccount = null;

async function initializeAuth() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (refreshToken) {
        try {
            const result = await refreshTokenRequest(refreshToken);
            localStorage.setItem('accessToken', result.refreshToken.accessToken);
            localStorage.setItem('refreshToken', result.refreshToken.refreshToken);
            localStorage.setItem('userId', result.refreshToken.userId);
            
            document.getElementById('tokenPanel').style.display = 'block';
            await checkUnlockTime();
            setInterval(checkUnlockTime, 60000);
            return true;
        } catch (error) {
            console.error('Failed to refresh token:', error);
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('userId');
            showAuthForm();
        }
    } else {
        showAuthForm();
    }
    
    return false;
}

function showAuthForm() {
    document.getElementById('authPanel').style.display = 'block';
    document.getElementById('connectWalletBtn').style.display = 'block';
    document.getElementById('tokenPanel').style.display = 'none';
}

async function checkUnlockTime() {
    try {
        const result = await getUnlockTime();
        const now = Date.now() / 1000;

        const holdBtn = document.getElementById('requestHoldBtn');
        const gasBtn = document.getElementById('requestGasBtn');

        if (result.getUnlockTime.holdUnlockTime > now) {
            holdBtn.classList.add('disabled');
            holdBtn.title = `Available in ${Math.ceil((result.getUnlockTime.holdUnlockTime - now) / 60)} minutes`;
        } else {
            holdBtn.classList.remove('disabled');
            holdBtn.title = '';
        }

        if (result.getUnlockTime.gasUnlockTime > now) {
            gasBtn.classList.add('disabled');
            gasBtn.title = `Available in ${Math.ceil((result.getUnlockTime.gasUnlockTime - now) / 60)} minutes`;
        } else {
            gasBtn.classList.remove('disabled');
            gasBtn.title = '';
        }
    } catch (error) {
        console.error('Failed to check unlock time:', error);
    }
}

async function connectWallet() {
    try {
        if (!window.ethereum) {
            alert('Please install MetaMask!');
            return;
        }

        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        if (accounts.length === 0) {
            alert('Please connect to MetaMask!');
            return;
        }

        currentAccount = accounts[0];
        document.getElementById('walletAddress').textContent = currentAccount;
        document.getElementById('walletInfo').style.display = 'block';
        document.getElementById('connectWalletBtn').style.display = 'none';
        document.getElementById('authenticateBtn').style.display = 'block';

    } catch (error) {
        console.error('Failed to connect wallet:', error);
        alert('Failed to connect wallet: ' + error.message);
    }
}

async function authenticateWallet() {
    try {
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `Welcome to RWA Platform!

We prioritize the security of your assets and personal data. To ensure secure access to your account, we kindly request you to verify ownership of your wallet by signing this message.`;

        const domain = {
            name: 'RWA Platform',
            version: '1'
        };

        const types = {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' }
            ],
            Message: [
                { name: 'wallet', type: 'address' },
                { name: 'timestamp', type: 'uint256' },
                { name: 'message', type: 'string' }
            ]
        };

        // Get the signature using eth_signTypedData_v4
        const signature = await window.ethereum.request({
            method: 'eth_signTypedData_v4',
            params: [currentAccount, JSON.stringify({
                types,
                domain,
                message: {
                    wallet: currentAccount,
                    timestamp: timestamp,
                    message: message
                },
                primaryType: 'Message'
            })]
        });
        
        const result = await authenticate(
            currentAccount,
            signature,
            timestamp
        );

        localStorage.setItem('accessToken', result.authenticate.accessToken);
        localStorage.setItem('refreshToken', result.authenticate.refreshToken);
        localStorage.setItem('userId', result.authenticate.userId);

        document.getElementById('authPanel').style.display = 'none';
        document.getElementById('tokenPanel').style.display = 'block';
        await checkUnlockTime();
        setInterval(checkUnlockTime, 60000);

    } catch (error) {
        console.error('Failed to authenticate:', error);
        alert('Failed to authenticate: ' + error.message);
    }
}

// Handle account changes
window.ethereum.on('accountsChanged', function (accounts) {
    if (accounts.length === 0) {
        // User disconnected wallet
        currentAccount = null;
        document.getElementById('walletInfo').style.display = 'none';
        document.getElementById('authenticateBtn').style.display = 'none';
        document.getElementById('connectWalletBtn').style.display = 'block';
    } else {
        // User switched accounts
        currentAccount = accounts[0];
        document.getElementById('walletAddress').textContent = currentAccount;
    }
});

function showTokenPanel() {
    document.getElementById('authPanel').style.display = 'none';
    document.getElementById('tokenPanel').style.display = 'block';
}

async function requestHold() {
    try {
        const holdBtn = document.getElementById('requestHoldBtn');
        if (holdBtn.classList.contains('disabled')) {
            alert('Please wait until the unlock time expires');
            return;
        }

        await requestHoldRequest(10000);
        alert('HOLD tokens requested successfully!');
        await checkUnlockTime();
    } catch (error) {
        console.error('Failed to request HOLD tokens:', error);
        alert('Failed to request HOLD tokens: ' + error.message);
    }
}

async function requestGas() {
    try {
        const gasBtn = document.getElementById('requestGasBtn');
        if (gasBtn.classList.contains('disabled')) {
            alert('Please wait until the unlock time expires');
            return;
        }

        await requestGasRequest(0.01);
        alert('Gas requested successfully!');
        await checkUnlockTime();
    } catch (error) {
        console.error('Failed to request gas:', error);
        alert('Failed to request gas: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initializeAuth();
    
    document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);
    document.getElementById('authenticateBtn').addEventListener('click', authenticateWallet);
    document.getElementById('requestHoldBtn').addEventListener('click', requestHold);
    document.getElementById('requestGasBtn').addEventListener('click', requestGas);
});