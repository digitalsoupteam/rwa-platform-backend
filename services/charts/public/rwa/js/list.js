// Store for pools data
let pools = [];
let userCompanies = [];

// Format timestamp to readable date
function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
}

// Format amount from wei
function formatAmount(amount) {
    return Number(BigInt(amount) / BigInt(10 ** 18));
}

// Create pool card HTML
function createPoolCard(pool) {
    const card = document.createElement('div');
    card.className = 'pool-card';
    
    const tagsHtml = pool.tags?.length ?
        `<div class="tags">${pool.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : '';
    
    // Check if user owns the company that owns this pool
    const isOwner = pool.ownerType === 'company' &&
        userCompanies.some(company => company.id === pool.ownerId);
    
    let actionsHtml = '';
    if (isOwner) {
        const buttons = [];
        
        buttons.push(`<button onclick="handleUpdateRiskScore('${pool.id}')" class="action-btn">Update Risk Score</button>`);
        if (!pool.rwaAddress) {
            buttons.push(`<button onclick="handleRequestApprovalSignatures('${pool.id}')" class="action-btn">Request Approval</button>`);
        }
        
        // Show deploy button only if we have approval signatures
        if (pool.approvalSignaturesTaskId && !pool.rwaAddress) {
            buttons.push(`<button onclick="handleDeploy('${pool.id}')" class="action-btn">Deploy</button>`);
        }
        
        actionsHtml = `<div class="pool-actions">${buttons.join('')}</div>`;
    }
    
    card.innerHTML = `
        <div class="pool-header">
            <h3>${pool.name || 'RWA Pool'}</h3>
            <div class="pool-links">
                <a href="index.html?pool_id=${pool.id}" class="pool-link">Edit</a>
                <a href="http://localhost:8000/chart?pool_id=${pool.id}" class="pool-link" target="_blank">Chart</a>
            </div>
        </div>
        <p>${pool.description || ''}</p>
        ${tagsHtml}
        <div class="amounts">
            <div>HOLD Amount: ${formatAmount(pool.expectedHoldAmount)}</div>
            <div>RWA Amount: ${pool.expectedRwaAmount}</div>
        </div>
        <div class="owner-info">
            Business ID: ${pool.businessId}
            ${pool.poolAddress ? `<br>Contract: ${pool.poolAddress}` : ''}
        </div>
        <div class="created-at">Created: ${formatDate(pool.createdAt)}</div>
        ${actionsHtml}
    `;
    return card;
}

// Refresh pools grid
async function refreshPools() {
    try {
        const showOnlyMine = document.getElementById('showMyPools').checked;
        const showDeployed = document.getElementById('showDeployed').checked;
        
        // First get user's companies
        const companiesResult = await getUserCompanies();
        userCompanies = companiesResult.getCompanies;
        
        let filter = {};
        
        if (showOnlyMine) {
            // Get businesses owned by user's companies
            const businessesResult = await getBusinesses({
                filter: {
                    ownerId: { $in: userCompanies.map(c => c.id) },
                    ownerType: 'company'
                }
            });
            const businesses = businessesResult.getBusinesses;
            
            filter.businessId = { $in: businesses.map(b => b.id) };
        }
        
        if (showDeployed) {
            filter.rwaAddress = { $ne: null };
        }
        
        const result = await getPools({ filter });
        pools = result.getPools;
        
        const container = document.getElementById('poolsContainer');
        container.innerHTML = '';
        
        if (pools.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No pools found</p>';
            return;
        }
        
        pools.forEach(pool => {
            container.appendChild(createPoolCard(pool));
        });
    } catch (error) {
        alert('Error loading pools: ' + error.message);
    }
}


// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    refreshPools();
    
    // Add filter change handlers
    document.getElementById('showMyPools').addEventListener('change', refreshPools);
    document.getElementById('showDeployed').addEventListener('change', refreshPools);
});