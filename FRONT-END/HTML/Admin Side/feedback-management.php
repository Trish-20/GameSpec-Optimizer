<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feedback Management - Admin Panel</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="../../CSS/Admin Side/AdminSideStyle.css">
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

const defaultFeedbackData = [
    {
        title: "Excellent prediction accuracy",
        comment: "The FPS predictions feel much more accurate now and helped me choose a better GPU for my setup.",
        rating: 5,
        username: "Ava",
        is_anonymous: false,
        created_at: "2026-06-28",
        helpful_count: 3,
        reported: false
    },
    {
        title: "Great recommendation flow",
        comment: "I liked how the suggestions were easy to understand and matched the games I usually play.",
        rating: 4,
        username: "Noah",
        is_anonymous: false,
        created_at: "2026-06-24",
        helpful_count: 1,
        reported: true
    },
    {
        title: "Helpful for budget builds",
        comment: "This made it simple to compare hardware options before buying anything new for my rig.",
        rating: 5,
        username: "Anonymous",
        is_anonymous: true,
        created_at: "2026-06-20",
        helpful_count: 2,
        reported: false
    }
];

function getFeedbackData() {
    try {
        const stored = localStorage.getItem("gamespecFeedback");
        if (!stored) return [...defaultFeedbackData];

        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [...defaultFeedbackData];
    } catch (error) {
        console.warn("Unable to load feedback for admin view.", error);
        return [...defaultFeedbackData];
    }
}

function saveFeedbackData(feedbacks) {
    try {
        localStorage.setItem("gamespecFeedback", JSON.stringify(feedbacks));
    } catch (error) {
        console.warn("Unable to save feedback for admin view.", error);
    }
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
    const feedbacks = getFeedbackData();
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
        const text = `${item.title || ''} ${item.comment || ''} ${item.username || ''}`.toLowerCase();
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

    listContainer.innerHTML = pagedFeedback.map((item, index) => {
        const title = escapeHtml(item.title || "Untitled feedback");
        const comment = escapeHtml(item.comment || "No comment provided.");
        const username = item.is_anonymous ? "Anonymous" : escapeHtml(item.username || "Guest");
        const createdAt = item.created_at ? new Date(item.created_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "Recently added";
        const stars = "★".repeat(Number(item.rating) || 0) + "☆".repeat(5 - (Number(item.rating) || 0));
        const globalIndex = feedbacks.findIndex(entry => entry === item);

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
                    </div>
                </div>
                <p class="feedback-admin-comment">${comment}</p>
                <div class="feedback-admin-actions">
                    <span>Helpful: ${Number(item.helpful_count || 0)}</span>
                    ${item.reported ? `<button type="button" class="feedback-admin-btn secondary" onclick="markFeedbackReviewed(${globalIndex})">Mark reviewed</button>` : ''}
                    <button type="button" class="feedback-admin-btn danger" onclick="deleteFeedbackAdmin(${globalIndex})">Delete</button>
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
    const feedbacks = getFeedbackData();
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

function deleteFeedbackAdmin(index) {
    const feedbacks = getFeedbackData();
    feedbacks.splice(index, 1);
    saveFeedbackData(feedbacks);
    renderFeedbackAdmin();
}

function markFeedbackReviewed(index) {
    const feedbacks = getFeedbackData();
    if (feedbacks[index]) {
        feedbacks[index].reported = false;
        saveFeedbackData(feedbacks);
        renderFeedbackAdmin();
    }
}

window.deleteFeedbackAdmin = deleteFeedbackAdmin;
window.markFeedbackReviewed = markFeedbackReviewed;
window.changeFeedbackAdminPage = changeFeedbackAdminPage;
window.addEventListener("DOMContentLoaded", renderFeedbackAdmin);
</script>

</body>
</html>
