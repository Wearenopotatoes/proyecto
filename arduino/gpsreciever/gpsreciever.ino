#include <heltec_unofficial.h>
#include <ArduinoJson.h>

void setup() {
  heltec_setup();
  RADIOLIB_OR_HALT(radio.begin());

  radio.setFrequency(915.0);
  radio.setBandwidth(250.0);
  radio.setSpreadingFactor(9);
  radio.setOutputPower(14);

  int16_t status = radio.startReceive();
  if (status == RADIOLIB_ERR_NONE) {
    both.println("Receptor LoRa listo, esperando paquetes...");
  } else {
    both.printf("Error al iniciar el receptor, código: %d\n", status);
    while (true);
  }
}

void loop() {
  heltec_loop();

  uint8_t rxBuf[256];
  int16_t status = radio.readData(rxBuf, sizeof(rxBuf));

  if (status == RADIOLIB_ERR_NONE) {
    size_t len = radio.getPacketLength();
    rxBuf[len] = '\0';

    both.printf("\nPaquete recibido [RSSI:%.2f, SNR:%.2f]: %s\n", radio.getRSSI(), radio.getSNR(), (char*)rxBuf);

    StaticJsonDocument<256> rxDoc;
    DeserializationError error = deserializeJson(rxDoc, (char*)rxBuf);

    if (error) {
      both.printf("Error al decodificar JSON: %s\n", error.c_str());
      return;
    }

    long seq = rxDoc["seq"];
    float battery = rxDoc["battery"];
    long uptime = rxDoc["uptime"];
    double lat = rxDoc["lat"];
    double lng = rxDoc["lng"];

    both.printf("  Seq: %ld\n", seq);
    both.printf("  Batería: %.2f V\n", battery);
    both.printf("  Uptime: %ld s\n", uptime);
    both.printf("  Lat: %.4f\n", lat);
    both.printf("  Lon: %.4f\n", lng);

    display.clear();
    display.setTextAlignment(TEXT_ALIGN_LEFT);
    display.setFont(ArialMT_Plain_10);
    
    display.drawString(0, 0, "Paquete Recibido!");
    display.drawString(0, 10, "RSSI: " + String(radio.getRSSI()) + " dBm");
    display.drawString(0, 20, "Seq: " + String(seq) + " | Bat: " + String(battery, 2) + "V");
    display.drawString(0, 32, "Lat: " + String(lat, 4));
    display.drawString(0, 42, "Lon: " + String(lng, 4));
    
    display.display();

    // <-- AQUÍ AÑADIMOS EL COOLDOWN DE 5 SEGUNDOS ---
    delay(5000); // Pausa el programa por 5000 milisegundos

  } else if (status != RADIOLIB_ERR_RX_TIMEOUT && status != RADIOLIB_ERR_NONE) {
    both.printf("Error en la recepción, código: %d\n", status);
  }
}