from machine import SPI, Pin
from sx126x import SX126x  # Asegúrate de tener esta librería cargada
import ujson
import time

# 🛠️ Inicializar SPI y LoRa
spi = SPI(1, baudrate=1000000, polarity=0, phase=0,
          sck=Pin(12), mosi=Pin(11), miso=Pin(13))

lora = SX126x(spi=spi,
              cs=Pin(10),
              reset=Pin(9),
              busy=Pin(14),
              dio1=Pin(8))

lora.begin(freq=915E6)

# 🔁 Enviar 4 mensajes simulados
cnt = 0
while cnt < 4:
    # 1️⃣ Crear el diccionario con los datos
    alerta = {
        "tipo": "Alerta",
        "dispositivo": "a1",
        "gps": [13.6929, -89.2182]  # Coordenadas simuladas
    }

    # 2️⃣ Convertir el diccionario a string JSON
    mensaje_json = ujson.dumps(alerta)

    # 3️⃣ Enviar el string por LoRa
    lora.send(mensaje_json)
    print("Mensaje enviado:", mensaje_json)

    cnt += 1
    time.sleep(2)  # ⏱️ Espera entre envíos
