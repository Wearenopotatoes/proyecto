from flask import Flask, render_template, request, jsonify, Response
import csv
import os
from datetime import datetime
import json
import secrets
import sqlite3 # Importamos sqlite3 para leer el archivo mbtiles

app = Flask(__name__)

# --- CONFIGURACIÓN ---
ALERTS_FILE = "reportes.csv"
UNITS_FILE = "units.json"
# ¡NUEVO! Ruta al archivo de mapa offline.
# Coloca tu archivo .mbtiles en la misma carpeta que este script.
MBTILES_FILE = "osm-2020-02-10-v3.11_central-america.mbtiles"
ALERTS_HEADERS = ["id", "timestamp", "tipo_accidente", "latitud", "longitud", "estado", "unidad"]

# --- Ruta para servir las teselas del mapa offline ---
@app.route('/tiles/<int:z>/<int:x>/<int:y>.png')
def serve_tile(z, x, y):
    # El formato mbtiles invierte la coordenada Y
    y = (2**z - 1) - y
    
    try:
        conn = sqlite3.connect(f'file:{MBTILES_FILE}?mode=ro', uri=True)
        cursor = conn.cursor()
        # Buscamos la tesela en la base de datos
        cursor.execute("SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?", (z, x, y))
        tile_data = cursor.fetchone()
        conn.close()

        if tile_data:
            # Si encontramos la tesela, la enviamos como una imagen PNG
            return Response(tile_data[0], mimetype='image/png')
        else:
            # Si no se encuentra, devolvemos un 404 (opcional, podrías devolver una imagen vacía)
            return "Tile not found", 404
            
    except sqlite3.OperationalError:
        print(f"ERROR: No se pudo encontrar o leer el archivo '{MBTILES_FILE}'. Asegúrate de que esté en la misma carpeta que app.py.")
        return "MBTiles file not found", 500
    except Exception as e:
        print(f"Error sirviendo la tesela: {e}")
        return "Server error", 500

# --- El resto de tu aplicación (sin cambios) ---

def load_alerts_from_csv(path):
    alerts = []
    if not os.path.exists(path): return []
    with open(path, mode='r', newline='', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            try:
                if not all(k in row and row[k] for k in ['id', 'timestamp', 'latitud', 'longitud']): continue
                alert = {
                    "id": row["id"], "type": row.get("tipo_accidente"),
                    "timestamp": datetime.fromtimestamp(int(row["timestamp"])).strftime("%H:%M:%S"),
                    "lat": float(row["latitud"]), "lon": float(row["longitud"]),
                    "status": row.get("estado", "accidente"),
                    "units": row.get("unidad", "").split('|') if row.get("unidad") else []
                }
                alerts.append(alert)
            except (ValueError, TypeError, KeyError):
                continue
    return alerts

def save_alerts_to_csv(path, alerts_data):
    with open(path, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.DictWriter(file, fieldnames=ALERTS_HEADERS)
        writer.writeheader()
        for alert in alerts_data:
            try:
                original_timestamp = alert["id"].split('_')[0]
                row = {
                    "id": alert["id"], "timestamp": original_timestamp,
                    "tipo_accidente": alert["type"], "latitud": alert["lat"],
                    "longitud": alert["lon"], "estado": alert["status"],
                    "unidad": '|'.join(alert.get("units", []))
                }
                writer.writerow(row)
            except:
                continue

def load_json(path, default):
    if not os.path.exists(path): return default
    with open(path, 'r', encoding='utf-8') as f: return json.load(f)

def save_json(path, data):
    with open(path, 'w', encoding='utf-8') as f: json.dump(data, f, indent=4)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/dashboard_data")
def get_dashboard_data():
    alerts = load_alerts_from_csv(ALERTS_FILE)
    units = load_json(UNITS_FILE, [])
    alerts.sort(key=lambda x: x.get('id', '0').split('_')[0], reverse=True)
    return jsonify({"alerts": alerts, "units": units})

@app.route("/assign_unit", methods=["POST"])
def assign_unit():
    data = request.get_json()
    alert_id, unit_name = data.get("alert_id"), data.get("unit_name")
    alerts, units = load_alerts_from_csv(ALERTS_FILE), load_json(UNITS_FILE, [])
    target_alert = next((a for a in alerts if a["id"] == alert_id), None)
    target_unit = next((u for u in units if u["name"] == unit_name), None)
    if target_alert and target_unit:
        target_alert["units"].append(unit_name)
        target_alert["status"] = "en_camino"
        target_unit["available"] = False
        save_alerts_to_csv(ALERTS_FILE, alerts)
        save_json(UNITS_FILE, units)
        return jsonify({"status": "ok"})
    return jsonify({"status": "error"}), 404

@app.route("/update_alert_status", methods=["POST"])
def update_alert_status():
    data = request.get_json()
    alert_id, new_status = data.get("alert_id"), data.get("status")
    alerts = load_alerts_from_csv(ALERTS_FILE)
    target_alert = next((a for a in alerts if a["id"] == alert_id), None)
    if target_alert:
        target_alert["status"] = new_status
        if new_status == "resuelto":
            units = load_json(UNITS_FILE, [])
            for unit_name in target_alert["units"]:
                unit = next((u for u in units if u["name"] == unit_name), None)
                if unit: unit["available"] = True
            save_json(UNITS_FILE, units)
        save_alerts_to_csv(ALERTS_FILE, alerts)
        return jsonify({"status": "ok"})
    return jsonify({"status": "error"}), 404

@app.route("/clear_alerts", methods=["DELETE"])
def clear_alerts():
    with open(ALERTS_FILE, mode='w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(ALERTS_HEADERS)
    units = load_json(UNITS_FILE, [])
    for unit in units:
        if isinstance(unit, dict): unit['available'] = True
    save_json(UNITS_FILE, units)
    return jsonify({"status": "cleared"})

if __name__ == "__main__":
    # Verifica si el archivo mbtiles existe antes de arrancar
    if not os.path.exists(MBTILES_FILE):
        print("="*60)
        print(f"ADVERTENCIA: El archivo de mapa '{MBTILES_FILE}' no se encontró.")
        print("La capa de mapa offline no funcionará. Asegúrate de que el")
        print("archivo esté en la misma carpeta que app.py.")
        print("="*60)
    app.run(host="0.0.0.0", port=5000, debug=True)