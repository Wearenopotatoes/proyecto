#receotorV3.py
from machine import Pin, SPI
from sx126x import SX126x
import time

# Botón PRG
prg = Pin(0, Pin.IN, Pin.PULL_UP)

# SPI y LoRa
spi = SPI(1, baudrate=1000000, polarity=0, phase=0,
          sck=Pin(12), mosi=Pin(11), miso=Pin(13))

lora = SX126x(spi=spi,
              cs=Pin(10),
              reset=Pin(9),
              busy=Pin(14),
              dio1=Pin(8))

lora.begin(freq=915E6)

def run():
    print("Modo receptor activo. Presiona PRG para salir.")
    while prg.value() == 1:
        try:
            msg = lora.receive()
            if msg:
                print("📩 Mensaje recibido:", msg)
            else:
                print("⏳ Esperando datos LoRa...")
            time.sleep(1)
        except Exception as e:
            print("⚠️ Error en recepción:", e)
            break
    print("🔚 Saliendo del modo receptor...")

run()