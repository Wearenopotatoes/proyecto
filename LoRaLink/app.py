# app.py

from flask import Flask, render_template, request, redirect
import json
from datetime import datetime

# Crear la aplicación Flask
app = Flask(__name__)

# Ruta principal que muestra los mensajes
@app.route('/')
def index():
    # Cargar mensajes desde el archivo JSON
    try:
        with open('messages.json', 'r') as f:
            messages = json.load(f)
    except FileNotFoundError:
        messages = []

    # Renderizar la plantilla HTML y pasarle los mensajes
    return render_template('index.html', messages=messages)

# Ruta para enviar un nuevo mensaje
@app.route('/send', methods=['POST'])
def send():
    # Obtener datos del formulario
    sender = request.form['sender']
    content = request.form['content']
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    # Crear el nuevo mensaje
    new_message = {
        'sender': sender,
        'content': content,
        'timestamp': timestamp
    }

    # Cargar mensajes existentes
    try:
        with open('messages.json', 'r') as f:
            messages = json.load(f)
    except FileNotFoundError:
        messages = []

    # Agregar el nuevo mensaje
    messages.append(new_message)

    # Guardar los mensajes actualizados
    with open('messages.json', 'w') as f:
        json.dump(messages, f, indent=4)

    # Redirigir al inicio
    return redirect('/')
    
# Ejecutar la app
if __name__ == '__main__':
    app.run(debug=True)