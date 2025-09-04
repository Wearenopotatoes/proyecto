#include <heltec_unofficial.h> // Para la placa Heltec
#include <ArduinoJson.h>      // Para crear el paquete de datos
#include <TinyGPS++.h>        // Para decodificar datos del GPS
#include <HardwareSerial.h>     // Para la comunicación con el GPS

// --- Configuración LoRa ---
#define HELTEC_POWER_BUTTON
long counter = 0;
const uint32_t TX_INTERVAL = 5000; // Intervalo de 5 segundos
uint32_t nextTxTime = 0;

// --- Configuración GPS ---
// Asigna los pines que usarás para conectar el GPS al ESP32
static const int RXPin = 44, TXPin = 43;
static const uint32_t GPSBaud = 9600;

// Objeto de la librería TinyGPS++
TinyGPSPlus gps;

// Usamos el puerto serie por hardware 1 (UART 1) para el GPS
HardwareSerial ss(1);

void setup() {
  // Inicia la placa Heltec (pantalla, etc.)
  heltec_setup();

  // Inicia la comunicación con el GPS
  ss.begin(GPSBaud, SERIAL_8N1, RXPin, TXPin);
  both.println("Esperando datos del GPS...");

  // Inicia el radio LoRa
  RADIOLIB_OR_HALT(radio.begin());
  radio.setFrequency(915.0);
  radio.setBandwidth(250.0);
  radio.setSpreadingFactor(9);
  radio.setOutputPower(14);

  both.println("Emisor LoRa con GPS listo");
}

void loop() {
  // Tareas de fondo de la placa Heltec
  heltec_loop();

  // --- Tarea 1: Leer el GPS constantemente ---
  // Esto mantiene los datos del GPS actualizados en segundo plano.
  while (ss.available() > 0) {
    gps.encode(ss.read());
  }

  // --- Tarea 2: Enviar datos por LoRa periódicamente ---
  if (millis() >= nextTxTime || button.isSingleClick()) {
    both.print("Enviando paquete... ");

    // Aumentamos el tamaño para que quepan los datos del GPS
    StaticJsonDocument<256> txDoc;
    char txBuf[256];

    // Añade los datos del contador, batería y uptime
    txDoc["seq"]     = counter++;
    txDoc["battery"] = analogRead(35) * (3.3 / 4095) * 2;
    txDoc["uptime"]  = millis() / 1000;

    // Añade los datos del GPS si son válidos
    if (gps.location.isValid()) {
      txDoc["lat"] = gps.location.lat();
      txDoc["lng"] = gps.location.lng();
    } else {
      // Si no hay datos válidos, envía 0.0 o null
      txDoc["lat"] = 0.0;
      txDoc["lng"] = 0.0;
    }

    // Serializa el JSON a un buffer de texto
    size_t len = serializeJson(txDoc, txBuf, sizeof(txBuf));

    // Transmite el paquete
    int16_t status = radio.transmit(txBuf, len);
    if (status == RADIOLIB_ERR_NONE) {
      both.printf("¡Éxito! -> %s\n", txBuf);
    } else {
      both.printf("Error al enviar, código: %d\n", status);
    }

    // Programa la próxima transmisión
    nextTxTime = millis() + TX_INTERVAL;
  }
}