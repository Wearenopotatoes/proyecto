from flask import Flask, render_template, request, jsonify
import json
import os
from datetime import datetime

app = Flask(__name__)

ALERTS_FILE = "alerts.json"
UNITS_FILE = "units.json"

# ---------- helpers ----------
def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

def get_unit(units, name):
    for u in units:
        if u["name"] == name:
            return u
    return None

# ---------- routes ----------
@app.route("/")
def index():
    alerts = load_json(ALERTS_FILE, [])
    units = load_json(UNITS_FILE, [])
    alerts_sorted = sorted(alerts, key=lambda x: x.get("id", 0))
    return render_template("index.html", alerts=alerts_sorted, units=units)

@app.route("/assign_unit", methods=["POST"])
def assign_unit():
    data = request.get_json(force=True)
    alert_id = int(data.get("alert_id"))
    unit_name = data.get("unit_name")

    alerts = load_json(ALERTS_FILE, [])
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

    save_json(ALERTS_FILE, alerts)
    save_json(UNITS_FILE, units)
    return jsonify({"status": "ok"})

@app.route("/mark_attended", methods=["POST"])
def mark_attended():
    data = request.get_json(force=True)
    alert_id = int(data.get("alert_id"))

    alerts = load_json(ALERTS_FILE, [])
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

    save_json(ALERTS_FILE, alerts)
    save_json(UNITS_FILE, units)
    return jsonify({"status": "ok"})

@app.route("/delete_alert/<int:alert_id>", methods=["DELETE"])
def delete_alert(alert_id):
    alerts = load_json(ALERTS_FILE, [])
    alerts = [a for a in alerts if a.get("id") != alert_id]
    save_json(ALERTS_FILE, alerts)
    return jsonify({"status": "deleted"})

@app.route("/clear_alerts", methods=["DELETE"])
def clear_alerts():
    units = load_json(UNITS_FILE, [])
    for u in units:
        u["available"] = True
    save_json(UNITS_FILE, units)
    save_json(ALERTS_FILE, [])
    return jsonify({"status": "cleared"})

@app.route("/update_unit_location", methods=["POST"])
def update_unit_location():
    data = request.get_json(force=True)
    name = data.get("name")
    lat = data.get("lat")
    lon = data.get("lon")
    units = load_json(UNITS_FILE, [])
    unit = next((u for u in units if u["name"] == name), None)
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
    alerts = load_json(ALERTS_FILE, [])
    new_id = (max([a.get("id", 0) for a in alerts]) + 1) if alerts else 1
    alert = {
        "id": new_id,
        "type": data.get("type", "Accidente"),
        "timestamp": data.get("timestamp") or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "lat": float(data.get("lat")) if data.get("lat") is not None else None,
        "lon": float(data.get("lon")) if data.get("lon") is not None else None,
        "status": data.get("status", "accidente"),
        "unit_assigned": None
    }
    alerts.append(alert)
    save_json(ALERTS_FILE, alerts)
    return jsonify({"status": "ok", "id": new_id})

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
