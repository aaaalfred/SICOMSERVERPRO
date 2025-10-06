'use strict';

const bodyParser = require('body-parser');
//const configDBTables = require('../util/configTablesClients.json');
const tablas_array = [];

var fs = require('fs');


class Get {

	getTableListValues(req, connection, res){
		connection.query('SELECT * FROM ' + req.params.table, (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getPin(req, connection, res) {
		connection.query('SELECT pin FROM configuracion', (err, rows, fields) => {
			connection.end();
			res.json(rows[0]);
		});
	}

	getValuesTableById(req, connection, res){
		//console.log('SELECT * FROM ' + req.params.table + ' WHERE id = ' + req.params.id);
		if(req.params.table == "configuracion"){
			connection.query('SELECT * FROM configuracion;', (err, rows, fields) => {
				connection.end();
				res.json(JSON.parse(JSON.stringify(rows[0])));
			});
		}else{
			connection.query('SELECT * FROM ' + req.params.table + ' WHERE id = ' + req.params.id, (err, rows, fields) => {
				connection.end();
				res.json(JSON.parse(JSON.stringify(rows[0])));
			});
		}
		
	}

	getValoresModulo(req, connection, res){
		connection.query('SELECT * FROM ' + req.params.table + ' WHERE tienda_id = ' + req.params.id+' AND DATE(fecha) = CURDATE();', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
		
	}

	getValuesTableByTiendaId(req, connection, res){
			connection.query('SELECT * FROM ' + req.params.table + ' WHERE tienda_id = ' + req.params.tienda_id, (err, rows, fields) => {
				connection.end();
				res.json(JSON.parse(JSON.stringify(rows)));
			});
		
	}

	getValuesTableByValor(req, connection, res){
			connection.query('SELECT * FROM ' + req.params.table + ' WHERE '+req.params.condicion +' = "' + req.params.tienda_id+'";', (err, rows, fields) => {
				connection.end();
				res.json(JSON.parse(JSON.stringify(rows)));
			});
		
	}

	getValuesTableByDetCad(req, connection, res){
			connection.query('SELECT * FROM ' + req.params.table + ' WHERE determinante = "' + req.params.determinante+'" AND cadena = "' + req.params.cadena+'";', (err, rows, fields) => {
				connection.end();
				res.json(JSON.parse(JSON.stringify(rows)));
			});
		
	}

	getUbicacionActual(req, connection, res){
		connection.query('select * from locationsusers where locationsusers.id_usuario = '+ req.params.id+' AND DATE_FORMAT(created_at,"%Y-%m-%d")=DATE(now()) ORDER BY id DESC LIMIT 1', (err, rows, fields) => {
			connection.end();
			if(rows==0){
				console.log('No trae ubicaciones');
				res.json(JSON.parse(JSON.stringify(rows)));	
			} else {
				console.log('trae ubicaciones');
			res.json(JSON.parse(JSON.stringify(rows[0])));
		}
		});
	}

	getUbicacionUsuariosActual(req, connection, res){
		connection.query('SELECT locationsusers.id, locationsusers.lat, locationsusers.log, locationsusers.created_at, usuarios.nombre FROM locationsusers INNER JOIN usuarios ON usuarios.nip = locationsusers.id_usuario WHERE DATE_FORMAT(created_at,"%Y-%m-%d")=DATE(now()) and locationsusers.id IN (SELECT MAX(id) FROM locationsusers GROUP BY locationsusers.id_usuario) ORDER BY id DESC', (err, rows, fields) => {
			connection.end();
				console.log('No trae ubicaciones');
				res.json(JSON.parse(JSON.stringify(rows)));	
		});
	}

	getValuesTableByNip(req, connection, res){
		connection.query('SELECT * FROM ' + req.params.table + ' WHERE nip = ' + req.params.nip, (err, rows, fields) => {
			connection.end();
			if(rows==0){
				console.log('entro en 0');
				res.json(JSON.parse(JSON.stringify(rows)));	
			} else {
				console.log('entro en 1');
			res.json(JSON.parse(JSON.stringify(rows[0])));
		}
		});
	}

	getValuesActividadesNow(req, connection, res){
		connection.query('SELECT actividades.id,actividades.fecha_i, actividades.fecha_f, actividades.c_x_i, actividades.c_x_f, actividades.c_y_i, actividades.c_y_f, actividades.incidenciaE,actividades.imgF,usuarios.ruta,usuarios.nip, usuarios.nombre as promo, tiendas.numero,tiendas.tienda,cadenas.cadena, TIMEDIFF (fecha_f,fecha_i) AS tiempo FROM actividades INNER JOIN tiendas ON actividades.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id=cadenas.id INNER JOIN usuarios ON actividades.usuario_id=usuarios.nip AND actividades.usuario_id=usuarios.nip AND DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now()) WHERE actividades.usuario_id = '+req.params.user+' and actividades.conPin !=100 ORDER BY actividades.id', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getValuesActividadesCanceladas(req, connection, res){
		connection.query('SELECT actividades.id,actividades.fecha_i, usuarios.ruta,usuarios.nip, usuarios.nombre as promo, tiendas.numero,tiendas.tienda,cadenas.cadena, TIMEDIFF (fecha_f,fecha_i) AS tiempo, incidenciasc.tipo, actividades.incidenciaE FROM actividades INNER JOIN tiendas ON actividades.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id=cadenas.id INNER JOIN incidenciasc ON incidenciasc.id=actividades.id_incidencias INNER JOIN usuarios ON actividades.usuario_id=usuarios.nip AND actividades.usuario_id=usuarios.nip AND DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now()) WHERE actividades.usuario_id = '+req.params.user+' and actividades.conPin = 100 ORDER BY actividades.id', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getValuesActividadesFaltantes(req, connection, res){
		connection.query('SELECT hc.id, hc.tienda_id, tiendas.tienda, tiendas.numero, cadenas.cadena, hc.fecha from hc INNER JOIN tiendas ON hc.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id =cadenas.id INNER JOIN usuarios ON usuarios.nip = hc.usuario_id WHERE NOT EXISTS (SELECT NULL FROM actividades WHERE actividades.usuario_id = hc.usuario_id and actividades.tienda_id = hc.tienda_id and DATE_FORMAT(actividades.fecha_i,"%Y-%m-%d") = DATE_FORMAT(hc.fecha,"%Y-%m-%d")) and DATE_FORMAT(hc.fecha,"%Y-%m-%d")=DATE(now()) and hc.usuario_id = '+req.params.user, (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getValuesActividadesTotalNow(req, connection, res){
		connection.query('SELECT hc.tienda_id, tiendas.tienda, cadenas.cadena, usuarios.nombre, hc.fecha from hc INNER JOIN tiendas ON hc.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id =cadenas.id INNER JOIN usuarios ON usuarios.nip = hc.usuario_id WHERE hc.fecha = curdate() and hc.activa = 1 and hc.usuario_id = '+req.params.user, (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getPorcentaje(req, connection, res){
		connection.query('SELECT (((SELECT COUNT(*) FROM actividades INNER JOIN tiendas ON actividades.tienda_id=tiendas.id and actividades.conPin != 100 INNER JOIN cadenas ON tiendas.cadenas_id=cadenas.id INNER JOIN usuarios ON actividades.usuario_id=usuarios.nip AND actividades.usuario_id=usuarios.nip AND DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now()) WHERE actividades.usuario_id = '+req.params.user+' ORDER BY actividades.id)*100 )/(SELECT COUNT(*) from hc INNER JOIN tiendas ON hc.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id =cadenas.id INNER JOIN usuarios ON usuarios.nip = hc.usuario_id WHERE hc.fecha = curdate() and hc.activa = 1 and hc.usuario_id ='+req.params.user+')) AS porcentaje', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows[0])));
		});
	}

	setActividad(req, connection, res){
		connection.query('INSERT INTO actividades VALUES (0, "", 0.0, 0.0, now(), now(), 0.0, 0.0, '+req.params.user+', '+req.params.tienda+', '+req.params.incidencia+', "'+req.params.comentario+'", 100)', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}
	
	getValuesActividadesBetweenUser(req, connection, res){
		connection.query('SELECT actividades.id,actividades.fecha_i, actividades.fecha_f, actividades.c_x_i, actividades.c_x_f, actividades.c_y_i, actividades.c_y_f, actividades.incidenciaE,actividades.imgF, usuarios.ruta,usuarios.nip, usuarios.localidad, usuarios.nombre as promo,usuarios.app,usuarios.apm, tiendas.numero,tiendas.tienda,cadenas.cadena, TIMEDIFF (fecha_f,fecha_i) AS tiempo FROM actividades INNER JOIN tiendas ON actividades.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id=cadenas.id INNER JOIN usuarios ON actividades.usuario_id=usuarios.nip AND actividades.usuario_id=usuarios.nip AND DATE_FORMAT(fecha_i,"%Y-%m-%d") BETWEEN "'+req.params.date1+'" AND "'+req.params.date2+'" WHERE actividades.usuario_id = '+req.params.user+' and actividades.conPin != 100', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	setActividadFiltro(req, connection, res){
		connection.query('INSERT INTO actividades VALUES (0, "", 0.0, 0.0, "'+req.params.fecha+'", "'+req.params.fecha+'", 0.0, 0.0, '+req.params.user+', '+req.params.tienda+', '+req.params.incidencia+', "'+req.params.comentario+'", 100)', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getValuesActividadesFaltantesFiltro(req, connection, res){
		connection.query('SELECT hc.id, hc.tienda_id, tiendas.tienda, tiendas.numero, cadenas.cadena, hc.fecha from hc INNER JOIN tiendas ON hc.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id =cadenas.id INNER JOIN usuarios ON usuarios.nip = hc.usuario_id WHERE NOT EXISTS (SELECT NULL FROM actividades WHERE actividades.usuario_id = hc.usuario_id and actividades.tienda_id = hc.tienda_id and DATE_FORMAT(actividades.fecha_i,"%Y-%m-%d") = DATE_FORMAT(hc.fecha,"%Y-%m-%d")) and DATE_FORMAT(hc.fecha,"%Y-%m-%d")=DATE("'+req.params.fecha+'") and hc.activa = 1 and hc.usuario_id ='+req.params.user, (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getHcActiva(req, connection, res){
		connection.query('SELECT fecha, COUNT(*) as total FROM hc WHERE NOT EXISTS( SELECT null from actividades WHERE DATE_FORMAT(actividades.fecha_i,"%Y-%m-%d") = DATE_FORMAT(hc.fecha,"%Y-%m-%d") and actividades.usuario_id = '+req.params.user+' and actividades.tienda_id = hc.tienda_id and actividades.conPin != 100 ) AND MONTH(fecha) = MONTH(now()) and activa =1 and usuario_id = '+req.params.user+' GROUP BY fecha', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	/*getValuesTableByUsuario(req, connection, res){
		connection.query('SELECT * FROM ' + req.params.table + ' WHERE usuario = "' + req.params.user+'"', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows[0])));
		});
	}*/
	getValuesTableByUsuario(req, connection, res){
		connection.query('SELECT * FROM ' + req.params.table + ' WHERE usuario = "' + req.params.user+'"', (err, rows, fields) => {
			connection.end();
			if(rows[0] == null){
				console.log('No existe el usuario');
				res.json(JSON.parse(JSON.stringify(rows)));
			}else{
				console.log('usuario: '+JSON.stringify(rows[0].usuario));
				res.json(JSON.parse(JSON.stringify(rows[0])));
			}
			//res.json(JSON.parse(JSON.stringify(rows[0])));
		});
	}

	getValuesTableByCuenta(req, connection, res){
		connection.query('SELECT * FROM ' + req.params.table + ' WHERE cuenta = "' + req.params.cuenta+'"', (err, rows, fields) => {
			connection.end();
			if(rows[0] == null){
				console.log('No existe la cuenta');
				res.json(JSON.parse(JSON.stringify(rows)));
			}else{
				console.log('cuenta: '+JSON.stringify(rows[0].cuenta));
				res.json(JSON.parse(JSON.stringify(rows[0])));
			}
			//res.json(JSON.parse(JSON.stringify(rows[0])));
		});
	}

	 getShowTables(req, connection, res){ 
		//connection.query('SELECT id FROM usuarios WHERE id IN (SELECT actividades.usuario_id FROM actividades WHERE DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now()))', (err, rows, fields) => {
			//connection.query('show tables like "%hc%"', (err, rows, fields) => {
				connection.query('SELECT COUNT(*) as hc FROM tables WHERE table_name like "%hc%" and TABLE_SCHEMA = "'+req.params.cuenta+'"', (err, rows, fields) => {

			connection.end();
				res.json(JSON.parse(JSON.stringify(rows[0])));	

			//connection.end();
//			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTiendas(req, connection, res){ 
			connection.query('SELECT tiendas.id, tiendas.tienda, tiendas.numero, cadenas.cadena FROM `tiendas` INNER JOIN cadenas ON cadenas.id = tiendas.cadenas_id', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}
	setCambiarFecha(req, connection, res){
		connection.query('Update hc Set fecha="'+req.params.fecha_c+'", fecha_c=curdate(), fecha_o="'+req.params.fecha_o+'", responsable="'+req.params.responsable+'", status="'+req.params.actualizacion+'" Where id='+req.params.id, (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}
	setActivo(req, connection, res){
		connection.query('Update hc Set activa=0, responsable="'+req.params.responsable+'", fecha_c=curdate(),  status="cancelacion" Where id='+req.params.id, (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getUsuariosActivos(req, connection, res){ 
		//connection.query('SELECT id FROM usuarios WHERE id IN (SELECT actividades.usuario_id FROM actividades WHERE DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now()))', (err, rows, fields) => {
			connection.query('SELECT DISTINCT usuarios.id, usuarios.nombre, usuarios.nip, usuarios.telefono, if (actividades.usuario_id>0 and (SELECT COUNT(*) from actividades WHERE actividades.usuario_id = usuarios.nip and actividades.conPin!=100 and DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now()))>0,true,false) as activo,actividades.usuario_id, (SELECT COUNT(*) from actividades WHERE actividades.usuario_id = usuarios.nip and actividades.conPin!=100 and DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now())) as act FROM actividades RIGHT JOIN usuarios ON actividades.usuario_id=usuarios.nip AND DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now()) WHERE usuarios.supervisor='+req.params.id+" ORDER BY usuarios.nombre ASC", (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
			//connection.end();
//			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getUsuariosActivosSA(req, connection, res){ 
		//connection.query('SELECT id FROM usuarios WHERE id IN (SELECT actividades.usuario_id FROM actividades WHERE DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now()))', (err, rows, fields) => {
			connection.query('SELECT DISTINCT usuarios.id, usuarios.nombre, usuarios.nip, usuarios.telefono, usuarios.supervisor, if (actividades.usuario_id>0 and (SELECT COUNT(*) from actividades WHERE actividades.usuario_id = usuarios.nip and actividades.conPin!=100 and DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now()))>0,true,false) as activo,actividades.usuario_id, (SELECT COUNT(*) from actividades WHERE actividades.usuario_id = usuarios.nip and actividades.conPin!=100 and DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now())) as act FROM actividades RIGHT JOIN usuarios ON actividades.usuario_id=usuarios.nip AND DATE_FORMAT(fecha_i,"%Y-%m-%d")=DATE(now()) ORDER BY usuarios.nombre ASC', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
			//connection.end();
//			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}
	
	getTableListValuesModulo(req, connection, res){
		console.log(req.params.table);
		console.log(req.params.modulo);
		connection.query('SELECT * FROM ' + req.params.table+' where modulo = "'+req.params.modulo+'"', (err, rows, fields) => {
			connection.end();
			if(rows==null){
				console.log("no esxiste");
				res.json();

			}
			else{
			res.json(JSON.parse(JSON.stringify(rows)));
		}
		});
	}

	setHc(req, connection, res){
		connection.query('INSERT INTO hc VALUES (0, '+req.params.user+', '+req.params.tienda+', "'+req.params.fecha+'", 1, "", null, "", null)', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTiendasCercanas(req, connection, res){
		//connection.query('SELECT *, ( 6371 * acos(cos(radians('+req.params.coordenadax+')) * cos(radians(coordenadax)) * cos(radians(coordenaday) - radians('+req.params.coordenaday+')) + sin(radians('+req.params.coordenadax+')) * sin(radians(coordenadax)))) as distancia FROM tiendas WHERE coordenadax between ('+req.params.coordenadax+'-0.5) and ('+req.params.coordenadax+'+0.5) and coordenaday between ('+req.params.coordenaday+'-0.5) and ('+req.params.coordenaday+'+0.5) having distancia < (250/1000)', (err, rows, fields) => {
		connection.query('SELECT tiendas.*, cadenas.cadena, ( 6371 * acos(cos(radians('+req.params.coordenadax+')) * cos(radians(coordenadax)) * cos(radians(coordenaday) - radians('+req.params.coordenaday+')) + sin(radians('+req.params.coordenadax+')) * sin(radians(coordenadax)))) as distancia FROM tiendas INNER JOIN cadenas ON cadenas.id = tiendas.cadenas_id WHERE coordenadax between ('+req.params.coordenadax+'-0.5) and ('+req.params.coordenadax+'+0.5) and coordenaday between ('+req.params.coordenaday+'-0.5) and ('+req.params.coordenaday+'+0.5) having distancia < (500/1000)', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getEstancia(req, connection, res){
		connection.query('SELECT actividades.id,actividades.fecha_i, actividades.fecha_f,actividades.incidenciaE,actividades.imgF, actividades.c_x_i AS lon, actividades.c_y_i AS lat, usuarios.ruta,usuarios.nip, usuarios.localidad, usuarios.nombre as promo,usuarios.app,usuarios.apm,usuarios.foto, incidenciasc.tipo, tiendas.numero,tiendas.tienda,cadenas.cadena,tiendas.id as idtienda,tiendas.localizacion, TIMEDIFF (fecha_f,fecha_i) AS tiempo, IF(TIMEDIFF (fecha_f,fecha_i)="00:00:00","CANCELADA","SI") AS VISITADA FROM actividades INNER JOIN incidenciasc ON actividades.id_incidencias=incidenciasc.id INNER JOIN tiendas ON actividades.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id=cadenas.id INNER JOIN usuarios ON actividades.usuario_id=usuarios.nip AND fecha_i BETWEEN "'+req.params.fecha1+'" AND DATE_ADD("'+req.params.fecha2+'", INTERVAL 1 DAY) ORDER BY actividades.id; ', (err, projects, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(projects)));
		});
	}

	getUpdate(req, connection, res){
		connection.query('SELECT hc.id,hc.fecha, hc.usuario_id, hc.tienda_id, hc.activa, usuarios.nip, usuarios.localidad, usuarios.nombre as promo,usuarios.app,usuarios.apm,usuarios.foto, tiendas.numero,tiendas.tienda,cadenas.cadena,tiendas.id as idtienda,tiendas.localizacion FROM hc INNER JOIN usuarios ON hc.usuario_id=usuarios.nip INNER JOIN tiendas ON hc.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id=cadenas.id AND fecha BETWEEN "'+req.params.fecha1+'" AND DATE_ADD("'+req.params.fecha2+'", INTERVAL 1 DAY) ORDER BY hc.id;', (err, projects, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(projects)));
		});
	}

	reporteActividades(req, connection, res){
		var union="";
		//query estancia
			connection.query('SELECT actividades.id,actividades.fecha_i, actividades.fecha_f,actividades.incidenciaE,actividades.imgF, actividades.c_x_i AS lon, actividades.c_y_i AS lat, usuarios.ruta,usuarios.nip, usuarios.localidad, usuarios.nombre as promo,usuarios.app,usuarios.apm,usuarios.foto, incidenciasc.tipo, tiendas.numero,tiendas.tienda,cadenas.cadena,tiendas.id as idtienda,tiendas.localizacion, TIMEDIFF (fecha_f,fecha_i) AS tiempo, IF(TIMEDIFF (fecha_f,fecha_i)="00:00:00","CANCELADA","SI") AS VISITADA FROM actividades INNER JOIN incidenciasc ON actividades.id_incidencias=incidenciasc.id INNER JOIN tiendas ON actividades.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id=cadenas.id INNER JOIN usuarios ON actividades.usuario_id=usuarios.nip AND fecha_i BETWEEN "'+req.params.fecha1+'" AND DATE_ADD("'+req.params.fecha2+'", INTERVAL 1 DAY) ORDER BY actividades.id; ', (err, estancia, fields) => {
		//query update
			connection.query('SELECT hc.id,hc.fecha, hc.usuario_id, hc.tienda_id, hc.activa, usuarios.nip, usuarios.localidad, usuarios.nombre as promo,usuarios.app,usuarios.apm,usuarios.foto, tiendas.numero,tiendas.tienda,cadenas.cadena,tiendas.id as idtienda,tiendas.localizacion FROM hc INNER JOIN usuarios ON hc.usuario_id=usuarios.nip INNER JOIN tiendas ON hc.tienda_id=tiendas.id INNER JOIN cadenas ON tiendas.cadenas_id=cadenas.id AND fecha BETWEEN "'+req.params.fecha1+'" AND DATE_ADD("'+req.params.fecha2+'", INTERVAL 1 DAY) ORDER BY hc.id;', (err, update, fields) => {
			connection.end();
			var inicio ='{"template": { "shortid": "B1Q2SFTNr" },"data": {"estancia":';
            var fin ='},"options": { "preview": true, "reportName": "prueba" }}';
            var hola = inicio+JSON.stringify(estancia)+',"update":'+JSON.stringify(update)+fin;
			res.json(JSON.parse(hola));
		});
		});
	}

	saveAplicaciones(req, connection, res){
		connection.query('INSERT INTO aplicaciones_instaladas VALUES (0, now(), '+req.params.usuario+', "'+req.params.aplicaciones+'", "'+req.params.telefono+'")', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	saveStatusgps(req, connection, res){
		connection.query('INSERT INTO status_gps VALUES (0, now(), '+req.params.usuario+', "'+req.params.proveedor+'", "'+req.params.status+'")', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	saveBateriaowifi(req, connection, res){
		connection.query('INSERT INTO bateria_wifi VALUES (0, now(), '+req.params.usuario+', "'+req.params.bateria+'", "'+req.params.wifi+'")', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getControl(req, connection, res) {
		connection.query('SELECT cambio FROM controlc', (err, rows, fields) => {
			connection.end();
			res.json(rows[0]);
		});
	}

	getConfiguracion(req, connection, res) {
		//cambio
		connection.query('SELECT * FROM configuracion', (err, rows, fields) => {
			connection.end();
			res.json(rows[0]);
		});
	}

	getHc(req, connection, res){
		connection.query('SELECT * FROM hc where MONTH(fecha) = MONTH(now()) and activa =0 and usuario_id = '+req.params.user+'', (err, rows, fields) => {
			connection.end();
			if(rows==null){
				console.log("no hay registros");
				res.json();
			}
			else{
			res.json(JSON.parse(JSON.stringify(rows)));
		}
		});
	}

	saveBajas(req, connection, res){
		connection.query('INSERT INTO bajas VALUES (0, now(), '+req.params.usuario+', '+req.params.responsable+')', (err, rows, fields) => {
			connection.end();
			//console.log(err);
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	validarDescanso(req, connection, res){
		//connection.query('SELECT COUNT(id) as total FROM actividades WHERE fecha_i = fecha_f and DATE(fecha_f) <= DATE("'+req.params.fecha+'");', (err, rows, fields) => {
		connection.query('SELECT COUNT(id) as total FROM actividades WHERE usuario_id = '+req.params.usuario+' AND incidenciaE = "Descanso" and DATE(fecha_f) BETWEEN DATE("'+req.params.fecha_i+'") AND DATE("'+req.params.fecha_f+'");', (err, rows, fields) => {
			connection.end();
			//res.json(JSON.parse(JSON.stringify(rows)));
			res.json(JSON.parse(JSON.stringify(rows[0])));
		});
	}

	getCmByRegional(req, connection, res){
		connection.query('SELECT usu.id, usu.nip, usu.nombre, (SELECT COUNT(DISTINCT ust.nip) FROM usuarios as ust INNER JOIN actividades ON actividades.usuario_id = ust.nip WHERE ust.supervisor = usu.nip AND DATE(fecha_i) = DATE(NOW())) AS activos, (SELECT COUNT(usd.id) FROM usuarios AS usd WHERE usd.supervisor = usu.nip) AS total FROM usuarios as usu WHERE regional = "'+req.params.regional+'" AND email = "CITY MANAGER";', (err, rows, fields) => {
			connection.end();
			if(rows==null){
				console.log("no hay registros");
				res.json();
			}
			else{
			res.json(JSON.parse(JSON.stringify(rows)));
		}
		});
	}

	getPromotoresBySupervisor(req, connection, res){
		connection.query('SELECT DISTINCT usuario_id, usuarios.* FROM usuarios INNER JOIN actividades ON usuarios.id = actividades.usuario_id WHERE supervisor = '+req.params.id_supervisor+' AND DATE(fecha_i) = DATE(NOW());', (err, rows, fields) => {
			connection.end();
			if(rows==null){
				console.log("no hay registros");
				res.json();
			}
			else{
			res.json(JSON.parse(JSON.stringify(rows)));
		}
		});
	}

	getActividades(req, connection, res){
		connection.query('SELECT actividades.*, tiendas.tienda FROM actividades INNER JOIN tiendas ON actividades.tienda_id = tiendas.id WHERE usuario_id = '+req.params.id_user+' AND DATE(fecha_i) = CURDATE();', (err, rows, fields) => {
			connection.end();
			if(rows==null){
				console.log("no hay registros");
				res.json();
			}
			else{
			res.json(JSON.parse(JSON.stringify(rows)));
		}
		});
	}

	getActividadesPromotor(req, connection, res){
		connection.query('SELECT actividades.*, tiendas.tienda FROM actividades INNER JOIN tiendas ON tiendas.id = actividades.tienda_id WHERE usuario_id = '+req.params.id_user+' AND MONTH(fecha_i) = MONTH("'+req.params.fecha+'") AND DAY(fecha_i) = DAY("'+req.params.fecha+'");', (err, rows, fields) => {
			connection.end();
			if(rows==null){
				console.log("no hay registros");
				res.json();
			}
			else{
			res.json(JSON.parse(JSON.stringify(rows)));
		}
		});
	}

	getValuesByPadre(req, connection, res){
		//connection.query('SELECT * FROM ' + req.params.table + '  WHERE usuario_id = ' + req.params.usuario_id + ' AND tienda_id = ' + req.params.tienda_id + ' AND ' + req.params.campo + ' = "' + req.params.valor + '" ORDER BY id DESC LIMIT 1;', (err, rows, fields) => {
			connection.query('SELECT * FROM ' + req.params.table + '  WHERE tienda_id = ' + req.params.tienda_id + ' AND ' + req.params.campo + ' = "' + req.params.valor + '" ORDER BY id DESC LIMIT 1;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getOneCap(req, connection, res){
		//connection.query('SELECT mc.opcion FROM ' + req.params.catalogo + ' mc LEFT JOIN ' + req.params.tabla + ' mp ON mc.opcion = mp.opcion WHERE mp.opcion IS NULL AND mc.tienda = ' + req.params.tienda_id + ';', (err, rows, fields) => {
			//connection.query('SELECT mc.opcion FROM ' + req.params.catalogo + ' mc WHERE mc.tienda = 190 AND NOT EXISTS ( SELECT 1 FROM ' + req.params.tabla + ' mp WHERE mp.opcion = mc.opcion AND mp.tienda_id = ' + req.params.tienda_id + ');', (err, rows, fields) => {
		//connection.query('SELECT mc.* FROM ' + req.params.catalogo + ' mc WHERE MONTH(NOW()) = MONTH(mc.fecha) AND mc.tienda = ' + req.params.tienda_id + ' AND NOT EXISTS ( SELECT 1 FROM ' + req.params.tabla + ' mp WHERE mp.opcion = mc.opcion AND MONTH(NOW()) = MONTH(mc.fecha) AND mp.tienda_id = ' + req.params.tienda_id + ');', (err, rows, fields) => {
		connection.query('SELECT cc.* FROM ' + req.params.catalogo + ' AS cc LEFT JOIN ' + req.params.tabla + ' AS c ON cc.opcion = c.opcion AND cc.tienda = c.tienda_id AND MONTH(c.fecha) = MONTH(CURRENT_DATE()) AND YEAR(c.fecha) = YEAR(CURRENT_DATE()) WHERE cc.tienda = ' + req.params.tienda_id + ' AND MONTH(cc.fecha) = MONTH(CURRENT_DATE()) AND YEAR(cc.fecha) = YEAR(CURRENT_DATE()) AND c.opcion IS NULL;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getUltimaVisita(req, connection, res){
		connection.query('SELECT a.*, u.nombre AS nombre_usuario, u.del_mun AS userCeys, u.foto AS perfil FROM actividades AS a INNER JOIN usuarios AS u ON a.usuario_id = u.nip WHERE a.tienda_id = ' + req.params.tienda_id + ' ORDER BY a.id DESC LIMIT 1;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTotalVisitas(req, connection, res){
		connection.query('SELECT COUNT(*) as total FROM actividades AS a WHERE a.tienda_id = ' + req.params.tienda_id + ' AND MONTH(a.fecha_i) = MONTH(CURRENT_DATE()) AND YEAR(a.fecha_i) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTotalVisitasDetalle(req, connection, res){
		//connection.query('SELECT actividades.*, IFNULL(TIMEDIFF(IFNULL(actividades.fecha_f, NOW() + INTERVAL 1 HOUR), actividades.fecha_i), 0) AS diferencia_tiempo, usuarios.nombre, tiendas.tienda FROM actividades INNER JOIN usuarios ON actividades.usuario_id = usuarios.id INNER JOIN tiendas ON actividades.tienda_id = tiendas.id WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha_i) = MONTH(CURRENT_DATE()) AND YEAR(fecha_i) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.query('SELECT a.imgF, a.fecha_i, u.nombre AS nombre_usuario, u.del_mun AS userCeys, u.foto AS perfil, IFNULL(CASE WHEN a.fecha_f IS NULL AND DATE(a.fecha_i) = CURRENT_DATE THEN TIMEDIFF(NOW() + INTERVAL 1 HOUR, a.fecha_i) WHEN a.fecha_f IS NULL AND DATE(a.fecha_i) != CURRENT_DATE THEN "00:00:00" ELSE TIMEDIFF(a.fecha_f, a.fecha_i) END, 0) AS diferencia_tiempo FROM actividades AS a INNER JOIN usuarios AS u ON a.usuario_id = u.nip WHERE a.tienda_id = ' + req.params.tienda_id + ' AND MONTH(a.fecha_i) = MONTH(CURRENT_DATE()) AND YEAR(a.fecha_i) = YEAR(CURRENT_DATE()) ORDER BY a.fecha_i DESC;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getEstadiaTienda(req, connection, res){
		connection.query('SELECT IFNULL(TIMEDIFF(IFNULL(fecha_f, NOW() + INTERVAL 1 HOUR), fecha_i), 0) AS total_horas FROM actividades WHERE tienda_id = ' + req.params.tienda_id + ' ORDER BY id DESC LIMIT 1;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTotalEstadia(req, connection, res){
		connection.query('SELECT SEC_TO_TIME(SUM(IFNULL(TIMESTAMPDIFF(SECOND, fecha_i, IFNULL(fecha_f, NOW() + INTERVAL 1 HOUR)), 0))) AS total_horas FROM actividades WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha_i) = MONTH(CURRENT_DATE()) AND YEAR(fecha_i) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getObjetivosPc(req, connection, res){
		connection.query('SELECT COUNT(*) AS total_registros FROM controlc WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getEjecutadoPc(req, connection, res){
		connection.query('SELECT COUNT(c.id) AS total_registros FROM control AS c INNER JOIN controlc AS cc ON c.opcion = cc.opcion AND c.tienda_id = cc.tienda WHERE c.tienda_id = ' + req.params.tienda_id + ' AND MONTH(c.fecha) = MONTH(CURRENT_DATE()) AND YEAR(c.fecha) = YEAR(CURRENT_DATE()) AND MONTH(cc.fecha) = MONTH(CURRENT_DATE()) AND YEAR(cc.fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getAvancePc(req, connection, res){
		//connection.query('SELECT IFNULL((COUNT(DISTINCT c.id) / NULLIF(COUNT(DISTINCT cc.id), 0)) * 100, 0) AS avance_porcentaje FROM control AS c LEFT JOIN controlc AS cc ON c.opcion = cc.opcion AND c.tienda_id = cc.tienda WHERE c.tienda_id = ' + req.params.tienda_id + ' AND MONTH(c.fecha) = MONTH(CURRENT_DATE()) AND YEAR(c.fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
		connection.query('SELECT IFNULL((total_registros / NULLIF(registros_objetivo, 0)) * 100, 0) AS avance_porcentaje FROM (SELECT COUNT(*) AS registros_objetivo FROM controlc WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS obj, (SELECT COUNT(*) AS total_registros FROM control WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS ejec;', (err, rows, fields) => {

			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getPcEjecutado(req, connection, res){
		connection.query('SELECT cc.opcion FROM controlc AS cc INNER JOIN control AS c ON cc.opcion = c.opcion AND cc.tienda = c.tienda_id AND MONTH(c.fecha) = MONTH(CURRENT_DATE()) AND YEAR(c.fecha) = YEAR(CURRENT_DATE()) WHERE cc.tienda = ' + req.params.tienda_id + ' AND MONTH(cc.fecha) = MONTH(CURRENT_DATE()) AND YEAR(cc.fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {

			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getPcPendiente(req, connection, res){
		connection.query('SELECT cc.opcion FROM controlc AS cc LEFT JOIN control AS c ON cc.opcion = c.opcion AND cc.tienda = c.tienda_id AND MONTH(c.fecha) = MONTH(CURRENT_DATE()) AND YEAR(c.fecha) = YEAR(CURRENT_DATE()) WHERE cc.tienda = ' + req.params.tienda_id + ' AND MONTH(cc.fecha) = MONTH(CURRENT_DATE()) AND YEAR(cc.fecha) = YEAR(CURRENT_DATE()) AND c.opcion IS NULL;', (err, rows, fields) => {

			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getObjetivosEx(req, connection, res){
		connection.query('SELECT SUM(objetivo) AS objetivo FROM exhibicionobj WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getEjecutadoEx(req, connection, res){
		connection.query('SELECT COUNT(id) AS ejecutado FROM exhibicion_especial WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getAvanceEx(req, connection, res){
		connection.query('SELECT IFNULL((SUM(ee.ejecutado) / NULLIF(SUM(eo.objetivo), 0)) * 100, 0) AS avance_porcentaje FROM (SELECT COUNT(*) AS ejecutado, tienda_id FROM exhibicion_especial WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE()) GROUP BY tienda_id) AS ee INNER JOIN (SELECT SUM(objetivo) AS objetivo, tienda FROM exhibicionobj WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE()) GROUP BY tienda) AS eo ON ee.tienda_id = eo.tienda;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getObjetivosLi(req, connection, res){
		connection.query('SELECT SUM(objetivo) AS objetivo FROM linealobj WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getEjecutadoLi(req, connection, res){
		connection.query('SELECT COUNT(id) AS ejecutado FROM lineal WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getAvanceLi(req, connection, res){
		connection.query('SELECT IFNULL((SUM(ejecutado) / NULLIF(SUM(objetivo), 0)) * 100, 0) AS avance_porcentaje FROM (SELECT COUNT(id) AS ejecutado FROM lineal WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS ejecutado, (SELECT SUM(objetivo) AS objetivo FROM linealobj WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS objetivo;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getFrentesTienda(req, connection, res){
		connection.query('SELECT AVG(facing) AS promedio_facing FROM lineal WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getPromedioCadena(req, connection, res){
		connection.query('SELECT AVG(l.facing) AS avg_facing_Cadenas FROM lineal l INNER JOIN tiendas t ON l.tienda_id = t.id WHERE t.cadena = ( SELECT cadena FROM tiendas WHERE id = ' + req.params.tienda_id + ');', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getPromedioFrentesMarca(req, connection, res){
		connection.query('SELECT AVG(facing) AS promedio_facing, productos.marca FROM lineal INNER JOIN productos ON lineal.producto=productos.producto WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE()) GROUP BY productos.marca ORDER BY productos.marca;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getCumplimientoVisita(req, connection, res){
		connection.query('SELECT (SUM(a.total_actividades) / NULLIF(SUM(h.total_visitas), 0)) * 100 AS porcentaje_cumplimiento FROM (SELECT COUNT(id) AS total_actividades FROM actividades WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha_i) = MONTH(CURRENT_DATE()) AND YEAR(fecha_i) = YEAR(CURRENT_DATE())) AS a, (SELECT SUM(visitas) AS total_visitas FROM hc WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS h;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getDatosPuntosControl(req, connection, res){
		//connection.query('SELECT total_registros_control, total_registros_control_join, CASE WHEN total_registros_control = 0 THEN 0 ELSE (total_registros_control_join / total_registros_control) * 100 END AS avance_porcentaje FROM (SELECT (SELECT COUNT(*) FROM controlc WHERE tienda = '+ req.params.tienda_id +' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS total_registros_control, (SELECT COUNT(c.id) FROM control AS c INNER JOIN controlc AS cc ON c.opcion = cc.opcion AND c.tienda_id = cc.tienda WHERE c.tienda_id = '+ req.params.tienda_id +' AND MONTH(c.fecha) = MONTH(CURRENT_DATE()) AND YEAR(c.fecha) = YEAR(CURRENT_DATE())) AS total_registros_control_join) AS subquery;', (err, rows, fields) => {
			connection.query('SELECT total_registros_control, total_registros_control_join, CASE WHEN total_registros_control = 0 THEN 0 ELSE (total_registros_control_join / total_registros_control) * 100 END AS avance_porcentaje FROM (SELECT (SELECT COUNT(*) FROM controlc WHERE tienda = '+ req.params.tienda_id +' AND fecha >= DATE_FORMAT(CURRENT_DATE(), "%Y-%m-01") AND fecha < DATE_FORMAT(DATE_ADD(CURRENT_DATE(), INTERVAL 1 MONTH), "%Y-%m-01")) AS total_registros_control, (SELECT COUNT(c.id) FROM control AS c INNER JOIN controlc AS cc ON c.opcion = cc.opcion AND c.tienda_id = cc.tienda WHERE c.tienda_id = '+ req.params.tienda_id +' AND c.fecha >= DATE_FORMAT(CURRENT_DATE(), "%Y-%m-01") AND c.fecha < DATE_FORMAT(DATE_ADD(CURRENT_DATE(), INTERVAL 1 MONTH), "%Y-%m-01") AND cc.fecha >= DATE_FORMAT(CURRENT_DATE(), "%Y-%m-01") AND cc.fecha < DATE_FORMAT(DATE_ADD(CURRENT_DATE(), INTERVAL 1 MONTH), "%Y-%m-01")) AS total_registros_control_join) as subquery;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getDatosExhibicion(req, connection, res){
		//connection.query('SELECT (SELECT SUM(objetivo) FROM exhibicionobj WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS total_objetivo, (SELECT COUNT(id) FROM exhibicion_especial WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS total_ejecutado, ROUND(IFNULL((SUM(ee.ejecutado) / NULLIF(SUM(eo.objetivo), 0)) * 100, 0), 2) AS avance_porcentaje FROM (SELECT COUNT(*) AS ejecutado, tienda_id FROM exhibicion_especial WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE()) GROUP BY tienda_id) AS ee INNER JOIN (SELECT SUM(objetivo) AS objetivo, tienda FROM exhibicionobj WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE()) GROUP BY tienda) AS eo ON ee.tienda_id = eo.tienda;', (err, rows, fields) => {
		connection.query('SELECT eo.total_objetivo, ee.total_ejecutado, ROUND(IFNULL((ee.total_ejecutado / NULLIF(eo.total_objetivo, 0)) * 100, 0), 2) AS avance_porcentaje FROM (SELECT SUM(objetivo) AS total_objetivo FROM exhibicionobj WHERE tienda = ' + req.params.tienda_id + ' AND fecha BETWEEN DATE_FORMAT(CURRENT_DATE(), "%Y-%m-01") AND LAST_DAY(CURRENT_DATE())) AS eo, (SELECT COUNT(*) AS total_ejecutado FROM exhibicion_especial WHERE tienda_id = ' + req.params.tienda_id + ' AND fecha BETWEEN DATE_FORMAT(CURRENT_DATE(), "%Y-%m-01") AND LAST_DAY(CURRENT_DATE())) AS ee;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getDatosLineal(req, connection, res){
		//connection.query('SELECT (SELECT SUM(objetivo) FROM linealobj WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS total_objetivo, (SELECT COUNT(id) FROM lineal WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS total_ejecutado, ROUND(IFNULL((SUM(ejecutado.ejecutado) / NULLIF(SUM(objetivo.objetivo), 0)) * 100, 0), 2) AS avance_porcentaje FROM (SELECT COUNT(id) AS ejecutado FROM lineal WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS ejecutado, (SELECT SUM(objetivo) AS objetivo FROM linealobj WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE())) AS objetivo;', (err, rows, fields) => {
		connection.query('WITH objetivos AS (SELECT SUM(objetivo) AS total_objetivo FROM linealobj WHERE tienda = ' + req.params.tienda_id + ' AND fecha BETWEEN DATE_FORMAT(CURRENT_DATE(), "%Y-%m-01") AND LAST_DAY(CURRENT_DATE())), ejecutados AS (SELECT COUNT(id) AS total_ejecutado FROM lineal WHERE tienda_id = ' + req.params.tienda_id + ' AND fecha BETWEEN DATE_FORMAT(CURRENT_DATE(), "%Y-%m-01") AND LAST_DAY(CURRENT_DATE())) SELECT objetivos.total_objetivo, ejecutados.total_ejecutado, ROUND(IFNULL((ejecutados.total_ejecutado / NULLIF(objetivos.total_objetivo, 0)) * 100, 0), 2) AS avance_porcentaje FROM objetivos, ejecutados;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getDatosSo(req, connection, res){
		connection.query('SELECT *, ROUND((avance / NULLIF(objetivo, 0)) * 100, 2) AS porcentaje_avance, objetivo, avance FROM objetivos_det WHERE cadena = "' + req.params.cadena + '" AND determinante = ' + req.params.determinante + ';', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getExhibicionesPrueba(req, connection, res){
		connection.query('SELECT marca, tipoexhibicion, departamento, permanencia, fotoF, fecha FROM exhibicion_especial WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE()) AND DATE(fecha) = ( SELECT MAX(DATE(fecha)) FROM exhibicion_especial WHERE tienda_id = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE()));', (err, rows, fields) => {
		//connection.query('SELECT ee.id, ee.fecha, ee.tienda_id, t.tienda AS nombre_tienda, ee.usuario_id, u.nombre AS nombre_usuario, ee.marca, ee.tipoexhibicion, ee.departamento, ee.comentario, ee.fotoF FROM exhibicion_especial ee INNER JOIN usuarios u ON ee.usuario_id = u.id INNER JOIN tiendas t ON ee.tienda_id = t.id WHERE DATE(ee.fecha) = DATE(CURDATE()) AND ee.tienda_id = ' + req.params.tienda_id + ';', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTareasAsignadasMes(req, connection, res){
		connection.query('SELECT COUNT(*) AS total_tareas_objetivo FROM tareas_asignadas WHERE tienda = ' + req.params.tienda_id + ' AND MONTH(fecha) = MONTH(CURRENT_DATE()) AND YEAR(fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTareasRealizadas(req, connection, res){
		connection.query('SELECT t.* FROM tareas_asignadas t WHERE !ISNULL(t.usuario_id) AND t.tienda = ' + req.params.tienda_id + ' AND MONTH(t.fecha) = MONTH(CURRENT_DATE()) AND YEAR(t.fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTareasPendientes(req, connection, res){
		//connection.query('SELECT tv.* FROM tareasv tv LEFT JOIN tareas t ON tv.opcion = t.opcion AND tv.tienda = t.tienda_id AND MONTH(tv.fecha) = MONTH(t.fecha) AND YEAR(tv.fecha) = YEAR(t.fecha) WHERE tv.tienda = ' + req.params.tienda_id + ' AND MONTH(tv.fecha) = MONTH(CURRENT_DATE()) AND YEAR(tv.fecha) = YEAR(CURRENT_DATE()) AND t.id IS NULL;', (err, rows, fields) => {
		connection.query('SELECT t.* FROM tareas_asignadas t WHERE ISNULL(t.usuario_id) AND t.tienda = ' + req.params.tienda_id + ' AND MONTH(t.fecha) = MONTH(CURRENT_DATE()) AND YEAR(t.fecha) = YEAR(CURRENT_DATE());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	saveVersiones(req, connection, res){
		connection.query('INSERT INTO versiones VALUES (0, NOW(), '+req.params.user+', "'+req.params.version1+'", "'+req.params.version2+'");', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	saveModelos(req, connection, res){
		connection.query('INSERT INTO modelos VALUES (0, '+req.params.user+', NOW(), "'+req.params.modelo+'");', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getFechaCadena(req, connection, res){
		connection.query('SELECT * FROM so_fecha WHERE cadena = "'+req.params.cadena+'" ORDER BY fecha DESC LIMIT 1;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getUserLogin(req, connection, res){
		connection.query('SELECT COUNT(*) as total FROM usuarios WHERE user = "'+req.params.user+'" and pass= "'+req.params.pass+'" LIMIT 1;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getCheckTareas(req, connection, res){
		connection.query('SELECT COUNT(*) as existe FROM tareasv WHERE opcion = "'+req.params.tarea+'" AND tienda = '+req.params.tienda+' AND MONTH(fecha) = MONTH(NOW());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getCheckTareasAsignadas(req, connection, res){
		connection.query('SELECT COUNT(*) as existe FROM tareas_asignadas WHERE opcion = "'+req.params.tarea+'" AND tienda = '+req.params.tienda+' AND MONTH(fecha) = MONTH(NOW());', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTareasAsignadas(req, connection, res){
		connection.query('SELECT * FROM tareas_asignadas WHERE tienda = '+req.params.tienda+' AND ISNULL(usuario_id);', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTareasAsignadasEstatus(req, connection, res){
		connection.query('SELECT * FROM tareas_asignadas WHERE tienda = '+req.params.tienda+' AND (ISNULL(usuario_id) || estatus = "Pendiente");', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getConteoInvFan(req, connection, res){
		connection.query('SELECT COUNT(id) as conteo FROM inventario_fan WHERE tienda_id = '+req.params.tienda+';', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getConteoTareasAsignadas(req, connection, res){
		connection.query('SELECT (SELECT COUNT(id) FROM inventario_fan WHERE tienda_id = '+req.params.tienda+') + (SELECT COUNT(*) FROM tareas_asignadas WHERE tienda = '+req.params.tienda+' AND ISNULL(usuario_id)) AS total;', (err, rows, fields) => {
			connection.end();
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	saveInvFan(req, connection, res) {
	    connection.query(
	        'INSERT INTO inventariofantasma VALUES (0, now(), ?, ?, ?, ?)',
	        [req.params.tienda, req.params.sistema, req.params.bodega, req.params.piso],
	        (err, rows, fields) => {
	            if (err) {
	                connection.end();
	                return res.status(500).json({ error: err.message });
	            }
	            connection.query(
	                'DELETE FROM inventario_fan WHERE id = ?',
	                [req.params.inventario_id],
	                (errDelete, resultDelete) => {
	                    connection.end();
	                    if (errDelete) {
	                        return res.status(500).json({ error: errDelete.message });
	                    }
	                    // Envía la respuesta tras completar ambas operaciones
	                    res.json({
	                        insertResult: rows,
	                        deleteResult: resultDelete
	                    });
	                }
	            );
	        }
	    );
	}


	getDBTablesSync(req, connection, res){
		var _this = this;
		var consultFields = '';
		var strSQLDb= '';
		function promiseSQL(table){

			// const invalidValues = ['_copy', '_old', '_0', '_1', '_2', '_3', '_4', '_5', '_6', '_7', '_8', '_9'];
		 //    if (invalidValues.some(invalidValue => table.includes(invalidValue))) {
		 //        console.log("Se saltará la tabla " + table);
		 //        // return Promise.reject("La tabla no puede tener uno de los valores prohibidos");
		 //    }

		    return new Promise(function (fulfill, reject){
		        connection.query('DESCRIBE ' + table, (err, rows, fields) => {
		        	let campos = JSON.parse(JSON.stringify(rows));

		        	consultFields = '(';
		        	campos.forEach((e, i) => {
		        		if (i == (rows.length - 1)) {
		        			consultFields += e.Field +' '+ _this.convertTypeData(e.Type);
		        		} else {
		        			consultFields += e.Field +' '+ _this.convertTypeData(e.Type) +',';
		        		}
		        	});

		        	consultFields += ')';
		        		fulfill({ table: table, sqlTable:  'CREATE TABLE IF NOT EXISTS ' + table + ' ' + consultFields});
		        });
		    });
		}

		connection.query('show tables;', (err, rows, fields) => {
			let tables = JSON.parse(JSON.stringify(rows));

			let arrayTables = [];
			var db = req.params.database;
			//var databasesConfig = configDBTables.dbs;
			//var tablesConfig = configDBTables.tables;

			tables.forEach((element, index) => {
				// databasesConfig.forEach((e, i) => {
				// 	if (db === e) {
				// 		tablesConfig[i].forEach((el, ind) => {
				// 			var ele = (JSON.stringify(element).split(":")[1]).replace("\"", "");
				// 			var tbl = ele.split("\"")[0];
				// 			if (el == tbl) {
				// 				arrayTables.push(tbl);
				// 			}

				// 		});
				// 	}
				// });
				var ele = (JSON.stringify(element).split(":")[1]).replace("\"", "");
				var tbl = ele.split("\"")[0];
				if(tbl === "aplicaciones_instaladas"){
					
				}else if(tbl === "bateria_wifi"){

				}else if(tbl === "cadenas"){

				}else if(tbl === "descargas"){

				}else if(tbl === "locationsusers"){

				}else if( tbl === "mod_registros_once"){

				}else{
					console.log("y si entro aqui "+tbl);
					if(tbl.includes("old")){
						console.log("Se saltara "+tbl);
					}else if(tbl.includes("respaldo")){
						console.log("Se saltara "+tbl);
					}else if(tbl.includes("copy")){
						console.log("Se saltara "+tbl);
					}else if (
				        tbl.includes("_0") ||
				        tbl.includes("_1") ||
				        tbl.includes("_2") ||
				        tbl.includes("_3") ||
				        tbl.includes("_4") ||
				        tbl.includes("_5") ||
				        tbl.includes("_6") ||
				        tbl.includes("_7") ||
				        tbl.includes("_8") ||
				        tbl.includes("_9")
				    ){
						console.log("Se saltara "+tbl);
					}else{
						console.log("Si registrara la tabla "+tbl);
						arrayTables.push(tbl);
						tablas_array.push(tbl);
					}
				}
			});

			var arrJSONDB = new Array();
			arrayTables.reduce(
			    function (sequence, value) {
			        return sequence.then(function() {
			            return promiseSQL(value);
			        }).then(function(returns) {
			        	arrJSONDB.push(returns.sqlTable);
			        	strSQLDb += returns.sqlTable + ':';
			            return Promise.resolve();
			        });
			    },
			    Promise.resolve()
			).then(function() {
				console.log('COMPLETED');
				connection.end();
				res.send(strSQLDb);
			});

		});
	}
	convertTypeData(field){
		let fr;
		var limp = field.split('(')[0];
		switch(limp){
			case 'int':
				fr = 'INTEGER';
			break;
			case 'varchar':
				fr = 'TEXT';
			break;
			case 'double':
				fr = 'TEXT';
			break;
			case 'datetime':
				fr = 'TEXT';
			break;
		}
		return fr;
	}

	getDBValuesSync(req, connection, res, cuenta_base){
		let tableCadenasHasProductos = [];
		let arrFinalResponseServer = [];
		let arrayForProductos= [];

		Array.prototype.unique= function(a){
		  return function(){return this.filter(a)}}(function(a,b,c){return c.indexOf(a,b+1)<0
		});

		//promesa que solo espera una consulta SQL y regresa el resultado como json
		function promiseSQL(sqlcadena){
		    return new Promise(function (fulfill, reject){
		        connection.query(sqlcadena, (err, rows, fields) => {
		        	fulfill({ response: JSON.parse(JSON.stringify(rows))});
		        });
		    });
		}

		//promesa para catalogos
		function promiseCatalogo(sqlcadena, catalogo){
		    return new Promise(function (fulfill, reject){
		        connection.query(sqlcadena, (err, rows, fields) => {
		        	console.log('catalogo ==> ', catalogo);
		        	fulfill({ response: JSON.parse("{ \""+ catalogo + "\": " + JSON.stringify(rows) + "}")});
		        });
		    });
		}
		//variable que contiene las bases de datos: clientes
		//let databasesConfig = configDBTables.dbs;
		
		//variable que guarda el nombre de las tablas.
		//let tablesConfig = configDBTables.tables;

		let arrayCatalogos = [];

		arrayCatalogos.push('usuarios');

		//recorremos la configuracion para obtener el nombre de tablas que son catalogo y los guardamos en arrayCatalogos
		// databasesConfig.forEach((e,i)=>{
		// 	if (e == req.params.database) {
		// 		tablesConfig[i].forEach((el, inde)=>{
		// 			if (el.substring(el.length - 1) == 'c') {
		// 				arrayCatalogos.push(el);
		// 				console.log("paso aqui con "+el);
		// 			}
		// 		});


		// 	}
		// });

		// tablas_array.forEach((el, inde)=>{
		// 	if (el.substring(el.length - 1) == 'c') {
		// 		arrayCatalogos.push(el);
		// 		console.log("paso aqui con "+el+" con c jeje");
		// 	}
		// });

		// Para llenar los catalogos
		connection.query('SELECT * FROM cargar_catalogos', (err, cargar, fields) => {
			let dataArrayCargar = JSON.parse(JSON.stringify(cargar));
			dataArrayCargar.forEach((e, i)=>{
				arrayCatalogos.push(e.opcion);
				console.log("paso aqui con "+e.opcion+" con c");
			});
		});



		// select de valores para la tabla modulos
		connection.query('SELECT * FROM modulos', (err, rows, fields) => {
			let dataArrayModulos = JSON.parse(JSON.stringify(rows));
			let jsonModulos=[];
			dataArrayModulos.forEach((e, i)=>{
				let img = fs.readFileSync(e.icono);
				//jsonModulos.push({id:e.id, cuenta_id: e.cuenta_id, modulo: e.modulo, icono: img.toString('base64'), obligatorio: e.obligatorio});
				jsonModulos.push({id:e.id, tab_id: e.tab_id, modulo: e.modulo, icono: img.toString('base64'), belongstousers: e.belongstousers, leyenda: e.leyenda, tipo: e.tipo, tabla: e.tabla, obligatorio: e.obligatorio});
			});
			arrFinalResponseServer.push({"modulos": jsonModulos});
		});

		// select de valores para la tabla fields_modulos
		connection.query('SELECT * FROM fields_modulo', (err, rows, fields) => {
			let dataArrayFieldsModulo = JSON.parse(JSON.stringify(rows));
			let jsonFieldsModulo=[];
			dataArrayFieldsModulo.forEach((e, i)=>{
				jsonFieldsModulo.push({id:e.id, type: e.type, catalog: e.catalog, hint: e.hint, mandatory: e.mandatory, key: e.key, modulo_id: e.modulo_id, padre: e.padre ?? null, escanear: e.escanear ?? null});
			});
			arrFinalResponseServer.push({"fields_modulo": jsonFieldsModulo});
		});

		let arrayCat = function(){
			//hace una consulta para obtener los registros a las tablas que son catalogos
			//y guardarlos en el arreglo que retornamos al cliente.
			arrayCatalogos.reduce((sequence, catalogo) => {
					return sequence.then(() => {
						console.log("imprime catalogo antes "+catalogo);
						if (catalogo == 'usuarios') {
							return promiseCatalogo('SELECT * FROM ' + catalogo + ' WHERE nip = ' + req.params.user, catalogo);
						}else{
							return promiseCatalogo('SELECT * FROM ' + catalogo, catalogo);
						}

					}).then(function(returns){
						let da = returns.catalogo;
						//guardamos los valores de catalogos al arreglo arrFinalResponseServer
						arrFinalResponseServer.push(returns.response);
						return Promise.resolve();
					});
				},
				Promise.resolve()
				).then(() => {
					/*
						Para la version de medir distancia entre la tienda y el dispósitivo se tiene que
						extraer t.coordenadax, t.coordenaday a la consulta
					*/
					//let mysql = 'SELECT t.id, CONCAT( c.cadena, \' \', t.numero ) as tienda, t.tienda as numero, t.cadenas_id, t.coordenadax, t.coordenaday FROM usuarios_has_tiendas ut INNER JOIN tiendas t ON ut.tiendas_id = t.id INNER JOIN usuarios u ON ut.usuarios_id = u.id INNER JOIN cadenas c ON t.cadenas_id = c.id';
					let mysql = 'SELECT t.id, CONCAT( c.cadena, \' \', t.numero ) as tienda, t.tienda as numero, t.cadenas_id, t.coordenadax, t.coordenaday FROM tiendas t INNER JOIN cadenas c ON t.cadenas_id = c.id';

					//let mysql = 'SELECT t.id, CONCAT( c.cadena, \' \', t.numero ) as tienda, t.tienda as numero, t.cadenas_id FROM usuarios_has_tiendas ut INNER JOIN tiendas t ON ut.tiendas_id = t.id INNER JOIN usuarios u ON ut.usuarios_id = u.id INNER JOIN cadenas c ON t.cadenas_id = c.id';
					connection.query(mysql, (e, r, f) => {
						arrFinalResponseServer.push(JSON.parse("{\"todastiendas\": " + JSON.stringify(r) + "}"));

						connection.end();
						let arrayFinal = [];

						arrayFinal.push(arrFinalResponseServer);
						//const configClienteModules = require('../util/'+ req.params.database +'_modulos.json');
						//arrayFinal.push(configClienteModules);
						res.json(arrayFinal);
						console.log('complete');
					});
				});
			};


		let arrayModules = [];
		//let sqlGetTiendas = 'SELECT t.id, CONCAT( c.cadena, \' \', t.numero ) as tienda, t.tienda as numero , t.coordenadax, t.coordenaday, t.localizacion,  t.cadenas_id FROM usuarios_has_tiendas ut INNER JOIN tiendas t ON ut.tiendas_id = t.id INNER JOIN usuarios u ON ut.usuarios_id = u.id AND ut.usuarios_id = '+req.params.user+' INNER JOIN cadenas c ON t.cadenas_id = c.id;';
		
		let sqlGetTiendas = 'SELECT t.id, CONCAT( c.cadena, \' \', t.numero ) as tienda, t.tienda as numero , t.coordenadax, t.coordenaday, t.localizacion, t.cadenas_id FROM tiendas t INNER JOIN cadenas c ON t.cadenas_id = c.id;';

		//consulta para obtener las tiendas del usuario
		connection.query(sqlGetTiendas, (err, rows, fields) => {
			if (err){
				console.log('No hay tiendas');
				arrayCat();
			}else{
				let responseTiendas = JSON.parse(JSON.stringify(rows));
				let arrayIdsCadenas = [];

				responseTiendas.forEach((e, i) => {
					arrayIdsCadenas.push(e.cadenas_id);
				});

				arrFinalResponseServer.push({"tiendas": responseTiendas});

				connection.query('select * from productos', (e, r, f) => {
					arrFinalResponseServer.push({"productos": JSON.parse(JSON.stringify(r))});
					connection.query('select * from cadenas_has_productos', (ee, rr, ff) => {
						arrFinalResponseServer.push({"cadenas_has_productos": JSON.parse(JSON.stringify(rr))});
						console.log('complete productos y cadenas_has_productos');
						arrayCat();
					});
				});


			}

		});

		connection.query('SELECT * FROM modulos_has_cadenas', (err, rows, fields) => {
			let dataArraymhc = JSON.parse(JSON.stringify(rows));
			let jsonmhc=[];
			dataArraymhc.forEach((e, i)=>{
				jsonmhc.push({id:e.id, cadena_id: e.cadena_id, modulo: e.modulo});
			});
			arrFinalResponseServer.push({"modulos_has_cadenas": jsonmhc});
		});

		/*connection.query('SELECT * FROM modulos_has_tiendas', (err, rows, fields) => {
			let dataArraymht = JSON.parse(JSON.stringify(rows));
			let jsonmht=[];
			dataArraymht.forEach((e, i)=>{
				jsonmht.push({id:e.id, tienda_id: e.tienda_id, modulo: e.modulo});
			});
			arrFinalResponseServer.push({"modulos_has_tiendas": jsonmht});
		});*/

		connection.query('SELECT * FROM modulos_once', (err, rows, fields) => {
			let dataArraymo = JSON.parse(JSON.stringify(rows));
			let jsonmo=[];
			dataArraymo.forEach((e, i)=>{
				jsonmo.push({id:e.id, modulo: e.modulo, tienda_id: e.tienda_id, activo: e.activo});
			});
			arrFinalResponseServer.push({"modulos_once": jsonmo});
		});

		/*connection.query('SELECT * FROM mod_registros_once', (err, rows, fields) => {
			let dataArraymo = JSON.parse(JSON.stringify(rows));
			let jsonmo=[];
			dataArraymo.forEach((e, i)=>{
				jsonmo.push({id:e.id, usuario_id: e.usuario_id, tienda_id: e.tienda_id, modulo_once_id: e.modulo_once_id});
			});
			arrFinalResponseServer.push({"modulos_once": jsonmo});
		});*/

		connection.query('SELECT * FROM configuracion', (err, rows, fields) => {
			let dataArrayModulos = JSON.parse(JSON.stringify(rows));
			let jsonModulos=[];
			dataArrayModulos.forEach((e, i)=>{
				jsonModulos.push({id:e.id, pin: e.pin, cambio: e.cambio, modalidad: e.modalidad, useHc: e.useHc, version: e.version, location_start: e.location_start, location_stop: e.location_stop, interval: e.interval, fotoco: e.fotoco, control: e.control});
			});
			arrFinalResponseServer.push({"configuracion": jsonModulos});
		});

		if(cuenta_base == "ceysp"){

			connection.query('SELECT * FROM controlc WHERE MONTH(fecha) = MONTH(NOW());', (err, rows, fields) => {
			    if (err) {
			        console.error('Error executing query:', err);
			        return;
			    }
			    let dataArrayModulos = JSON.parse(JSON.stringify(rows));
			    let jsonModulos = [];
			    dataArrayModulos.forEach((e, i) => {
			        jsonModulos.push({
			            id: e.id,
			            fupdate: e.fupdate,
			            usuario: e.usuario,
			            tienda: e.tienda,
			            fecha: e.fecha,
			            cadena: e.cadena,
			            opcion: e.opcion
			        });
			    });
			    arrFinalResponseServer.push({ "controlc": jsonModulos });
			});
		}



		// connection.query('SELECT * FROM config', (err, rows, fields) => {
		// 	let dataArrayModulos = JSON.parse(JSON.stringify(rows));
		// 	let jsonModulos=[];
		// 	dataArrayModulos.forEach((e, i)=>{
		// 		jsonModulos.push({id:e.id, modulo: e.modulo, share: e.share, label: e.label, posicion: e.posicion});
		// 	});
		// 	arrFinalResponseServer.push({"config": jsonModulos});
		// });

	}

	getInputsOutputsOfUser(req, connection, res){
		let query = "SELECT actividades.id, DATE_FORMAT(actividades.fecha_i,'%Y-%m-%d %H:%i:%S') as fecha_i, DATE_FORMAT(actividades.fecha_i,'%Y-%m-%d') AS dia, DATE_FORMAT(actividades.fecha_f,'%Y-%m-%d %H:%i:%S') as fecha_f,actividades.usuario_id,"+
	    "actividades.c_x_i, actividades.c_y_i,"+
	    "actividades.c_x_f, actividades.c_y_f,"+
	    "actividades.imgF," +
	    "tiendas.numero,tiendas.tienda,tiendas.id AS gis,"+
	    "cadenas.cadena,tiendas.localizacion, usuarios.nombre, usuarios.app,usuarios.ruta "+
	    "FROM actividades "+
	    "INNER JOIN tiendas ON actividades.tienda_id=tiendas.id"+
	    " INNER JOIN cadenas ON tiendas.cadenas_id=cadenas.id"+
	    " INNER JOIN usuarios ON actividades.usuario_id=usuarios.nip"+
	    " WHERE actividades.tienda_id=tiendas.id AND DATE_FORMAT(actividades.fecha_i,'%Y-%m-%d')= '" + req.params.date + "'"+
	    " AND actividades.usuario_id= " + req.params.user + ";";

	    connection.query(query, (error, rows, fields) => {
	      if (error) console.log(error);

	      let data = JSON.parse(JSON.stringify(rows));
	      let responsedata = [];
	      /*Parseamos las imagenes de las entradas y salidas del usuario*/
	      data.forEach((element, index) => {
	        let pathToServer = ".." + element.imgF;
	        console.log("path:", pathToServer);

	        let imgResult= null;

	        try{
	        	let img = fs.readFileSync(pathToServer);
	        	imgResult = img.toString('base64');
	        } catch(err){
	        	console.log('Error read photo ...');
	        }

	        responsedata.push({
	          "id": element.id,
	          "fecha_i": element.fecha_i,
	          "dia": element.dia,
	          "fecha_f": element.fecha_f,
	          "usuario_id": element.usuario_id,
	          "c_x_i": element.c_y_i,
	          "c_y_i": element.c_x_i,
	          "c_x_f": element.c_x_f,
	          "c_y_f": element.c_y_f,
	          "imgF": imgResult,
	          "numero": element.numero,
	          "tienda": element.tienda,
	          "gis": element.gis,
	          "cadena": element.cadena,
	          "localizacion": element.localizacion,
	          "nombre": element.nombre,
	          "app": element.app,
	          "ruta": element.ruta
	        });
	      });

	      connection.end();
	      /*Respondemos al cliente con los datos en json*/
	      res.json(responsedata);
	    });
	}

	getHistoryUserLocation(connection, req, res){
		let sql = 'select id_usuario, DATE_FORMAT(created_at, \'%Y-%m-%d %h:%i:%s %p \') as fecha, lat, log as lng from locationsusers where id_usuario = '+req.params.user+' and DATE_FORMAT(created_at, \'%Y-%m-%d \') = \''+req.params.date +'\'';
        console.log("Consulta historico:",  sql);

        connection.query(sql, (err, rows, fields) => {
          let data = JSON.parse(JSON.stringify(rows));
          connection.end();
          res.json(data);
        });
	}
}

module.exports.Get = Get;
