import serial
import json
import time
import csv
import os

# --- CONFIGURACIÓN ---
PUERTO_SERIAL = 'COM7'  # Reemplaza con tu puerto COM
VELOCIDAD = 115200
NOMBRE_ARCHIVO_CSV = 'reportes.csv'

# Las columnas que tendrá nuestro archivo CSV
CSV_HEADER = ['timestamp', 'tipo_accidente', 'latitud', 'longitud']

print(f"Intentando conectar al puerto {PUERTO_SERIAL}...")

try:
    placa = serial.Serial(PUERTO_SERIAL, VELOCIDAD, timeout=1)
    time.sleep(2)
    print("¡Conexión exitosa! Esperando datos...")

    # --- Comprobar si el CSV necesita el encabezado ---
    file_exists = os.path.isfile(NOMBRE_ARCHIVO_CSV)
    if not file_exists:
        with open(NOMBRE_ARCHIVO_CSV, mode='w', newline='', encoding='utf-8') as csv_file:
            writer = csv.writer(csv_file)
            writer.writerow(CSV_HEADER)
        print(f"Archivo '{NOMBRE_ARCHIVO_CSV}' creado con encabezados.")

    # --- Bucle principal para leer datos ---
    while True:
        linea = placa.readline().decode('utf-8').strip()

        if linea and "Contenido:" in linea:
            json_str = linea.split("Contenido:")[1].strip()
            
            try:
                datos = json.loads(json_str)
                
                # Extraemos los datos del JSON
                timestamp = datos['t']
                tipo_accidente = datos['a']
                latitud = datos['lt']
                longitud = datos['ln']
                
                print(f"Dato recibido: a={tipo_accidente}, t={timestamp}, lat={latitud}, lon={longitud}")

                # --- Guardamos los datos en el archivo CSV ---
                with open(NOMBRE_ARCHIVO_CSV, mode='a', newline='', encoding='utf-8') as csv_file:
                    writer = csv.writer(csv_file)
                    writer.writerow([timestamp, tipo_accidente, latitud, longitud])
                
                print(f"-> Dato guardado en '{NOMBRE_ARCHIVO_CSV}'")

            except (json.JSONDecodeError, KeyError) as e:
                print(f"Error procesando el JSON: {e}")

except serial.SerialException as e:
    print(f"Error al abrir el puerto serial: {e}")