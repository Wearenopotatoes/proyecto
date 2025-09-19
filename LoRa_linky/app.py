from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def dashboard():
    """Sirve la página principal del dashboard de emergencias."""
    return render_template("index.html")

# --- NUEVA RUTA PARA LA GESTIÓN DE UNIDADES ---
@app.route('/units')
def units_management():
    """Sirve la nueva página para gestionar las unidades."""
    return render_template("units.html")

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)