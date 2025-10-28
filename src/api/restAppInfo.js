'use strict';
 
const bodyParser = require('body-parser');


class AppInfo {

	saveID(req, connection, res){
		connection.query('INSERT INTO actividad VALUES (0, now(), "'+req.params.deviceid+'")', (err, rows, fields) => {
			connection.end();
			console.log("saveID complete");
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	saveTest(req, connection, res){
		connection.query('INSERT INTO control_casos VALUES (0, now(), "'+req.params.r1+'", "'+req.params.nombre+'", "'+req.params.cuenta+'", "'+req.params.puesto+'", "'+req.params.pdv+'", "'+req.params.casa+'", "'+req.params.contacto+'", "'+req.params.r2+'", "'+req.params.r3+'", "'+req.params.r4+'", "'+req.params.r5+'", "'+req.params.r6+'", "'+req.params.r7+'", "'+req.params.r8+'", "'+req.params.r9+'", "'+req.params.r10+'", "'+req.params.r11+'")', (err, rows, fields) => {
			connection.end();
			//console.log(err);
			console.log("saveTest complete");
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTemas(req, connection, res){
		connection.query('SELECT * FROM tema;', (err, rows, fields) => {
			var tema = "";
			var data = "";
			let jsonTemas=[];
			let jsonFotos=[];
			let dataArrayTemas = JSON.parse(JSON.stringify(rows));
			dataArrayTemas.forEach((e, i)=>{
				//console.log("Que es "+i+" o "+e.id);
				
				jsonTemas.push({recipeId:e.id, categoryId: e.categoria_id, title: e.title, tipo: e.tipo, photo_url: e.photo_url });
			});
			//console.log(jsonTemas.length);
			// for (var i = 1; i <= jsonTemas.length; i++) {
			// 	//jsonTemas[i]
			// 	console.log(i);
			// 	connection.query('SELECT url_foto FROM fotos_temas WHERE tema_id='+i, (err, urls, fields) => {
			// 		dataArrayTemas.forEach((e, i)=>{
				
			// 	jsonFotos.push({recipeId:e.id, categoryId: e.categoria_id, title: e.title, tipo: e.tipo, photo_url: e.photo_url, comida: e.tipo });
			// 	console.log(jsonFotos);
			// });
					
			// 	//res.json(JSON.parse(JSON.stringify(jsonFotos)));
			// 	});
			// }
//aqui va lo otro
			console.log("getTemas complete");
			res.json(JSON.parse(JSON.stringify(jsonTemas)));
			//res.json(JSON.parse(JSON.stringify(jsonTemas)));
		});	
	}

	getFotos(req, connection, res){
		connection.query('SELECT url_foto FROM fotos_temas WHERE tema_id='+req.params.idtema, (err, urls, fields) => {
			var tema = "";
					var urls_tema = "";
					for (var i = 0; i < urls.length; i++) {
						if (urls_tema == "") {
							urls_tema = '"'+urls[i].url_foto+'"';
						} else {
							urls_tema =urls_tema+', "'+urls[i].url_foto+'"';
						}
					}
					tema = tema +"["+urls_tema+"]";
					console.log(tema);
			connection.end();
			console.log("saveID complete");
			res.json(JSON.parse(tema));
		});
	}

	getCategorias(req, connection, res){
		connection.query('SELECT * FROM categorias;', (err, rows, fields) => {
			connection.end();
			console.log("getCategorias complete");
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTemasByCat(req, connection, res){
		connection.query('SELECT id AS recipeId, categoria_id AS categoryId, title, tipo, photo_url FROM tema WHERE categoria_id = '+req.params.categoria_id+';', (err, rows, fields) => {
			connection.end();
			console.log("getTemasByCat complete");
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTemasByTemaName(req, connection, res){
		connection.query('SELECT id AS recipeId, categoria_id AS categoryId, title, tipo, photo_url FROM tema WHERE title LIKE "%'+req.params.name+'%"', (err, rows, fields) => {
			connection.end();
			console.log("getTemasByTemaName complete");
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}

	getTemasByCategoryName(req, connection, res){
		connection.query('SELECT tema.id AS recipeId, categoria_id AS categoryId, title, tipo, tema.photo_url FROM tema INNER JOIN categorias ON tema.categoria_id = categorias.id WHERE categorias.name LIKE  "%'+req.params.name+'%"', (err, rows, fields) => {
			connection.end();
			console.log("getTemasByCategoryName complete");
			res.json(JSON.parse(JSON.stringify(rows)));
		});
	}
}

module.exports.AppInfo = AppInfo;