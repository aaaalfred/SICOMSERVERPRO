# SICOMSERVER

ejecutar 
	SICOM SERVER:

	Node v6.10.3
	Express 4.13.4

DATABASE: 
			 MySQL
			 FireBase

Run Server:

	terminal: 

			"node main.js" para levantarlo con node 

			"npm start" para levantarlo con forever, en caso de error se levanta de nuevo solo.

Logs: si se inicia con forever ejecutar en la terminal

		"forever list" esto para ver las instancias y ver el archivo .log

		"tail -f archivo.log" para leer los log

		"forever restart numero_de_instancia" para reiniciar el server.

		"forever stop numero_de_instancia" para reiniciar el server.

Estructura del proyecto:

 SICOMSERVER

 	main.js  ------- Arranque del projecto

 	src      ------- carpeta donde está toda logica del projecto.

 		api     ------- para desarrollo del proceso de las peticiones http

 			checkDuplicate.js  ------ para evitar la duplicidad de informacion en mysql

 			restGet.js         ------ contiene las peticiones get

 			restPost.js        ------ contiene las peticiones post

 			socketRealTime     ------ aqui tenemos el servidor socket para consultas real time con angular2

 			firebase           ------- tenemos la conexion a firebase, para las actividades. Esta clase 
 										se encarga de vigilar los cambios de firebase y hacer una copia a mysql

 		database   

 			sicom-firebase.json   ------   para la informacion de firebase, 

 		icon ------ capeta donde se guardan los iconos de sicom, tanto para modulos como para iconos 
 					generales de sicom

 		server

 			server.js  ----  en este archivo está la configuracion del servidor sicom, puerto,
 							 cabeceras para peticiones

 		test

 		util

 			configTablesClients.json   ----- configuracion de las tablas que se sincronizaran, 
 											nombre de las tablas para almacenamiento de informacion
 											y catalogos de informacion.

 			nombredemarca_modulos.json  ---- contiene toda la configuracion de una marca, tabs para
 											la aplicacion, modulos con sus campos a llenar, tipos de 
 											datos para capturar: numerico, foto, firma, decimal, etc.



	