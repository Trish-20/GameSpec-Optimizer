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
                    placeholder="Search feedback..."
                    oninput="filterFeedback()">
            </div>

            <select id="ratingFilter" onchange="filterFeedback()">
                <option value="">All Ratings</option>
                <option value="5">★★★★★ (5 Stars)</option>
                <option value="4">★★★★☆ (4 Stars)</option>
                <option value="3">★★★☆☆ (3 Stars)</option>
                <option value="2">★★☆☆☆ (2 Stars)</option>
                <option value="1">★☆☆☆☆ (1 Star)</option>
            </select>

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


    </div>

    <?php include 'footer.php'; ?>

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