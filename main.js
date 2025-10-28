'use strict';

const server = require('./src/server/server.js');

const restGet = require('./src/api/restGet.js');
const restPost = require('./src/api/restPost.js');
const restAppInfo = require('./src/api/restAppInfo.js');
const socketRealTime = require('./src/api/socketRealTime.js');
// const firebaseCheckEvents = require('./src/api/firebase.js'); // Comentado para desarrollo local
const checkDupl = require('./src/api/checkDuplicate.js');
const socketPeticiones = require('./src/api/socketPeticiones.js');

const mysql = require('mysql');
const path = require('path');
var fs = require('fs');
// var admin = require("firebase-admin"); // Comentado para desarrollo local
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");

var connection = null;

const pools = {};

function getPool(database) {
  if (!pools[database]) {
    pools[database] = mysql.createPool({
      host: '193.203.165.213',
      user: 'alfred',
      password: 'Abcde$1409',
      database: database,
      port: 3306,
      connectionLimit: 10 // 🔹 máximo 10 conexiones simultáneas por cliente
    });
    console.log(`🔗 Pool creado para base de datos: ${database}`);
  }
  return pools[database];
}

var serve = new server.Server();
serve.serverInit();

var post = new restPost.Post();
var get = new restGet.Get();
var appinfo = new restAppInfo.AppInfo();


/*:::::::::::::: Firebase :::::::::::::::::::::::::::::::::::::::::::::::::::::*/
// Comentado para desarrollo local
//var firebaseCheck = new firebaseCheckEvents.FirebaseCheckEvents();

//firebaseCheck.initializeApp();

//firebaseCheck.startCheckEvents();

/*:::::::::::::: Socket :::::::::::::::::::::::::::::::::::::::::::::::::::::*/
var sktRealTime = new socketRealTime.SocketRealTime();

sktRealTime.startSocket();

var sktPeticiones = new socketPeticiones.SocketPeticiones();
sktPeticiones.startSocket();

/* :::::::::::::::::::::::::::¨Peticiones POST ::::::::::::::::::::::::::::::::::::::::::*/

server.app.post('/postDBTablesSync', (req, res) => {

  let dataRequest = JSON.parse(JSON.stringify(req.body));
  let database = dataRequest[0].bd;
  let arrDataForInsert = [];
  arrDataForInsert.push(dataRequest[1]);

  let checkDuplicate = new checkDupl.CheckDuplicate();

  connection = post.connection(database);
  connection.connect((err) => {
    /*Metodo para validar si los datos a guardar en la base de datos aun no existen,
      para no duplicarlos*/
    checkDuplicate.checkDuplicateToDB(arrDataForInsert, connection, res, database);
  });

});

// Versión NUEVA con S3
server.app.post('/postDBTablesSyncS3', (req, res) => {
  let dataRequest = JSON.parse(JSON.stringify(req.body));
  let database = dataRequest[0].bd;
  let arrDataForInsert = [];
  arrDataForInsert.push(dataRequest[1]);

  let checkDuplicate = new checkDupl.CheckDuplicate();

  connection = post.connection(database);
  connection.connect((err) => {
    checkDuplicate.checkDuplicateToDBS3(arrDataForInsert, connection, res, database);
  });
});

/*Para la app de taxis*/
server.app.post('/savelocations', (req, res) => {
  let location = JSON.parse(JSON.stringify(req.body));
  console.log('insert locations :',location.lat, ' ', location.lng);
  let connection= null;
  new Promise((resolve, reject) => {
    connection = post.connection("personal");
    connection.connect((err) => {
      if (err) reject(err);
      connection.query("insert into locations values(0, "
        + location.usuario +", "
        + location.lat +", "
        + location.lng +");", (error, rows, fields) => {
          if (error) reject(error);
          resolve(rows);
        });
    });
  }).then((data) => {
    res.json({"status": 1});
  }).catch((err) => {
    console.log(err);
    res.json({"status": 2})
  });
});

server.app.post('/savelocationsusers', (req, res) => {
  let location = JSON.parse(JSON.stringify(req.body));
  console.log('Guardando ubicación usuario:',location.usuario, 'lat:', location.lat, 'lng:', location.lng);
  let connection= null;
  new Promise((resolve, reject) => {
    connection = post.connection(location.cuenta);
    connection.connect((err) => {
      if (err) reject(err);
      
      // Insertar en tabla geolocalizacionusuarios (la tabla correcta que usa el Frontend)
      const query = `INSERT INTO geolocalizacionusuarios 
        (id_usuario, created_at, lat, log, fechahora, bateria, confianza, calidad_red, latencia_red)
        VALUES (
          ${location.usuario},
          NOW(),
          ${location.lat},
          ${location.lng},
          '${location.datetime || new Date().toISOString()}',
          ${location.bateria || 0},
          ${location.precision || 0},
          ${location.calidad_red ? "'" + location.calidad_red + "'" : 'NULL'},
          ${location.latencia_red || 'NULL'}
        )`;
      
      connection.query(query, (error, rows, fields) => {
        connection.end();
        if (error) {
          console.error('Error insertando en geolocalizacionusuarios:', error);
          reject(error);
        } else {
          console.log('Ubicación guardada en geolocalizacionusuarios');
          resolve(rows);
        }
      });
    });
  }).then((data) => {
    res.json({"status": 1, "message": "Ubicación guardada en BD"});
  }).catch((err) => {
    console.error('Error:', err);
    res.json({"status": 2, "error": err.message})
  });
});


// NUEVO ENDPOINT: Solicitar ubicacion a dispositivo via Socket.IO
// Manejar preflight CORS
server.app.options('/solicitar-ubicacion-dispositivo', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(200);
});

server.app.post('/solicitar-ubicacion-dispositivo', (req, res) => {
  // Agregar headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  try {
    const { usuario_id, database = 'devsicom' } = req.body;

    if (!usuario_id) {
      return res.status(400).json({
        success: false,
        error: 'Falta parámetro: usuario_id'
      });
    }

    console.log('Solicitar ubicación Usuario:', usuario_id, 'Base:', database);

    // Usar Socket.IO SocketPeticiones para solicitar al dispositivo
    const enviado = sktPeticiones.solicitarDatos(
      database,
      usuario_id,
      'request_location_history',
      { limit: 10 }
    );

    if (enviado) {
      console.log('Solicitud enviada al dispositivo via Socket.IO');
      return res.json({
        success: true,
        message: 'Solicitud de ubicación enviada al dispositivo',
        usuario_id,
        database,
        metodo: 'Socket.IO 8070'
      });
    } else {
      console.warn('Dispositivo NO conectado');
      return res.status(503).json({
        success: false,
        error: 'Dispositivo no conectado',
        usuario_id,
        database
      });
    }
  } catch (error) {
    console.error('Error en solicitar-ubicacion-dispositivo:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al procesar solicitud'
    });
  }
});

/* ::::::::::::::::::::::::::::¨FIN Peticiones POST ::::::::::::::::::::*/


// ::::::::::::::::::::::::: Peticiones GET ::::::::::::::::::::::::::::::::::::::::::

server.app.get('/getTableListValues/:database/:table', (req, res) => {
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getTableListValues(req, connection, res);
      }
   });
});

server.app.get('/getPin/:database', (req, res) => {
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getPin(req, connection, res);
      }
   });
});


/*Consultas para localizacion en tiempo real*/
/*obtiene el historico de un usuario de acuerdo a una fecha*/
server.app.get('/getHistoryUserLocation/:database/:user/:date', (req, res) => {
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        get.getHistoryUserLocation(connection, req, res);
      }
   });
});

/*Obtiene las  entradas y salidas de un usuario de acuerdo a una fecha*/
server.app.get('/getInputsOutputsOfUser/:database/:user/:date', (req, res) => {
  connection = post.connection(req.params.database);
  console.log("getInputsOutputsOfUser:", req.params);
  connection.connect((err) => {
    if(err) res.json({"error": err});
    get.getInputsOutputsOfUser(req, connection, res);
  });
});

server.app.get('/getValuesTableById/:database/:table/:id', (req, res) => {
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesTableById(req, connection, res);
      }
   });
});

server.app.get('/getValoresModulo/:database/:table/:id', (req, res) => {
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValoresModulo(req, connection, res);
      }
   });
});

server.app.get('/getValuesTableByTiendaId/:database/:table/:tienda_id', (req, res) => {
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesTableByTiendaId(req, connection, res);
      }
   });
});

server.app.get('/getValuesTableByValor/:database/:table/:condicion/:tienda_id', (req, res) => {
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesTableByValor(req, connection, res);
      }
   });
});

server.app.get('/getValuesTableByDetCad/:database/:table/:determinante/:cadena', (req, res) => {
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesTableByDetCad(req, connection, res);
      }
   });
});

// getDBSync
server.app.get('/getDBTablesSync/:database', (req, res) => {
  connection = post.connection(req.params.database);
  connection.connect(function(err){
    if (err) {
      console.log(err);
      res.send('error');
    }else{
      console.log('conected !!');
      get.getDBTablesSync(req, connection, res);
    }

  });
});

server.app.get('/getDBValuesSync/:database/:user', (req, res) => {
  connection = post.connection(req.params.database);
  connection.connect(function(err){
   if (err) {
      console.log(err);
      res.send('error');
   } else {
      console.log('conected !!');
      get.getDBValuesSync(req, connection, res, req.params.database);
   }
  });
});

// obtener un registro con nip
server.app.get('/getValuesTableByNip/:database/:table/:nip', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesTableByNip(req, connection, res);  
      }
   });
});

// obtener un registro con fecha de hoy de usuarios
server.app.get('/getValuesActividadesNow/:database/:user', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesActividadesNow(req, connection, res);  
      }
   });
});  

server.app.get('/getValuesActividadesCanceladas/:database/:user', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesActividadesCanceladas(req, connection, res);  
      }
   });
});

//obtiene las actividades faltantes de un usuario
server.app.get('/getValuesActividadesFaltantes/:database/:user', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesActividadesFaltantes(req, connection, res);  
      }
   });
});

//obtiene todas las actividades a realizar hoy
server.app.get('/getValuesActividadesTotalNow/:database/:user', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesActividadesTotalNow(req, connection, res);  
      }
   });
});

//obtener porcentaje
server.app.get('/getPorcentaje/:database/:user', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getPorcentaje(req, connection, res);  
      }
   });
});

//cancelar visita con actividad
server.app.get('/setActividad/:database/:user/:tienda/:incidencia/:comentario', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.setActividad(req, connection, res);  
      }
   });
});

// obtener un registro entre fechas de usuario
server.app.get('/getValuesActividadesBetweenUser/:database/:table/:user/:date1/:date2', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesActividadesBetweenUser(req, connection, res);  
      }
   });
});

//obtiene usuarios activos
server.app.get('/getUsuariosActivos/:database/:id', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getUsuariosActivos(req, connection, res);  
      }
   });
});

//ubicacion actual de un usuario en especifico
server.app.get('/getUbicacionActual/:database/:id', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getUbicacionActual(req, connection, res);  
      }
   });
});

//ubicacion de todos los usuarios
server.app.get('/getUbicacionUsuariosActual/:database', function (req, res) {
  let connection= null;
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getUbicacionUsuariosActual(req, connection, res);  
      }
   });
});

//obtiene las actividades faltantes de un dia determinado  de un usuario
server.app.get('/getValuesActividadesFaltantesFiltro/:database/:user/:fecha', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesActividadesFaltantesFiltro(req, connection, res);  
      }
   });
});

//cancelar visita con fecha determinada
server.app.get('/setActividadFiltro/:database/:user/:tienda/:incidencia/:comentario/:fecha', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.setActividadFiltro(req, connection, res);  
      }
   });
});

//obtener visitas que no fueron echas mensualmente
server.app.get('/getHcActiva/:database/:user', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getHcActiva(req, connection, res);  
      }
   });
});

//iniciar en sicom con usuario
server.app.get('/getValuesTableByUsuario/:database/:table/:user', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getValuesTableByUsuario(req, connection, res);  
      }
   });
});

//iniciar en sicom con usuario
server.app.get('/getValuesTableByCuenta/:database/:table/:cuenta', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getValuesTableByCuenta!!');
        get.getValuesTableByCuenta(req, connection, res);  
      }
   });
});

server.app.get('/getUsuariosActivosSA/:database', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getUsuariosActivosSA(req, connection, res);  
      }
   });
});
//muestra si trae la tabla hc
server.app.get('/getShowTables/:database/:cuenta', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getShowTables(req, connection, res);  
      }
   });
});
//obtiene tiendas
server.app.get('/getTiendas/:database', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getTiendas(req, connection, res);  
      }
   });
});
//pospone visitas
server.app.get('/setCambiarFecha/:database/:responsable/:fecha_c/:fecha_o/:actualizacion/:id', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.setCambiarFecha(req, connection, res);  
      }
   });
});
//cancela visitas
server.app.get('/setActivo/:database/:responsable/:id', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.setActivo(req, connection, res);  
      }
   });
});

server.app.get('/getTableListValuesModulo/:database/:table/:modulo', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getTableListValuesModulo(req, connection, res);  
      }
   });
});

server.app.get('/setHc/:database/:user/:tienda/:fecha', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.setHc(req, connection, res);  
      }
   });
});

server.app.get('/getTiendasCercanas/:database/:coordenadax/:coordenaday/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getTiendasCercanas(req, connection, res);  
      }
   });
});

server.app.get('/getEstancia/:database/:fecha1/:fecha2/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.getEstancia(req, connection, res);  
    
   });
});

server.app.get('/getUpdate/:database/:fecha1/:fecha2/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.getUpdate(req, connection, res);  
    
   });
});

server.app.get('/reporteActividades/:database/:fecha1/:fecha2/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.reporteActividades(req, connection, res);  
    
   });
});

server.app.get('/saveAplicaciones/:database/:usuario/:aplicaciones/:telefono/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.saveAplicaciones(req, connection, res);  
   });
});

server.app.get('/saveStatusgps/:database/:usuario/:proveedor/:status/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.saveStatusgps(req, connection, res);  
   });
});

server.app.get('/saveBateriaowifi/:database/:usuario/:bateria/:wifi/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.saveBateriaowifi(req, connection, res);  
   });
});

server.app.get('/getControl/:database', (req, res) => {
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected !!');
        get.getControl(req, connection, res);
      }
   });
});

server.app.get('/getConfiguracion/:database', (req, res) => {
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getConfiguracion!!');
        get.getConfiguracion(req, connection, res);
      }
   });
});

server.app.get('/getHc/:database/:user/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.getHc(req, connection, res);  
   });
});

server.app.get('/saveBajas/:database/:usuario/:responsable/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.saveBajas(req, connection, res);  
   });
});

server.app.get('/validarDescanso/:database/:usuario/:fecha_i/:fecha_f/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.validarDescanso(req, connection, res);  
   });
});

server.app.get('/getCmByRegional/:database/:regional/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.getCmByRegional(req, connection, res);  
   });
});

server.app.get('/getPromotoresBySupervisor/:database/:id_supervisor/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.getPromotoresBySupervisor(req, connection, res);  
   });
});

server.app.get('/getActividadesPromotor/:database/:id_user/:fecha/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        get.getActividadesPromotor(req, connection, res);  
   });
});

/* Inicia pis AppInfo */

server.app.get('/saveID/:database/:deviceid/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        appinfo.saveID(req, connection, res);  
   });
});

server.app.get('/saveTest/:database/:r1/:nombre/:cuenta/:puesto/:pdv/:casa/:contacto/:r2/:r3/:r4/:r5/:r6/:r7/:r8/:r9/:r10/:r11/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        appinfo.saveTest(req, connection, res);  
   });
});

server.app.get('/getTemas/:database/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        appinfo.getTemas(req, connection, res);  
   });
});

server.app.get('/getFotos/:database/:idtema/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        appinfo.getFotos(req, connection, res);  
   });
});

server.app.get('/getCategorias/:database/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        appinfo.getCategorias(req, connection, res);  
   });
});

server.app.get('/getTemasByCat/:database/:categoria_id/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        appinfo.getTemasByCat(req, connection, res);  
   });
});

server.app.get('/getTemasByTemaName/:database/:name/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        appinfo.getTemasByTemaName(req, connection, res);  
   });
});

server.app.get('/getTemasByCategoryName/:database/:name/', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
        appinfo.getTemasByCategoryName(req, connection, res);  
   });
});

server.app.get('/getConfigurationApp/:client', (req, res) => {
  get.getConfigurationApp(req, res);
});

server.app.get('/getValuesByPadre/:database/:table/:usuario_id/:tienda_id/:campo/:valor', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getValuesByPadre!!');
        get.getValuesByPadre(req, connection, res);  
      }
   });
});

server.app.get('/getOneCap/:database/:catalogo/:tabla/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getValuesByPadre!!');
        get.getOneCap(req, connection, res);  
      }
   });
});

server.app.get('/getUltimaVisita/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getUltimaVisita!!');
        get.getUltimaVisita(req, connection, res);  
      }
   });
});

server.app.get('/getTotalVisitas/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getTotalVisitas!!');
        get.getTotalVisitas(req, connection, res);  
      }
   });
});

server.app.get('/getTotalVisitasDetalle/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getTotalVisitasDetalle!!');
        get.getTotalVisitasDetalle(req, connection, res);  
      }
   });
});

server.app.get('/getEstadiaTienda/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getEstadiaTienda!!');
        get.getEstadiaTienda(req, connection, res);  
      }
   });
});

server.app.get('/getTotalEstadia/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getTotalEstadia!!');
        get.getTotalEstadia(req, connection, res);  
      }
   });
});

server.app.get('/getObjetivosPc/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getObjetivosPc!!');
        get.getObjetivosPc(req, connection, res);  
      }
   });
});

server.app.get('/getEjecutadoPc/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getEjecutadoPc!!');
        get.getEjecutadoPc(req, connection, res);  
      }
   });
});

server.app.get('/getAvancePc/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getAvancePc!!');
        get.getAvancePc(req, connection, res);  
      }
   });
});

server.app.get('/getPcEjecutado/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getPcEjecutado!!');
        get.getPcEjecutado(req, connection, res);  
      }
   });
});

server.app.get('/getPcPendiente/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getPcPendiente!!');
        get.getPcPendiente(req, connection, res);  
      }
   });
});

server.app.get('/getObjetivosEx/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getObjetivosEx!!');
        get.getObjetivosEx(req, connection, res);  
      }
   });
});

server.app.get('/getEjecutadoEx/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getEjecutadoEx!!');
        get.getEjecutadoEx(req, connection, res);  
      }
   });
});

server.app.get('/getAvanceEx/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getAvanceEx!!');
        get.getAvanceEx(req, connection, res);  
      }
   });
});

server.app.get('/getObjetivosLi/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getObjetivosLi!!');
        get.getObjetivosLi(req, connection, res);  
      }
   });
});

server.app.get('/getEjecutadoLi/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getEjecutadoLi!!');
        get.getEjecutadoLi(req, connection, res);  
      }
   });
});

server.app.get('/getAvanceLi/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getAvanceLi!!');
        get.getAvanceLi(req, connection, res);  
      }
   });
});

server.app.get('/getFrentesTienda/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getFrentesTienda!!');
        get.getFrentesTienda(req, connection, res);  
      }
   });
});

server.app.get('/getPromedioCadena/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getPromedioCadena!!');
        get.getPromedioCadena(req, connection, res);  
      }
   });
});

server.app.get('/getPromedioFrentesMarca/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getPromedioFrentesMarca!!');
        get.getPromedioFrentesMarca(req, connection, res);  
      }
   });
});

server.app.get('/getCumplimientoVisita/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getCumplimientoVisita!!');
        get.getCumplimientoVisita(req, connection, res);  
      }
   });
});

server.app.get('/getDatosPuntosControl/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getDatosPuntosControl!!');
        get.getDatosPuntosControl(req, connection, res);  
      }
   });
});

server.app.get('/getDatosExhibicion/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getDatosExhibicion!!');
        get.getDatosExhibicion(req, connection, res);  
      }
   });
});

server.app.get('/getDatosLineal/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getDatosLineal!!');
        get.getDatosLineal(req, connection, res);  
      }
   });
});

server.app.get('/getDatosSo/:database/:cadena/:determinante', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getDatosSo!!');
        get.getDatosSo(req, connection, res);  
      }
   });
});

server.app.get('/getTareasAsignadasMes/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getTareasAsignadasMes!!');
        get.getTareasAsignadasMes(req, connection, res);  
      }
   });
});

server.app.get('/getTareasRealizadas/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getTareasRealizadas!!');
        get.getTareasRealizadas(req, connection, res);  
      }
   });
});

server.app.get('/getTareasPendientes/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getTareasPendientes!!');
        get.getTareasPendientes(req, connection, res);  
      }
   });
});

server.app.get('/getExhibicionesPrueba/:database/:tienda_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getExhibicionesPrueba!!');
        get.getExhibicionesPrueba(req, connection, res);  
      }
   });
});

//cancela visitas
server.app.get('/saveVersiones/:database/:user/:version1/:version2', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected saveVersiones!!');
        get.saveVersiones(req, connection, res);  
      }
   });
});

server.app.get('/saveModelos/:database/:user/:modelo', function (req, res) {
  let connection= null;
    // Connecting to the database.
    connection = post.connection(req.params.database);
    connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected saveModelos!!');
        get.saveModelos(req, connection, res);  
      }
   });
});

server.app.get('/getFechaCadena/:database/:cadena', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getFechaCadena!!');
        get.getFechaCadena(req, connection, res);  
      }
   });
});

server.app.get('/getUserLogin/:database/:user/:pass', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getUserLogin!!');
        get.getUserLogin(req, connection, res);  
      }
   });
});

server.app.get('/getCheckTareas/:database/:tarea/:tienda', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getCheckTareas!!');
        get.getCheckTareas(req, connection, res);  
      }
   });
});

server.app.get('/getCheckTareasAsignadas/:database/:tarea/:tienda', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getCheckTareasAsignadas!!');
        get.getCheckTareasAsignadas(req, connection, res);  
      }
   });
});

server.app.get('/getTareasAsignadas/:database/:tienda', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getTareasAsignadas!!');
        get.getTareasAsignadas(req, connection, res);  
      }
   });
});

server.app.get('/getTareasAsignadasEstatus/:database/:tienda', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getTareasAsignadasEstatus!!');
        get.getTareasAsignadasEstatus(req, connection, res);  
      }
   });
});

server.app.get('/getConteoInvFan/:database/:tienda', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getConteoInvFan!!');
        get.getConteoInvFan(req, connection, res);  
      }
   });
});

server.app.get('/getConteoTareasAsignadas/:database/:tienda', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected getConteoTareasAsignadas!!');
        get.getConteoTareasAsignadas(req, connection, res);  
      }
   });
});

server.app.get('/saveInvFan/:database/:tienda/:sistema/:bodega/:piso/:inventario_id', (req, res) => {
  let connection= null;
   connection = post.connection(req.params.database);
   connection.connect(function(err){
      if (err) {
        console.log(err);
        res.send('error');
      }else{
        console.log('conected saveInvFan!!');
        get.saveInvFan(req, connection, res);  
      }
   });
});

server.app.get('/getEtapasPendientes/:db/:tienda_id/:usuario_id', (req, res) => {
  const { db, tienda_id, usuario_id } = req.params;
  const pool = getPool(db);

  const query = `
    SELECT e.*
    FROM ejecucion e
    INNER JOIN (
        SELECT grupo
        FROM ejecucion
        WHERE DATE(fecha) = CURDATE()
        GROUP BY grupo
        HAVING COUNT(*) = 1
    ) solo_uno ON e.grupo = solo_uno.grupo
    WHERE e.tienda_id = ?
      AND e.usuario_id = ?
      AND DATE(e.fecha) = CURDATE();
  `;

  pool.query(query, [tienda_id, usuario_id], (err, rows) => {
    if (err) {
      console.error("❌ Error en /getEtapasPendientes:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(rows);
  });
});

server.app.post('/postSaveEtapa', (req, res) => {
  console.log('entro a postSaveEtapa');
  const etapa = JSON.parse(JSON.stringify(req.body));
  const pool = getPool(etapa.db);

  let { tienda_id, usuario_id, grupo, valores } = etapa;

  if (grupo && typeof grupo === "object" && grupo.type === "Buffer") {
    grupo = Buffer.from(grupo).toString(); 
  }

  if (!grupo || grupo === "") {
    grupo = uuidv4();
  }

  // 🔹 Campos fijos que siempre van
  const fixedFields = ["fecha", "tienda_id", "usuario_id", "grupo"];
  const fixedValues = ["NOW()", "?", "?", "?"];
  const params = [tienda_id, usuario_id, grupo];

  // 🔹 Campos dinámicos
  const dynamicFields = [];
  const dynamicPlaceholders = [];

  for (const [campo, valor] of Object.entries(valores || {})) {
    console.log(`for en postSaveEtapa con ${campo}`);
    if (typeof valor === "string" && valor.length > 1000) {
      console.log(`entro a if 1000 en postSaveEtapa con ${campo}`);
      const nombre_img = `${Date.now()}_${usuario_id}_${campo}.jpg`;
      const pathToDatabase = `/${etapa.db}/fotosapp/${nombre_img}`;
      const pathToServer = `../${etapa.db}/fotosapp/${nombre_img}`;

      try {
        fs.writeFileSync(pathToServer, Buffer.from(valor, "base64"));
        console.log(`✅ Imagen ${campo} guardada en ${pathToServer}`);

        dynamicFields.push(campo);
        dynamicPlaceholders.push("?");
        params.push(pathToDatabase);
      } catch (err) {
        console.log(`❌ Error guardando imagen: ${err}`);
        return res.status(500).json({ error: "Error guardando imagen" });
      }
    } else {
      console.log(`entro a else en postSaveEtapa con ${campo}`);
      dynamicFields.push(campo);
      dynamicPlaceholders.push("?");
      params.push(valor);
    }
  }

  const query = `
    INSERT INTO ejecucion
    (${["id", ...fixedFields, ...dynamicFields].join(", ")})
    VALUES (0, ${fixedValues.join(", ")}, ${dynamicPlaceholders.join(", ")});
  `;

  pool.query(query, params, (err, result) => {
    if (err) {
      console.log(`❌ Error en /postSaveEtapa: ${err}`);
      console.log("📝 Query:", query);
      console.log("📝 Params:", params);
      return res.status(500).json({ error: "DB error" });
    }
    res.json({ id: result.insertId, grupo, msg: "Etapa registrada" });
  });
});

function getDateTime(){
  return new Promise((resolve, reject) => {
    var currentdate = new Date();
    if (currentdate) {
      let datetime = "" + currentdate.getDate() + ""
                      + (currentdate.getMonth()+1)  + ""
                      + currentdate.getFullYear() + "-"
                      + currentdate.getHours() + ""
                      + currentdate.getMinutes() + "-"
                      + currentdate.getMilliseconds();

      resolve(datetime);
    }else{
      reject('error');
    }
  });
}

function createImage(img, name, client){
  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/"+client+"/fotosapp/"+ name;
      let pathToServer = "../"+client+"/fotosapp/" + name;
      fs.writeFile(pathToServer, new Buffer.from(img, 'base64'), (err) => {
        if (err){
          reject(err);
        }else{
          resolve({"msg": "create image successfull", "pathToDatabase": pathToDatabase});
        }
      });
    });
  });
}

server.app.post('/postSaveImage', (req, res)=>{
  console.log();
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  imagesArray.forEach((image, index) => {
    new Promise((resolve, reject) => {
      createImage(image.img, image.name, image.client)
      .then((msg) => {
        console.log(msg.msg);
      }).catch((err) => {
        console.error(err);
      });
    });//fin de la promesa imagenes*/
  });

  res.send('completed');
});

server.app.post('/postSaveCheckIn', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageCheckIn(imagesArray["nombre_imagen"], imagesArray["imgF"], imagesArray["c_x_i"], imagesArray["c_y_i"], imagesArray["fecha_i"], imagesArray["usuario_id"], imagesArray["tienda_id"], imagesArray["conPin"], imagesArray["cliente"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageCheckIn(nombre_imagen, imgF, c_x_i, c_y_i, fecha_i, usuario_id, tienda_id, conPin, cliente) {
  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/" + cliente + "/fotosapp/" + nombre_imagen;
      let pathToServer = "../" + cliente + "/fotosapp/" + nombre_imagen;

      fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("avanzo cn path " + pathToDatabase);

          let connection = null;
          let query_up = "";
          query_up = 'INSERT INTO actividades(id, imgF, c_x_i, c_y_i, fecha_i, usuario_id, tienda_id, conPin) VALUES(0, "' + pathToDatabase + '","' + c_x_i + '","' + c_y_i + '","' + fecha_i + '","' + usuario_id + '","' + tienda_id + '","' + conPin + '");';

          new Promise((resolve, reject) => {
            connection = post.connection(cliente);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                connection.end();
                if (err) {
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  resolve(result.insertId); // Aquí devolvemos el ID del registro insertado
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      });
    });
  });
}

server.app.post('/postSaveCheckInDistS3', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageCheckInDistS3(
    imagesArray["nombre_imagen"],
    imagesArray["imgF"],
    imagesArray["c_x_i"],
    imagesArray["c_y_i"],
    imagesArray["fecha_i"],
    imagesArray["usuario_id"],
    imagesArray["tienda_id"],
    imagesArray["conPin"],
    imagesArray["cliente"],
    imagesArray["distancia"]   // recuperar distancia como en la vieja función
  )
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

async function createImageCheckInDistS3(
  nombre_imagen,
  imgF,
  c_x_i,
  c_y_i,
  fecha_i,
  usuario_id,
  tienda_id,
  conPin,
  cliente,
  distancia
) {
  try {
    // 1. Pedir presigned URL a tu backend
    const urlBackend = "http://mctree.mx:8000/sicom/generate-upload-url";
    const urlResponse = await axios.get(urlBackend, {
      params: {
        file_name: nombre_imagen,
        project: cliente,
      },
    });

    if (!urlResponse.data || !urlResponse.data.presigned_url) {
      throw new Error("No se pudo obtener presigned URL del backend");
    }

    const presignedUrl = urlResponse.data.presigned_url;
    const publicUrl = urlResponse.data.public_url || `/${cliente}/${nombre_imagen}`;

    console.log("URL firmada obtenida:", presignedUrl);
    console.log("URL pública generada:", publicUrl);

    // 2. Subir la imagen a S3 usando la URL firmada
    const buffer = Buffer.from(imgF, "base64");

    const uploadResp = await axios.put(presignedUrl, buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
      },
    });

    if (uploadResp.status !== 200) {
      throw new Error("Error al subir imagen a S3");
    }

    console.log("Imagen subida correctamente a S3");

    // 3. Guardar en base de datos (con distancia incluida)
    const query_up = `
      INSERT INTO actividades(id, imgF, c_x_i, c_y_i, fecha_i, usuario_id, tienda_id, conPin, distancia)
      VALUES(0, "${publicUrl}", "${c_x_i}", "${c_y_i}", "${fecha_i}", "${usuario_id}", "${tienda_id}", "${conPin}", "${distancia}");
    `;

    const insertedId = await new Promise((resolve, reject) => {
      const connection = post.connection(cliente);
      connection.connect((err) => {
        if (err) return reject(err);
        connection.query(query_up, (err, result) => {
          connection.end();
          if (err) reject(err);
          else resolve(result.insertId);
        });
      });
    });

    console.log("Registro insertado en DB con ID:", insertedId);
    return insertedId;
  } catch (err) {
    console.error("Error en createImageCheckInDistS3:", err);
    throw err;
  }
}


server.app.post('/postSaveCheckInDist', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageCheckInDist(imagesArray["nombre_imagen"], imagesArray["imgF"], imagesArray["c_x_i"], imagesArray["c_y_i"], imagesArray["fecha_i"], imagesArray["usuario_id"], imagesArray["tienda_id"], imagesArray["conPin"], imagesArray["cliente"], imagesArray["distancia"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageCheckInDist(nombre_imagen, imgF, c_x_i, c_y_i, fecha_i, usuario_id, tienda_id, conPin, cliente, distancia) {
  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/" + cliente + "/fotosapp/" + nombre_imagen;
      let pathToServer = "../" + cliente + "/fotosapp/" + nombre_imagen;

      fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("avanzo cn path " + pathToDatabase);

          let connection = null;
          let query_up = "";
          query_up = 'INSERT INTO actividades(id, imgF, c_x_i, c_y_i, fecha_i, usuario_id, tienda_id, conPin, distancia) VALUES(0, "' + pathToDatabase + '","' + c_x_i + '","' + c_y_i + '","' + fecha_i + '","' + usuario_id + '","' + tienda_id + '","' + conPin + '","' + distancia + '");';

          new Promise((resolve, reject) => {
            connection = post.connection(cliente);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                connection.end();
                if (err) {
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  resolve(result.insertId); // Aquí devolvemos el ID del registro insertado
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      });
    });
  });
}

server.app.post('/postSaveCheckInsMult', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageCheckInsMult(imagesArray["nombre_imagen"], imagesArray["imgF"], imagesArray["c_x_i"], imagesArray["c_y_i"], imagesArray["fecha_i"], imagesArray["fecha_f"], imagesArray["c_x_f"], imagesArray["c_y_f"], imagesArray["usuario_id"], imagesArray["tienda_id"], imagesArray["incidencia"], imagesArray["comentario"], imagesArray["conPin"], imagesArray["cliente"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageCheckInsMult(nombre_imagen, imgF, c_x_i, c_y_i, fecha_i, fecha_f, c_x_f, c_y_f, usuario_id, tienda_id, incidencia, comentario, conPin, cliente) {
  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/" + cliente + "/fotosapp/" + nombre_imagen;
      let pathToServer = "../" + cliente + "/fotosapp/" + nombre_imagen;

      fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("avanzo cn path " + pathToDatabase);

          let connection = null;
          let query_up = "";
          query_up = 'INSERT INTO actividades(id, imgF, c_x_i, c_y_i, fecha_i, fecha_f, c_x_f, c_y_f, usuario_id, tienda_id, incidencia, comentario, conPin) VALUES(0, "' + pathToDatabase + '","' + c_x_i + '","' + c_y_i + '","' + fecha_i + '","' + fecha_f + '","' + c_x_f + '","' + c_y_f + '","' + usuario_id + '","' + tienda_id + '","' + incidencia + '","' + comentario + '","' + conPin + '");';

          new Promise((resolve, reject) => {
            connection = post.connection(cliente);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                connection.end();
                if (err) {
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  resolve(result.insertId); // Aquí devolvemos el ID del registro insertado
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      });
    });
  });
}

server.app.post('/postSaveCheckInsMultDistS3', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageCheckInsMultDistS3(
    imagesArray["nombre_imagen"],
    imagesArray["imgF"],
    imagesArray["c_x_i"],
    imagesArray["c_y_i"],
    imagesArray["fecha_i"],
    imagesArray["fecha_f"],
    imagesArray["c_x_f"],
    imagesArray["c_y_f"],
    imagesArray["usuario_id"],
    imagesArray["tienda_id"],
    imagesArray["incidencia"],
    imagesArray["comentario"],
    imagesArray["conPin"],
    imagesArray["cliente"],
    imagesArray["distancia"]
  )
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});


async function createImageCheckInsMultDistS3(
  nombre_imagen,
  imgF,
  c_x_i,
  c_y_i,
  fecha_i,
  fecha_f,
  c_x_f,
  c_y_f,
  usuario_id,
  tienda_id,
  incidencia,
  comentario,
  conPin,
  cliente,
  distancia
) {
  try {
    // 1. Pedir presigned URL a tu backend
    const urlBackend = "http://mctree.mx:8000/sicom/generate-upload-url";
    const urlResponse = await axios.get(urlBackend, {
      params: {
        file_name: nombre_imagen,
        project: cliente,
      },
    });

    if (!urlResponse.data || !urlResponse.data.presigned_url) {
      throw new Error("No se pudo obtener presigned URL del backend");
    }

    const presignedUrl = urlResponse.data.presigned_url;
    const publicUrl = urlResponse.data.public_url || 
      `/${cliente}/${nombre_imagen}`;

    console.log("URL firmada obtenida:", presignedUrl);
    console.log("URL pública generada:", publicUrl);

    // 2. Subir la imagen a S3 usando la URL firmada
    const buffer = Buffer.from(imgF, "base64");

    const uploadResp = await axios.put(presignedUrl, buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
      },
    });

    if (uploadResp.status !== 200) {
      throw new Error("Error al subir imagen a S3");
    }

    console.log("Imagen subida correctamente a S3");

    // 3. Guardar en base de datos (todos los campos extra incluidos)
    const query_up = `
      INSERT INTO actividades(
        id, imgF, c_x_i, c_y_i, fecha_i, fecha_f, c_x_f, c_y_f, 
        usuario_id, tienda_id, incidencia, comentario, conPin, distancia
      )
      VALUES(
        0, "${publicUrl}", "${c_x_i}", "${c_y_i}", "${fecha_i}", "${fecha_f}", 
        "${c_x_f}", "${c_y_f}", "${usuario_id}", "${tienda_id}", 
        "${incidencia}", "${comentario}", "${conPin}", "${distancia}"
      );
    `;

    const insertedId = await new Promise((resolve, reject) => {
      const connection = post.connection(cliente);
      connection.connect((err) => {
        if (err) return reject(err);
        connection.query(query_up, (err, result) => {
          connection.end();
          if (err) reject(err);
          else resolve(result.insertId);
        });
      });
    });

    console.log("Registro insertado en DB con ID:", insertedId);
    return insertedId;
  } catch (err) {
    console.error("Error en createImageCheckInsMultDistS3:", err);
    throw err;
  }
}


server.app.post('/postSaveCheckInsMultDist', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageCheckInsMultDist(imagesArray["nombre_imagen"], imagesArray["imgF"], imagesArray["c_x_i"], imagesArray["c_y_i"], imagesArray["fecha_i"], imagesArray["fecha_f"], imagesArray["c_x_f"], imagesArray["c_y_f"], imagesArray["usuario_id"], imagesArray["tienda_id"], imagesArray["incidencia"], imagesArray["comentario"], imagesArray["conPin"], imagesArray["cliente"], imagesArray["distancia"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageCheckInsMultDist(nombre_imagen, imgF, c_x_i, c_y_i, fecha_i, fecha_f, c_x_f, c_y_f, usuario_id, tienda_id, incidencia, comentario, conPin, cliente, distancia) {
  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/" + cliente + "/fotosapp/" + nombre_imagen;
      let pathToServer = "../" + cliente + "/fotosapp/" + nombre_imagen;

      fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("avanzo cn path " + pathToDatabase);

          let connection = null;
          let query_up = "";
          query_up = 'INSERT INTO actividades(id, imgF, c_x_i, c_y_i, fecha_i, fecha_f, c_x_f, c_y_f, usuario_id, tienda_id, incidencia, comentario, conPin, distancia) VALUES(0, "' + pathToDatabase + '","' + c_x_i + '","' + c_y_i + '","' + fecha_i + '","' + fecha_f + '","' + c_x_f + '","' + c_y_f + '","' + usuario_id + '","' + tienda_id + '","' + incidencia + '","' + comentario + '","' + conPin + '","' + distancia + '");';

          new Promise((resolve, reject) => {
            connection = post.connection(cliente);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                connection.end();
                if (err) {
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  resolve(result.insertId); // Aquí devolvemos el ID del registro insertado
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      });
    });
  });
}

// Endpoint para actualizar URL de imagen S3 en check-in
server.app.post('/api/updateCheckInImage', async (req, res) => {
  try {
    const { registro_id, imagen_url, cuenta } = req.body;

    console.log("📸 Actualizando imagen de check-in");
    console.log("   - Registro ID:", registro_id);
    console.log("   - URL S3:", imagen_url);
    console.log("   - Cuenta:", cuenta);

    if (!registro_id || !imagen_url || !cuenta) {
      return res.status(400).json({
        error: "Faltan parámetros requeridos",
        required: ["registro_id", "imagen_url", "cuenta"]
      });
    }

    const connection = post.connection(cuenta);
    connection.connect(async (err) => {
      if (err) {
        console.error("❌ Error conectando a BD:", err);
        return res.status(500).json({ error: err.message });
      }

      const query = "UPDATE actividades SET imagen_url = ?, imagen_updated_at = NOW() WHERE id = ?";
      connection.query(query, [imagen_url, registro_id], (err, result) => {
        connection.end();

        if (err) {
          console.error("❌ Error actualizando imagen:", err);
          return res.status(500).json({ error: err.message });
        }

        console.log("✅ Imagen actualizada - Rows affected:", result.affectedRows);
        res.json({
          success: true,
          message: "Imagen actualizada correctamente",
          registro_id: registro_id,
          imagen_url: imagen_url,
          rows_affected: result.affectedRows
        });
      });
    });
  } catch (error) {
    console.error("❌ Error en updateCheckInImage:", error);
    res.status(500).json({ error: error.message });
  }
});

server.app.post('/postSaveInvFanS3', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageInvFanS3(
    imagesArray["nombre_imagen"],
    imagesArray["imgF"],
    imagesArray["sistema"],
    imagesArray["bodega"],
    imagesArray["piso"],
    imagesArray["inventario_id"],
    imagesArray["tienda_id"],
    imagesArray["cliente"]
  )
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});


async function createImageInvFanS3(
  nombre_imagen,
  imgF,
  sistema,
  bodega,
  piso,
  inventario_id,
  tienda_id,
  cliente
) {
  try {
    // 1. Pedir presigned URL a tu backend
    const urlBackend = "http://mctree.mx:8000/sicom/generate-upload-url";
    const urlResponse = await axios.get(urlBackend, {
      params: {
        file_name: nombre_imagen,
        project: cliente,
      },
    });

    if (!urlResponse.data || !urlResponse.data.presigned_url) {
      throw new Error("No se pudo obtener presigned URL del backend");
    }

    const presignedUrl = urlResponse.data.presigned_url;
    const publicUrl =
      urlResponse.data.public_url ||
      `/${cliente}/${nombre_imagen}`;

    console.log("URL firmada obtenida:", presignedUrl);
    console.log("URL pública generada:", publicUrl);

    // 2. Subir la imagen a S3 usando la URL firmada
    const buffer = Buffer.from(imgF, "base64");

    const uploadResp = await axios.put(presignedUrl, buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
      },
    });

    if (uploadResp.status !== 200) {
      throw new Error("Error al subir imagen a S3");
    }

    console.log("Imagen subida correctamente a S3");

    // 3. Insertar en inventariofantasma con la URL
    const query_insert = `
      INSERT INTO inventariofantasma(
        id, fecha, tienda_id, sistema, bodega, piso, fotoF
      )
      VALUES(
        0, NOW(), ${tienda_id}, "${sistema}", "${bodega}", "${piso}", "${publicUrl}"
      );
    `;

    const insertedId = await new Promise((resolve, reject) => {
      const connection = post.connection(cliente);
      connection.connect((err) => {
        if (err) return reject(err);
        connection.query(query_insert, (err, result) => {
          if (err) {
            connection.end();
            return reject(err);
          }

          // 4. Eliminar registro de inventario_fan
          connection.query(
            "DELETE FROM inventario_fan WHERE id = ?",
            [inventario_id],
            (errDelete, resultDelete) => {
              connection.end();
              if (errDelete) return reject(errDelete);
              resolve(result.insertId);
            }
          );
        });
      });
    });

    console.log("Registro insertado en DB con ID:", insertedId);
    return insertedId;
  } catch (err) {
    console.error("Error en createImageInvFanS3:", err);
    throw err;
  }
}



server.app.post('/postSaveInvFan', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageInvFan(imagesArray["nombre_imagen"], imagesArray["imgF"], imagesArray["sistema"], imagesArray["bodega"], imagesArray["piso"], imagesArray["inventario_id"], imagesArray["tienda_id"], imagesArray["cliente"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageInvFan(nombre_imagen, imgF, sistema, bodega, piso, inventario_id, tienda_id, cliente) {
  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/" + cliente + "/fotosapp/" + nombre_imagen;
      let pathToServer = "../" + cliente + "/fotosapp/" + nombre_imagen;

      fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("avanzo cn path " + pathToDatabase);

          let connection = null;
          let query_up = "";
          query_up = 'INSERT INTO inventariofantasma(id, fecha, tienda_id, sistema, bodega, piso, fotoF) VALUES(0, NOW(),' + tienda_id + ',"' + sistema + '","' + bodega + '","' + piso + '","' + pathToDatabase + '");';

          new Promise((resolve, reject) => {
            connection = post.connection(cliente);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                if (err) {
                  connection.end();
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  connection.query(
                    'DELETE FROM inventario_fan WHERE id = ?',
                    [inventario_id],
                    (errDelete, resultDelete) => {
                        connection.end();
                        if (errDelete) {
                            //return res.status(500).json({ error: errDelete.message });
                            reject(errDelete);
                        }
                        resolve(result.insertId);
                        // Envía la respuesta tras completar ambas operaciones
                        // res.json({
                        //     insertResult: rows,
                        //     deleteResult: resultDelete
                        // });
                    }
                  );
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      });
    });
  });
}

server.app.post('/postUpdateTareaAsignada', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageTareaAsignadaUpdate(imagesArray["nombre_imagen"], imagesArray["imgF"], imagesArray["comentario"], imagesArray["tarea_id"], imagesArray["usuario_id"], imagesArray["cliente"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageTareaAsignadaUpdate(nombre_imagen, imgF, comentario, tarea_id, usuario_id, cliente) {
  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/" + cliente + "/fotosapp/" + nombre_imagen;
      let pathToServer = "../" + cliente + "/fotosapp/" + nombre_imagen;

      fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("avanzo cn path " + pathToDatabase);

          let connection = null;
          let query_up = "";
          query_up = 'UPDATE tareas_asignadas SET usuario_id = ' + usuario_id + ', fecha_retro = NOW(), comentario_retro = "' + comentario + '", imgF_retro = "' + pathToDatabase + '" WHERE id = ' + tarea_id + ';';

          new Promise((resolve, reject) => {
            connection = post.connection(cliente);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                if (err) {
                  connection.end();
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  resolve(result.insertId);
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      });
    });
  });
}

server.app.post('/postUpdateTareaAsignadaEstatusS3', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageTareaAsignadaUpdateEstatusS3(
    imagesArray["nombre_imagen"],
    imagesArray["imgF"],
    imagesArray["estatus"],
    imagesArray["comentario"],
    imagesArray["tarea_id"],
    imagesArray["usuario_id"],
    imagesArray["cliente"]
  )
    .then((affectedRows) => {
      console.log("Filas afectadas:", affectedRows);
      res.json({ id: imagesArray["tarea_id"], msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});


async function createImageTareaAsignadaUpdateEstatusS3(
  nombre_imagen,
  imgF,
  estatus,
  comentario,
  tarea_id,
  usuario_id,
  cliente
) {
  try {
    // 1. Pedir presigned URL a tu backend
    const urlBackend = "http://mctree.mx:8000/sicom/generate-upload-url";
    const urlResponse = await axios.get(urlBackend, {
      params: {
        file_name: nombre_imagen,
        project: cliente,
      },
    });

    if (!urlResponse.data || !urlResponse.data.presigned_url) {
      throw new Error("No se pudo obtener presigned URL del backend");
    }

    const presignedUrl = urlResponse.data.presigned_url;
    const publicUrl =
      urlResponse.data.public_url ||
      `/${cliente}/${nombre_imagen}`;

    console.log("URL firmada obtenida:", presignedUrl);
    console.log("URL pública generada:", publicUrl);

    // 2. Subir la imagen a S3
    const buffer = Buffer.from(imgF, "base64");

    const uploadResp = await axios.put(presignedUrl, buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
      },
    });

    if (uploadResp.status !== 200) {
      throw new Error("Error al subir imagen a S3");
    }

    console.log("Imagen subida correctamente a S3");

    // 3. Actualizar registro en tareas_asignadas
    const query_up = `
      UPDATE tareas_asignadas 
      SET usuario_id = ${usuario_id}, 
          fecha_retro = NOW(), 
          estatus = "${estatus}", 
          comentario_retro = "${comentario}", 
          imgF_retro = "${publicUrl}"
      WHERE id = ${tarea_id};
    `;

    const affectedRows = await new Promise((resolve, reject) => {
      const connection = post.connection(cliente);
      connection.connect((err) => {
        if (err) return reject(err);
        connection.query(query_up, (err, result) => {
          connection.end();
          if (err) reject(err);
          else resolve(result.affectedRows);
        });
      });
    });

    console.log("Registro actualizado en DB, filas afectadas:", affectedRows);
    return affectedRows;
  } catch (err) {
    console.error("Error en createImageTareaAsignadaUpdateEstatusS3:", err);
    throw err;
  }
}


server.app.post('/postUpdateTareaAsignadaEstatus', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageTareaAsignadaUpdateEstatus(imagesArray["nombre_imagen"], imagesArray["imgF"], imagesArray["estatus"], imagesArray["comentario"], imagesArray["tarea_id"], imagesArray["usuario_id"], imagesArray["cliente"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageTareaAsignadaUpdateEstatus(nombre_imagen, imgF, estatus, comentario, tarea_id, usuario_id, cliente) {
  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/" + cliente + "/fotosapp/" + nombre_imagen;
      let pathToServer = "../" + cliente + "/fotosapp/" + nombre_imagen;

      fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("avanzo cn path " + pathToDatabase);

          let connection = null;
          let query_up = "";
          query_up = 'UPDATE tareas_asignadas SET usuario_id = ' + usuario_id + ', fecha_retro = NOW(), estatus = "' + estatus + '", comentario_retro = "' + comentario + '", imgF_retro = "' + pathToDatabase + '" WHERE id = ' + tarea_id + ';';

          new Promise((resolve, reject) => {
            connection = post.connection(cliente);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                if (err) {
                  connection.end();
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  resolve(result.insertId);
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      });
    });
  });
}

server.app.post('/postSaveTareas', (req, res) => {
  let datos = JSON.parse(JSON.stringify(req.body));
  let connection= null;
  new Promise((resolve, reject) => {
    connection = post.connection(datos.db);
    connection.connect((err) => {
      if (err) reject(err);
      connection.query("insert into tareasv values(0, NOW(), "
        + datos.tienda +", '"
        + datos.tarea +"', '"
        + datos.comentario +"');", (error, rows, fields) => {
          if (error) reject(error);
          resolve(rows);
        });
    });
  }).then((data) => {
    res.json({"status": 1});
  }).catch((err) => {
    console.log(err);
    res.json({"status": 2})
  });
});


server.app.post('/postSaveTareasFotoS3', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageTareasS3(
    imagesArray["tienda"],
    imagesArray["nombre_imgF"],
    imagesArray["imgF"],
    imagesArray["tarea"],
    imagesArray["comentario"],
    imagesArray["db"]
  )
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});


async function createImageTareasS3(
  tienda,
  nombre_imgF,
  imgF,
  tarea,
  comentario,
  db
) {
  try {
    // 1. Pedir presigned URL al backend
    const urlBackend = "http://mctree.mx:8000/sicom/generate-upload-url";
    const urlResponse = await axios.get(urlBackend, {
      params: {
        file_name: nombre_imgF,
        project: db,
      },
    });

    if (!urlResponse.data || !urlResponse.data.presigned_url) {
      throw new Error("No se pudo obtener presigned URL del backend");
    }

    const presignedUrl = urlResponse.data.presigned_url;
    const publicUrl =
      urlResponse.data.public_url ||
      `/${db}/${nombre_imgF}`;

    console.log("URL firmada obtenida:", presignedUrl);
    console.log("URL pública generada:", publicUrl);

    // 2. Subir la imagen a S3 usando la URL firmada
    const buffer = Buffer.from(imgF, "base64");

    const uploadResp = await axios.put(presignedUrl, buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
      },
    });

    if (uploadResp.status !== 200) {
      throw new Error("Error al subir imagen a S3");
    }

    console.log("Imagen subida correctamente a S3");

    // 3. Insertar en la tabla tareasv con la URL pública
    const query_up = `
      INSERT INTO tareasv(id, fecha, tienda, opcion, comentario, imgF)
      VALUES(0, NOW(), ${tienda}, "${tarea}", "${comentario}", "${publicUrl}");
    `;

    const insertedId = await new Promise((resolve, reject) => {
      const connection = post.connection(db);
      connection.connect((err) => {
        if (err) return reject(err);
        connection.query(query_up, (err, result) => {
          connection.end();
          if (err) reject(err);
          else resolve(result.insertId);
        });
      });
    });

    console.log("Registro insertado en DB con ID:", insertedId);
    return insertedId;
  } catch (err) {
    console.error("Error en createImageTareasS3:", err);
    throw err;
  }
}


server.app.post('/postSaveTareasFoto', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageTareas(imagesArray["tienda"], imagesArray["nombre_imgF"], imagesArray["imgF"], imagesArray["tarea"], imagesArray["comentario"], imagesArray["db"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageTareas(tienda, nombre_imgF, imgF, tarea, comentario, db) {
  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/" + db + "/fotosapp/" + nombre_imgF;
      let pathToServer = "../" + db + "/fotosapp/" + nombre_imgF;

      fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("avanzo cn path " + pathToDatabase);

          let connection = null;
          let query_up = "";
          query_up = 'INSERT INTO tareasv(id, fecha, tienda, opcion, comentario, imgF) VALUES(0, NOW(),' + tienda + ',"' + tarea + '","' + comentario + '","' + pathToDatabase + '");';

          new Promise((resolve, reject) => {
            connection = post.connection(db);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                connection.end();
                if (err) {
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  resolve(result.insertId); // Aquí devolvemos el ID del registro insertado
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      });
    });
  });
}

server.app.post('/postSaveTareasFotoAsignadasS3', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageTareasAsignadasS3(
    imagesArray["tienda"],
    imagesArray["nombre_imgF"],
    imagesArray["imgF"],
    imagesArray["tarea"],
    imagesArray["comentario"],
    imagesArray["db"]
  )
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});


async function createImageTareasAsignadasS3(
  tienda,
  nombre_imgF,
  imgF,
  tarea,
  comentario,
  db
) {
  try {
    // 1. Pedir presigned URL al backend
    const urlBackend = "http://mctree.mx:8000/sicom/generate-upload-url";
    const urlResponse = await axios.get(urlBackend, {
      params: {
        file_name: nombre_imgF,
        project: db,
      },
    });

    if (!urlResponse.data || !urlResponse.data.presigned_url) {
      throw new Error("No se pudo obtener presigned URL del backend");
    }

    const presignedUrl = urlResponse.data.presigned_url;
    const publicUrl =
      urlResponse.data.public_url ||
      `/${db}/${nombre_imgF}`;

    console.log("URL firmada obtenida:", presignedUrl);
    console.log("URL pública generada:", publicUrl);

    // 2. Subir la imagen a S3 usando la URL firmada
    const buffer = Buffer.from(imgF, "base64");

    const uploadResp = await axios.put(presignedUrl, buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
      },
    });

    if (uploadResp.status !== 200) {
      throw new Error("Error al subir imagen a S3");
    }

    console.log("Imagen subida correctamente a S3");

    // 3. Insertar en la tabla tareas_asignadas con la URL pública
    const query_up = `
      INSERT INTO tareas_asignadas(id, fecha, tienda, opcion, comentario, imgF)
      VALUES(0, NOW(), ${tienda}, "${tarea}", "${comentario}", "${publicUrl}");
    `;

    const insertedId = await new Promise((resolve, reject) => {
      const connection = post.connection(db);
      connection.connect((err) => {
        if (err) return reject(err);
        connection.query(query_up, (err, result) => {
          connection.end();
          if (err) reject(err);
          else resolve(result.insertId);
        });
      });
    });

    console.log("Registro insertado en DB con ID:", insertedId);
    return insertedId;
  } catch (err) {
    console.error("Error en createImageTareasAsignadasS3:", err);
    throw err;
  }
}


server.app.post('/postSaveTareasFotoAsignadas', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageTareasAsignadas(imagesArray["tienda"], imagesArray["nombre_imgF"], imagesArray["imgF"], imagesArray["tarea"], imagesArray["comentario"], imagesArray["db"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageTareasAsignadas(tienda, nombre_imgF, imgF, tarea, comentario, db) {
  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/" + db + "/fotosapp/" + nombre_imgF;
      let pathToServer = "../" + db + "/fotosapp/" + nombre_imgF;

      fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("avanzo cn path " + pathToDatabase);

          let connection = null;
          let query_up = "";
          query_up = 'INSERT INTO tareas_asignadas(id, fecha, tienda, opcion, comentario, imgF) VALUES(0, NOW(),' + tienda + ',"' + tarea + '","' + comentario + '","' + pathToDatabase + '");';

          new Promise((resolve, reject) => {
            connection = post.connection(db);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                connection.end();
                if (err) {
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  resolve(result.insertId); // Aquí devolvemos el ID del registro insertado
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      });
    });
  });
}

server.app.post('/postSaveAplicaciones', (req, res) => {
  let datos = JSON.parse(JSON.stringify(req.body));
  let connection= null;
  new Promise((resolve, reject) => {
    connection = post.connection(datos.db);
    connection.connect((err) => {
      if (err) reject(err);
      connection.query("insert into aplicaciones_instaladas values(0, NOW(), "
        + datos.user_id +", '"
        + datos.aplicaciones +"', '"
        + datos.telefono +"');", (error, rows, fields) => {
          if (error) reject(error);
          resolve(rows);
        });
    });
  }).then((data) => {
    res.json({"status": 1});
  }).catch((err) => {
    console.log(err);
    res.json({"status": 2})
  });
});


server.app.post('/postSaveCheckOut', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageCheckOut(imagesArray["c_x_f"], imagesArray["c_y_f"], imagesArray["fecha_f"], imagesArray["incidencia"], imagesArray["comentario"], imagesArray["registroId"], imagesArray["cliente"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageCheckOut(c_x_f, c_y_f, fecha_f, incidencia, comentario, registroId, cliente) {
  return new Promise((resolve, reject) => {

          let connection = null;
          let query_up = "";
          query_up = 'Update actividades Set c_x_f="'+c_x_f+'", c_y_f="'+c_y_f+'", fecha_f="'+fecha_f+'", incidencia="'+incidencia+'", comentario="'+comentario+'" Where id='+registroId;

          new Promise((resolve, reject) => {
            connection = post.connection(cliente);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                connection.end();
                if (err) {
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  resolve(result.insertId); // Aquí devolvemos el ID del registro insertado
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
  });
}

server.app.post('/postSaveCheckOutFotoS3', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageCheckOutFotoS3(
    imagesArray["c_x_f"],
    imagesArray["c_y_f"],
    imagesArray["fecha_f"],
    imagesArray["incidencia"],
    imagesArray["comentario"],
    imagesArray["registroId"],
    imagesArray["cliente"],
    imagesArray["nombre_imagen"],
    imagesArray["imgF"]
  )
    .then((affectedRows) => {
      console.log("Filas afectadas:", affectedRows);
      res.json({ id: imagesArray["registroId"], msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});


async function createImageCheckOutFotoS3(
  c_x_f,
  c_y_f,
  fecha_f,
  incidencia,
  comentario,
  registroId,
  cliente,
  nombre_imagen,
  imgF
) {
  try {
    // 1. Pedir presigned URL a tu backend
    const urlBackend = "http://mctree.mx:8000/sicom/generate-upload-url";
    const urlResponse = await axios.get(urlBackend, {
      params: {
        file_name: nombre_imagen,
        project: cliente,
      },
    });

    if (!urlResponse.data || !urlResponse.data.presigned_url) {
      throw new Error("No se pudo obtener presigned URL del backend");
    }

    const presignedUrl = urlResponse.data.presigned_url;
    const publicUrl =
      urlResponse.data.public_url ||
      `/${cliente}/${nombre_imagen}`;

    console.log("URL firmada obtenida:", presignedUrl);
    console.log("URL pública generada:", publicUrl);

    // 2. Subir la imagen a S3 usando la URL firmada
    const buffer = Buffer.from(imgF, "base64");

    const uploadResp = await axios.put(presignedUrl, buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.length,
      },
    });

    if (uploadResp.status !== 200) {
      throw new Error("Error al subir imagen a S3");
    }

    console.log("Imagen subida correctamente a S3");

    // 3. Actualizar la actividad con datos de checkout y la URL de la foto
    const query_up = `
      UPDATE actividades 
      SET c_x_f="${c_x_f}", 
          c_y_f="${c_y_f}", 
          fecha_f="${fecha_f}", 
          incidencia="${incidencia}", 
          comentario="${comentario}", 
          imgF="${publicUrl}"
      WHERE id=${registroId};
    `;

    const affectedRows = await new Promise((resolve, reject) => {
      const connection = post.connection(cliente);
      connection.connect((err) => {
        if (err) return reject(err);
        connection.query(query_up, (err, result) => {
          connection.end();
          if (err) reject(err);
          else resolve(result.affectedRows);
        });
      });
    });

    console.log("Registro actualizado en DB, filas afectadas:", affectedRows);
    return affectedRows;
  } catch (err) {
    console.error("Error en createImageCheckOutFotoS3:", err);
    throw err;
  }
}


server.app.post('/postSaveCheckOutFoto', (req, res) => {
  let imagesArray = JSON.parse(JSON.stringify(req.body));

  createImageCheckOutFoto(imagesArray["c_x_f"], imagesArray["c_y_f"], imagesArray["fecha_f"], imagesArray["incidencia"], imagesArray["comentario"], imagesArray["registroId"], imagesArray["cliente"], imagesArray["nombre_imagen"], imagesArray["imgF"])
    .then((insertedId) => {
      console.log("Inserted ID:", insertedId);
      res.json({ id: insertedId, msg: 'completed' });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    });
});

function createImageCheckOutFoto(c_x_f, c_y_f, fecha_f, incidencia, comentario, registroId, cliente, nombre_imagen, imgF) {

  return new Promise((resolve, reject) => {
    getDateTime().then((datetime) => {
      let pathToDatabase = "/" + cliente + "/fotosapp/" + nombre_imagen;
      let pathToServer = "../" + cliente + "/fotosapp/" + nombre_imagen;

      fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
        if (err) {
          reject(err);
        } else {
          console.log("avanzo cn path " + pathToDatabase);

          let connection = null;
          let query_up = "";
          query_up = 'Update actividades Set c_x_f="'+c_x_f+'", c_y_f="'+c_y_f+'", fecha_f="'+fecha_f+'", incidencia="'+incidencia+'", comentario="'+comentario+'" Where id='+registroId;

          new Promise((resolve, reject) => {
            connection = post.connection(cliente);
            connection.connect((err) => {
              if (err) reject(err);
              connection.query(query_up, (err, result) => {
                connection.end();
                if (err) {
                  reject(err);
                } else {
                  console.log("Enviada la imagen");
                  resolve(result.insertId); // Aquí devolvemos el ID del registro insertado
                }
              });
            });
          }).then((insertedId) => {
            console.log("Enviado");
            resolve(insertedId);
          }).catch((err) => {
            console.log(err);
            reject(err);
          });
        }
      });
    });
  });

}


// server.app.post('/postSaveCheckIn', (req, res)=>{
//   let imagesArray = JSON.parse(JSON.stringify(req.body));
//   createImageCheckIn(imagesArray["nombre_imagen"], imagesArray["imgF"], imagesArray["c_x_i"], imagesArray["c_y_i"], imagesArray["fecha_i"], imagesArray["usuario_id"], imagesArray["tienda_id"], imagesArray["conPin"], imagesArray["cliente"])
//   .then((msg) => {
//     console.log(msg.msg);
//   }).catch((err) => {
//     console.error(err);
//   });

//   res.send('completed');
// });

// function createImageCheckIn(nombre_imagen, imgF, c_x_i, c_y_i, fecha_i, usuario_id, tienda_id, conPin, cliente){
//   return new Promise((resolve, reject) => {
//     getDateTime().then((datetime) => {
//       let pathToDatabase = "/"+cliente+"/fotosapp/"+ nombre_imagen;
//       let pathToServer = "../"+cliente+"/fotosapp/" + nombre_imagen;
      
//       fs.writeFile(pathToServer, new Buffer.from(imgF, 'base64'), (err) => {
//         if (err){
//           reject(err);
//         }else{
//           console.log("avanzo cn path "+ pathToDatabase);

//           let connection= null;
//           let query_up = "";
//           query_up = 'INSERT INTO actividades(id, imgF, c_x_i, c_y_i, fecha_i, usuario_id, tienda_id, conPin) VALUES(0, "'+pathToDatabase+'","'+c_x_i+'","'+c_y_i+'","'+fecha_i+'","'+usuario_id+'","'+tienda_id+'","'+conPin+'");';

//           new Promise((resolve, reject) => {
//             connection = post.connection(cliente);
//             connection.connect((err) => {
//               if (err) reject(err);
//                 connection.query(query_up, (err, rows, fields) => {
//                   connection.end();
//                   console.log("Enviada la imagen");
//                   resolve(rows);
//                 });
//             });
//           }).then((data) => {
//             console.log("Enviado");
//           }).catch((err) => {
//             console.log(err);
//           });
//           resolve({"msg": "create image successfull", "pathToDatabase": pathToDatabase});
//         }
//       });
//     });
//   });
// }

