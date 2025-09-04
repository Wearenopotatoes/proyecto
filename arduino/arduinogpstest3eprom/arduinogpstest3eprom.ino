#include <TinyGPS++.h>
#include <SoftwareSerial.h>
#include <EEPROM.h>

// Pines GPS
static const int RXPin = 4, TXPin = 3;
static const uint32_t GPSBaud = 9600;

TinyGPSPlus gps;
SoftwareSerial ss(RXPin, TXPin);

// Dirección base EEPROM
const int addrLat = 0;
const int addrLng = sizeof(double);
const int addrAlt = sizeof(double) * 2;

// Variables de posición
double lastLat = 0.0;
double lastLng = 0.0;
double lastAlt = 0.0;
int lastSat = 0;
bool fixRecuperado = false;

// Cooldown entre lecturas
unsigned long lastFixTime = 0;
const unsigned long cooldown = 5000;

// Funciones EEPROM
void guardarUltimaPosicion(double lat, double lng, double alt) {
  EEPROM.put(addrLat, lat);
  EEPROM.put(addrLng, lng);
  EEPROM.put(addrAlt, alt);
}

void leerUltimaPosicion(double &lat, double &lng, double &alt) {
  EEPROM.get(addrLat, lat);
  EEPROM.get(addrLng, lng);
  EEPROM.get(addrAlt, alt);
}

void setup() {
  Serial.begin(115200);
  ss.begin(GPSBaud);
  Serial.println("⏳ Iniciando GPS con recuperación de última posición...");

  // Leer datos guardados al iniciar
  leerUltimaPosicion(lastLat, lastLng, lastAlt);
  fixRecuperado = true;
}

void loop() {
  while (ss.available()) {
    gps.encode(ss.read());
  }

  if (millis() - lastFixTime > cooldown) {
    if (gps.location.isValid() && gps.location.isUpdated()) {
      // Actualizar datos
      lastLat = gps.location.lat();
      lastLng = gps.location.lng();
      lastAlt = gps.altitude.meters();
      lastSat = gps.satellites.value();
      fixRecuperado = false;

      // Guardar en EEPROM
      guardarUltimaPosicion(lastLat, lastLng, lastAlt);

      Serial.println("✅ Fix GPS actualizado:");
    } else {
      Serial.println("⚠️ No hay fix GPS. Usando última posición guardada:");
    }

    // Mostrar datos actuales
    Serial.print("Latitud: "); Serial.println(lastLat, 6);
    Serial.print("Longitud: "); Serial.println(lastLng, 6);
    Serial.print("Altitud: "); Serial.println(lastAlt);
    Serial.print("Satélites: "); Serial.println(lastSat);
    Serial.print("Origen: "); Serial.println(fixRecuperado ? "EEPROM" : "GPS");
    Serial.println("------------------------");

    lastFixTime = millis();
  }
}