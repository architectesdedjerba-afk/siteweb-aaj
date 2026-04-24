<?php
declare(strict_types=1);

/**
 * Migration : ajoute la colonne `archived_at` à la table `users`.
 *
 * Nécessaire pour la fonctionnalité d'archivage des membres introduite
 * en 2026. Idempotent — safe à relancer, ne fait rien si la colonne existe
 * déjà.
 *
 * Utilisation sur cPanel (Terminal / SSH) :
 *   cd ~/public_html/api
 *   php scripts/migrate-archived-at.php
 *
 * Ou via navigateur (en mode CLI déguisé — non recommandé, gardez-le CLI) :
 *   pas d'accès HTTP, CLI uniquement.
 */

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("CLI only.\n");
}

require_once __DIR__ . '/../lib/bootstrap.php';

$pdo = db();

// 1. Vérifie si la colonne existe déjà (portable sur MariaDB et MySQL)
$check = $pdo->prepare(
    "SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'users'
       AND COLUMN_NAME  = 'archived_at'"
);
$check->execute();
$exists = (int) ($check->fetch()['c'] ?? 0) > 0;

if ($exists) {
    echo "✓ La colonne `users.archived_at` existe déjà — rien à faire.\n";
    exit(0);
}

// 2. Ajoute la colonne (compatible avec toutes versions — pas de IF NOT EXISTS)
echo "→ Ajout de la colonne `users.archived_at` …\n";
try {
    $pdo->exec('ALTER TABLE users ADD COLUMN archived_at DATETIME NULL');
} catch (PDOException $e) {
    fwrite(STDERR, "❌ Erreur lors de l'ajout de la colonne : " . $e->getMessage() . "\n");
    exit(1);
}

// 3. Re-vérifie
$check->execute();
$exists = (int) ($check->fetch()['c'] ?? 0) > 0;
if (!$exists) {
    fwrite(STDERR, "❌ La colonne n'a pas été créée (raison inconnue).\n");
    exit(1);
}

echo "✅ Migration appliquée avec succès.\n";
echo "   Les membres archivés porteront désormais un timestamp `archived_at`.\n";
