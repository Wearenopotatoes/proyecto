# main.py
import machine

modo = machine.Pin(0, machine.Pin.IN, machine.Pin.PULL_UP)  # Botón en GPIO0

if modo.value() == 0:
    print("Modo EMISOR activado")
    import emisor
else:
    print("Modo RECEPTOR activado")
    import receptor
