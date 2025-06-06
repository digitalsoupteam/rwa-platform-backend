// Store for companies data
let companies = [];

// Format timestamp to readable date
function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
}

// Create company card HTML
function createCompanyCard(company) {
    const card = document.createElement('div');
    card.className = 'company-card';
    
    const userId = localStorage.getItem('userId');
    const isOwner = company.ownerId === userId;
    
    const actionsHtml = isOwner ?
        `<div class="company-actions">
            <button onclick="handleEditCompany('${company.id}')" class="edit-btn">Edit</button>
            <button onclick="handleDeleteCompany('${company.id}')" class="delete-btn">Delete</button>
        </div>` : '';
    
    card.innerHTML = `
        <h3>${company.name} (ID: ${company.id})</h3>
        <p>${company.description}</p>
        <div class="company-owner">Owner ID: ${company.ownerId}</div>
        <div class="created-at">Created: ${formatDate(company.createdAt)}</div>
        ${actionsHtml}
    `;
    return card;
}

// Refresh companies grid
async function refreshCompanies() {
    try {
        const showOnlyMine = document.getElementById('showMyCompanies').checked;
        const result = await getCompanies({
            filter: showOnlyMine ? { ownerId: localStorage.getItem('userId') } : {}
        });
        companies = result.getCompanies;
        
        const container = document.getElementById('companiesContainer');
        container.innerHTML = '';
        
        if (companies.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No companies found</p>';
            return;
        }
        
        companies.forEach(company => {
            container.appendChild(createCompanyCard(company));
        });
    } catch (error) {
        alert('Error loading companies: ' + error.message);
    }
}

// Handle company creation
async function handleCreateCompany() {
    const nameInput = document.getElementById('companyName');
    const descriptionInput = document.getElementById('companyDescription');
    
    const name = nameInput.value.trim();
    const description = descriptionInput.value.trim();
    
    if (!name) {
        alert('Please enter a company name');
        return;
    }
    
    try {
        await createCompany({ name, description });
        
        // Clear form
        nameInput.value = '';
        descriptionInput.value = '';
        
        // Refresh companies display
        await refreshCompanies();
        
        alert('Company created successfully!');
    } catch (error) {
        alert('Error creating company: ' + error.message);
    }
}

// Handle company edit
async function handleEditCompany(id) {
    const company = companies.find(c => c.id === id);
    if (!company) return;
    
    const newName = prompt('Enter new company name:', company.name);
    if (!newName) return;
    
    const newDescription = prompt('Enter new company description:', company.description);
    if (newDescription === null) return;
    
    try {
        await updateCompany({
            id,
            updateData: {
                name: newName,
                description: newDescription
            }
        });
        
        await refreshCompanies();
        alert('Company updated successfully!');
    } catch (error) {
        alert('Error updating company: ' + error.message);
    }
}

// Handle company deletion
async function handleDeleteCompany(id) {
    if (!confirm('Are you sure you want to delete this company?')) {
        return;
    }
    
    try {
        await deleteCompany(id);
        await refreshCompanies();
        alert('Company deleted successfully!');
    } catch (error) {
        alert('Error deleting company: ' + error.message);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    refreshCompanies();
    
    // Add filter change handler
    document.getElementById('showMyCompanies').addEventListener('change', refreshCompanies);
});