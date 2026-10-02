<?php
require_once __DIR__ . '/admin-guard.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feedback Management - Admin Panel</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
    <!-- Mobile layout layer: every rule sits inside a max-width media
         query, so desktop rendering is left completely untouched. -->
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css">
</head>
<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">
    <div class="page-container">
        <h2>Feedback Management</h2>

        <div class="admin-card">
            <h3>Feedback Overview</h3>
            <hr>
            <div class="feedback-admin-summary" id="feedbackAdminSummary"></div>
        </div>

        <div class="admin-card">
            <h3>Feedback List</h3>
            <div class="search-box feedback-search-box">
                <i class="fas fa-search search-icon"></i>
                <input type="text" id="feedbackSearch" placeholder="Search feedback..." onkeyup="filterFeedbackAdmin()">
            </div>
            <hr>
            <div class="feedback-admin-list" id="feedbackAdminList">
                <p class="feedback-admin-loading">Loading feedback...</p>
            </div>
            <div class="feedback-pagination" id="feedbackAdminPagination"></div>
        </div>
    </div>

    <?php include 'footer.php'; ?>
</div>

<script src="../../JAVASCRIPT/Admin Side/AdminSideFunction.js"></script>
<script>
document.querySelector('[data-page="feedback"]')?.classList.add('active');

// MySQL `site_feedback` is the source of truth for the admin view.
// Relative URLs resolve against this page (FRONT-END/HTML/Admin Side/*.php),
// so the API base must climb three levels to reach GameSpec-Optimizer/MODULES/api.
const FEEDBACK_ADMIN_API_BASE = "../../../MODULES/api";

let feedbackAdminData = [];

function normalizeAdminFeedback(item) {
    if (!item || typeof item !== "object") return null;
    const isAnonymous = item.is_anonymous === true || item.is_anonymous === 1 || item.is_anonymous === "1";
    return {
        feedback_id: Number(item.feedback_id ?? item.review_id ?? item.id ?? 0) || 0,
        title: String(item.title ?? item.feedback_title ?? "Untitled feedback"),
        comment: String(item.comment ?? "No comment provided."),
        rating: Number(item.rating) || 0,
        username: isAnonymous ? "Anonymous" : String(item.username ?? item.display_name ?? "Guest"),
        is_anonymous: isAnonymous,
        created_at: item.created_at || "",
        helpful_count: Number(item.helpful_count || 0),
        reported_count: Number(item.reported_count || 0),
        reported: Boolean(item.reported) || Number(item.reported_count || 0) > 0,
        is_approved: item.is_approved === undefined ? true : Boolean(item.is_approved),
        report_reason: String(item.report_reason ?? ""),
    };
}

async function requestFeedbackAdmin(url, options) {
    const response = await adminFetch(url, options);
    const raw = await response.text().catch(() => "");
    let result = null;

    if (raw && /^\s*[\{\[]/.test(raw)) {
        try { result = JSON.parse(raw); } catch (parseError) { result = null; }
    }

    if (!response.ok || result === null) {
        const status = `HTTP ${response.status}${response.statusText ? " " + response.statusText : ""}`;
        const serverMessage = result && typeof result.message === "string" ? result.message.trim() : "";
        throw new Error(serverMessage ? `${status}: ${serverMessage}` : status);
    }

    return result;
}

async function loadFeedbackAdminData() {
    const listContainer = document.getElementById("feedbackAdminList");
    if (listContainer) {
        listContainer.innerHTML = '<p class="feedback-admin-loading">Loading feedback...</p>';
    }

    try {
        const data = await requestFeedbackAdmin(`${FEEDBACK_ADMIN_API_BASE}/get-latest-feedback.php`);
        if (!Array.isArray(data)) {
            throw new Error("Unexpected response shape");
        }
        feedbackAdminData = data.map(normalizeAdminFeedback).filter(item => item !== null);
    } catch (error) {
        console.warn("Unable to load feedback for admin view.", error);
        feedbackAdminData = [];
        if (listContainer) {
            listContainer.innerHTML = `<p class="feedback-admin-empty">Unable to load feedback from the database. (${escapeHtml(error.message)})</p>`;
        }
    }

    renderFeedbackAdmin();
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

let feedbackAdminPage = 1;
const feedbackAdminPageSize = 5;

function renderFeedbackAdmin() {
    const feedbacks = feedbackAdminData;
    const summaryContainer = document.getElementById("feedbackAdminSummary");
    const listContainer = document.getElementById("feedbackAdminList");
    const paginationContainer = document.getElementById("feedbackAdminPagination");

    const total = feedbacks.length;
    const reported = feedbacks.filter(item => item.reported).length;
    const helpful = feedbacks.reduce((sum, item) => sum + Number(item.helpful_count || 0), 0);

    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="feedback-admin-stat">
                <strong>${total}</strong>
                <span>Total feedback</span>
            </div>
            <div class="feedback-admin-stat">
                <strong>${reported}</strong>
                <span>Reported</span>
            </div>
            <div class="feedback-admin-stat">
                <strong>${helpful}</strong>
                <span>Helpful votes</span>
            </div>
        `;
    }

    if (!listContainer) return;

    const searchValue = document.getElementById('feedbackSearch')?.value.toLowerCase() || '';
    const filteredFeedback = feedbacks.filter(item => {
        const text = `${item.title || ''} ${item.comment || ''} ${item.username || ''} ${item.report_reason || ''}`.toLowerCase();
        return text.includes(searchValue);
    });

    const totalPages = Math.max(1, Math.ceil(filteredFeedback.length / feedbackAdminPageSize));
    feedbackAdminPage = Math.min(feedbackAdminPage, totalPages);

    const start = (feedbackAdminPage - 1) * feedbackAdminPageSize;
    const pagedFeedback = filteredFeedback.slice(start, start + feedbackAdminPageSize);

    if (!filteredFeedback.length) {
        listContainer.innerHTML = '<p class="feedback-admin-empty">No feedback available yet.</p>';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }

    listContainer.innerHTML = pagedFeedback.map((item) => {
        const title = escapeHtml(item.title || "Untitled feedback");
        const comment = escapeHtml(item.comment || "No comment provided.");
        const username = item.is_anonymous ? "Anonymous" : escapeHtml(item.username || "Guest");
        const createdAt = item.created_at ? new Date(item.created_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "Recently added";
        const rating = Math.max(0, Math.min(5, Number(item.rating) || 0));
        const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
        // Delete acts on the real database row via feedback_id.
        const feedbackId = Number(item.feedback_id) || 0;
        const approvalBadge = item.is_approved
            ? '<span class="feedback-admin-badge">Approved</span>'
            : '<span class="feedback-admin-badge feedback-admin-badge-danger">Unapproved</span>';
        // Why the user reported this feedback, so the admin can decide.
        const reportReason = String(item.report_reason || "").trim();
        const reportReasonBlock = reportReason
            ? `<p class="feedback-admin-report-reason"><strong>Report reason:</strong> ${escapeHtml(reportReason)}</p>`
            : "";

        return `
            <div class="feedback-admin-item">
                <div class="feedback-admin-item-header">
                    <div>
                        <h4>${title}</h4>
                        <p>${username} • ${createdAt}</p>
                    </div>
                    <div class="feedback-admin-item-badges">
                        <span class="feedback-admin-badge">${stars}</span>
                        ${item.reported ? '<span class="feedback-admin-badge feedback-admin-badge-danger">Reported</span>' : ''}
                        ${approvalBadge}
                    </div>
                </div>
                <p class="feedback-admin-comment">${comment}</p>
                ${reportReasonBlock}
                <div class="feedback-admin-actions">
                    <span>Helpful: ${Number(item.helpful_count || 0)}</span>
                    <span>Reported: ${Number(item.reported_count || 0)}</span>
                    ${feedbackId > 0 ? `<button type="button" class="feedback-admin-btn danger" onclick="deleteFeedbackAdmin(${feedbackId})">Delete</button>` : ''}
                </div>
            </div>
        `;
    }).join("");

    if (paginationContainer) {
        const pageButtons = [];
        for (let page = 1; page <= totalPages; page += 1) {
            pageButtons.push(`<button type="button" class="pagination-btn ${page === feedbackAdminPage ? 'active' : ''}" onclick="changeFeedbackAdminPage(${page})">${page}</button>`);
        }
        paginationContainer.innerHTML = `
            <button type="button" class="pagination-btn" ${feedbackAdminPage === 1 ? 'disabled' : ''} onclick="changeFeedbackAdminPage(${feedbackAdminPage - 1})">Prev</button>
            ${pageButtons.join('')}
            <button type="button" class="pagination-btn" ${feedbackAdminPage === totalPages ? 'disabled' : ''} onclick="changeFeedbackAdminPage(${feedbackAdminPage + 1})">Next</button>
        `;
    }
}

function changeFeedbackAdminPage(page) {
    const feedbacks = feedbackAdminData;
    const searchValue = document.getElementById('feedbackSearch')?.value.toLowerCase() || '';
    const filteredFeedback = feedbacks.filter(item => {
        const text = `${item.title || ''} ${item.comment || ''} ${item.username || ''}`.toLowerCase();
        return text.includes(searchValue);
    });
    const totalPages = Math.max(1, Math.ceil(filteredFeedback.length / feedbackAdminPageSize));

    if (page < 1 || page > totalPages) return;
    feedbackAdminPage = page;
    renderFeedbackAdmin();
}

function filterFeedbackAdmin() {
    feedbackAdminPage = 1;
    renderFeedbackAdmin();
}

async function deleteFeedbackAdmin(feedbackId) {
    const id = Number(feedbackId) || 0;
    if (id <= 0) return;
    if (!confirm("Delete this feedback permanently?")) return;

    try {
        // MySQL is the source of truth: delete the row, then reload.
        await requestFeedbackAdmin(`${FEEDBACK_ADMIN_API_BASE}/delete-feedback.php`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback_id: id }),
        });
    } catch (error) {
        console.warn("Unable to delete feedback.", error);
        alert(error.message || "Feedback could not be deleted.");
        return;
    }

    await loadFeedbackAdminData();
}

window.deleteFeedbackAdmin = deleteFeedbackAdmin;
window.changeFeedbackAdminPage = changeFeedbackAdminPage;
window.addEventListener("DOMContentLoaded", loadFeedbackAdminData);
</script>

</body>
</html>
