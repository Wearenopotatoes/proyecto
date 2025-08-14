#mainV2.py
from machine import Pin
import time

# Configuración del botón PRG
prg = Pin(0, Pin.IN, Pin.PULL_UP)

def main():
    print("Sistema de selección de rol iniciado...")

    try:
        while True:
            print("Esperando selección de rol...")
            time.sleep(2)  # Delay para estabilizar lectura

            if prg.value() == 0:
                print("Botón PRG presionado → Modo EMISOR")
                import emisor
                emisor.run()
            else:
                print("Botón PRG no presionado → Modo RECEPTOR")
                import receptor
                receptor.run()

            print("Ciclo completado. Reiniciando selección en 10 segundos...")
            time.sleep(10)  # Espera antes de permitir nueva selección

    except Exception as e:
        print("Error en el sistema:", e)

main()
