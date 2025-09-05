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
    """Loads alerts from a CSV file."""
    alerts = []
    if not os.path.exists(path):
        return alerts
    try:
        with open(path, mode='r', newline='', encoding='utf-8') as csv_file:
            csv_reader = csv.DictReader(csv_file)
            for row in csv_reader:
                alert = {
                    "id": row.get("timestamp"),
                    "type": row.get("tipo_accidente"),
                    "timestamp": datetime.fromtimestamp(int(row.get("timestamp"))).strftime("%Y-%m-%d %H:%M:%S") if row.get("timestamp") else None,
                    "lat": float(row.get("latitud")) if row.get("latitud") else None,
                    "lon": float(row.get("longitud")) if row.get("longitud") else None,
                    "status": row.get("estado", "accidente"),
                    "unit_assigned": row.get("unidad", None)
                }
                alerts.append(alert)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return []
    return alerts

def save_alerts_to_csv(path, alerts):
    """Saves alerts to a CSV file."""
    with open(path, mode='w', newline='', encoding='utf-8') as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=ALERTS_HEADERS)
        writer.writeheader()
        for alert in alerts:
            row = {
                "timestamp": alert.get("id"),
                "tipo_accidente": alert.get("type"),
                "latitud": alert.get("lat"),
                "longitud": alert.get("lon"),
                "estado": alert.get("status"),
                "unidad": alert.get("unit_assigned")
            }
            writer.writerow(row)

def load_json(path, default):
    """Loads a JSON file, returning a default if it doesn't exist."""
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return default

def save_json(path, data):
    """Saves data to a JSON file."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def get_unit(units, name):
    """Finds a unit by its name."""
    for u in units:
        if isinstance(u, dict) and u.get("name") == name:
            return u
    return None

# ---------- routes ----------
@app.route("/")
def index():
    """Serves the main dashboard page."""
    alerts = load_alerts_from_csv(ALERTS_FILE)
    units = load_json(UNITS_FILE, [])
    return render_template("index.html", alerts=alerts, units=units)

@app.route("/assign_unit", methods=["POST"])
def assign_unit():
    """Assigns an available unit to an alert."""
    data = request.get_json(force=True)
    alert_id = data.get("alert_id")
    unit_name = data.get("unit_name")

    alerts = load_alerts_from_csv(ALERTS_FILE)
    units = load_json(UNITS_FILE, [])

    alert = next((a for a in alerts if a.get("id") == alert_id), None)
    if not alert:
        return jsonify({"error": "alert not found"}), 404

    unit = get_unit(units, unit_name)
    if not unit:
        return jsonify({"error": "unit not found"}), 404
    if not unit.get("available", True):
        return jsonify({"error": "unit not available"}), 400

    alert["status"] = "en_camino"
    alert["unit_assigned"] = unit_name
    unit["available"] = False

    save_alerts_to_csv(ALERTS_FILE, alerts)
    save_json(UNITS_FILE, units)
    return jsonify({"status": "ok"})

@app.route("/mark_attended", methods=["POST"])
def mark_attended():
    """Marks an alert as attended and makes the assigned unit available again."""
    data = request.get_json(force=True)
    alert_id = data.get("alert_id")

    alerts = load_alerts_from_csv(ALERTS_FILE)
    units = load_json(UNITS_FILE, [])

    alert = next((a for a in alerts if a.get("id") == alert_id), None)
    if not alert:
        return jsonify({"error": "alert not found"}), 404

    unit_name = alert.get("unit_assigned")
    if unit_name:
        unit = get_unit(units, unit_name)
        if unit:
            unit["available"] = True

    alert["status"] = "atendido"
    
    save_alerts_to_csv(ALERTS_FILE, alerts)
    save_json(UNITS_FILE, units)
    return jsonify({"status": "ok"})

@app.route("/delete_alert/<alert_id>", methods=["DELETE"])
def delete_alert(alert_id):
    """Deletes a specific alert by its ID."""
    alerts = load_alerts_from_csv(ALERTS_FILE)
    alerts = [a for a in alerts if a.get("id") != alert_id]
    save_alerts_to_csv(ALERTS_FILE, alerts)
    return jsonify({"status": "deleted"})

@app.route("/clear_alerts", methods=["DELETE"])
def clear_alerts():
    """Deletes all alerts and makes all units available."""
    units = load_json(UNITS_FILE, [])
    for u in units:
        if isinstance(u, dict):
            u["available"] = True
    save_json(UNITS_FILE, units)
    save_alerts_to_csv(ALERTS_FILE, [])
    return jsonify({"status": "cleared"})

@app.route("/update_unit_location", methods=["POST"])
def update_unit_location():
    """Updates the location of a unit or adds a new one."""
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
    """Adds a new alert to the system."""
    data = request.get_json(force=True)
    alerts = load_alerts_from_csv(ALERTS_FILE)
    new_id = str(int(datetime.now().timestamp()))
    alert = {
        "id": new_id,
        "type": data.get("type", "Accidente"),
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "lat": float(data.get("lat")) if data.get("lat") is not None else None,
        "lon": float(data.get("lon")) if data.get("lon") is not None else None,
        "status": data.get("status", "accidente"),
        "unit_assigned": None
    }
    alerts.append(alert)
    save_alerts_to_csv(ALERTS_FILE, alerts)
    return jsonify({"status": "ok", "id": new_id})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)