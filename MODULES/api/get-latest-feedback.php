<?php

$apiURL = "http://localhost/GameSpecOptimizer/API/feedback/latest";

$response = file_get_contents($apiURL);

if ($response === false) {
    $feedbacks = [];
} else {
    $feedbacks = json_decode($response, true);

    if (!is_array($feedbacks)) {
        $feedbacks = [];
    }
}