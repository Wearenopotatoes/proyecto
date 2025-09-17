from flask import Flask, render_template

# Creamos la aplicación de Flask
app = Flask(__name__)

# Esta es la única ruta que necesitamos.
# Su única misión es encontrar y servir el archivo index.html.
@app.route('/')
def dashboard():
    """Sirve la página principal del dashboard (el esqueleto HTML)."""
    return render_template("index.html")

# Esto permite ejecutar el servidor directamente con "python app.py"
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
    
# aqui pueden ir otras páginas