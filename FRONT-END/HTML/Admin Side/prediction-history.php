<?php
require_once __DIR__ . '/admin-guard.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prediction History - Admin Panel</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css?v=<?= @filemtime(__DIR__ . '/../../CSS/shared/MobileResponsive.css') ?: '1' ?>">
</head>
<body class="sidebar-open">
<?php include 'header.php'; ?>
<main class="content">
    <div class="page-container prediction-history-page">
        <h2>Prediction History</h2>
        <p class="prediction-history-intro">Anonymous records of successful FPS predictions.</p>
        <section class="prediction-summary-grid" id="predictionSummary" aria-live="polite">
            <div class="admin-card prediction-stat"><span>Total Predictions</span><strong>—</strong></div>
            <div class="admin-card prediction-stat"><span>Predictions Today</span><strong>—</strong></div>
            <div class="admin-card prediction-stat"><span>Games Analyzed</span><strong>—</strong></div>
            <div class="admin-card prediction-stat"><span>Most Analyzed Game</span><strong>—</strong></div>
        </section>
        <section class="admin-card prediction-history-card">
            <div class="prediction-filter-row">
                <input id="historyGameFilter" type="search" maxlength="255" placeholder="Search game">
                <input id="historyDateFilter" type="date" aria-label="Filter by date">
                <select id="historyModeFilter" aria-label="Filter by performance mode">
                    <option value="">All performance modes</option>
                    <option value="battery">Battery</option>
                    <option value="balanced">Balanced</option>
                    <option value="performance">Performance</option>
                </select>
                <button id="historySearchButton" class="btn-secondary" type="button">Search</button>
                <button id="historyExportButton" class="btn-secondary" type="button"><i class="fas fa-file-csv"></i> Export CSV</button>
            </div>
            <div id="historyState" class="prediction-history-state" role="status">Loading prediction history...</div>
            <div class="table-container prediction-table-wrap" id="predictionTableWrap" hidden>
                <table class="prediction-table">
                    <thead><tr><th>Prediction ID</th><th>Date &amp; Time</th><th>Game</th><th>Predicted FPS</th><th>Mode</th><th>Details</th></tr></thead>
                    <tbody id="predictionRows"></tbody>
                </table>
            </div>
            <div class="feedback-pagination" id="historyPagination"></div>
        </section>
    </div>
</main>
<div class="modal-overlay" id="predictionDetailsModal" aria-hidden="true">
    <div class="modal-dialog prediction-details-dialog" role="dialog" aria-modal="true" aria-labelledby="predictionDetailsTitle">
        <div class="modal-header"><h2 id="predictionDetailsTitle">Prediction Details</h2><button class="modal-close" type="button" id="closePredictionDetails" aria-label="Close">&times;</button></div>
        <div class="modal-body prediction-details-body" id="predictionDetailsBody"></div>
    </div>
</div>
<?php include 'footer.php'; ?>
<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js?v=<?= @filemtime(__DIR__ . '/../../JAVASCRIPT/Admin Side/AdminSideFunction.js') ?: '1' ?>"></script>
<script>
document.querySelector('[data-page="prediction-history"]')?.classList.add('active');
const historyApi = '../../../MODULES/api/prediction-history.php';
const historyState = document.getElementById('historyState');
const rowsBody = document.getElementById('predictionRows');
const tableWrap = document.getElementById('predictionTableWrap');
const escapeHistory = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let historyPage = 1;
let historyPages = 1;
const getFilters = () => ({ game: document.getElementById('historyGameFilter').value.trim(), date: document.getElementById('historyDateFilter').value, mode: document.getElementById('historyModeFilter').value });
const queryFor = (values) => new URLSearchParams(Object.entries(values).filter(([, value]) => value));

async function loadHistory() {
    historyState.hidden = false;
    historyState.className = 'prediction-history-state';
    historyState.textContent = 'Loading prediction history...';
    tableWrap.hidden = true;
    try {
        const [summaryResponse, recordsResponse] = await Promise.all([
            adminFetch(`${historyApi}?action=summary`),
            adminFetch(`${historyApi}?${queryFor({...getFilters(), page: historyPage})}`)
        ]);
        const [summary, data] = await Promise.all([summaryResponse.json(), recordsResponse.json()]);
        if (!summaryResponse.ok || !recordsResponse.ok || !Array.isArray(data.records)) throw new Error(data.message || summary.message || 'Unable to load prediction history.');
        document.getElementById('predictionSummary').innerHTML = [
            ['Total Predictions', summary.total_predictions], ['Predictions Today', summary.predictions_today],
            ['Games Analyzed', summary.games_analyzed], ['Most Analyzed Game', summary.most_analyzed_game || '—']
        ].map(([label, value]) => `<div class="admin-card prediction-stat"><span>${escapeHistory(label)}</span><strong>${escapeHistory(value)}</strong></div>`).join('');
        historyPages = Math.max(1, Math.ceil(data.total / data.page_size));
        rowsBody.innerHTML = data.records.map(record => `<tr>
            <td class="prediction-id-cell">${escapeHistory(record.prediction_id)}</td>
            <td>${escapeHistory(new Date(record.created_at.replace(' ', 'T')).toLocaleString())}</td>
            <td>${escapeHistory(record.game_title)}</td><td>${escapeHistory(record.predicted_fps)} FPS</td>
            <td>${escapeHistory(record.performance_mode)}</td>
            <td><button type="button" class="btn-secondary prediction-details-button" data-prediction-id="${escapeHistory(record.prediction_id)}">View</button></td>
        </tr>`).join('');
        tableWrap.hidden = data.records.length === 0;
        historyState.hidden = data.records.length > 0;
        if (!data.records.length) historyState.textContent = 'No prediction records match these filters yet.';
        renderHistoryPagination();
    } catch (error) {
        historyState.hidden = false;
        historyState.className = 'prediction-history-state is-error';
        historyState.textContent = error.message || 'Prediction history could not be loaded.';
        document.getElementById('historyPagination').innerHTML = '';
    }
}

function renderHistoryPagination() {
    const el = document.getElementById('historyPagination');
    el.innerHTML = historyPages > 1 ? `<button class="pagination-btn" type="button" ${historyPage <= 1 ? 'disabled' : ''} id="historyPrev">Previous</button><span>Page ${historyPage} of ${historyPages}</span><button class="pagination-btn" type="button" ${historyPage >= historyPages ? 'disabled' : ''} id="historyNext">Next</button>` : '';
    document.getElementById('historyPrev')?.addEventListener('click', () => { historyPage -= 1; loadHistory(); });
    document.getElementById('historyNext')?.addEventListener('click', () => { historyPage += 1; loadHistory(); });
}

async function showPredictionDetails(id) {
    const modal = document.getElementById('predictionDetailsModal');
    const body = document.getElementById('predictionDetailsBody');
    body.textContent = 'Loading details...';
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    try {
        const response = await adminFetch(`${historyApi}?action=details&id=${encodeURIComponent(id)}`);
        const record = await response.json();
        if (!response.ok) throw new Error(record.message || 'Unable to load prediction details.');
        const sections = [
            ['Prediction', [['Prediction ID', record.prediction_id], ['Date/Time', record.created_at], ['Game', record.game_title], ['Predicted FPS', `${record.predicted_fps} FPS`], ['Recommendation', record.recommendation]]],
            ['Hardware', [['CPU', record.cpu_model], ['GPU', record.gpu_model], ['RAM', record.ram_gb ? `${record.ram_gb} GB` : null], ['Hardware Input', record.hardware_input_method]]],
            ['Preferences', [['Graphics Preset', record.graphics_preset], ['Performance Mode', record.performance_mode]]]
        ];
        body.innerHTML = sections.map(([title, fields]) => {
            const visible = fields.filter(([, value]) => value !== null && value !== undefined && value !== '');
            return visible.length ? `<section class="prediction-detail-section"><h3>${escapeHistory(title)}</h3><dl>${visible.map(([label,value]) => `<div><dt>${escapeHistory(label)}</dt><dd>${escapeHistory(value)}</dd></div>`).join('')}</dl></section>` : '';
        }).join('');
    } catch (error) { body.textContent = error.message || 'Unable to load prediction details.'; }
}

document.getElementById('historySearchButton').addEventListener('click', () => { historyPage = 1; loadHistory(); });
document.getElementById('historyExportButton').addEventListener('click', () => { window.location.href = `${historyApi}?action=export&${queryFor(getFilters())}`; });
rowsBody.addEventListener('click', event => { const button = event.target.closest('[data-prediction-id]'); if (button) showPredictionDetails(button.dataset.predictionId); });
function closePredictionDetails() { const modal = document.getElementById('predictionDetailsModal'); modal.classList.remove('active'); modal.setAttribute('aria-hidden', 'true'); }
document.getElementById('closePredictionDetails').addEventListener('click', closePredictionDetails);
document.getElementById('predictionDetailsModal').addEventListener('click', event => { if (event.target.id === 'predictionDetailsModal') closePredictionDetails(); });
loadHistory();
</script>
</body>
</html>
