from flask import Flask, render_template, request, redirect, url_for, jsonify
import json
import os
from datetime import datetime

app = Flask(__name__)
DATA_FILE = "messages.json"

# --- Utilidades ---
def load_messages():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return []
    return []

def save_messages(messages):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(messages, f, indent=4, ensure_ascii=False)

# --- Rutas web (dashboard) ---
@app.route("/")
def index():
    messages = load_messages()
    return render_template("index.html", messages=messages)

@app.route("/attend/<int:msg_id>", methods=["POST"])
def mark_as_attended(msg_id):
    messages = load_messages()
    if 0 <= msg_id < len(messages):
        messages[msg_id]["status"] = "atendida"
        save_messages(messages)
    return redirect(url_for("index"))

@app.route("/reset/<int:msg_id>", methods=["POST"])
def reset_message(msg_id):
    messages = load_messages()
    if 0 <= msg_id < len(messages):
        messages[msg_id]["status"] = "pendiente"
        save_messages(messages)
    return redirect(url_for("index"))

@app.route("/delete/<int:msg_id>", methods=["POST"])
def delete_message(msg_id):
    messages = load_messages()
    if 0 <= msg_id < len(messages):
        messages.pop(msg_id)
        save_messages(messages)
    return redirect(url_for("index"))

# --- API para recibir señales externas ---
@app.route("/receive", methods=["POST"])
def receive_message():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON recibido"}), 400

    messages = load_messages()
    new_message = {
        "content": data.get("content", "Mensaje sin descripción"),
        "timestamp": data.get("timestamp") or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": "pendiente",
        # Si no envían lat/lng, simulamos un punto en ES (San Salvador aprox.)
        "lat": float(data.get("lat", 13.713)),
        "lng": float(data.get("lng", -89.19))
    }
    messages.append(new_message)
    save_messages(messages)
    return jsonify({"message": "Mensaje recibido", "data": new_message}), 201

if __name__ == "__main__":
    # Cambia host/port si lo necesitas
    app.run(debug=True, host="0.0.0.0", port=5000)
