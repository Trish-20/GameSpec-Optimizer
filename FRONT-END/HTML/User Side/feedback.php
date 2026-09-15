<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Community Feedback - GameSpec Optimizer</title>

    <link rel="stylesheet" href="../../CSS/User Side/UserSideStyle.css">

    <!-- Font Awesome -->
    <link rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css">
</head>

<body class="sidebar-open">

<?php include 'header.php'; ?>

<div class="content">

    <div class="page-container">

        <h2>
            <i class="fas fa-comments"></i>
            Community Feedback
        </h2>

        <section class="feedback-toolbar">

            <div class="feedback-search">
                <i class="fas fa-search"></i>
                <input
                    type="text"
                    id="feedbackSearch"
                    placeholder="Search reviews..."
                    oninput="filterFeedback()">
            </div>

           

                        <div class="search-dropdown" id="ratingFilterDropdown">
                <input type="text" class="search-input" id="ratingFilterSearch" placeholder="Filter by rating..." autocomplete="off">
                <input type="hidden" id="ratingFilter" value="">
                <div class="dropdown-list" id="ratingFilterDropdownList"></div>
            </div>

             <button class="feedback-add-btn" type="button" onclick="openFeedbackModal()">
                <i class="fas fa-plus"></i>
                Add Feedback
            </button>

        </section>

        
        <section class="feedback-summary-card">

            <div class="feedback-overall">

                <div class="feedback-score" id="averageRating">
                    --
                </div>

                <div class="feedback-stars" id="averageStars">
                    ★★★★★
                </div>

                <p id="totalReviews">
                    Loading community rating...
                </p>

            </div>

        </section>

        <section
            class="feedback-page-list"
            id="feedbackList">

            <div class="results-placeholder">

                <div class="placeholder-icon">
                    <i class="fas fa-comment-dots"></i>
                </div>

                <p>
                    Loading community feedback...
                </p>

            </div>

        </section>

        <div class="feedback-pagination" id="feedbackPagination"></div>

    </div>

    <?php include 'footer.php'; ?>

</div>

<div class="modal-overlay" id="feedbackModalOverlay" onclick="if (event.target.id === 'feedbackModalOverlay') closeFeedbackModal();">
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="feedbackModalTitle">
        <div class="modal-header">
            <h2 id="feedbackModalTitle">Share Your Feedback</h2>
            <button class="modal-close" type="button" onclick="closeFeedbackModal()" aria-label="Close feedback form">×</button>
        </div>

        <form class="modal-body feedback-form" id="feedbackForm" onsubmit="handleFeedbackSubmit(event)">
            <p class="feedback-form-intro">Tell us about your experience with GameSpec Optimizer.</p>
            <label for="feedbackTitle">Title</label>
            <input id="feedbackTitle" name="title" type="text" placeholder="Short summary" required>

            <label for="feedbackComment">Your feedback</label>
            <textarea id="feedbackComment" name="comment" placeholder="Tell us what you think..." required></textarea>

            <label id="ratingLabel">Rating</label>
                <div class="star-rating" role="radiogroup" aria-labelledby="ratingLabel">

                    <input id="rating5" type="radio" name="rating" value="5">
                    <label for="rating5" class="star" aria-label="5 stars">★</label>

                    <input id="rating4" type="radio" name="rating" value="4">
                    <label for="rating4" class="star" aria-label="4 stars">★</label>

                    <input id="rating3" type="radio" name="rating" value="3">
                    <label for="rating3" class="star" aria-label="3 stars">★</label>

                    <input id="rating2" type="radio" name="rating" value="2">
                    <label for="rating2" class="star" aria-label="2 stars">★</label>

                    <input id="rating1" type="radio" name="rating" value="1" required>
                    <label for="rating1" class="star" aria-label="1 star">★</label>

                </div>

            <label for="feedbackUsername">Name</label>
            <input id="feedbackUsername" name="username" type="text" placeholder="Your name (optional)">

            <div class="modal-footer">
                <button class="modal-btn modal-btn-secondary" type="button" onclick="closeFeedbackModal()">Cancel</button>
                <button class="modal-btn modal-btn-primary" type="submit">Submit Feedback</button>
            </div>
        </form>
    </div>
</div>

<script src="../../JAVASCRIPT/User Side/UserSideFunction.js"></script>

<script>

document.querySelector('[data-page="feedback"]')?.classList.add("active");

if (typeof loadFeedbackPage === "function") {
    loadFeedbackPage();
}

</script>

</body>
</html>