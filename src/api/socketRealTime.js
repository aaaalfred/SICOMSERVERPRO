'use strict'

var express = require('express');
var app = express();
const restPost = require('./restPost.js');
var serverHttp = require('http').createServer(app);
var io = require('socket.io')(serverHttp);
// antes 8060
try {
	serverHttp.listen(8060, '0.0.0.0', () => {
		console.log('✅ SocketRealTime escuchando en puerto 8060 en TODAS LAS INTERFACES');
	});
} catch(error) {
	console.error(error);
}


var post = new restPost.Post();

class SocketRealTime {
	startSocket(){
		/*Sockets*/
		io.on('connection', function(client) {
		    console.log('Socket Client connected...', client.id);
		    client.on('message', function(ObjDatasLocation) {
		          let connection= null;
		          new Promise((resolve, reject) => {

		            let datasLocation = JSON.parse(ObjDatasLocation);
		            console.log("datasLocation:", datasLocation.cliente);

		            connection = post.connection(datasLocation.cliente);

		            connection.connect((err) => {
		              if (err) console.log(err);
		              connection.query("INSERT INTO locationsusers (id_usuario, created_at, lat, log) VALUES("
		                + datasLocation.id_usuario + ", '" + datasLocation.date + "', "+datasLocation.lat+", "+datasLocation.long+");",
		              (err, rows, fields) => {
		                if (err) reject(err);
		                resolve(rows);
		              });
		            });
		          })
		          .then((result) => {
		            let location = JSON.parse(ObjDatasLocation);
		            console.log("INSERT SOCKET:", ObjDatasLocation);
		            let clientOfSicom = 'client_location_sicom_' + location.cliente;
		            console.log ('socket: ', clientOfSicom);
		            client.emit(clientOfSicom, ObjDatasLocation);
		            client.broadcast.emit(clientOfSicom, ObjDatasLocation);

		            client.emit('messages', result);
		            client.broadcast.emit('messages',result);

		            connection.end();
		          })
		          .catch((err) => {
		            console.log("ERROR:",err);
		            client.emit('messages', "error");
		            client.broadcast.emit('messages',"err");
		            connection.end();
		          });
		    });
		});
	}
}

module.exports.SocketRealTime = SocketRealTime;
