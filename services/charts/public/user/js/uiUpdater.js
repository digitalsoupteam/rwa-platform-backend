class UIUpdater {
    constructor() {
        this.unauthorizedView = document.getElementById('unauthorizedView');
        this.authorizedView = document.getElementById('authorizedView');
        
        // User info elements
        this.walletAddress = document.getElementById('walletAddress');
        this.userId = document.getElementById('userId');
        this.memberSince = document.getElementById('memberSince');
        
        // Tables
        this.balancesTableBody = document.getElementById('balancesTableBody');
        this.transactionsTableBody = document.getElementById('transactionsTableBody');
    }

    showUnauthorizedView() {
        this.unauthorizedView.style.display = 'block';
        this.authorizedView.style.display = 'none';
    }

    showAuthorizedView() {
        this.unauthorizedView.style.display = 'none';
        this.authorizedView.style.display = 'block';
    }

    updateUserInfo(wallet, userId, createdAt) {
        this.walletAddress.textContent = formatAddress(wallet);
        this.userId.textContent = userId;
        this.memberSince.textContent = formatTimestamp(createdAt);
    }

    updateBalances(balances) {
        this.balancesTableBody.innerHTML = '';
        
        if (!balances.length) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="5" style="text-align: center;">No balances found</td>
            `;
            this.balancesTableBody.appendChild(row);
            return;
        }

        balances.forEach(balance => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${formatAddress(balance.tokenAddress)} (#${balance.tokenId})</td>
                <td>${formatAddress(balance.pool)}</td>
                <td>${balance.chainId}</td>
                <td>${formatBalance(balance.balance)}</td>
                <td>${formatTimestamp(balance.updatedAt)}</td>
            `;
            this.balancesTableBody.appendChild(row);
        });
    }

    updateTransactions(transactions) {
        this.transactionsTableBody.innerHTML = '';
        
        if (!transactions.length) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="6" style="text-align: center;">No transactions found</td>
            `;
            this.transactionsTableBody.appendChild(row);
            return;
        }

        const currentWallet = localStorage.getItem('wallet');
        
        transactions.forEach(tx => {
            const row = document.createElement('tr');
            const type = formatTransactionType(tx.from, tx.to, currentWallet);
            row.innerHTML = `
                <td>${formatTimestamp(tx.createdAt)}</td>
                <td>
                    <span class="transaction-type ${type}">
                        ${type}
                    </span>
                </td>
                <td>${formatAddress(tx.tokenAddress)} (#${tx.tokenId})</td>
                <td>${formatAddress(tx.pool)}</td>
                <td>${formatBalance(tx.amount)}</td>
                <td>
                    <a href="${getExplorerUrl(tx.chainId, tx.transactionHash)}" 
                       class="transaction-hash" 
                       target="_blank">
                        ${formatAddress(tx.transactionHash)}
                    </a>
                </td>
            `;
            this.transactionsTableBody.appendChild(row);
        });
    }

    showError(message) {
        // You can implement a more sophisticated error display system
        alert(message);
    }
}

const uiUpdater = new UIUpdater();