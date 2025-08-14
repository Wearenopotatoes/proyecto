# receptorV2.py  no envia Json a la raspberry 14/08/2025

from machine import Pin
import time

prg = Pin(0, Pin.IN, Pin.PULL_UP)

def run():
    print("Modo receptor activo. Presiona PRG para salir.")
    while prg.value() == 1:
        try:
            print("Escuchando...")
            time.sleep(2)
        except Exception as e:
            print("Error:", e)
            break
    print("Saliendo del modo receptor...")
