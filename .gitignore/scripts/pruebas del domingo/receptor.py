# receiver.py - Ejemplo de receptor LoRa
from machine import Pin, SPI
from sx126x import SX126x # Importa la nueva librería
import time

# --- CONFIGURACIÓN DE PINES ---
spi = SPI(1, baudrate=2000000, polarity=0, phase=0, sck=Pin(10), mosi=Pin(11), miso=Pin(12))
cs = Pin(9, Pin.OUT)
reset = Pin(17, Pin.OUT)
busy = Pin(13, Pin.IN)
dio1 = Pin(14, Pin.IN)

# --- INICIALIZACIÓN DEL MÓDULO LORA ---
lora = SX126x(spi, cs, reset, busy, dio1)

# Inicia el módulo con parámetros explícitos.
# ¡El transmisor debe usar EXACTAMENTE los mismos!
lora.begin(freq=915E6, sf=7, bw=125.0)

# --- BUCLE PRINCIPAL DE RECEPCIÓN ---
print("Modo recepción activado. Esperando mensajes...")
while True:
    mensaje_recibido = lora.receive(timeout_ms=10000) # Espera 10 segundos
    
    if mensaje_recibido:
        print("--- Mensaje Procesado ---")
        # Aquí puedes agregar tu lógica
    else:
        print("No se recibieron mensajes en el último ciclo.")
