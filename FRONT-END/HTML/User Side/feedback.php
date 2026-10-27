<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Community Feedback - GameSpec Optimizer</title>
    <script>try { document.documentElement.dataset.theme = localStorage.getItem('gamespec-theme') === 'dark' ? 'dark' : 'light'; } catch (e) {}</script>

    <link rel="stylesheet" href="../../CSS/User Side/UserSideStyle.css">
    <!-- Mobile layout layer: every rule sits inside a max-width media
         query, so desktop rendering is left completely untouched. -->
    <link rel="stylesheet" href="../../CSS/shared/MobileResponsive.css?v=<?= @filemtime(__DIR__ . '/../../CSS/shared/MobileResponsive.css') ?: '1' ?>">

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

        <section class="feedback-toolbar" aria-label="Search and filter community reviews">

            <div class="feedback-search">
                <i class="fas fa-search"></i>
                <input
                    type="text"
                    id="feedbackSearch"
                    placeholder="Search reviews..."
                    aria-label="Search reviews"
                    oninput="filterFeedback()">
            </div>

           

            <div class="search-dropdown" id="ratingFilterDropdown">
                <input type="text" class="search-input" id="ratingFilterSearch" placeholder="Filter by rating..." autocomplete="off" aria-label="Filter reviews by rating">
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
            <div class="feedback-modal-heading">
                <h2 id="feedbackModalTitle">Share Your Feedback</h2>
                <p class="feedback-modal-subtitle">Help us make GameSpec Optimizer better.</p>
            </div>
            <button class="modal-close" type="button" onclick="closeFeedbackModal()" aria-label="Close feedback form">×</button>
        </div>

        <form class="modal-body feedback-form" id="feedbackForm" onsubmit="handleFeedbackSubmit(event)">
            <p class="feedback-form-intro">Tell us about your experience with GameSpec Optimizer.</p>
            <p class="feedback-required-note"><span class="required-indicator" aria-hidden="true">*</span> Required fields</p>
            <fieldset class="feedback-form-section">
                <legend>Review details</legend>
                <label for="feedbackTitle">Title <span class="required-indicator" aria-hidden="true">*</span></label>
                <input id="feedbackTitle" name="title" type="text" placeholder="Short summary" required>
                <label for="feedbackComment">Your feedback <span class="required-indicator" aria-hidden="true">*</span></label>
                <textarea id="feedbackComment" name="comment" placeholder="Tell us what you think..." required></textarea>
            </fieldset>

            <fieldset class="feedback-form-section feedback-rating-section">
                <legend id="ratingLabel">Rating <span class="required-indicator" aria-hidden="true">*</span></legend>
                <div class="star-rating" role="radiogroup" aria-labelledby="ratingLabel" aria-required="true">
                <input id="feedbackRatingValue" type="hidden" name="rating" value="">
                <button class="star" type="button" role="radio" aria-checked="false" aria-label="1 star" data-rating="1" tabindex="0">★</button>
                <button class="star" type="button" role="radio" aria-checked="false" aria-label="2 stars" data-rating="2" tabindex="-1">★</button>
                <button class="star" type="button" role="radio" aria-checked="false" aria-label="3 stars" data-rating="3" tabindex="-1">★</button>
                <button class="star" type="button" role="radio" aria-checked="false" aria-label="4 stars" data-rating="4" tabindex="-1">★</button>
                <button class="star" type="button" role="radio" aria-checked="false" aria-label="5 stars" data-rating="5" tabindex="-1">★</button>
                </div>
                <div class="star-rating-scale" aria-hidden="true"><span>Poor</span><span>Excellent</span></div>
            </fieldset>

            <fieldset class="feedback-form-section feedback-name-section">
                <legend>Your name</legend>
                <label for="feedbackUsername">Name <span class="optional-indicator">(optional)</span></label>
                <input id="feedbackUsername" name="username" type="text" placeholder="Your name (optional)">
            </fieldset>

            <div class="modal-footer">
                <button class="modal-btn modal-btn-secondary" type="button" onclick="closeFeedbackModal()">Cancel</button>
                <button class="modal-btn modal-btn-primary" type="submit">Submit Feedback</button>
            </div>
        </form>
    </div>
</div>

<script src="../../JAVASCRIPT/User Side/UserSideFunction.js?v=<?= @filemtime(__DIR__ . '/../../JAVASCRIPT/User Side/UserSideFunction.js') ?: '1' ?>"></script>

<script>

document.querySelector('[data-page="feedback"]')?.classList.add("active");

if (typeof loadFeedbackPage === "function") {
    loadFeedbackPage();
}

const feedbackRatingGroup = document.querySelector("#feedbackForm .star-rating");
if (feedbackRatingGroup) {
    const ratingButtons = [...feedbackRatingGroup.querySelectorAll("button[data-rating]")];
    const ratingValue = document.getElementById("feedbackRatingValue");
    const paintRating = (rating) => ratingButtons.forEach((button) => {
        const value = Number(button.dataset.rating);
        button.classList.toggle("is-filled", value <= rating);
        button.setAttribute("aria-checked", String(value === Number(ratingValue.value)));
        button.tabIndex = value === Number(ratingValue.value || 1) ? 0 : -1;
    });
    const selectRating = (rating) => {
        ratingValue.value = String(rating);
        paintRating(rating);
    };
    ratingButtons.forEach((button, index) => {
        button.addEventListener("click", () => selectRating(Number(button.dataset.rating)));
        button.addEventListener("mouseenter", () => paintRating(Number(button.dataset.rating)));
        button.addEventListener("keydown", (event) => {
            let nextIndex = index;
            if (event.key === "ArrowRight" || event.key === "ArrowUp") nextIndex = Math.min(index + 1, ratingButtons.length - 1);
            else if (event.key === "ArrowLeft" || event.key === "ArrowDown") nextIndex = Math.max(index - 1, 0);
            else if (event.key === "Home") nextIndex = 0;
            else if (event.key === "End") nextIndex = ratingButtons.length - 1;
            else return;
            event.preventDefault();
            ratingButtons[nextIndex].focus();
            selectRating(Number(ratingButtons[nextIndex].dataset.rating));
        });
    });
    feedbackRatingGroup.addEventListener("mouseleave", () => paintRating(Number(ratingValue.value || 0)));
}

</script>

</body>
</html>
