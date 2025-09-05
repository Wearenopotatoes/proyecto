from flask import Flask, jsonify, render_template, request
import csv
import json
import os

app = Flask(__name__)

# Nombres de nuestros archivos de datos
ARCHIVO_CSV = 'reportes.csv'
ARCHIVO_ESTADOS_JSON = 'estados.json'
ARCHIVO_UNIDADES_JSON = 'units.json'

# --- Funciones de Ayuda ---
def leer_estados():
    """Lee el archivo de estados y lo devuelve como un diccionario."""
    if not os.path.exists(ARCHIVO_ESTADOS_JSON):
        return {}
    try:
        with open(ARCHIVO_ESTADOS_JSON, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return {}

def escribir_estados(estados):
    """Escribe el diccionario de estados en el archivo JSON."""
    with open(ARCHIVO_ESTADOS_JSON, 'w', encoding='utf-8') as f:
        json.dump(estados, f, indent=4)

# --- Rutas de la Aplicación ---

@app.route('/')
def dashboard():
    """Sirve la página principal del dashboard."""
    return render_template('index.html')

@app.route('/units.json')
def obtener_unidades():
    """Sirve la lista de unidades desde units.json."""
    try:
        with open(ARCHIVO_UNIDADES_JSON, 'r', encoding='utf-8') as f:
            unidades = json.load(f)
            return jsonify(unidades)
    except FileNotFoundError:
        return jsonify([])

@app.route('/api/datos')
def obtener_datos():
    """Lee los reportes del CSV, les añade su estado/unidad y los devuelve."""
    estados = leer_estados()
    reportes = []
    try:
        with open(ARCHIVO_CSV, mode='r', newline='', encoding='utf-8') as csv_file:
            csv_reader = csv.DictReader(csv_file)
            for fila in csv_reader:
                reporte_id = fila.get('timestamp')
                if reporte_id:
                    estado_info = estados.get(reporte_id, {})
                    fila['estado'] = estado_info.get('estado', 'Nuevo')
                    fila['unidad'] = estado_info.get('unidad', 'Sin asignar')
                    reportes.append(fila)
    except FileNotFoundError:
        return jsonify([])
    return jsonify(sorted(reportes, key=lambda x: x.get('timestamp', '0'), reverse=True))

@app.route('/api/actualizar_estado', methods=['POST'])
def actualizar_estado():
    """Actualiza el estado y/o la unidad de un reporte."""
    data = request.json
    reporte_id = data.get('id')
    nuevo_estado = data.get('estado')
    unidad_asignada = data.get('unidad')

    if not reporte_id or not nuevo_estado:
        return jsonify({'error': 'Faltan datos'}), 400

    estados = leer_estados()
    estado_actual = estados.get(reporte_id, {})
    estado_actual['estado'] = nuevo_estado
    if unidad_asignada:
        estado_actual['unidad'] = unidad_asignada
    
    estados[reporte_id] = estado_actual
    escribir_estados(estados)
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)