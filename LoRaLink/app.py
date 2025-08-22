from flask import Flask, render_template, request, redirect, url_for
import json
from datetime import datetime

app = Flask(__name__)

DATA_FILE = "messages.json"

def load_messages():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_messages(messages):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(messages, f, indent=2, ensure_ascii=False)

@app.route("/")
def index():
    messages = load_messages()
    return render_template("index.html", messages=messages)

@app.route("/cambiar_estado/<int:msg_id>", methods=["POST"])
def cambiar_estado(msg_id):
    messages = load_messages()
    if 0 <= msg_id < len(messages):
        nuevo_estado = request.form.get("estado")
        if nuevo_estado in ["camino", "atendido"]:  # 🔥 Solo estos dos estados
            messages[msg_id]["status"] = nuevo_estado
            save_messages(messages)
    return redirect(url_for("index"))

# Ejemplo de ruta si agregas nuevas ubicaciones manualmente
@app.route("/nuevo", methods=["POST"])
def nuevo():
    messages = load_messages()
    descripcion = request.form.get("descripcion", "Accidente reportado")
    lat = float(request.form.get("lat", 13.6929))
    lng = float(request.form.get("lng", -89.2182))
    nuevo_mensaje = {
        "description": descripcion,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "lat": lat,
        "lng": lng,
        "status": "accidente"   # 🔴 Siempre inicia en accidente
    }
    messages.append(nuevo_mensaje)
    save_messages(messages)
    return redirect(url_for("index"))

if __name__ == "__main__":
    app.run(debug=True)
