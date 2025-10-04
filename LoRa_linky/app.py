from flask import Flask, render_template, jsonify
from datetime import datetime
import pytz 

app = Flask(__name__)

# Configuración de zona horaria
TIMEZONE = pytz.timezone('America/El_Salvador')  # GMT-6

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
    app.run(debug=True, host="0.0.0.0", port=5000)