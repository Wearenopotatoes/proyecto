from flask import Flask, request, jsonify
import json
import os

app = Flask(__name__)

MESSAGES_FILE = "messages.json"

# Función para guardar mensajes en JSON
def save_message(message):
    messages = []
    if os.path.exists(MESSAGES_FILE):
        with open(MESSAGES_FILE, "r") as f:
            try:
                messages = json.load(f)
            except json.JSONDecodeError:
                messages = []
    messages.append(message)
    with open(MESSAGES_FILE, "w") as f:
        json.dump(messages, f, indent=4)

# Endpoint para recibir mensajes
@app.route('/data', methods=['POST'])
def receive_data():
    data = request.get_json()
    if not data:
        return jsonify({"status": "error", "message": "No se recibió JSON"}), 400

    save_message(data)
    print("Mensaje recibido:", data)
    return jsonify({"status": "ok", "received": data}), 200

# Endpoint opcional para chequear si está vivo
@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({"status": "alive"}), 200

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
