#include "LoRaWan_APP.h"
#include <WiFi.h>

// --- Configuración de Wi-Fi y Servidor ---
const char* ssid = "Red_Percances_ESP32";
const char* password = "reporte1";
const int puerto = 8080;
WiFiServer server(puerto);

// --- Configuración de LoRa (del ejemplo) ---
#define RF_FREQUENCY          915000000 // 915 MHz en Hz
#define TX_OUTPUT_POWER       14        // Potencia de transmisión en dBm
#define LORA_BANDWIDTH        0         // 0: 125 kHz
#define LORA_SPREADING_FACTOR 7         // SF7
#define LORA_CODINGRATE       1         // 1: 4/5
#define LORA_PREAMBLE_LENGTH  8
#define LORA_FIX_LENGTH_PAYLOAD_ON false
#define LORA_IQ_INVERSION_ON  false

// --- Variables de Estado LoRa ---
static RadioEvents_t RadioEvents;
bool lora_idle = true;

// --- Callbacks de LoRa ---
void OnTxDone( void ) {
  Serial.println("LoRa: TX Done");
  lora_idle = true;
}

void OnTxTimeout( void ) {
  Radio.Sleep();
  Serial.println("LoRa: TX Timeout");
  lora_idle = true;
}

void setup() {
  Serial.begin(115200);
  
  // Inicialización de la placa (la clave del éxito)
  Mcu.begin(HELTEC_BOARD, SLOW_CLK_TPYE);

  // --- Inicialización de Wi-Fi ---
  Serial.println("Iniciando Wi-Fi AP...");
  WiFi.softAP(ssid, password);
  Serial.print("Access Point IP: ");
  Serial.println(WiFi.softAPIP());
  server.begin();
  Serial.print("Servidor Wi-Fi iniciado en el puerto: ");
  Serial.println(puerto);

  // --- Inicialización de la Radio LoRa ---
  RadioEvents.TxDone = OnTxDone;
  RadioEvents.TxTimeout = OnTxTimeout;
  Radio.Init(&RadioEvents);
  Radio.SetChannel(RF_FREQUENCY);
  Radio.SetTxConfig(MODEM_LORA, TX_OUTPUT_POWER, 0, LORA_BANDWIDTH,
                    LORA_SPREADING_FACTOR, LORA_CODINGRATE,
                    LORA_PREAMBLE_LENGTH, LORA_FIX_LENGTH_PAYLOAD_ON,
                    true, 0, 0, LORA_IQ_INVERSION_ON, 3000);
  
  Serial.println("Placa Emisora lista.");
}

void loop() {
  // Manejar interrupciones de la radio es OBLIGATORIO
  Radio.IrqProcess();

  // Si LoRa está ocupado, no hacemos nada más
  if (lora_idle == false) {
    return;
  }
  
  // Revisar si hay un cliente Wi-Fi
  WiFiClient client = server.available();
  if (!client) {
    return;
  }

  Serial.println("\nCliente Wi-Fi conectado!");
  while (client.connected()) {
    if (client.available()) {
      String jsonRecibido = client.readStringUntil('\r');
      Serial.print("JSON Recibido: ");
      Serial.println(jsonRecibido);

      lora_idle = false; // Marcamos LoRa como ocupado
      Radio.Send((uint8_t*)jsonRecibido.c_str(), jsonRecibido.length());
      break;
    }
  }
  client.stop();
  Serial.println("Cliente Wi-Fi desconectado.");
}