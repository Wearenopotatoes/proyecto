# sx126x.py para LoRa
from machine import Pin, SPI
import time

class SX126x:
    def __init__(self, spi, cs, reset, busy, dio1):
        self.spi = spi
        self.cs = cs
        self.reset = reset
        self.busy = busy
        self.dio1 = dio1

        self.cs.init(Pin.OUT, value=1)
        self.reset.init(Pin.OUT, value=1)
        self.busy.init(Pin.IN)
        self.dio1.init(Pin.IN)

    def reset_chip(self):
        self.reset.value(0)
        time.sleep_ms(10)
        self.reset.value(1)
        time.sleep_ms(10)
        while self.busy.value() == 1:
            time.sleep_ms(1)

    def write_command(self, opcode, data=[]):
        while self.busy.value() == 1:
            time.sleep_ms(1)
        self.cs.value(0)
        self.spi.write(bytearray([opcode]))
        if data:
            self.spi.write(bytearray(data))
        self.cs.value(1)
        while self.busy.value() == 1:
            time.sleep_ms(1)

    def begin(self, freq=915E6):
        self.reset_chip()
        self.write_command(0x80, [0x01])  # SetStandby
        self.write_command(0x8A, [0x01])  # SetPacketType: LoRa
        self.set_frequency(freq)
        print("LoRa iniciado en frecuencia", freq)

    def set_frequency(self, freq):
        frf = int((freq / 32e6) * (2**25))
        freq_bytes = [(frf >> 24) & 0xFF, (frf >> 16) & 0xFF, (frf >> 8) & 0xFF, frf & 0xFF]
        self.write_command(0x86, freq_bytes)

    def send(self, data):
        payload = list(data.encode())
        self.write_command(0x8C, [0x00, 0x00])  # SetBufferBaseAddress: TX=0, RX=0
        self.write_command(0x0E, payload)      # WriteBuffer
        self.write_command(0x83, [0x00, 0x00, 0x00])  # SetTx: timeout = 0 (no timeout)
        print("Mensaje enviado:", data)
