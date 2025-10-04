from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    """Sirve la página principal."""
    return render_template("index.html")

@app.route('/dashboard.html')
def dashboard():
    """Sirve la página principal del dashboard de emergencias."""
    return render_template("dashboard.html")

# --- RUTA PARA LA GESTIÓN DE UNIDADES ---
@app.route('/units.html')
def units_management():
    """Sirve la página para gestionar las unidades."""
    return render_template("units.html")



if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)