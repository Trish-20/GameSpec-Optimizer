<?php 

$hardware = $_POST['hardware'];

$command = escapeshellcmd("python3 /path/to/ml_predict.py " . escapeshellarg(json_encode($hardware)));
$output = shell_exec($command);
echo $output;

?>