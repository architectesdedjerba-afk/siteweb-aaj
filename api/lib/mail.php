<?php
declare(strict_types=1);

/**
 * Minimal SMTP client — enough for transactional mail on cPanel
 * (no Composer/PHPMailer required). Supports STARTTLS and implicit TLS.
 */

function send_mail(string $toEmail, string $toName, string $subject, string $htmlBody, string $textBody = ''): bool
{
    global $CONFIG;
    $smtp = $CONFIG['smtp'];

    $host = $smtp['host'];
    $port = (int)$smtp['port'];
    $encryption = strtolower((string)($smtp['encryption'] ?? ''));
    $username = $smtp['username'];
    $password = $smtp['password'];
    $fromEmail = $smtp['from_email'];
    $fromName = $smtp['from_name'];

    $remote = $encryption === 'ssl' ? "ssl://$host:$port" : "$host:$port";

    $errno = 0; $errstr = '';
    $socket = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if (!$socket) {
        error_log("SMTP connect failed: $errstr ($errno)");
        return false;
    }
    stream_set_timeout($socket, 15);

    $read = function () use ($socket): string {
        $data = '';
        while (!feof($socket)) {
            $line = fgets($socket, 515);
            if ($line === false) break;
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') break;
        }
        return $data;
    };
    $cmd = function (string $c) use ($socket, $read): string {
        fwrite($socket, $c . "\r\n");
        return $read();
    };

    $read(); // greeting
    $cmd('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'));

    if ($encryption === 'tls') {
        $cmd('STARTTLS');
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            error_log('SMTP STARTTLS failed');
            fclose($socket);
            return false;
        }
        $cmd('EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost'));
    }

    if ($username) {
        $cmd('AUTH LOGIN');
        $cmd(base64_encode($username));
        $cmd(base64_encode($password));
    }

    $cmd("MAIL FROM:<$fromEmail>");
    $cmd("RCPT TO:<$toEmail>");
    $cmd('DATA');

    $boundary = 'aaj_' . bin2hex(random_bytes(8));
    $headers  = [];
    $headers[] = 'From: ' . mb_encode_mimeheader($fromName) . " <$fromEmail>";
    $headers[] = 'To: ' . ($toName !== '' ? (mb_encode_mimeheader($toName) . " <$toEmail>") : "<$toEmail>");
    $headers[] = 'Subject: ' . mb_encode_mimeheader($subject);
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Date: ' . date('r');
    $headers[] = "Content-Type: multipart/alternative; boundary=\"$boundary\"";

    $plain = $textBody !== '' ? $textBody : strip_tags($htmlBody);
    $body  = "--$boundary\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $plain . "\r\n";
    $body .= "--$boundary\r\n";
    $body .= "Content-Type: text/html; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
    $body .= $htmlBody . "\r\n";
    $body .= "--$boundary--\r\n";

    // Dot-stuffing
    $bodyEscaped = preg_replace('/^\./m', '..', $body);

    fwrite($socket, implode("\r\n", $headers) . "\r\n\r\n" . $bodyEscaped . "\r\n.\r\n");
    $resp = $read();
    $cmd('QUIT');
    fclose($socket);

    return strpos($resp, '250') === 0;
}
