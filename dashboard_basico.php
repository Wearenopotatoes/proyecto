<!-- dashboard.php -->
<!DOCTYPE html>
<html>
<head>
    <title>Dashboard de Alertas LoRa</title>
    <style>
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Alertas Recibidas</h1>
    <table>
        <tr>
            <th>Hora</th>
            <th>Tipo</th>
            <th>Dispositivo</th>
            <th>Latitud</th>
            <th>Longitud</th>
        </tr>
        <?php
        $file = fopen("alertas.csv", "r");
        $first = true;
        while (($data = fgetcsv($file)) !== FALSE) {
            if ($first) { $first = false; continue; } // omitir encabezado
            echo "<tr>";
            foreach ($data as $cell) {
                echo "<td>" . htmlspecialchars($cell) . "</td>";
            }
            echo "</tr>";
        }
        fclose($file);
        ?>
    </table>
</body>
</html>