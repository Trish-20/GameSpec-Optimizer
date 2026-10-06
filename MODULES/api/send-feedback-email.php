<?php

declare(strict_types=1);

require_once __DIR__ . '/../db.php';

header('Content-Type: application/json; charset=utf-8');

function feedbackEmailResponse(int $status, bool $success, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    feedbackEmailResponse(405, false, 'Unable to send feedback.');
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = $_POST;
}

$title = trim((string) ($input['title'] ?? ''));
$comment = trim((string) ($input['comment'] ?? ''));
$ratingRaw = $input['rating'] ?? null;
$username = trim((string) ($input['username'] ?? $input['name'] ?? ''));
$replyEmail = trim((string) ($input['email'] ?? ''));

if ($title === '' || $comment === '' || $ratingRaw === null || trim((string) $ratingRaw) === '') {
    feedbackEmailResponse(400, false, 'Unable to send feedback.');
}

if (mb_strlen($title) > 150 || mb_strlen($username) > 100) {
    feedbackEmailResponse(400, false, 'Unable to send feedback.');
}

$ratingText = (string) $ratingRaw;
if (!preg_match('/^[1-5]$/', $ratingText)) {
    feedbackEmailResponse(400, false, 'Unable to send feedback.');
}

if ($replyEmail !== '' && (strlen($replyEmail) > 254 || filter_var($replyEmail, FILTER_VALIDATE_EMAIL) === false)) {
    feedbackEmailResponse(400, false, 'Unable to send feedback.');
}

try {
    // Configure these in Render's Environment settings for deployment, or in
    // the ignored project-root .env.local file for local XAMPP development.
    // Required names: BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME,
    // and FEEDBACK_RECIPIENT_EMAIL. Never put the recipient in the request.
    $environment = loadEnvironment();
    $apiKey = trim((string) ($environment['BREVO_API_KEY'] ?? ''));
    $senderEmail = trim((string) ($environment['BREVO_SENDER_EMAIL'] ?? ''));
    $senderName = trim((string) ($environment['BREVO_SENDER_NAME'] ?? ''));
    $recipientEmail = trim((string) ($environment['FEEDBACK_RECIPIENT_EMAIL'] ?? ''));

    if (
        $apiKey === '' ||
        $senderName === '' ||
        filter_var($senderEmail, FILTER_VALIDATE_EMAIL) === false ||
        filter_var($recipientEmail, FILTER_VALIDATE_EMAIL) === false ||
        preg_match('/[\r\n]/', $senderName)
    ) {
        feedbackEmailResponse(503, false, 'Unable to send feedback.');
    }

    if (!function_exists('curl_init')) {
        error_log('Feedback email delivery unavailable: PHP cURL extension is not enabled.');
        feedbackEmailResponse(500, false, 'Unable to send feedback.');
    }

    $escape = static fn (string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $nameForEmail = $username !== '' ? $username : 'Anonymous';
    $htmlContent = '<h2>New GameSpec Optimizer Feedback</h2>'
        . '<table cellpadding="8" cellspacing="0" style="border-collapse:collapse">'
        . '<tr><th align="left">Name</th><td>' . $escape($nameForEmail) . '</td></tr>'
        . '<tr><th align="left">Rating</th><td>' . $escape($ratingText) . ' / 5</td></tr>'
        . '<tr><th align="left">Title</th><td>' . $escape($title) . '</td></tr>'
        . '<tr><th align="left" valign="top">Feedback</th><td>'
        . nl2br($escape($comment), false)
        . '</td></tr>';

    if ($replyEmail !== '') {
        $htmlContent .= '<tr><th align="left">Reply-To</th><td>' . $escape($replyEmail) . '</td></tr>';
    }
    $htmlContent .= '</table>';

    $email = [
        'sender' => ['name' => $senderName, 'email' => $senderEmail],
        'to' => [['email' => $recipientEmail]],
        'subject' => 'New GameSpec Optimizer Feedback',
        'htmlContent' => $htmlContent,
    ];
    if ($replyEmail !== '') {
        $email['replyTo'] = ['email' => $replyEmail];
    }

    $handle = curl_init('https://api.brevo.com/v3/smtp/email');
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_HTTPHEADER => [
            'accept: application/json',
            'api-key: ' . $apiKey,
            'content-type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($email, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
    ]);

    $responseBody = curl_exec($handle);
    $curlFailed = $responseBody === false;
    $httpStatus = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);

    if ($curlFailed || $httpStatus < 200 || $httpStatus >= 300) {
        error_log('Feedback email delivery failed; Brevo HTTP status ' . $httpStatus . '.');
        feedbackEmailResponse(502, false, 'Unable to send feedback.');
    }

    feedbackEmailResponse(200, true, 'Feedback submitted successfully.');
} catch (Throwable $error) {
    error_log('Feedback email endpoint failed during configuration or request setup.');
    feedbackEmailResponse(500, false, 'Unable to send feedback.');
}
