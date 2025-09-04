#include "LoRaWan_APP.h"

// --- Configuración de LoRa (debe coincidir con el emisor) ---
#define RF_FREQUENCY          915000000
#define LORA_BANDWIDTH        0
#define LORA_SPREADING_FACTOR 7
#define LORA_CODINGRATE       1
#define LORA_PREAMBLE_LENGTH  8
#define LORA_SYMBOL_TIMEOUT   0
#define LORA_FIX_LENGTH_PAYLOAD_ON false
#define LORA_IQ_INVERSION_ON  false
#define RX_TIMEOUT_VALUE      3000
#define BUFFER_SIZE           255
char rxBuffer[BUFFER_SIZE];

// --- Callbacks de LoRa ---
static RadioEvents_t RadioEvents;
void OnRxDone(uint8_t *payload, uint16_t size, int16_t rssi, int8_t snr);
void OnRxTimeout(void);

void setup() {
  Serial.begin(115200);
  Mcu.begin(HELTEC_BOARD, SLOW_CLK_TPYE);

  RadioEvents.RxDone = OnRxDone;
  RadioEvents.RxTimeout = OnRxTimeout;

  Radio.Init(&RadioEvents);
  Radio.SetChannel(RF_FREQUENCY);
  Radio.SetRxConfig(MODEM_LORA, LORA_BANDWIDTH, LORA_SPREADING_FACTOR,
                    LORA_CODINGRATE, 0, LORA_PREAMBLE_LENGTH,
                    LORA_SYMBOL_TIMEOUT, LORA_FIX_LENGTH_PAYLOAD_ON,
                    0, true, 0, 0, LORA_IQ_INVERSION_ON, true);
  
  Serial.println("Placa Receptora lista. Escuchando...");
  Radio.Rx(RX_TIMEOUT_VALUE);
}

void loop() {
  Radio.IrqProcess();
}

void OnRxDone(uint8_t *payload, uint16_t size, int16_t rssi, int8_t snr) {
  memcpy(rxBuffer, payload, size);
  rxBuffer[size] = '\0';

  Serial.println("\n¡Paquete Recibido!");
  Serial.print("Contenido: ");
  Serial.println(rxBuffer);
  Serial.print("RSSI: ");
  Serial.println(rssi);

  Radio.Rx(RX_TIMEOUT_VALUE); // Volver a modo recepción
}

void OnRxTimeout(void) {
  Serial.println("RX Timeout");
  Radio.Rx(RX_TIMEOUT_VALUE); // Volver a modo recepción
}