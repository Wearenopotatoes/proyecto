from flask import Flask, render_template, jsonify, Response
from datetime import datetime
import pytz
import sqlite3
import os

app = Flask(__name__)

# Configuración de zona horaria
TIMEZONE = pytz.timezone('America/El_Salvador')  # GMT-6

# Configuración del archivo mbtiles
MBTILES_FILE = "osm-2020-02-10-v3.11_central-america.mbtiles"

# --- Ruta para servir las teselas del mapa offline ---
@app.route('/tiles/<int:z>/<int:x>/<int:y>.pbf')
def serve_tile_pbf(z, x, y):
    """
    Sirve teselas vectoriales en formato PBF desde el archivo .mbtiles
    """
    # Convertir de esquema XYZ a TMS
    y_tms = (2**z - 1) - y
    
    try:
        conn = sqlite3.connect(f'file:{MBTILES_FILE}?mode=ro', uri=True)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
            (z, x, y_tms)
        )
        tile_data = cursor.fetchone()
        conn.close()

        if tile_data:
            # Teselas vectoriales usan gzip
            return Response(
                tile_data[0],
                mimetype='application/x-protobuf',
                headers={
                    'Content-Encoding': 'gzip',
                    'Content-Type': 'application/x-protobuf'
                }
            )
        else:
            return '', 204
            
    except Exception as e:
        print(f"Error sirviendo tesela {z}/{x}/{y}: {e}")
        return "Server error", 500

@app.route('/tiles/<int:z>/<int:x>/<int:y>.png')
def serve_tile_png(z, x, y):
    """
    Fallback para teselas PNG (si las hubiera)
    """
    y_tms = (2**z - 1) - y
    
    try:
        conn = sqlite3.connect(f'file:{MBTILES_FILE}?mode=ro', uri=True)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
            (z, x, y_tms)
        )
        tile_data = cursor.fetchone()
        conn.close()

        if tile_data:
            return Response(tile_data[0], mimetype='image/png')
        else:
            return '', 204
            
    except Exception as e:
        print(f"Error sirviendo tesela PNG {z}/{x}/{y}: {e}")
        return "Server error", 500

@app.route('/tiles/info')
def tiles_info():
    """Endpoint para obtener información sobre el archivo mbtiles"""
    try:
        conn = sqlite3.connect(f'file:{MBTILES_FILE}?mode=ro', uri=True)
        cursor = conn.cursor()
        
        # Obtener metadatos
        cursor.execute("SELECT name, value FROM metadata")
        metadata = dict(cursor.fetchall())
        
        # Obtener estadísticas de teselas
        cursor.execute("SELECT COUNT(*) FROM tiles")
        total_tiles = cursor.fetchone()[0]
        
        cursor.execute("SELECT DISTINCT zoom_level FROM tiles ORDER BY zoom_level")
        zoom_levels = [row[0] for row in cursor.fetchall()]
        
        # Obtener muestra de teselas por zoom
        tiles_by_zoom = {}
        for zoom in zoom_levels:
            cursor.execute("SELECT COUNT(*) FROM tiles WHERE zoom_level = ?", (zoom,))
            tiles_by_zoom[zoom] = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify({
            'metadata': metadata,
            'total_tiles': total_tiles,
            'zoom_levels': zoom_levels,
            'tiles_by_zoom': tiles_by_zoom
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def index():
    """Página de bienvenida."""
    return render_template("index.html")

@app.route('/dashboard.html')
def dashboard():
    """Dashboard principal de emergencias."""
    return render_template("dashboard.html")

@app.route('/units.html')
def units_management():
    """Gestión de unidades de emergencia."""
    return render_template("units.html")

@app.route('/analytics.html')
def analytics():
    """Dashboard de analíticas y métricas."""
    return render_template("analytics.html")

@app.route('/offline.html')
def dashboard_offline():
    """Dashboard offline independiente."""
    return render_template("dashboard_offline.html")

@app.route('/api/server-time')
def get_server_time():
    """Endpoint para sincronizar tiempo del servidor."""
    now = datetime.now(TIMEZONE)
    return jsonify({
        'timestamp': now.isoformat(),
        'formatted': now.strftime('%H:%M:%S'),
        'date': now.strftime('%d/%m/%Y'),
        'timezone': 'GMT-6'
    })

@app.errorhandler(404)
def not_found(error):
    return render_template('404.html'), 404

if __name__ == "__main__":
    # Verificar que el archivo mbtiles existe
    if not os.path.exists(MBTILES_FILE):
        print("\n" + "="*70)
        print("⚠️  ADVERTENCIA: Archivo de mapa no encontrado")
        print("="*70)
        print(f"No se encontró el archivo: {MBTILES_FILE}")
        print(f"Ubicación esperada: {os.path.abspath(MBTILES_FILE)}")
        print("\nPor favor coloca el archivo .mbtiles en la raíz del proyecto.")
        print("El mapa offline NO funcionará hasta que lo agregues.")
        print("="*70 + "\n")
    else:
        print("\n" + "="*70)
        print("✅ Archivo de mapa offline encontrado")
        print("="*70)
        print(f"Archivo: {MBTILES_FILE}")
        print(f"Tamaño: {os.path.getsize(MBTILES_FILE) / (1024*1024):.2f} MB")
        
        # Verificar contenido del mbtiles
        try:
            conn = sqlite3.connect(f'file:{MBTILES_FILE}?mode=ro', uri=True)
            cursor = conn.cursor()
            cursor.execute("SELECT name, value FROM metadata")
            metadata = dict(cursor.fetchall())
            cursor.execute("SELECT COUNT(*) FROM tiles")
            tile_count = cursor.fetchone()[0]
            cursor.execute("SELECT MIN(zoom_level), MAX(zoom_level) FROM tiles")
            zoom_range = cursor.fetchone()
            conn.close()
            
            print(f"Formato: {metadata.get('format', 'desconocido')}")
            print(f"Teselas: {tile_count}")
            print(f"Zoom: {zoom_range[0]} - {zoom_range[1]}")
            print(f"Bounds: {metadata.get('bounds', 'no especificado')}")
        except Exception as e:
            print(f"⚠️  Error al leer metadatos: {e}")
        
        print("="*70 + "\n")
    
    print("="*70)
    print(" LoRaLink Dashboard - Servidor iniciado")
    print("="*70)
    print(" Inicio:            http://localhost:5000/")
    print("🔵 Dashboard Online:  http://localhost:5000/dashboard.html")
    print("🔴 Dashboard Offline: http://localhost:5000/offline.html")
    print(" Unidades:          http://localhost:5000/units.html")
    print("📊 Analytics:         http://localhost:5000/analytics.html")
    print("🗺️  Teselas PBF:      http://localhost:5000/tiles/{z}/{x}/{y}.pbf")
    print("🗺️  Teselas PNG:      http://localhost:5000/tiles/{z}/{x}/{y}.png")
    print("ℹ️  Info del mapa:    http://localhost:5000/tiles/info")
    print("="*70 + "\n")
    
    app.run(debug=True, host="0.0.0.0", port=5000)