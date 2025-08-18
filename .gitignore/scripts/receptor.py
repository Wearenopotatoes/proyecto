from sx126x import SX126x
from machine import SPI, Pin, UART
import time

# Inicializar SPI y LoRa
spi = SPI(1, baudrate=1000000, polarity=0, phase=0,
          sck=Pin(12), mosi=Pin(11), miso=Pin(13))

lora = SX126x(spi=spi,
              cs=Pin(10),
              reset=Pin(9),
              busy=Pin(14),
              dio1=Pin(8))

lora.begin(freq=915E6)

# Inicializar UART
uart = UART(1, baudrate=9600, tx=Pin(17), rx=Pin(18))  # Ajusta pines según tu placa

# Bucle de recepción
while True:
    try:
        msg = lora.receive()
        if msg:
            print("Recibido:", msg)
            uart.write(msg + "\n")
    except Exception as e:
        print("Error al recibir LoRa:", e)
    time.sleep(5)

