#include <heltec_unofficial.h> // La nueva librería ayudante
#include <WiFi.h> // <-- LA LÍNEA QUE FALTABA

// --- Configuración de LoRa ---
// Asegúrate de que estos valores coincidan en el emisor y el receptor
#define FREQUENCY          915.0  // Frecuencia para América
#define BANDWIDTH          125.0  // Ancho de banda
#define SPREADING_FACTOR   9      // Factor de propagación
#define TRANSMIT_POWER     14     // Potencia de transmisión en dBm

// --- Configuración de Wi-Fi y Servidor ---
const char* ssid = "Red_Percances_ESP32";
const char* password = "password123";
const int puerto = 8080;
WiFiServer server(puerto);

void setup() {
  heltec_setup(); // Inicializa Serial, pantalla y pines de la placa
  
  both.println("Iniciando Placa Emisora (WiFi + LoRa)");

  // --- Inicializar la radio LoRa ---
  both.println("Inicializando RadioLib...");
  RADIOLIB_OR_HALT(radio.begin());
  radio.setFrequency(FREQUENCY);
  radio.setBandwidth(BANDWIDTH);
  radio.setSpreadingFactor(SPREADING_FACTOR);
  radio.setOutputPower(TRANSMIT_POWER);
  both.println("Radio LoRa configurada.");

  // --- Inicializar Wi-Fi ---
  WiFi.softAP(ssid, password);
  both.print("Access Point IP: ");
  both.println(WiFi.softAPIP());
  server.begin();
  both.print("Servidor Wi-Fi iniciado en el puerto: ");
  both.println(puerto);
}

void loop() {
  heltec_loop(); // Maneja el botón y otras funciones de la placa
  
  WiFiClient client = server.available();
  if (!client) {
    return;
  }

  both.println("\n¡Nuevo cliente Wi-Fi conectado!");
  while (client.connected()) {
    if (client.available()) {
      String jsonRecibido = client.readStringUntil('\r');
      both.print("JSON Recibido por Wi-Fi: ");
      both.println(jsonRecibido);

      both.print("Enviando paquete LoRa... ");
      
      // Enviar el paquete usando RadioLib
      int transmission_state = radio.transmit(jsonRecibido);

      if (transmission_state == RADIOLIB_ERR_NONE) {
        both.println("¡Éxito!");
      } else {
        both.printf("Falló, código de error: %i\n", transmission_state);
      }
      break;
    }
  }
  client.stop();
  both.println("Cliente Wi-Fi desconectado.");
}