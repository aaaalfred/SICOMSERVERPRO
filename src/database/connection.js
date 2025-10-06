const mysql = require('mysql');
var connection = null;
/*Esta conexion no se utiliza, la conexion se realiza en el api/restPost*/
module.exports = function myconnection (database){
	//console.log('Connected ', database);
	connection = mysql.createConnection({
	    host : '192.168.0.76',
	    user : 'mctree',
	    password : '12345',
	    database : database,
	    port : 3306
	});	

	return connection;
};
