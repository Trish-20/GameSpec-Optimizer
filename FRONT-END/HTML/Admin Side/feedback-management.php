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

function renderFeedbackAdmin() {
    const feedbacks = getFeedbackData();
    const summaryContainer = document.getElementById("feedbackAdminSummary");
    const listContainer = document.getElementById("feedbackAdminList");

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

    if (!feedbacks.length) {
        listContainer.innerHTML = '<p class="feedback-admin-empty">No feedback available yet.</p>';
        return;
    }

    listContainer.innerHTML = feedbacks.map((item, index) => {
        const title = escapeHtml(item.title || "Untitled feedback");
        const comment = escapeHtml(item.comment || "No comment provided.");
        const username = item.is_anonymous ? "Anonymous" : escapeHtml(item.username || "Guest");
        const createdAt = item.created_at ? new Date(item.created_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "Recently added";
        const stars = "★".repeat(Number(item.rating) || 0) + "☆".repeat(5 - (Number(item.rating) || 0));

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
                    ${item.reported ? `<button type="button" class="feedback-admin-btn secondary" onclick="markFeedbackReviewed(${index})">Mark reviewed</button>` : ''}
                    <button type="button" class="feedback-admin-btn danger" onclick="deleteFeedbackAdmin(${index})">Delete</button>
                </div>
            </div>
        `;
    }).join("");

    filterFeedbackAdmin();
}

function filterFeedbackAdmin() {
    const searchValue = document.getElementById('feedbackSearch')?.value.toLowerCase() || '';
    const cards = document.querySelectorAll('.feedback-admin-item');

    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(searchValue) ? 'block' : 'none';
    });
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
window.addEventListener("DOMContentLoaded", renderFeedbackAdmin);
</script>

</body>
</html>
