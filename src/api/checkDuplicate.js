'use strict';

const mysql = require('mysql');
const bodyParser = require('body-parser');
const restPost = require('./restPost.js');

class CheckDuplicate {

	checkDuplicateToDB(data, connection, res, database) {
		var post = new restPost.Post();
		/*Variable para guardar las consultas de contadores del numero de registro dependiendo de la tabla*/
		let arrayDataQueryValidate = [];
		let Tables = JSON.parse(JSON.stringify(data[0]));
		let table;
		let indexTable = 0;
		/*Recorrer las todas las tablas para insertar*/
		for (table in Tables) {
			Tables[table].forEach((fields, i) => {
				if (fields.hasOwnProperty('fecha') && fields.hasOwnProperty('usuario_id')) {
					/*Entra a esta condicion si la tabla es un modulo, despues hacemos una consulta para asegurarnos
					   de que este registro aun no existe en la base de datos*/
					arrayDataQueryValidate.push({ 'table': table, 'indexTable': i, 'fecha': fields.fecha, 'fecha_f': null, 'query': 'SELECT count(id) as du FROM ' + table + ' WHERE fecha=\'' + fields.fecha + '\' AND usuario_id = ' + fields.usuario_id });
				} else if (fields.hasOwnProperty('fecha_i')) {
					/*Si la tabla tiene la columna fecha_i es porque es una actividad
					 y tenemos que obtener un contador de esa actividad para asegurarnos de que dicha actividad
					  no existe en la base de datos*/
					arrayDataQueryValidate.push({ 'table': table, 'indexTable': i, 'fecha': fields.fecha_i, 'fecha_f': fields.fecha_f, 'query': 'SELECT count(id) as du FROM ' + table + ' WHERE fecha_i= \'' + fields.fecha_i + '\' AND fecha_f = \'' + fields.fecha_f + '\'  AND usuario_id = ' + fields.usuario_id });
				}
			});
		}

		var result;

		arrayDataQueryValidate.reduce(
			function (sequence, value) {
				return sequence.then(function () {
					return promiseQueryCount(value);
				}).then(function (returns) {
					//si el registro ya existe se quita del arreglo, debe de ser igual a  0.
					if (parseInt(returns.response[0].du) > 0) {
						var table;
						var arrayf = [];
						for (table in Tables) {
							if (table == returns.table) {

								Tables[table].forEach((fields, i) => {
									if (fields.hasOwnProperty('fecha')) {
										if (fields.fecha != returns.fecha) {
											console.log('validado ', database, ' TABLE ', table);
											arrayf.push(fields);
										}
									} else if (fields.hasOwnProperty('fecha_i')) {
										if (fields.fecha_i != returns.fecha) {
											console.log('validado ', database, ' TABLE ', table);
											arrayf.push(fields);
										}
									}

								});
								Tables[table] = [];
								Tables[table] = arrayf;
							}
						}

					}

					return Promise.resolve();
				});
			},
			Promise.resolve()
		).then(function () {
			console.log('Fin de validaciones !! ');
			let arr = [];
			arr.push(Tables);
			//una vez asegurado que los registros aun no existe en la base de datos, en la funcion post guardamos los registros
			post.postDBTablesSync(arr, connection, res, database);
		});

		function promiseQueryCount(data) {
			return new Promise(function (fulfill, reject) {
				connection.query(data.query, (err, rows, fields) => {
					if (err) console.log(err);
					if (data.hasOwnProperty('fecha')) {
						fulfill({ response: JSON.parse(JSON.stringify(rows)), 'table': data.table, 'fecha': data.fecha, 'index': data.indexTable });
					} else if (data.hasOwnProperty('fecha_i')) {
						fulfill({ response: JSON.parse(JSON.stringify(rows)), 'table': data.table, 'fecha': data.fecha_i, 'index': data.indexTable });
					}

				});
			});
		}
	}

	checkDuplicateToDBS3(data, connection, res, database) {
		var post = new restPost.Post();
		let arrayDataQueryValidate = [];
		let Tables = JSON.parse(JSON.stringify(data[0]));
		let table;

		for (table in Tables) {
			Tables[table].forEach((fields, i) => {
				if (fields.hasOwnProperty("fecha") && fields.hasOwnProperty("usuario_id")) {
					arrayDataQueryValidate.push({
						table: table,
						indexTable: i,
						fecha: fields.fecha,
						fecha_f: null,
						query:
							"SELECT count(id) as du FROM " +
							table +
							" WHERE fecha='" +
							fields.fecha +
							"' AND usuario_id = " +
							fields.usuario_id,
					});
				} else if (fields.hasOwnProperty("fecha_i")) {
					arrayDataQueryValidate.push({
						table: table,
						indexTable: i,
						fecha: fields.fecha_i,
						fecha_f: fields.fecha_f,
						query:
							"SELECT count(id) as du FROM " +
							table +
							" WHERE fecha_i= '" +
							fields.fecha_i +
							"' AND fecha_f = '" +
							fields.fecha_f +
							"'  AND usuario_id = " +
							fields.usuario_id,
					});
				}
			});
		}

		arrayDataQueryValidate
			.reduce(function (sequence, value) {
				return sequence
					.then(function () {
						return promiseQueryCount(value);
					})
					.then(function (returns) {
						if (parseInt(returns.response[0].du) > 0) {
							let arrayf = [];
							for (let table in Tables) {
								if (table == returns.table) {
									Tables[table].forEach((fields) => {
										if (fields.hasOwnProperty("fecha")) {
											if (fields.fecha != returns.fecha) {
												console.log("validado ", database, " TABLE ", table);
												arrayf.push(fields);
											}
										} else if (fields.hasOwnProperty("fecha_i")) {
											if (fields.fecha_i != returns.fecha) {
												console.log("validado ", database, " TABLE ", table);
												arrayf.push(fields);
											}
										}
									});
									Tables[table] = arrayf;
								}
							}
						}
						return Promise.resolve();
					});
			}, Promise.resolve())
			.then(function () {
				console.log("Fin de validaciones !! ");
				let arr = [];
				arr.push(Tables);

				// Aquí llamar a la versión que sube a S3
				post.postDBTablesSyncS3(arr, connection, res, database);
			});

		function promiseQueryCount(data) {
			return new Promise(function (fulfill, reject) {
				connection.query(data.query, (err, rows, fields) => {
					if (err) console.log(err);
					if (data.hasOwnProperty("fecha")) {
						fulfill({
							response: JSON.parse(JSON.stringify(rows)),
							table: data.table,
							fecha: data.fecha,
							index: data.indexTable,
						});
					} else if (data.hasOwnProperty("fecha_i")) {
						fulfill({
							response: JSON.parse(JSON.stringify(rows)),
							table: data.table,
							fecha: data.fecha_i,
							index: data.indexTable,
						});
					}
				});
			});
		}
	}


}

module.exports.CheckDuplicate = CheckDuplicate;
