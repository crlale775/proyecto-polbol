<?php
$pdo = new PDO('pgsql:host=127.0.0.1;port=5432;dbname=comlapaz', 'postgres', 'ale775');
$stmt = $pdo->query("SELECT * FROM tipos_documento");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
