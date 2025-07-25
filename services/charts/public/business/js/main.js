// Store for businesses data
let businesses = [];
let userCompanies = [];

// Format timestamp to readable date
function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
}

// Format risk score to percentage
function formatRiskScore(score) {
    return `${(score)}%`;
}

// Create business card HTML
function createBusinessCard(business) {
    const card = document.createElement('div');
    card.className = 'business-card';
    
    const tagsHtml = business.tags?.length ?
        `<div class="tags">${business.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>` : '';
    
    // Check if user owns the company that owns this business
    const isOwner = business.ownerType === 'company' &&
        userCompanies.some(company => company.id === business.ownerId);
    
    let actionsHtml = '';
    if (isOwner) {
        const buttons = [`<button onclick="handleEditBusiness('${business.id}')" class="edit-btn">Edit</button>`];
        
        buttons.push(`<button onclick="handleUpdateRiskScore('${business.id}')" class="action-btn">Update Risk Score</button>`);
        if (!business.tokenAddress) {
            buttons.push(`<button onclick="handleRequestApprovalSignatures('${business.id}')" class="action-btn">Request Approval</button>`);
        }
        
        // Show deploy button only if we have approval signatures and they haven't expired
        console.log(business)
        console.log(business.approvalSignaturesTaskId)
        console.log(business.approvalSignaturesTaskExpired)
        console.log(business.tokenAddress)
        console.log(business.tokenAddress)
        if (business.approvalSignaturesTaskId &&
            !business.tokenAddress) {
            buttons.push(`<button onclick="handleDeploy('${business.id}')" class="action-btn">Deploy</button>`);
        }
        
        actionsHtml = `<div class="business-actions">${buttons.join('')}</div>`;
    }
    
    card.innerHTML = `
        <h3>${business.name}</h3>
        <p>${business.description || ''}</p>
        ${tagsHtml}
        <div class="risk-score">Risk Score: ${formatRiskScore(business.riskScore)}</div>
        <div class="owner-info">
            Company ID: ${business.ownerId}
            ${business.tokenAddress ? `<br>Contract: ${business.tokenAddress}` : ''}
        </div>
        <div class="created-at">Created: ${formatDate(business.createdAt)}</div>
        ${actionsHtml}
    `;
    return card;
}

// Refresh businesses grid
async function refreshBusinesses() {
    try {
        const showOnlyMine = document.getElementById('showMyBusinesses').checked;
        const showDeployed = document.getElementById('showDeployed').checked;
        
        let filter = {};
        
        if (showOnlyMine) {
            filter.ownerId = { $in: userCompanies.map(c => c.id) };
            filter.ownerType = 'company';
        }
        
        if (showDeployed) {
            filter.tokenAddress = { $ne: null };
        }
        
        const result = await getBusinesses({ filter });
        businesses = result.getBusinesses;
        
        const container = document.getElementById('businessesContainer');
        container.innerHTML = '';
        
        if (businesses.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No businesses found</p>';
            return;
        }
        
        businesses.forEach(business => {
            container.appendChild(createBusinessCard(business));
        });
    } catch (error) {
        alert('Error loading businesses: ' + error.message);
    }
}

// Handle business creation
async function handleCreateBusiness() {
    const companySelect = document.getElementById('businessCompanyId');
    const companyId = companySelect.value;
    const name = document.getElementById('businessName').value.trim();
    const description = document.getElementById('businessDescription').value.trim();
    const tags = document.getElementById('businessTags').value.trim()
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    const chainId = document.getElementById('businessChainId').value.trim();
    
    if (!companyId) {
        alert('Please enter a company ID');
        return;
    }
    
    if (!name) {
        alert('Please enter a business name');
        return;
    }
    
    if (!chainId) {
        alert('Please enter a chain ID');
        return;
    }
    
    try {
        await createBusiness({
            name,
            description,
            tags,
            chainId,
            ownerId: companyId,
            ownerType: 'company'
        });
        
        // Clear form
        document.getElementById('businessCompanyId').value = '';
        document.getElementById('businessName').value = '';
        document.getElementById('businessDescription').value = '';
        document.getElementById('businessTags').value = '';
        document.getElementById('businessChainId').value = '';
        
        // Refresh businesses display
        await refreshBusinesses();
        
        alert('Business created successfully!');
    } catch (error) {
        alert('Error creating business: ' + error.message);
    }
}

// Handle business edit
async function handleEditBusiness(id) {
    const business = businesses.find(b => b.id === id);
    if (!business) return;
    
    if (!userCompanies.some(company => company.id === business.ownerId) || business.ownerType !== 'company') {
        alert('You can only edit businesses owned by your company');
        return;
    }
    
    const newName = prompt('Enter new business name:', business.name);
    if (!newName) return;
    
    const newDescription = prompt('Enter new business description:', business.description);
    if (newDescription === null) return;
    
    const newTags = prompt('Enter new tags (comma separated):', business.tags?.join(', '));
    if (newTags === null) return;
    
    try {
        await editBusiness({
            id,
            updateData: {
                name: newName,
                description: newDescription,
                tags: newTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
            }
        });
        
        await refreshBusinesses();
        alert('Business updated successfully!');
    } catch (error) {
        alert('Error updating business: ' + error.message);
    }
}

// Initialize on page load
// Populate company select
function populateCompanySelect() {
    const select = document.getElementById('businessCompanyId');
    select.innerHTML = '<option value="">Select company</option>';
    
    userCompanies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.id;
        option.textContent = `${company.name} (${company.id})`;
        select.appendChild(option);
    });
}

async function handleUpdateRiskScore(id) {
    try {
        await updateBusinessRiskScore(id);
        await refreshBusinesses();
        alert('Risk score updated successfully!');
    } catch (error) {
        alert('Error updating risk score: ' + error.message);
    }
}

async function handleRequestApprovalSignatures(id) {
    try {
        const business = businesses.find(b => b.id === id);
        if (!business) return;

        const wallet = await window.ethereum.request({
            method: 'eth_requestAccounts'
        }).then(accounts => accounts[0]);

        await requestBusinessApprovalSignatures({
            id,
            ownerWallet: wallet,
            deployerWallet: wallet,
            createRWAFee: "100"
        });

        alert('Approval signatures requested successfully!');
        await refreshBusinesses();
    } catch (error) {
        alert('Error requesting approval signatures: ' + error.message);
    }
}

async function handleDeploy(id) {
    try {
        // Get business details including approval signatures task
        const business = await getBusinessDetails(id);
        if (!business.getBusiness.approvalSignaturesTaskId) {
            throw new Error('No approval signatures task found');
        }

        // Get wallet from MetaMask
        const wallet = await window.ethereum.request({
            method: 'eth_requestAccounts'
        }).then(accounts => accounts[0]);

        // Get signatures from task
        const taskResult = await getSignatureTask(business.getBusiness.approvalSignaturesTaskId);
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
                {"name": "createRWAFee", "type": "uint256"},
                {"name": "entityId", "type": "string"},
                {"name": "entityOwnerId", "type": "string"},
                {"name": "entityOwnerType", "type": "string"},
                {"name": "owner", "type": "address"},
                {"name": "signers", "type": "address[]"},
                {"name": "signatures", "type": "bytes[]"},
                {"name": "expired", "type": "uint256"}
            ],
            "name": "deployRWA",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        }];

        // Create contract instances
        const holdToken = new web3.eth.Contract(holdTokenABI, HOLD_TOKEN_ADDRESS);
        const factory = new web3.eth.Contract(factoryABI, FACTORY_ADDRESS);

        // Approve HOLD tokens for factory
        await holdToken.methods.approve(
            FACTORY_ADDRESS,
            web3.utils.toTwosComplement('-1') // Max uint256
        ).send({ from: wallet });

        // Deploy RWA contract
        await factory.methods.deployRWA(
            '100', // createRWAFee
            business.getBusiness.id,
            business.getBusiness.ownerId,
            business.getBusiness.ownerType,
            wallet,
            signers,
            signatureValues,
            task.expired
        ).send({
            from: wallet,
            gas: 1800000,
            gasPrice: '1000000000'
        });

        // Wait for backend to process the event
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Refresh businesses to show updated state
        await refreshBusinesses();
        
        alert('Business contract deployed successfully!');
    } catch (error) {
        console.error('Deploy error:', error);
        alert('Error deploying business contract: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get user's companies first
        const result = await getUserCompanies();
        userCompanies = result.getCompanies;
        
        // Populate company select
        populateCompanySelect();
        
        await refreshBusinesses();
        
        // Add filter change handlers
        document.getElementById('showMyBusinesses').addEventListener('change', refreshBusinesses);
        document.getElementById('showDeployed').addEventListener('change', refreshBusinesses);
    } catch (error) {
        console.error('Failed to load user companies:', error);
        alert('Failed to load your companies. Please try refreshing the page.');
    }
});