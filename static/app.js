function setQuery(sql) {
    document.getElementById('sqlInput').value = sql;
}

function clearResults() {
    document.getElementById('resultsContainer').innerHTML = `
        <div class="no-data">
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
            </svg>
            <h3>No Query Results</h3>
            <p>Please enter an SQL statement and click "Execute Query" button</p>
        </div>
    `;
    document.getElementById('error').classList.remove('show');
    document.getElementById('resultsInfo').classList.remove('show');
    document.getElementById('sqlInput').value = '';
}

async function executeQuery() {
    const sql = document.getElementById('sqlInput').value.trim();
    
    if (!sql) {
        showError('Please enter an SQL query');
        return;
    }

    const executeBtn = document.getElementById('executeBtn');
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const resultsInfo = document.getElementById('resultsInfo');

    // Show loading, hide error
    executeBtn.disabled = true;
    loading.classList.add('show');
    error.classList.remove('show');
    resultsInfo.classList.remove('show');

    try {
        const response = await fetch('/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql }),
        });

        const data = await response.json();

        if (data.error) {
            showError(data.error);
        } else {
            displayResults(data);
            showResultsInfo(data.rows.length, data.columns.length);
        }
    } catch (err) {
        showError('Query failed: ' + err.message);
    } finally {
        executeBtn.disabled = false;
        loading.classList.remove('show');
    }
}

function showError(message) {
    const error = document.getElementById('error');
    error.textContent = message;
    error.classList.add('show');
}

function showResultsInfo(rowCount, columnCount) {
    const resultsInfo = document.getElementById('resultsInfo');
    resultsInfo.textContent = `✓ Query successful! Returned ${rowCount} rows, ${columnCount} columns`;
    resultsInfo.classList.add('show');
}

let currentData = null;
let currentPage = 1;
let rowsPerPage = 50;

function displayResults(data) {
    currentData = data;
    currentPage = 1;
    renderTable();
}

function renderTable() {
    const container = document.getElementById('resultsContainer');
    
    if (currentData.rows.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                </svg>
                <h3>Query Result is Empty</h3>
                <p>No matching data found</p>
            </div>
        `;
        return;
    }

    const totalRows = currentData.rows.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const startIdx = (currentPage - 1) * rowsPerPage;
    const endIdx = Math.min(startIdx + rowsPerPage, totalRows);
    const pageRows = currentData.rows.slice(startIdx, endIdx);

    let html = '<div class="table-container"><table><thead><tr>';
    
    // Add column headers
    currentData.columns.forEach(col => {
        html += `<th>${escapeHtml(col)}</th>`;
    });
    
    html += '</tr></thead><tbody>';
    
    // Add rows for current page
    pageRows.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
            html += `<td>${escapeHtml(cell)}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table></div>';

    // Add pagination controls
    html += `
        <div class="pagination">
            <div class="pagination-info">
                Showing ${startIdx + 1} to ${endIdx} of ${totalRows} rows
            </div>
            <div class="pagination-controls">
                <select id="rowsPerPageSelect">
                    <option value="25" ${rowsPerPage === 25 ? 'selected' : ''}>25 / page</option>
                    <option value="50" ${rowsPerPage === 50 ? 'selected' : ''}>50 / page</option>
                    <option value="100" ${rowsPerPage === 100 ? 'selected' : ''}>100 / page</option>
                    <option value="200" ${rowsPerPage === 200 ? 'selected' : ''}>200 / page</option>
                </select>
                <button data-page="1" ${currentPage === 1 ? 'disabled' : ''}>First</button>
                <button data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
                <span style="color: #666; font-size: 14px;">Page ${currentPage} of ${totalPages}</span>
                <button data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
                <button data-page="${totalPages}" ${currentPage === totalPages ? 'disabled' : ''}>Last</button>
            </div>
        </div>
    `;

    container.innerHTML = html;
    
    // Attach event listeners to pagination controls
    const paginationButtons = container.querySelectorAll('.pagination button[data-page]');
    paginationButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const page = parseInt(e.target.getAttribute('data-page'));
            goToPage(page);
        });
    });
    
    const rowsSelect = container.querySelector('#rowsPerPageSelect');
    if (rowsSelect) {
        rowsSelect.addEventListener('change', (e) => {
            changeRowsPerPage(e.target.value);
        });
    }
}

function goToPage(page) {
    currentPage = page;
    renderTable();
}

function changeRowsPerPage(value) {
    rowsPerPage = parseInt(value);
    currentPage = 1;
    renderTable();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize event listeners when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Execute button
    document.getElementById('executeBtn').addEventListener('click', executeQuery);
    
    // Clear button
    document.getElementById('clearBtn').addEventListener('click', clearResults);
    
    // Example query buttons
    document.querySelectorAll('.example-query').forEach(button => {
        button.addEventListener('click', (e) => {
            const query = e.target.getAttribute('data-query');
            setQuery(query);
        });
    });
    
    // Allow executing query with Ctrl+Enter or Cmd+Enter
    document.getElementById('sqlInput').addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            executeQuery();
        }
    });
});
