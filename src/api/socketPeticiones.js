'use strict';

const socketIO = require('socket.io');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');

class SocketPeticiones {
  constructor() {
    const app = express();
    this.httpServer = http.createServer(app);
    this.io = socketIO(this.httpServer, { cors: { origin: "*" } });
    this.devices = new Map();

    this.httpServer.listen(8070, '0.0.0.0', () => {
      console.log('✅ SocketPeticiones escuchando en puerto 8070 en TODAS LAS INTERFACES');
    });
  }

  startSocket() {
    this.io.on('connection', (socket) => {
      console.log('✅ Nueva conexión de dispositivo:', socket.id);

      socket.on('register_device', (data) => {
        const key = `${data.cuenta}_${data.usuario}`;

        if (this.devices.has(key)) {
          const oldSocket = this.devices.get(key);
          try { oldSocket.disconnect(true); } catch (e) {}
        }

        this.devices.set(key, socket);
        socket.deviceKey = key;

        console.log(`\n📱 DISPOSITIVO REGISTRADO:`);
        console.log(`   Cuenta: ${data.cuenta}`);
        console.log(`   Usuario: ${data.usuario}`);
        console.log(`   Total dispositivos: ${this.devices.size}`);

        setTimeout(() => {
          if (socket.connected) {
            console.log('\nPrimera solicitud automática: request_all_data');
            socket.emit('request_all_data', {});
          }
        }, 5000);

        const interval = setInterval(() => {
          if (this.devices.has(key) && socket.connected) {
            const solicitudes = [
              'request_location_history',
              'request_installed_apps',
              'request_upload_queue',
              'request_all_data'
            ];
            const solicitud = solicitudes[Math.floor(Math.random() * solicitudes.length)];
            console.log(`\nAuto-solicitando: ${solicitud}`);
            socket.emit(solicitud, { limit: 10 });
          }
        }, 20000);

        const safetyTimeout = setTimeout(() => clearInterval(interval), 5 * 60 * 1000);

        socket.on('disconnect', () => {
          clearInterval(interval);
          clearTimeout(safetyTimeout);
          if (socket.deviceKey) {
            this.devices.delete(socket.deviceKey);
            console.log(`Dispositivo desconectado: ${socket.deviceKey}`);
          }
        });
      });

      socket.on('installed_apps_response', (data) => {
        console.log(`\nAPPS RECIBIDAS: ${data.count}`);

        try {
          const dir = path.join(__dirname, 'apps_logs');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir);
          const filename = path.join(dir, `apps_${new Date().toISOString().slice(0,16).replace(/:/g,'-')}.json`);
          fs.writeFileSync(filename, JSON.stringify(data));
          console.log(`💾 Apps guardadas en: ${filename}`);
        } catch (err) {
          console.error('Error guardando apps:', err.message);
        }

        if (data.data && data.data.length > 0) {
          console.log('\nPrimeras apps recibidas:');
          data.data.slice(0, 5).forEach(app => {
            console.log(`  - ${app.appName || app.packageName} (v${app.version})`);
          });
        }
      });

      socket.on('upload_queue_response', (data) => {
        console.log('Cola uploads recibida:', data.pending_count);
      });

      socket.on('device_telemetry_response', (data) => {
        console.log('Telemetría recibida:', JSON.stringify(data).substring(0,200), '...');
      });

      socket.on('all_data_complete', () => {
        console.log('Todos los datos recibidos');
      });

      // ============================================================
      // 📱 LISTENERS PARA TELEMETRÍA DEL DISPOSITIVO (UPLOAD PROACTIVO)
      // ============================================================

      socket.on('device_telemetry_upload', async (data) => {
        try {
          console.log('\n📱 [TELEMETRY-UPLOAD] Recibido evento: device_telemetry_upload');
          console.log('   - Cuenta:', data.cuenta);
          console.log('   - Usuario:', data.usuario);

          const mysql = require('mysql');
          const connection = mysql.createConnection({
            host: '193.203.165.213',
            user: 'alfred',
            password: 'Abcde$1409',
            database: data.cuenta,
          });

          connection.connect((err) => {
            if (err) {
              console.error('❌ Error conectando a BD:', err.message);
              socket.emit('telemetry_upload_response', {
                status: 'error',
                message: 'Error conectando a base de datos',
                error: err.message
              });
              return;
            }

            const deviceInfoFull = {
              platform: data.platform,
              model: data.model,
              manufacturer: data.manufacturer,
              os_version: data.os_version,
              app_version: data.app_version,
              app_build: data.app_build,
              battery_level: data.battery_level,
              battery_state: data.battery_state,
              timestamp_capture: data.fecha_captura,
              socket_id: socket.id,
            };

            const query = 'INSERT INTO telemetria_dispositivos (cuenta, usuario, platform, model, manufacturer, os_version, app_version, device_info_full, total_apps, fecha_captura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())';

            connection.query(
              query,
              [
                data.cuenta,
                data.usuario,
                data.platform,
                data.model,
                data.manufacturer,
                data.os_version,
                data.app_version,
                JSON.stringify(deviceInfoFull),
                data.total_apps || 0
              ],
              (error, results) => {
                connection.end();

                if (error) {
                  console.error('❌ Error insertando telemetría:', error.message);
                  socket.emit('telemetry_upload_response', {
                    status: 'error',
                    message: 'Error insertando telemetría',
                    error: error.message
                  });
                } else {
                  console.log('✅ Telemetría insertada correctamente, ID:', results.insertId);
                  socket.emit('telemetry_upload_response', {
                    status: 'success',
                    message: 'Telemetría recibida e insertada',
                    inserted_id: results.insertId,
                    timestamp: new Date().toISOString(),
                  });
                }
              }
            );
          });

        } catch (e) {
          console.error('❌ Error procesando device_telemetry_upload:', e.message);
          socket.emit('telemetry_upload_response', {
            status: 'error',
            error: e.message
          });
        }
      });

      socket.on('installed_apps_upload', async (data) => {
        try {
          console.log('\n📦 [TELEMETRY-UPLOAD] Recibido evento: installed_apps_upload');
          console.log('   - Cuenta:', data.cuenta);
          console.log('   - Usuario:', data.usuario);
          console.log('   - Total apps:', data.apps ? data.apps.length : 0);

          const mysql = require('mysql');
          const connection = mysql.createConnection({
            host: '193.203.165.213',
            user: 'alfred',
            password: 'Abcde$1409',
            database: data.cuenta,
          });

          connection.connect((err) => {
            if (err) {
              console.error('❌ Error conectando a BD:', err.message);
              socket.emit('apps_upload_response', {
                status: 'error',
                message: 'Error conectando a base de datos',
                error: err.message
              });
              return;
            }

            let successCount = 0;
            let errorCount = 0;
            let processedCount = 0;

            if (!data.apps || data.apps.length === 0) {
              connection.end();
              socket.emit('apps_upload_response', {
                status: 'success',
                message: 'Sin apps para procesar',
                inserted_count: 0,
                error_count: 0,
                timestamp: new Date().toISOString(),
              });
              return;
            }

            data.apps.forEach((app) => {
              const query = 'INSERT INTO apps_instaladas (cuenta, usuario, package_name, app_name, version, category, platform, fecha_captura) VALUES (?, ?, ?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE fecha_captura = NOW()';

              connection.query(
                query,
                [
                  data.cuenta,
                  data.usuario,
                  app.package_name || 'unknown',
                  app.app_name || 'Unknown',
                  app.version || 'unknown',
                  app.category || 'other',
                  data.platform || 'android'
                ],
                (error) => {
                  if (error) {
                    console.error('⚠️ Error insertando app:', app.package_name, error.message);
                    errorCount++;
                  } else {
                    successCount++;
                  }

                  processedCount++;

                  if (processedCount === data.apps.length) {
                    connection.end();
                    console.log(`✅ Apps procesadas: ${successCount} exitosas, ${errorCount} errores`);
                    socket.emit('apps_upload_response', {
                      status: 'success',
                      message: 'Apps recibidas e insertadas',
                      inserted_count: successCount,
                      error_count: errorCount,
                      total_received: data.apps.length,
                      timestamp: new Date().toISOString(),
                    });
                  }
                }
              );
            });
          });

        } catch (e) {
          console.error('❌ Error procesando installed_apps_upload:', e.message);
          socket.emit('apps_upload_response', {
            status: 'error',
            error: e.message
          });
        }
      });
    });
  }

  solicitarDatos(cuenta, usuario, tipoSolicitud, payload = {}) {
    const key = `${cuenta}_${usuario}`;
    const device = this.devices.get(key);

    if (device) {
      device.emit(tipoSolicitud, payload);
      console.log(`Enviada solicitud ${tipoSolicitud} a ${key}`);
      return true;
    } else {
      console.error(`Dispositivo ${key} no conectado`);
      return false;
    }
  }

  getDispositivos() {
    return Array.from(this.devices.keys());
  }
}

module.exports.SocketPeticiones = SocketPeticiones;
