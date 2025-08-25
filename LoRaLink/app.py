from flask import Flask, render_template, jsonify
import json, os, uuid

app = Flask(__name__)
DATA_FILE = "messages.json"

def load_messages():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return []

def save_messages(messages):
    with open(DATA_FILE, "w") as f:
        json.dump(messages, f, indent=2)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/get_messages")
def get_messages():
    return jsonify(load_messages())

@app.route("/mark_atendido/<msg_id>", methods=["POST"])
def mark_atendido(msg_id):
    messages = load_messages()
    messages = [m for m in messages if m["id"] != msg_id]  # Eliminar
    save_messages(messages)
    return jsonify({"status": "ok"})

@app.route("/clear_messages", methods=["POST"])
def clear_messages():
    save_messages([])  # Borra todo
    return jsonify({"status": "cleared"})

if __name__ == "__main__":
    app.run(debug=True)
