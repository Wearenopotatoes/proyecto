import serial
import json
import time
import csv
import os
import secrets  # Importamos secrets para generar un token aleatorio

# --- CONFIGURACIÓN ---
PUERTO_SERIAL = 'COM7'  # Reemplaza con tu puerto COM
VELOCIDAD = 115200
NOMBRE_ARCHIVO_CSV = 'reportes.csv'

# CAMBIO: Añadimos la columna 'id' al principio para el identificador único.
CSV_HEADER = ["id", "timestamp", "tipo_accidente", "latitud", "longitud", "estado", "unidad"]

print(f"Intentando conectar al puerto {PUERTO_SERIAL}...")

try:
    placa = serial.Serial(PUERTO_SERIAL, VELOCIDAD, timeout=1)
    time.sleep(2)
    print("¡Conexión exitosa! Esperando datos...")

    file_exists = os.path.isfile(NOMBRE_ARCHIVO_CSV)
    if not file_exists:
        with open(NOMBRE_ARCHIVO_CSV, mode='w', newline='', encoding='utf-8') as csv_file:
            writer = csv.writer(csv_file)
            writer.writerow(CSV_HEADER)
        print(f"Archivo '{NOMBRE_ARCHIVO_CSV}' creado con el nuevo encabezado.")

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

                # --- CAMBIO CLAVE: Generamos un ID único ---
                # Combinamos el timestamp con 4 bytes aleatorios en formato hexadecimal.
                # Ejemplo de ID: "1678886400_a1b2c3d4"
                unique_id = f"{timestamp}_{secrets.token_hex(4)}"

                # --- CAMBIO: Escribimos la fila completa con el nuevo ID ---
                nueva_fila = [unique_id, timestamp, tipo_accidente, latitud, longitud, "accidente", ""]

                with open(NOMBRE_ARCHIVO_CSV, mode='a', newline='', encoding='utf-8') as csv_file:
                    writer = csv.writer(csv_file)
                    writer.writerow(nueva_fila)
                
                print(f"-> Dato con ID '{unique_id}' guardado en '{NOMBRE_ARCHIVO_CSV}'")

            except (json.JSONDecodeError, KeyError) as e:
                print(f"Error procesando el JSON recibido: {e}")

except serial.SerialException as e:
    print(f"Error al abrir el puerto serial: {e}")
    print("Asegúrate de que el puerto COM sea correcto y que el dispositivo esté conectado.")

except KeyboardInterrupt:
    print("\nPrograma detenido por el usuario.")

finally:
    if 'placa' in locals() and placa.is_open:
        placa.close()
        print("Puerto serial cerrado.")