from flask import Flask, render_template, request, jsonify
import csv
import os
from datetime import datetime
import json

app = Flask(__name__)

ALERTS_FILE = "reportes.csv"
UNITS_FILE = "units.json"
ALERTS_HEADERS = ["timestamp", "tipo_accidente", "latitud", "longitud", "estado", "unidad"]

# ---------- helpers ----------
def load_alerts_from_csv(path):
    """Carga las alertas desde un CSV y convierte las unidades en una lista."""
    alerts = []
    if not os.path.exists(path):
        return alerts
    try:
        with open(path, mode='r', newline='', encoding='utf-8') as csv_file:
            csv_reader = csv.DictReader(csv_file)
            for row in csv_reader:
                # Convertir el texto de unidades (separado por '|') en una lista.
                units_str = row.get("unidad", "")
                unit_list = units_str.split('|') if units_str and units_str != "None" else []
                
                alert = {
                    "id": row.get("timestamp"),
                    "type": row.get("tipo_accidente"),
                    "timestamp": datetime.fromtimestamp(int(row.get("timestamp"))).strftime("%Y-%m-%d %H:%M:%S") if row.get("timestamp") else None,
                    "lat": float(row.get("latitud")) if row.get("latitud") else None,
                    "lon": float(row.get("longitud")) if row.get("longitud") else None,
                    "status": row.get("estado", "accidente"),
                    "unit_assigned": unit_list # Ahora es una lista
                }
                alerts.append(alert)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return []
    return alerts

def save_alerts_to_csv(path, alerts):
    """Guarda las alertas en un CSV, uniendo la lista de unidades en un texto."""
    with open(path, mode='w', newline='', encoding='utf--8') as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=ALERTS_HEADERS)
        writer.writeheader()
        for alert in alerts:
            # Unir la lista de unidades en un solo string separado por '|'.
            unit_list = alert.get("unit_assigned", [])
            units_str = "|".join(unit_list) if unit_list else None

            row = {
                "timestamp": alert.get("id"),
                "tipo_accidente": alert.get("type"),
                "latitud": alert.get("lat"),
                "longitud": alert.get("lon"),
                "estado": alert.get("status"),
                "unidad": units_str
            }
            writer.writerow(row)

def load_json(path, default):
    if not os.path.exists(path): return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return default

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def get_unit(units, name):
    for u in units:
        if isinstance(u, dict) and u.get("name") == name:
            return u
    return None

# ---------- routes ----------

@app.route("/api/dashboard_data")
def dashboard_data():
    alerts = load_alerts_from_csv(ALERTS_FILE)
    units = load_json(UNITS_FILE, [])
    sorted_alerts = sorted(alerts, key=lambda x: x.get('id', '0'), reverse=True)
    return jsonify({"alerts": sorted_alerts, "units": units})

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/assign_unit", methods=["POST"])
def assign_unit():
    data = request.get_json(force=True)
    alert_id = data.get("alert_id")
    unit_name = data.get("unit_name")

    alerts = load_alerts_from_csv(ALERTS_FILE)
    units = load_json(UNITS_FILE, [])

    alert = next((a for a in alerts if a.get("id") == alert_id), None)
    if not alert: return jsonify({"error": "alert not found"}), 404
    unit = get_unit(units, unit_name)
    if not unit: return jsonify({"error": "unit not found"}), 404
    if not unit.get("available", True): return jsonify({"error": "unit not available"}), 400
    
    if unit_name not in alert["unit_assigned"]:
        alert["unit_assigned"].append(unit_name)
    
    alert["status"] = "en_camino"
    unit["available"] = False

    save_alerts_to_csv(ALERTS_FILE, alerts)
    save_json(UNITS_FILE, units)
    return jsonify({"status": "ok"})

@app.route("/mark_attended", methods=["POST"])
def mark_attended():
    data = request.get_json(force=True)
    alert_id = data.get("alert_id")

    alerts = load_alerts_from_csv(ALERTS_FILE)
    units = load_json(UNITS_FILE, [])

    alert = next((a for a in alerts if a.get("id") == alert_id), None)
    if not alert: return jsonify({"error": "alert not found"}), 404

    assigned_units = alert.get("unit_assigned", [])
    if isinstance(assigned_units, list):
        for unit_name in assigned_units:
            unit_to_release = get_unit(units, unit_name)
            if unit_to_release:
                unit_to_release["available"] = True

    alert["status"] = "atendido"
    
    save_alerts_to_csv(ALERTS_FILE, alerts)
    save_json(UNITS_FILE, units)
    return jsonify({"status": "ok"})

@app.route("/delete_alert/<alert_id>", methods=["DELETE"])
def delete_alert(alert_id):
    alerts = load_alerts_from_csv(ALERTS_FILE)
    alerts = [a for a in alerts if a.get("id") != alert_id]
    save_alerts_to_csv(ALERTS_FILE, alerts)
    return jsonify({"status": "deleted"})

@app.route("/clear_alerts", methods=["DELETE"])
def clear_alerts():
    units = load_json(UNITS_FILE, [])
    for u in units:
        if isinstance(u, dict):
            u["available"] = True
    save_json(UNITS_FILE, units)
    save_alerts_to_csv(ALERTS_FILE, [])
    return jsonify({"status": "cleared"})

@app.route("/update_unit_location", methods=["POST"])
def update_unit_location():
    data = request.get_json(force=True)
    name = data.get("name")
    lat = data.get("lat")
    lon = data.get("lon")
    units = load_json(UNITS_FILE, [])
    unit = next((u for u in units if isinstance(u, dict) and u.get("name") == name), None)
    if not unit:
        units.append({"name": name, "available": True, "lat": lat, "lon": lon})
    else:
        unit["lat"] = lat
        unit["lon"] = lon
    save_json(UNITS_FILE, units)
    return jsonify({"status": "ok"})

@app.route("/add_alert", methods=["POST"])
def add_alert():
    data = request.get_json(force=True)
    alerts = load_alerts_from_csv(ALERTS_FILE)
    new_id = str(int(datetime.now().timestamp()))
    alert = {
        "id": new_id,
        "type": data.get("type", "tipo_accidente"),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "lat": float(data.get("lat")) if data.get("lat") is not None else None,
        "lon": float(data.get("lon")) if data.get("lon") is not None else None,
        "status": data.get("status", "accidente"),
        "unit_assigned": [] # Empieza como una lista vacía
    }
    alerts.append(alert)
    save_alerts_to_csv(ALERTS_FILE, alerts)
    return jsonify({"status": "ok", "id": new_id})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)