# emisorV2.py
from machine import SPI, Pin
from sx126x import SX126x
import ujson
import time

# 🛠️ Inicializar botón PRG para salir del modo
prg = Pin(0, Pin.IN, Pin.PULL_UP)

# 🛠️ Inicializar SPI y LoRa
spi = SPI(1, baudrate=1000000, polarity=0, phase=0,
          sck=Pin(12), mosi=Pin(11), miso=Pin(13))

lora = SX126x(spi=spi,
              cs=Pin(10),
              reset=Pin(9),
              busy=Pin(14),
              dio1=Pin(8))

lora.begin(freq=915E6)

def run():
    print("Modo emisor activo. Presiona PRG para salir.")
    cnt = 0

    while prg.value() == 0:
        alerta = {
            "tipo": "Alerta",
            "dispositivo": "a1",
            "gps": [13.6929, -89.2182]  # Coordenadas simuladas
        }

        mensaje_json = ujson.dumps(alerta)
        lora.send(mensaje_json)
        print("Mensaje enviado:", mensaje_json)

        cnt += 1
        time.sleep(2)

        if cnt >= 4:
            print("Se enviaron 4 mensajes. Esperando salida...")
            cnt = 0  # Reiniciar contador si deseas seguir enviando

    print("Saliendo del modo emisor...")
